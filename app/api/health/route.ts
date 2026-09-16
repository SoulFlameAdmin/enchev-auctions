export const dynamic='force-dynamic';
export async function GET() {
  return Response.json({service:'enchev-auctions',status:'ok',scope:'web-only',auctionBackendReady:false,time:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
}
