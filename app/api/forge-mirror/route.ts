export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE_ORIGIN = "https://forgeautomotive.co.uk";
const SOURCE_URL = SOURCE_ORIGIN + "/";

function injectMirror(html:string){
  const bridge = `
<base href="${SOURCE_ORIGIN}/">
<style>html,body{margin:0!important;background:#000!important}</style>
<script>
(function(){
  const SOURCE_ORIGIN="${SOURCE_ORIGIN}";
  document.addEventListener("click",function(event){
    const a=event.target&&event.target.closest?event.target.closest("a[href]"):null;
    if(!a)return;
    try{
      const u=new URL(a.getAttribute("href"),document.baseURI);
      if(u.origin===SOURCE_ORIGIN){
        event.preventDefault();
        location.href=u.href;
      }
    }catch{}
  },true);
})();
</script>`;

  if(/<head[^>]*>/i.test(html)){
    return html.replace(/<head([^>]*)>/i, "<head$1>"+bridge);
  }
  return bridge+html;
}

export async function GET(){
  const upstream=await fetch(SOURCE_URL,{
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
