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
    const brandPattern=/<div class="soulflame-masthead">[\\s\\S]*?<\\/div>\\s*<div class="cinema-brand">[\\s\\S]*?<\\/div>/;
    if(!brandPattern.test(html))throw Error("ORIGINAL_BRANDING_NOT_FOUND");
    html=html.replace(brandPattern,
      '<div class="ea-approved-cinema-brand" role="img" aria-label="E&A East West Auctioneers Group — SOULFLAME">'+
      '<img src="/brand/ea-approved-1to1.jpg" alt="E&A East West Auctioneers Group — SOULFLAME" width="1536" height="1087" />'+
      '</div>');
    // Load after the original styles so the logo owns the header on all devices.
    const brandCSS=`<style id="ea-cinema-approved-brand">
      .ea-approved-cinema-brand{
        position:absolute;z-index:9;top:8px;left:50%;
        transform:translateX(-50%);
        width:clamp(190px,23vw,300px);
        max-width:calc(100vw - 190px);
        display:flex;justify-content:center;align-items:flex-start;
        pointer-events:none;
      }
      .ea-approved-cinema-brand img{
        display:block;width:100%;height:auto;object-fit:contain;
        mix-blend-mode:screen;
      }
      .signup-count{top:clamp(142px,15vw,225px)!important;}
      @media(max-width:760px){
        .ea-approved-cinema-brand{
          top:max(7px,env(safe-area-inset-top));
          width:min(160px,46vw);
          max-width:none;
        }
        .signup-count{top:max(123px,calc(env(safe-area-inset-top) + 116px))!important;}
      }
      @media(max-width:410px){
        .ea-approved-cinema-brand{width:min(150px,44vw);}
        .signup-count{top:max(116px,calc(env(safe-area-inset-top) + 109px))!important;}
      }
      @media(max-height:580px) and (orientation:landscape){
        .ea-approved-cinema-brand{top:3px;width:120px;}
        .signup-count{top:88px!important;}
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
