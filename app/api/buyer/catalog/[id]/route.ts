import {authConfig,json} from "../../../../lib/enchev-auth-server";
import {UUID} from "../../../../lib/enchev-buyer-workspace-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,context:Context){
 const {id}=await context.params;
 if(!UUID.test(id))return json({ok:false,error:"Invalid lot."},400);
 const config=authConfig();
 if(!config||new URL(config.url).hostname!=="ejfrnjhlggebzmpmxajl.supabase.co")
    return json({ok:false,available:false,error:"Real catalogue is awaiting production activation."},503);
 const params=new URLSearchParams({
  select:"id,lot_number,title,make,model,model_year,vin,country_code,condition_summary,starting_price,price_currency,status,auction_starts_at,auction_ends_at",
  id:"eq."+id,limit:"1"
 });
 try{
  const r=await fetch(config.url+"/rest/v1/enchev_market_lots?"+params,{
    cache:"no-store",headers:{apikey:config.anonKey,Authorization:"Bearer "+config.anonKey},
    signal:AbortSignal.timeout(8000),
  });
  const values=await r.json();
  if(!r.ok||!Array.isArray(values))throw Error();
  if(values.length===0)return json({ok:false,error:"This lot is not published or not available."},404);
  return json({ok:true,lot:values[0] as Record<string,unknown>});
 }catch{return json({ok:false,error:"Unable to verify this lot."},503)}
}
