import {authConfig,json} from "../../../../lib/enchev-auth-server";
import {UUID} from "../../../../lib/enchev-buyer-workspace-server";
import {publicLotImageUrl} from "../../../../lib/enchev-public-lot-media";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,context:Context){
 const {id}=await context.params;
 if(!UUID.test(id))return json({ok:false,error:"Invalid lot."},400);
 const config=authConfig();
 if(!config) // authConfig rejects wrong Supabase project for this deployment
    return json({ok:false,available:false,error:"Real catalogue is awaiting production activation."},503);
 const params=new URLSearchParams({
  select:"id,lot_number,title,make,model,model_year,vin,country_code,condition_summary,mileage_km,fuel_type,transmission,power_kw,body_type,image_path,starting_price,price_currency,status,auction_starts_at,auction_ends_at",published:"is.true",seller_verified_at:"not.is.null",approved_at:"not.is.null",
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
  const {image_path,...fields}=values[0] as Record<string,unknown>;
  return json({ok:true,lot:{...fields,image_url:publicLotImageUrl(config.url,image_path)}});
 }catch{return json({ok:false,error:"Unable to verify this lot."},503)}
}
