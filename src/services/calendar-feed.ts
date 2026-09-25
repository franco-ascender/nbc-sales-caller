import 'server-only';
import type { Member } from '@/lib/member-types';
import { googleCalendarEntry, safeMeetingUrl } from '@/lib/calendar-feed';
import type { CalendarFeed, CalendarEntry, GoogleEvent } from '@/lib/calendar-feed';
import { readMemberWorkspace } from '@/services/member-workspace';
export async function readCalendarFeed(actor: Member): Promise<CalendarFeed> {
  const workspace=await readMemberWorkspace(actor,new Request('https://nbc.invalid/api/members'));
  const now=new Date();const events:CalendarEntry[]=workspace.events.map(e=>({id:`nbc:${e.id}`,title:e.title,starts_at:e.starts_at,ends_at:e.ends_at,join_url:safeMeetingUrl(e.join_url),all_day:false,source:'nbc' as const}));
  let externalStatus:CalendarFeed['externalStatus']='not_connected';
  const id=process.env.NBC_GOOGLE_CALENDAR_ID,client=process.env.GOOGLE_CALENDAR_CLIENT_ID,secret=process.env.GOOGLE_CALENDAR_CLIENT_SECRET,refresh=process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
  if(id&&client&&secret&&refresh){
    try{
      const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:client,client_secret:secret,refresh_token:refresh,grant_type:'refresh_token'}),signal:AbortSignal.timeout(12000),cache:'no-store'});
      const auth=await response.json() as {access_token?:string};if(!response.ok||!auth.access_token)throw new Error('Calendar access unavailable');
      const query=new URLSearchParams({timeMin:now.toISOString(),timeMax:new Date(now.getTime()+60*86400000).toISOString(),singleEvents:'true',orderBy:'startTime',maxResults:'250',fields:'items(id,summary,status,visibility,start,end,hangoutLink,conferenceData/entryPoints),timeZone,nextPageToken'});
      const result=await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events?${query}`,{headers:{Authorization:`Bearer ${auth.access_token}`},signal:AbortSignal.timeout(12000),cache:'no-store'});if(!result.ok)throw new Error('Calendar read unavailable');
      const body=await result.json() as {items?:GoogleEvent[]};for(const event of body.items??[]){const entry=googleCalendarEntry(event);if(entry)events.push(entry);}externalStatus='connected';
    }catch{externalStatus='unavailable';}
  }
  return {events:events.filter(e=>Date.parse(e.ends_at)>now.getTime()).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)).slice(0,250),timezone:workspace.onboarding?.timezone||'UTC',externalStatus,checkedAt:now.toISOString()};
}
