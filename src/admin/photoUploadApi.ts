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

export type PhotoCrop = {
  zoom: number;
  positionX: number;
  positionY: number;
};

async function staffClient() {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника не найдена. Войдите в админ-панель снова.");

  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function roleFromProfile(row: any) {
  const value = Array.isArray(row?.roles) ? row.roles[0]?.name : row?.roles?.name;
  return String(value ?? "");
}

export async function fetchPhotoUploadContext(): Promise<PhotoUploadContext> {
  const client = await staffClient();
  const { data: profiles, error: profileError } = await client.from("users_profile").select("id,roles(name)").limit(1);
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
  return "jpg";
}

async function decodeImage(file: File) {
  const sourceUrl = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("decode_failed"));
      image.src = sourceUrl;
    });
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(sourceUrl), 0);
  }
}

async function cropForProfile(file: File, crop: PhotoCrop): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Можно загрузить только фотографию.");

  let image: HTMLImageElement;
  try {
    image = await decodeImage(file);
  } catch {
    throw new Error("Не удалось открыть фото для кадрирования. Попробуйте JPG, PNG или WEBP.");
  }

  const targetWidth = 800;
  const targetHeight = 1000;
  const zoom = Math.min(3, Math.max(1, crop.zoom || 1));
  const positionX = Math.min(1, Math.max(0, crop.positionX ?? 0.5));
  const positionY = Math.min(1, Math.max(0, crop.positionY ?? 0.5));

  const baseScale = Math.max(targetWidth / image.naturalWidth, targetHeight / image.naturalHeight);
  const drawWidth = image.naturalWidth * baseScale * zoom;
  const drawHeight = image.naturalHeight * baseScale * zoom;
  const overflowX = Math.max(0, drawWidth - targetWidth);
  const overflowY = Math.max(0, drawHeight - targetHeight);
  const drawX = -overflowX * positionX;
  const drawY = -overflowY * positionY;

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Не удалось подготовить фотографию.");

  context.fillStyle = "#f5f3ec";
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) throw new Error("Не удалось сохранить выбранный кадр.");
  return new File([blob], "profile.jpg", { type: "image/jpeg", lastModified: Date.now() });
}

export async function fileFromExistingPhoto(url: string) {
  if (!url) throw new Error("У ребёнка пока нет загруженной фотографии.");
  const response = await fetch(url);
  if (!response.ok) throw new Error("Не удалось открыть текущее фото. Выберите его из галереи заново.");
  const blob = await response.blob();
  return new File([blob], "current-photo.jpg", { type: blob.type || "image/jpeg", lastModified: Date.now() });
}

export async function uploadChildPhoto(childId: string, originalFile: File, crop: PhotoCrop) {
  if (!childId) throw new Error("Выберите ребёнка.");

  const client = await staffClient();
  const file = await cropForProfile(originalFile, crop);
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Фотография слишком большая. Максимальный размер — 10 МБ.");

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
  if (uploadError) throw new Error(uploadError.message || "Не удалось загрузить фотографию.");

  const { data: signed, error: signError } = await client.storage.from(PHOTO_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
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

  const oldPaths = (existing ?? []).map((item: any) => `${childId}/${item.name}`).filter((oldPath: string) => oldPath !== path);
  if (oldPaths.length) await client.storage.from(PHOTO_BUCKET).remove(oldPaths);
  return signed.signedUrl;
}
