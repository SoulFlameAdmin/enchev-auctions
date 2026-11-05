import {NextRequest} from "next/server";
import {json,sameOriginPost} from "../../../lib/enchev-auth-server";
import {requireBuyer,buyerDataRequest,UUID,getBuyerApiStatus,buyerApiStatusMessage} from "../../../lib/enchev-buyer-workspace-server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

async function authorized(request:NextRequest){
 const identity=await requireBuyer(request);
 return identity;
}

export async function POST(request:NextRequest){
 if(!sameOriginPost(request))return json({ok:false,error:"Invalid request origin."},403);
 const auth=await authorized(request);
 if(auth.state!=="ready")return json({ok:false,error:buyerApiStatusMessage(auth.state)},getBuyerApiStatus(auth.state));
 if(!request.headers.get("content-type")?.startsWith("application/json") ||
   Number(request.headers.get("content-length")||0)>512)return json({ok:false,error:"Invalid input."},400);
 let body:unknown;
 try{const src=await request.text();if(src.length>512)throw Error();body=JSON.parse(src)}
 catch{return json({ok:false,error:"Invalid input."},400)}
 if(!body||typeof body!=="object"||!UUID.test((body as {lot_id?:string}).lot_id||""))return json({ok:false,error:"Invalid lot."},400);
 const lot_id=(body as {lot_id:string}).lot_id;
 const insert=await buyerDataRequest(auth.buyer,"/enchev_buyer_saved_lots?on_conflict=user_id,lot_id","POST",
  [{user_id:auth.buyer.user.id,lot_id}],{"Prefer":"resolution=ignore-duplicates,return=minimal"});
 if(insert.status!==201 && insert.status!==204)return json({ok:false,error:"Only verified published lots can be saved."},422);
 return json({ok:true,saved:true});
}

export async function DELETE(request:NextRequest){
 if(!sameOriginPost(request))return json({ok:false,error:"Invalid request origin."},403);
 const auth=await authorized(request);
 if(auth.state!=="ready")return json({ok:false,error:buyerApiStatusMessage(auth.state)},getBuyerApiStatus(auth.state));
 const lot_id=request.nextUrl.searchParams.get("lot_id")||"";
 if(!UUID.test(lot_id))return json({ok:false,error:"Invalid lot."},400);
 const deleted=await buyerDataRequest(auth.buyer,"/enchev_buyer_saved_lots?user_id=eq."+
  auth.buyer.user.id+"&lot_id=eq."+lot_id,"DELETE",undefined,{"Prefer":"return=minimal"});
 if(deleted.status!==204)return json({ok:false,error:"Could not update saved lots."},503);
 return json({ok:true,saved:false});
}
