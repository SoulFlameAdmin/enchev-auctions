import { developmentStatus } from '../../../lib/development-status';
export const dynamic='force-dynamic';
export async function GET() {
  try {
    return Response.json(await developmentStatus(),{headers:{'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'}});
  } catch {
    return Response.json({error:'Статусът не може да бъде проверен. Опитайте отново.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
