import "server-only";

/** Public images only: canonical keys in the dedicated approved lot media bucket.
 * Uploads require service-role/staff privileges; no browser upload tokens. */
const BUCKET = "enchev-lot-public";
export function publicLotImageUrl(supabaseOrigin:string,key:unknown):string|null{
 if(typeof key!=="string"||key.length<5||key.length>360)return null;
 if(key.startsWith("/")||key.includes("//")||key.includes("..")||key.includes("\\")||key.includes("?")||key.includes("#"))return null;
 if(!/^[a-zA-Z0-9/_ .-]+\.(jpe?g|png|webp)$/i.test(key))return null;
 const parts=key.split("/");
 if(parts.some(part=>!part||part==="."||part===".."||part.startsWith(".")))return null;
 return supabaseOrigin+"/storage/v1/object/public/"+BUCKET+"/"+parts.map(encodeURIComponent).join("/");
}
