import { getValidStaffSession } from "@/admin/adminApi";
export const NEWS_STORAGE="https://yiwiykbuaggyslfyhlfo.supabase.co/storage/v1";
export const NEWS_KEY="sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";
export const newsPath=(path:string)=>path.split("/").map(encodeURIComponent).join("/");
export async function uploadNewsPhoto(file:File):Promise<string>{
 if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Выберите фото JPG, PNG или WebP. Если фото в HEIC, сохраните его в JPG.");
 if(file.size>10*1024*1024)throw new Error("Каждая фотография должна быть не больше 10 МБ.");
 const session=await getValidStaffSession();if(!session)throw new Error("Войдите в кабинет сотрудника заново.");
 const headers={apikey:NEWS_KEY,Authorization:`Bearer ${session.access_token}`};
 const userResponse=await fetch("https://yiwiykbuaggyslfyhlfo.supabase.co/auth/v1/user",{headers});
 if(!userResponse.ok)throw new Error("Не удалось проверить доступ. Войдите заново.");
 const user=await userResponse.json();const extension=file.type==="image/jpeg"?"jpg":file.type==="image/png"?"png":"webp";
 const path=`${user.id}/${crypto.randomUUID()}.${extension}`;
 const response=await fetch(`${NEWS_STORAGE}/object/news-photos/${newsPath(path)}`,{method:"POST",headers:{...headers,"Content-Type":file.type,"x-upsert":"false"},body:file});
 if(!response.ok)throw new Error("Не удалось загрузить фотографию. Проверьте интернет и повторите.");
 return path;
}
export async function removeNewsDraftPhotos(paths:string[]){
 if(!paths.length)return;const session=await getValidStaffSession();if(!session)return;
 await fetch(`${NEWS_STORAGE}/object/news-photos`,{method:"DELETE",headers:{apikey:NEWS_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({prefixes:paths})});
}
