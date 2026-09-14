import { getValidStaffSession } from '@/admin/adminApi';
import { getValidParentSession } from '@/openStarsApi';
import { HomeworkFile, homeworkFileType } from '@/homeworkMaterials';

const BASE = 'https://yiwiykbuaggyslfyhlfo.supabase.co';
const STORAGE = `${BASE}/storage/v1`;
const KEY = 'sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7';
const BUCKET = 'homework-materials';
const encodedPath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

async function headers(staff: boolean) {
  const session = await (staff ? getValidStaffSession() : getValidParentSession());
  if (!session) throw new Error('Войдите в кабинет заново.');
  return { apikey: KEY, Authorization: `Bearer ${session.access_token}` };
}

export async function uploadHomeworkFile(file: File, signal: AbortSignal, onProgress: (percent: number) => void): Promise<HomeworkFile> {
  const { kind, mimeType, extension } = homeworkFileType(file);
  const authHeaders = await headers(true);
  const response = await fetch(`${BASE}/auth/v1/user`, { headers: authHeaders, signal });
  if (!response.ok) throw new Error('Не удалось проверить доступ. Войдите заново.');
  const user = await response.json() as { id: string };
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => { xhr.abort(); reject(new DOMException('Загрузка отменена', 'AbortError')); };
    if (signal.aborted) return abort();
    xhr.open('POST', `${STORAGE}/object/${BUCKET}/${encodedPath(path)}`);
    for (const [key, value] of Object.entries(authHeaders)) xhr.setRequestHeader(key, value);
    xhr.setRequestHeader('Content-Type', mimeType);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.timeout = 300_000;
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round(event.loaded * 100 / event.total)); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(xhr.status === 413
        ? 'Файл слишком большой для загрузки. Добавьте его ссылкой.'
        : 'Не удалось загрузить файл. Проверьте интернет и прикрепите его повторно.'));
    };
    xhr.onerror = xhr.ontimeout = () => reject(new Error('Загрузка прервалась. Проверьте интернет и прикрепите файл повторно.'));
    xhr.onabort = () => reject(new DOMException('Загрузка отменена', 'AbortError'));
    xhr.onloadend = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    xhr.send(file);
  });
  return { kind, path, mimeType, size: file.size, name: file.name.slice(0, 180) };
}

export async function homeworkFileUrl(path: string, staff: boolean, signal: AbortSignal): Promise<string> {
  const authHeaders = await headers(staff);
  const response = await fetch(`${STORAGE}/object/sign/${BUCKET}/${encodedPath(path)}`, {
    method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 3600 }), signal,
  });
  if (!response.ok) throw new Error('Материал не загрузился или больше недоступен.');
  const data = await response.json() as { signedURL?: string };
  if (!data.signedURL?.startsWith(`/object/sign/${BUCKET}/`)) throw new Error('Не удалось открыть материал.');
  return `${STORAGE}${data.signedURL}`;
}

export async function removeHomeworkDraftFile(path: string) {
  const authHeaders = await headers(true);
  await fetch(`${STORAGE}/object/${BUCKET}`, {
    method: 'DELETE', headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: [path] }),
  });
}
