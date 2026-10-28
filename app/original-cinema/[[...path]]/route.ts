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
    html=html.replace(brandPattern,
      '<header class="ea-approved-cinema-brand" aria-label="E&A East West Auctioneers Group — SOULFLAME">'+
      '<img src="/brand/ea-2026-horizontal.svg" alt="E&A · EAST WEST AUCTIONEERS GROUP · SOULFLAME" width="1280" height="175" />'+
      '</header>');
    // Horizontal mark lives in its own rail, instead of floating over film.
    const brandCSS=`<style id="ea-cinema-approved-brand">
      #cinema{--ea-bar-height:102px;}
      .ea-approved-cinema-brand{
        position:absolute;inset:0 0 auto 0;z-index:9;
        width:100%;height:var(--ea-bar-height);
        background:#030406;
        border-bottom:1px solid rgba(197,164,113,.22);
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 6px 20px rgba(0,0,0,.36);
        overflow:hidden;pointer-events:none;
      }
      .ea-approved-cinema-brand img{
        display:block;
        width:min(600px,calc(100vw - 420px));
        max-height:calc(var(--ea-bar-height) - 10px);
        height:auto;
        aspect-ratio:1280/175;
        object-fit:contain;
      }
      #advert-video{
        top:var(--ea-bar-height)!important;
        height:calc(100% - var(--ea-bar-height))!important;
      }
      #cinema-frames .cinema-frame{
        top:var(--ea-bar-height)!important;
      }
      .signup-count{top:calc(var(--ea-bar-height) + 10px)!important;}
      /* Parent X occupies top-right: use left-bottom sound button instead. */
      #cinema-sound{
        top:auto!important;bottom:max(22px,env(safe-area-inset-bottom))!important;
        left:6%!important;right:auto!important;
      }
      @media(max-width:760px){
        #cinema{--ea-bar-height:76px;}
        .ea-approved-cinema-brand img{
          width:min(490px,calc(100vw - 26px));
          max-height:calc(var(--ea-bar-height) - 8px);
        }
        .signup-count{top:calc(var(--ea-bar-height) + 9px)!important;}
        #cinema-sound{
          left:5%!important;right:auto!important;
          bottom:max(18px,env(safe-area-inset-bottom))!important;
          padding:10px 9px!important;font-size:9px!important;
        }
        #open-signup{right:5%!important;bottom:max(18px,env(safe-area-inset-bottom))!important;}
      }
      @media(max-width:380px){
        #cinema{--ea-bar-height:69px;}
        .ea-approved-cinema-brand img{
          width:calc(100vw - 20px);
          max-height:calc(var(--ea-bar-height) - 6px);
        }
        #cinema-sound{font-size:8px!important;padding:8px!important;}
        #open-signup{font-size:11px!important;padding:10px!important;}
      }
      @media(max-height:540px) and (orientation:landscape){
        #cinema{--ea-bar-height:62px;}
        .ea-approved-cinema-brand img{
          width:min(400px,calc(100vw - 300px));
          max-height:calc(var(--ea-bar-height) - 4px);
        }
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
