export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Never infer payment readiness from the mere existence of merchant secrets.
// An authenticated order/invoice service, verified webhooks, finance rules,
// refunds and compliance review must be completed before activation.
export async function GET() {
  return Response.json({
    ok:true,
    livePaymentsEnabled:false,
    depositCollectionEnabled:false,
    paymentRequestsEnabled:false,
    methods:[
      {id:"stripe",name:"Stripe · bank card",status:"pending_activation"},
      {id:"revolut",name:"Revolut · merchant payments",status:"pending_activation"},
    ],
    reason:"No verified buyer order and production payment capture workflow is enabled.",
    nextRequired:["merchant approval","production keys configured in provider-owned secret store","approved deposit and fee policy","verified buyer and invoice ownership","idempotent signed webhook reconciliation","refund and dispute policy","two-user payment test"],
  },{headers:{"Cache-Control":"no-store, max-age=0"}});
}