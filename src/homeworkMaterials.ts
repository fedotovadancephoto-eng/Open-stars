export const MAX_HOMEWORK_MATERIALS = 10;
export const HOMEWORK_MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
};
export type HomeworkLink = { kind: 'link'; name: string; url: string };
export type HomeworkFile = { kind: 'image' | 'video'; name: string; path: string; mimeType: string; size: number };
export type HomeworkMaterial = HomeworkLink | HomeworkFile;

export function normalizeHomeworkUrl(value: string): string {
  const raw = value.trim();
  if (!raw || /[\s\\]/u.test(raw) || [...raw].some(char => char.charCodeAt(0) < 32)) throw new Error('Введите ссылку без пробелов.');
  let url: URL;
  try { url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`); }
  catch { throw new Error('Проверьте адрес ссылки.'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.href.length > 2048) {
    throw new Error('Используйте обычную ссылку http или https без логина и пароля.');
  }
  return url.href;
}

export function homeworkFileType(file: Pick<File, 'type' | 'name' | 'size'>) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const mimeType = file.type || (extension === 'jpeg' ? 'image/jpeg' : Object.entries(HOMEWORK_MIME_EXTENSIONS).find(([, ext]) => ext === extension)?.[0]) || '';
  const ext = HOMEWORK_MIME_EXTENSIONS[mimeType];
  if (!ext) throw new Error('Выберите фото JPG, PNG, WebP, GIF или видео MP4, MOV, WebM. Фото HEIC сохраните в JPG.');
  const kind = mimeType.startsWith('image/') ? 'image' : 'video';
  const limit = kind === 'image' ? 10 : 50;
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > limit * 1024 * 1024) throw new Error(`${kind === 'image' ? 'Фото' : 'Видео'} должно быть от 1 байта до ${limit} МБ. Большое видео можно добавить ссылкой.`);
  return { kind, mimeType, extension: ext } as const;
}

export function validateHomeworkMaterials(materials: HomeworkMaterial[]): HomeworkMaterial[] {
  if (materials.length > MAX_HOMEWORK_MATERIALS) throw new Error('Можно прикрепить до 10 материалов.');
  const seen = new Set<string>();
  return materials.map((material) => {
    let result: HomeworkMaterial;
    let identity: string;
    if (material.kind === 'link') {
      const url = normalizeHomeworkUrl(material.url);
      result = { kind: 'link', url, name: material.name.trim() || new URL(url).hostname };
      identity = `link:${url}`;
    } else {
      const fileType = homeworkFileType({ name: material.name, type: material.mimeType, size: material.size });
      if (fileType.kind !== material.kind || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|gif|mp4|mov|webm)$/.test(material.path)) {
        throw new Error('Файл не загружен. Прикрепите его повторно.');
      }
      result = { ...material, name: material.name.trim() };
      identity = `file:${material.path}`;
    }
    if (!result.name || result.name.length > 180) throw new Error('Название материала должно содержать от 1 до 180 символов.');
    if (seen.has(identity)) throw new Error('Один из материалов прикреплён дважды. Удалите повтор.');
    seen.add(identity);
    return result;
  });
}

export function readHomeworkMaterials(value: unknown): HomeworkMaterial[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_HOMEWORK_MATERIALS).flatMap((item) => {
    try { return validateHomeworkMaterials([item as HomeworkMaterial]); } catch { return []; }
  });
}
