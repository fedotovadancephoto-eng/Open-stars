import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getValidStaffSession } from "@/admin/adminApi";
import { getValidParentSession } from "@/openStarsApi";
import { NEWS_KEY, NEWS_STORAGE, newsPath } from "@/admin/newsPhotosApi";
export function NewsPhotoGallery({paths,staff=false,title}:{paths:string[];staff?:boolean;title:string}){
 const [photos,setPhotos]=useState<string[]>([]);const [error,setError]=useState(false);const [selected,setSelected]=useState<number|null>(null);const [revision,setRevision]=useState(0);
 const key=JSON.stringify(paths||[]);
 useEffect(()=>{const controller=new AbortController();const urls:string[]=[];setPhotos([]);setError(false);setSelected(null);
 async function load(){try{const session=await (staff?getValidStaffSession():getValidParentSession());if(!session)throw Error();
 for(const path of JSON.parse(key) as string[]){const response=await fetch(`${NEWS_STORAGE}/object/authenticated/news-photos/${newsPath(path)}`,{headers:{apikey:NEWS_KEY,Authorization:`Bearer ${session.access_token}`},signal:controller.signal});if(!response.ok)throw Error();const blob=await response.blob();if(controller.signal.aborted)return;urls.push(URL.createObjectURL(blob));setPhotos([...urls]);}
 }catch{if(!controller.signal.aborted)setError(true);}}
 if(JSON.parse(key).length)void load();return()=>{controller.abort();urls.forEach(URL.revokeObjectURL);};},[key,staff,revision]);
 if(!paths?.length)return null;
 return <div className="mt-3"><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{photos.map((url,i)=><button type="button" key={url} onClick={()=>setSelected(i)} aria-label={`Открыть фото ${i+1}: ${title}`}><img src={url} alt={`${title} · фото ${i+1}`} className="h-36 w-full rounded-xl object-cover"/></button>)}</div>{error?<button type="button" onClick={()=>setRevision(v=>v+1)} className="mt-2 text-sm text-red-700">Фото не загрузились. Повторить</button>:photos.length<paths.length&&<p className="mt-2 text-xs text-black/40">Загружаем фотографии…</p>}{selected!=null&&photos[selected]&&<div role="dialog" aria-modal="true" aria-label="Фотография новости" className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/95 p-4" onClick={()=>setSelected(null)}><button type="button" autoFocus aria-label="Закрыть фотографию" onClick={()=>setSelected(null)} className="absolute right-4 top-4 rounded-full bg-white p-3"><X/></button><img src={photos[selected]} alt={`${title} · фото ${selected+1}`} className="max-h-[80vh] max-w-full object-contain"/><p className="mt-3 text-sm text-white">{selected+1} / {paths.length}</p></div>}</div>;
}
