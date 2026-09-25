import { requireMember } from '@/services/member-workspace';
import { readCalendarFeed } from '@/services/calendar-feed';
import { MemberError } from '@/lib/member-validation';
export async function GET(request:Request):Promise<Response>{try{return Response.json(await readCalendarFeed(await requireMember(request)),{headers:{'Cache-Control':'private, no-store'}});}catch(error){return Response.json({error:'Your calendar could not be loaded. Please try again.'},{status:error instanceof MemberError?error.status:503,headers:{'Cache-Control':'no-store'}});}}
