import { createClient } from "@supabase/supabase-js";

import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";
const PHOTO_BUCKET = "child-photos";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 365 * 10;

export type PhotoStudent = {
  id: string;
  fullName: string;
  branch: string;
  groupName: string;
  photoUrl: string;
};

export type PhotoUploadContext = {
  role: string;
  canUpload: boolean;
  students: PhotoStudent[];
};

async function staffClient() {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника не найдена. Войдите в админ-панель снова.");

  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: { Authorization: `Bearer ${session.access_token}` },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function roleFromProfile(row: any) {
  const value = Array.isArray(row?.roles) ? row.roles[0]?.name : row?.roles?.name;
  return String(value ?? "");
}

export async function fetchPhotoUploadContext(): Promise<PhotoUploadContext> {
  const client = await staffClient();

  const { data: profiles, error: profileError } = await client
    .from("users_profile")
    .select("id,roles(name)")
    .limit(1);

  if (profileError) throw new Error("Не удалось проверить права на загрузку фото.");

  const role = roleFromProfile(profiles?.[0]);
  const canUpload = ["owner", "project_director", "manager", "admin"].includes(role);
  if (!canUpload) return { role, canUpload: false, students: [] };

  const { data: children, error: childrenError } = await client
    .from("children")
    .select("id,first_name,last_name,branch,group_name,photo_url")
    .is("archived_at", null)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (childrenError) throw new Error("Не удалось загрузить список детей для фотографий.");

  return {
    role,
    canUpload: true,
    students: (children ?? []).map((child: any) => ({
      id: child.id,
      fullName: [child.first_name, child.last_name].filter(Boolean).join(" "),
      branch: child.branch || "",
      groupName: child.group_name || "",
      photoUrl: child.photo_url || "",
    })),
  };
}

function extensionForMime(type: string) {
  const value = type.toLowerCase();
  if (value === "image/png") return "png";
  if (value === "image/webp") return "webp";
  if (value === "image/heic") return "heic";
  if (value === "image/heif") return "heif";
  return "jpg";
}

async function compressForProfile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Можно загрузить только фотографию.");
  }

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("decode_failed"));
      element.src = sourceUrl;
    });

    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;

    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob) return file;

    return new File([blob], "profile.jpg", { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    // Safari can decode HEIC selected from the iPhone library. If a browser cannot,
    // keep the original and let Storage validate the image MIME type.
    return file;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export async function uploadChildPhoto(childId: string, originalFile: File) {
  if (!childId) throw new Error("Выберите ребёнка.");

  const client = await staffClient();
  const file = await compressForProfile(originalFile);
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Фотография слишком большая. Максимальный размер — 10 МБ.");
  }

  const extension = extensionForMime(file.type);
  const path = `${childId}/profile-${Date.now()}.${extension}`;

  const { data: existing } = await client.storage.from(PHOTO_BUCKET).list(childId, {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" },
  });

  const { error: uploadError } = await client.storage.from(PHOTO_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type || "image/jpeg",
    upsert: false,
  });

  if (uploadError) {
    if (/mime|type/i.test(uploadError.message || "")) {
      throw new Error("Этот формат фотографии не поддерживается. Выберите JPG, PNG или WEBP.");
    }
    throw new Error(uploadError.message || "Не удалось загрузить фотографию.");
  }

  const { data: signed, error: signError } = await client.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);

  if (signError || !signed?.signedUrl) {
    await client.storage.from(PHOTO_BUCKET).remove([path]);
    throw new Error("Фото загрузилось, но не удалось создать ссылку для кабинета.");
  }

  const { error: updateError } = await client
    .from("children")
    .update({ photo_url: signed.signedUrl, photo_storage_path: path })
    .eq("id", childId);

  if (updateError) {
    await client.storage.from(PHOTO_BUCKET).remove([path]);
    throw new Error("Не удалось привязать фотографию к карточке ребёнка.");
  }

  const oldPaths = (existing ?? [])
    .map((item: any) => `${childId}/${item.name}`)
    .filter((oldPath: string) => oldPath !== path);
  if (oldPaths.length) {
    await client.storage.from(PHOTO_BUCKET).remove(oldPaths);
  }

  return signed.signedUrl;
}
