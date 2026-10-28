import { NextResponse } from "next/server";

export const dynamic="force-dynamic";
export const runtime="nodejs";
const origin="https://e-auctions-cinematic-demo.lit360.chatgpt.site";

type RouteProps={params:Promise<{path?:string[]}>};
async function upstream(path:string){
  const result=await fetch(origin+path,{
    cache:"no-store",redirect:"follow",signal:AbortSignal.timeout(12000)
  });
  if(!result.ok)throw Error("ORIGINAL_UNAVAILABLE");
  return await result.text();
}

export async function GET(_request:Request,{params}:RouteProps){
  const {path=[]}=await params;
  if(path.length===1&&path[0]==="cinema.js"){
    try{
      let js=await upstream("/cinema.js");
      // The original slideshow's absolute asset references must continue
      // to resolve to the Lit360 storyboard when served on Enchev.
      js=js.replaceAll('"/assets/','"'+origin+'/assets/')
        .replaceAll("'/assets/","'"+origin+"/assets/");
      return new NextResponse(js,{headers:{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"public, max-age=300"}});
    }catch{return new NextResponse("/* Cinema source temporarily unavailable */",{status:503});}
  }
  if(path.length===1&&path[0]==="signup.js"){
    try{
      let js=await upstream("/signup.js");
      // Reuse precisely the original Lit360 signup UI, while reading and
      // saving *real* E&A signups via the verified Supabase Edge Function.
      js=js.replaceAll("/api/registrations","/api/ea-early-access");
      js=js.replaceAll("data.error||","data.message||");
      return new NextResponse(js,{headers:{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"public, max-age=300"}});
    }catch{return new NextResponse("/* Signup source temporarily unavailable */",{status:503});}
  }
  if(path.length)return new NextResponse("Not found",{status:404});

  try{
    let html=await upstream("/");
    // Cloudflare injects a verification iframe into fetched HTML;
    // it is unrelated to the advertisement and must not be rehosted.
    const challenge=html.indexOf("<script>(function(){function c(){");
    if(challenge>=0)html=html.slice(0,challenge)+"</body>\n</html>";
    html=html.replaceAll('="/assets/','="'+origin+'/assets/');
    for(const file of ["styles.css","cinema.css","signup.css"]){
      html=html.replaceAll('href="/'+file+'"','href="'+origin+'/'+file+'"');
    }
    html=html.replaceAll('src="/cinema.js"','src="/original-cinema/cinema.js"');
    html=html.replaceAll('src="/signup.js"','src="/original-cinema/signup.js"');

    // One approved E&A brand mark replaces BOTH original masthead labels.
    // Do not alter the original Lit360 motion film, slides, sound or signup form.
    const brandPattern=/<div class="soulflame-masthead">[\s\S]*?<\/div>\s*<div class="cinema-brand">[\s\S]*?<\/div>/;
    if(!brandPattern.test(html))throw Error("ORIGINAL_BRANDING_NOT_FOUND");
    // Only center lettering, then SOULFLAME, then real signup count.
    // Reuse the existing counter ID, so original Supabase signup JS still works.
    const countPattern=/<div class="signup-count" aria-live="polite">[\s\S]*?<\/div>/;
    const counter=html.match(countPattern)?.[0];
    if(!counter)throw Error("SIGNUP_COUNTER_NOT_FOUND");
    html=html.replace(countPattern,"");
    html=html.replace(brandPattern,
      '<header class="ea-approved-cinema-brand" aria-label="EAST WEST AUCTIONEERS GROUP — SOULFLAME">'+
      '<div class="ea-brand-name">EAST WEST</div>'+
      '<div class="ea-brand-group">AUCTIONEERS GROUP</div>'+
      '<div class="ea-brand-soul">SOULFLAME</div>'+
      counter+
      '</header>');
    const brandCSS=`<style id="ea-cinema-approved-brand">
#cinema{--ea-bar-height:158px;}
.ea-approved-cinema-brand{
  position:absolute;inset:0 0 auto;z-index:9;width:100%;height:var(--ea-bar-height);
  box-sizing:border-box;background:#030406;padding:10px 80px;
  display:flex;flex-direction:column;justify-content:center;align-items:center;gap:5px;
  border-bottom:1px solid rgba(197,164,113,.28);text-align:center;
  pointer-events:none;overflow:hidden;
}
.ea-brand-name{
  color:#f4f4f6;font:800 clamp(24px,3.2vw,40px)/1.05 Manrope,Arial,sans-serif;
  letter-spacing:.23em;padding-left:.23em;white-space:nowrap;
}
.ea-brand-group{
  color:#dfb77d;font:700 clamp(10px,1.5vw,17px)/1.2 Manrope,Arial,sans-serif;
  letter-spacing:.25em;padding-left:.25em;white-space:nowrap;
}
.ea-brand-soul{
  color:#edf0f5;font:650 clamp(12px,1.45vw,16px)/1.2 Manrope,Arial,sans-serif;
  letter-spacing:.26em;padding-left:.26em;white-space:nowrap;
}
.ea-approved-cinema-brand .signup-count{
  position:static!important;inset:auto!important;transform:none!important;
  top:auto!important;left:auto!important;right:auto!important;
  margin:4px 0 0!important;padding:0!important;display:flex!important;
  justify-content:center;align-items:center;gap:8px;
  border:0!important;background:transparent!important;box-shadow:none!important;
  color:#c4c7ce;font:500 12px/1.3 Manrope,Arial,sans-serif;
  white-space:nowrap;text-shadow:none!important;
}
.ea-approved-cinema-brand .signup-count strong{
  color:#e9c18a;font-size:18px;font-variant-numeric:tabular-nums;
}
#advert-video{
  top:var(--ea-bar-height)!important;height:calc(100% - var(--ea-bar-height))!important;
}
#cinema-frames .cinema-frame{
  top:var(--ea-bar-height)!important;height:calc(100% - var(--ea-bar-height))!important;
}
#cinema-sound{
  top:auto!important;left:6%!important;right:auto!important;
  bottom:max(22px,env(safe-area-inset-bottom))!important;
}
@media(max-width:760px){
  #cinema{--ea-bar-height:128px;}
  .ea-approved-cinema-brand{padding:7px 16px;gap:3px;}
  .ea-brand-name{font-size:clamp(21px,5.5vw,29px);letter-spacing:.17em;padding-left:.17em;}
  .ea-brand-group{font-size:clamp(9px,2.3vw,12px);letter-spacing:.18em;padding-left:.18em;}
  .ea-brand-soul{font-size:11px;letter-spacing:.23em;padding-left:.23em;}
  .ea-approved-cinema-brand .signup-count{font-size:11px;margin-top:2px!important;}
  .ea-approved-cinema-brand .signup-count strong{font-size:16px;}
  #cinema-sound{left:5%!important;right:auto!important;bottom:max(18px,env(safe-area-inset-bottom))!important;padding:10px 9px!important;font-size:9px!important;}
  #open-signup{right:5%!important;bottom:max(18px,env(safe-area-inset-bottom))!important;}
}
@media(max-width:380px){
  #cinema{--ea-bar-height:120px;}
  .ea-brand-name{font-size:20px;}
  .ea-brand-group{font-size:9px;}
  #cinema-sound{font-size:8px!important;padding:8px!important;}
  #open-signup{font-size:11px!important;padding:10px!important;}
}
@media(max-height:540px) and (orientation:landscape){
  #cinema{--ea-bar-height:105px;}
  .ea-approved-cinema-brand{gap:2px;padding:4px 70px;}
  .ea-brand-name{font-size:20px;}
  .ea-brand-group{font-size:9px;}
  .ea-brand-soul{font-size:10px;}
}
</style>`;
    html=html.replace("</head>",brandCSS+"</head>");
    // Original structure, original video, original slides and CSS.
    // Only registration endpoints are mapped to Enchev's real database.
    return new NextResponse(html,{headers:{
      "Content-Type":"text/html; charset=utf-8",
      "Cache-Control":"no-store",
      "X-Content-Type-Options":"nosniff"
    }});
  }catch{
    return new NextResponse('<!doctype html><html lang="bg"><meta charset="utf-8"><title>E&A Cinema</title><body style="margin:0;background:#050608;color:#fff;font:16px Arial;display:grid;place-items:center;min-height:100dvh"><main style="text-align:center"><h1>SOULFLAME × E&A</h1><p>Рекламата временно не е достъпна.</p><a href="'+origin+'/" style="color:#e0b37e">Виж оригиналната реклама ↗</a></main></body></html>',{
      status:503,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}
    });
  }
}
