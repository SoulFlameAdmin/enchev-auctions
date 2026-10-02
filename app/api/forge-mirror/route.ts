import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE_ORIGIN = "https://forgeautomotive.co.uk";

function normalizePath(raw:string|null){
  if(!raw)return "/";
  try{
    const decoded=decodeURIComponent(raw);
    if(!decoded.startsWith("/"))return "/";
    if(decoded.startsWith("//"))return "/";
    return decoded;
  }catch{
    return "/";
  }
}

function injectMirror(html:string){
  const bridge = `
<base href="${SOURCE_ORIGIN}/">
<style>
html,body{margin:0!important;background:#000!important}
</style>
<script>
(function(){
  const SOURCE_ORIGIN="${SOURCE_ORIGIN}";
  const toMirror=(href)=>{
    try{
      const u=new URL(href,document.baseURI);
      if(u.origin!==SOURCE_ORIGIN)return null;
      return "/api/forge-mirror?path="+encodeURIComponent(u.pathname+u.search+u.hash);
    }catch{return null}
  };
  document.addEventListener("click",function(event){
    const a=event.target&&event.target.closest?event.target.closest("a[href]"):null;
    if(!a)return;
    const mirror=toMirror(a.getAttribute("href"));
    if(!mirror)return;
    event.preventDefault();
    event.stopPropagation();
    location.href=mirror;
  },true);
  window.addEventListener("popstate",()=>{});
})();
</script>`;

  if(/<head[^>]*>/i.test(html)){
    return html.replace(/<head([^>]*)>/i, "<head$1>"+bridge);
  }
  return bridge+html;
}

export async function GET(request:NextRequest){
  const path=normalizePath(request.nextUrl.searchParams.get("path"));
  const url=new URL(path,SOURCE_ORIGIN);

  if(url.origin!==SOURCE_ORIGIN){
    return new Response("Invalid mirror path",{status:400});
  }

  const upstream=await fetch(url,{
    cache:"no-store",
    redirect:"follow",
    headers:{
      "User-Agent":"ENCHEV-Authorized-Design-Mirror/1.0",
      "Accept":"text/html,application/xhtml+xml"
    }
  });

  if(!upstream.ok){
    return new Response(`Mirror upstream failed: ${upstream.status}`,{status:502});
  }

  const contentType=upstream.headers.get("content-type")||"";
  if(!contentType.includes("text/html")){
    return new Response(await upstream.arrayBuffer(),{
      status:200,
      headers:{
        "Content-Type":contentType||"application/octet-stream",
        "Cache-Control":"public, max-age=3600, s-maxage=86400"
      }
    });
  }

  const html=injectMirror(await upstream.text());
  return new Response(html,{
    status:200,
    headers:{
      "Content-Type":"text/html; charset=utf-8",
      "Cache-Control":"no-store",
      "X-Robots-Tag":"noindex, nofollow",
      "X-Content-Type-Options":"nosniff"
    }
  });
}
