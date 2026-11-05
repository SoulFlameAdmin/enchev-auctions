import {authConfig,json} from "../../../lib/enchev-auth-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;
export async function GET(){
  const config=authConfig();
  if(!config||new URL(config.url).hostname!=="ejfrnjhlggebzmpmxajl.supabase.co")
    return json({ok:false,available:false,lots:[],error:"Real vehicle catalogue is awaiting production identity configuration."},503);
  const params=new URLSearchParams({
    select:"id,lot_number,title,make,model,model_year,country_code,condition_summary,starting_price,price_currency,status,auction_starts_at,auction_ends_at",
    order:"created_at.desc",
    limit:"50"
  });
  try{
    const response=await fetch(config.url+"/rest/v1/enchev_market_lots?"+params.toString(),{
      headers:{apikey:config.anonKey,Authorization:"Bearer "+config.anonKey,Accept:"application/json"},
      cache:"no-store",signal:AbortSignal.timeout(10000),
    });
    const data=await response.json();
    if(!response.ok||!Array.isArray(data))throw Error("catalog-unavailable");
    return json({ok:true,available:true,lots:data});
  }catch{
    return json({ok:false,available:false,lots:[],error:"Verified catalogue is temporarily unavailable."},503);
  }
}
