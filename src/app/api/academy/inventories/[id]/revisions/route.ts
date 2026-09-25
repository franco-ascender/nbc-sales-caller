import { requireAcademyAdmin } from '@/services/academy-access';
import { academyApiError, academyResponse, listAcademyRevisions } from '@/services/academy.service';
import { academyId, academyInteger } from '@/lib/academy-validation';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const owner = await requireAcademyAdmin(request);
    return academyResponse(await listAcademyRevisions(owner, academyId((await context.params).id), academyInteger(new URL(request.url).searchParams.get('offset'), 0)));
  } catch (error) { return academyApiError(error); }
}
