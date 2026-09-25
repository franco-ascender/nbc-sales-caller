import { requireAcademyAdmin } from '@/services/academy-access';
import { academyApiError } from '@/services/academy.service';
import { getAcademyCover } from '@/services/academy-covers';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const owner = await requireAcademyAdmin(request);
    const file = await getAcademyCover(owner, (await context.params).id);
    return new Response(file, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Content-Disposition': 'inline; filename="course-cover.jpg"' } });
  } catch (error) { return academyApiError(error); }
}
