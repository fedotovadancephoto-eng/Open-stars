import { useEffect, useState } from 'react';
import { ExternalLink, Image, Play } from 'lucide-react';
import { HomeworkFile, HomeworkMaterial } from '@/homeworkMaterials';
import { homeworkFileUrl } from '@/homeworkMaterialsApi';

function FileMaterial({ material, staff }: { material: HomeworkFile; staff: boolean }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setUrl(''); setError('');
    void homeworkFileUrl(material.path, staff, controller.signal).then(value => {
      if (!controller.signal.aborted) setUrl(value);
    }).catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Не удалось открыть материал.'); });
    return () => controller.abort();
  }, [material.path, staff, open, revision]);
  return <div className="overflow-hidden rounded-xl border border-black/10 bg-white p-3">
    <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} className="flex w-full items-center gap-2 text-left text-sm font-medium text-[#4D512E]">{material.kind === 'image' ? <Image size={18} className="shrink-0"/> : <Play size={18} className="shrink-0"/>}<span className="min-w-0 flex-1 break-words">{material.name}</span><span className="shrink-0 text-xs">{open ? 'Свернуть' : 'Открыть'}</span></button>
    {open && <div className="mt-3">{error ? <div><p className="text-xs text-red-700">{error}</p><button type="button" onClick={() => setRevision(value => value + 1)} className="mt-2 rounded-lg bg-black/5 px-3 py-2 text-xs">Повторить загрузку</button></div> : url ? <>
      {material.kind === 'image' ? <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={material.name} className="max-h-96 w-full rounded-lg object-contain" onError={() => setError('Не удалось показать фото. Повторите загрузку.')}/></a> : <video src={url} controls playsInline preload="metadata" className="max-h-96 w-full rounded-lg bg-black" onError={() => setError('Не удалось воспроизвести видео. Можно открыть оригинал ниже или повторить загрузку.')}/>}
    </> : <p role="status" className="text-xs text-black/40">Загружаем материал…</p>}
    {url && <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-[#4D512E] underline">Открыть оригинал <ExternalLink size={12}/></a>}</div>}
  </div>;
}

export function HomeworkMaterials({ materials, staff = false }: { materials: HomeworkMaterial[]; staff?: boolean }) {
  if (!materials.length) return null;
  return <div className="mt-3 space-y-2"><p className="text-xs font-semibold text-black/50">Материалы к заданию</p>{materials.map((material, index) => material.kind === 'link'
    ? <a key={`link-${index}`} href={material.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-black/10 bg-white p-3 text-sm font-medium text-[#4D512E]"><ExternalLink size={17} className="shrink-0"/><span className="min-w-0 break-words">{material.name}</span></a>
    : <FileMaterial key={material.path} material={material} staff={staff}/>)}</div>;
}
