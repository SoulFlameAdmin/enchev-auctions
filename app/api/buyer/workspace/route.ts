import {NextRequest} from "next/server";
import {json,sameOriginPost} from "../../../lib/enchev-auth-server";
import {
  requireBuyer,buyerDataRequest,getBuyerApiStatus,buyerApiStatusMessage,
  UUID,type BuyerIdentity,
} from "../../../lib/enchev-buyer-workspace-server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;
const disabledOrUnauthorized=(state:"disabled"|"unauthorized")=>
  json({ok:false,available:state!=="disabled",authenticated:false,error:buyerApiStatusMessage(state)},getBuyerApiStatus(state));

function readPath(table:string,select:string,filter?:string){
  const params=new URLSearchParams({select,limit:"100"});
  if(filter) {
    const [name,value]=filter.split(":",2);
    if(name&&value)params.set(name,value);
  }
  return "/"+table+"?"+params.toString();
}
async function read(buyer:BuyerIdentity,table:string,select:string,filter?:string) {
  return buyerDataRequest(buyer,readPath(table,select,filter));
}
export async function GET(request:NextRequest){
  const auth=await requireBuyer(request);
  if(auth.state!=="ready")return disabledOrUnauthorized(auth.state);
  const {buyer}=auth;
  const id=buyer.user.id;
  const calls=await Promise.all([
    read(buyer,"enchev_buyer_profiles","display_name,phone_e164,locale","id:eq."+id),
    read(buyer,"enchev_buyer_saved_lots","lot_id,created_at","user_id:eq."+id),
    read(buyer,"enchev_buyer_verifications","buyer_type,kyc_status,deposit_status,updated_at","user_id:eq."+id),
    read(buyer,"enchev_buyer_orders","id,lot_id,status,currency,total_amount,invoice_number,created_at","buyer_id:eq."+id),
    read(buyer,"enchev_buyer_payment_records","id,order_id,provider,amount,currency,status,created_at"),
    read(buyer,"enchev_buyer_documents","id,order_id,kind,label,status,issued_at,created_at"),
    read(buyer,"enchev_buyer_deliveries","id,order_id,status,destination_country,eta_at,delivered_at,updated_at"),
  ]);
  if(calls.some(x=>x.status!==200 || !Array.isArray(x.data)))return json({
    ok:false,error:"Secure workspace data is not available. No information was changed."
  },503);
  const [profiles,saved,verification,orders,payments,documents,deliveries]=calls.map(x=>x.data as Array<Record<string,unknown>>);
  const savedIds=saved.map(item=>item.lot_id).filter((value):value is string=>typeof value==="string" && UUID.test(value));
  const orderIds=orders.map(item=>item.lot_id).filter((value):value is string=>typeof value==="string" && UUID.test(value));
  const allLotIds=[...new Set([...savedIds,...orderIds])];
  let lots:Array<Record<string,unknown>>=[];
  if(allLotIds.length){
    const params=new URLSearchParams({
      select:"id,lot_number,title,make,model,model_year,status,starting_price,price_currency,auction_starts_at,auction_ends_at",
      id:"in.("+allLotIds.join(",")+")"
    });
    const result=await buyerDataRequest(buyer,"/enchev_market_lots?"+params);
    if(result.status!==200 || !Array.isArray(result.data))return json({ok:false,error:"Verified lot data unavailable."},503);
    lots=result.data as Array<Record<string,unknown>>;
  }
  return json({
    ok:true,available:true,authenticated:true,
    user:buyer.user,
    profile:profiles[0]??null,
    verification:verification[0]??null,
    savedLots:saved,
    lots,orders,payments,documents,deliveries,
    realMoneyEnabled:false,
    mode:"verified-account-readiness"
  });
}

export async function PATCH(request:NextRequest){
  if(!sameOriginPost(request))return json({ok:false,error:"Invalid request origin."},403);
  const auth=await requireBuyer(request);
  if(auth.state!=="ready")return disabledOrUnauthorized(auth.state);
  if(!request.headers.get("content-type")?.startsWith("application/json") ||
    Number(request.headers.get("content-length")||0)>2048)return json({ok:false,error:"Invalid input."},400);
  let raw:unknown;
  try{const source=await request.text();if(source.length>2048)throw Error();raw=JSON.parse(source)}
  catch{return json({ok:false,error:"Invalid JSON."},400)}
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return json({ok:false,error:"Invalid profile."},400);
  const fields=raw as Record<string,unknown>;
  if(Object.keys(fields).some(k=>!["display_name","phone_e164","locale"].includes(k)))return json({ok:false,error:"Unsupported profile field."},400);
  const update:Record<string,string|null>={};
  if("display_name" in fields){
    if(fields.display_name!==null && (typeof fields.display_name!=="string" || fields.display_name.trim().length>120 ||
      fields.display_name.trim().length<1))return json({ok:false,error:"Invalid display name."},400);
    update.display_name=fields.display_name===null?null:(fields.display_name as string).trim();
  }
  if("phone_e164" in fields){
    if(fields.phone_e164!==null && (typeof fields.phone_e164!=="string" ||
      !/^\+[1-9][0-9]{6,14}$/.test(fields.phone_e164)))return json({ok:false,error:"Phone must include + and country code."},400);
    update.phone_e164=fields.phone_e164 as string|null;
  }
  if("locale" in fields){
    if(!["bg","en"].includes(fields.locale as string))return json({ok:false,error:"Unsupported language."},400);
    update.locale=fields.locale;
  }
  if(Object.keys(update).length===0)return json({ok:false,error:"Nothing to update."},400);
  const path="/enchev_buyer_profiles?id=eq."+auth.buyer.user.id+"&select=display_name,phone_e164,locale";
  const result=await buyerDataRequest(auth.buyer,path,"PATCH",update,{"Prefer":"return=representation"});
  if(result.status!==200 || !Array.isArray(result.data) || result.data.length!==1)
    return json({ok:false,error:"Could not save the profile. Please try again."},503);
  return json({ok:true,profile:result.data[0] as Record<string,unknown>});
}
