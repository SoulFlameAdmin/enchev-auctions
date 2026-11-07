import {authConfig,json} from "../../../lib/enchev-auth-server";
import {publicLotImageUrl} from "../../../lib/enchev-public-lot-media";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;
export async function GET(){
  const config=authConfig();
  if(!config||false /* authConfig enforces strict Enchev environment isolation */)
    return json({ok:false,available:false,lots:[],error:"Real vehicle catalogue is awaiting production identity configuration."},503);
  const params=new URLSearchParams({
    select:"id,lot_number,title,make,model,model_year,country_code,condition_summary,mileage_km,fuel_type,transmission,power_kw,body_type,image_path,starting_price,price_currency,status,auction_starts_at,auction_ends_at",
    published:"is.true",seller_verified_at:"not.is.null",approved_at:"not.is.null",
    order:"created_at.desc",
    limit:"100"
  });
  try{
    const response=await fetch(config.url+"/rest/v1/enchev_market_lots?"+params.toString(),{
      headers:{apikey:config.anonKey,Authorization:"Bearer "+config.anonKey,Accept:"application/json"},
      cache:"no-store",signal:AbortSignal.timeout(10000),
    });
    const data=await response.json();
    if(!response.ok||!Array.isArray(data))throw Error("catalog-unavailable");
    const lots=data.map((raw:Record<string,unknown>)=>{
      const {image_path,...fields}=raw;
      return {...fields,image_url:publicLotImageUrl(config.url,image_path)};
    });
    return json({ok:true,available:true,lots,realMoneyEnabled:false});
  }catch{
    return json({ok:false,available:false,lots:[],error:"Verified catalogue is temporarily unavailable."},503);
  }
}
