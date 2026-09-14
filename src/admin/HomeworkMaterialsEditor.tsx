import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Link2, X } from 'lucide-react';
import { HomeworkMaterial, MAX_HOMEWORK_MATERIALS, homeworkFileType } from '@/homeworkMaterials';
import { removeHomeworkDraftFile, uploadHomeworkFile } from '@/homeworkMaterialsApi';

type Props = { value: HomeworkMaterial[]; onChange: (value: HomeworkMaterial[]) => void; disabled?: boolean; onBusyChange: (busy: boolean) => void };
export function HomeworkMaterialsEditor({ value, onChange, disabled = false, onBusyChange }: Props) {
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const uploaded = useRef(new Set<string>());
  useEffect(() => () => { controller.current?.abort(); onBusyChange(false); }, [onBusyChange]);
  const busy = Boolean(progress);
  async function chooseFiles(files: File[]) {
    if (!files.length || controller.current || disabled) return;
    setError('');
    try {
      if (value.length + files.length > MAX_HOMEWORK_MATERIALS) throw new Error('Можно прикрепить до 10 материалов.');
      files.forEach(homeworkFileType);
    } catch (err) { setError((err as Error).message); return; }
    const next = [...value];
    const active = new AbortController();
    controller.current = active;
    onBusyChange(true);
    try {
      for (const file of files) {
        setProgress(`${file.name}: 0%`);
        const material = await uploadHomeworkFile(file, active.signal, (percent) => setProgress(`${file.name}: ${percent}%`));
        if (active.signal.aborted) return;
        uploaded.current.add(material.path);
        next.push(material);
        onChange([...next]);
      }
    } catch (err) {
      if (!active.signal.aborted) setError(err instanceof Error ? err.message : 'Не удалось загрузить материал.');
    } finally {
      controller.current = null;
      if (!active.signal.aborted) { setProgress(''); onBusyChange(false); }
    }
  }
  function remove(index: number) {
    const item = value[index];
    onChange(value.filter((_, i) => i !== index));
    if (item.kind !== 'link' && uploaded.current.has(item.path)) {
      uploaded.current.delete(item.path);
      void removeHomeworkDraftFile(item.path).catch(() => undefined);
    }
  }
  const locked = disabled || busy;
  const field = 'mt-1 w-full min-w-0 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm';
  return <div className="mt-3 space-y-3">
    <p className="text-sm font-semibold">Материалы к заданию <span className="font-normal text-black/40">{value.length} / 10</span></p>
    {value.map((item, index) => <div key={item.kind === 'link' ? `link-${index}` : item.path} className="rounded-xl border border-black/10 p-3">
      <div className="flex items-start gap-2"><p className="min-w-0 flex-1 break-words text-xs font-semibold">{item.kind === 'link' ? 'Ссылка' : item.kind === 'image' ? 'Фото' : 'Видео'}{item.kind !== 'link' && ` · ${item.name}`}</p><button type="button" disabled={locked} onClick={() => remove(index)} aria-label={`Убрать материал ${index + 1}`} className="shrink-0 rounded-lg p-1 text-black/50 disabled:opacity-40"><X size={16}/></button></div>
      {item.kind === 'link' && <><label className="mt-2 block text-xs text-black/55">Адрес ссылки<input type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" value={item.url} disabled={locked} onChange={e => onChange(value.map((m, i) => i === index ? { ...item, url: e.target.value } : m))} placeholder="https://…" className={field}/></label><label className="mt-2 block text-xs text-black/55">Подпись — необязательно<input value={item.name} maxLength={180} disabled={locked} onChange={e => onChange(value.map((m, i) => i === index ? { ...item, name: e.target.value } : m))} placeholder="Например, видео с упражнением" className={field}/></label></>}
    </div>)}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={locked || value.length >= 10} onClick={() => onChange([...value, { kind: 'link', url: '', name: '' }])} className="flex items-center gap-2 rounded-xl bg-[#5F6338]/10 px-3 py-2.5 text-xs font-semibold text-[#4D512E] disabled:opacity-40"><Link2 size={16}/> Добавить ссылку</button>
      <button type="button" disabled={locked || value.length >= 10} onClick={() => input.current?.click()} className="flex items-center gap-2 rounded-xl bg-[#D96A24]/10 px-3 py-2.5 text-xs font-semibold text-[#C95320] disabled:opacity-40"><ImagePlus size={16}/> Фото или видео</button>
      <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,.jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm" disabled={locked} className="hidden" onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; void chooseFiles(files); }}/>
    </div>
    <p className="text-[11px] leading-5 text-black/40">Фото до 10 МБ, видео до 50 МБ. Большое видео можно прикрепить ссылкой.</p>
    {progress && <p role="status" className="break-words text-xs text-[#4D512E]">Загружаем {progress}. Дождитесь окончания загрузки.</p>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
  </div>;
}
