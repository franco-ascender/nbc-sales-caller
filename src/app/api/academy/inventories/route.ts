import { requireAcademyAdmin } from '@/services/academy-access';
import { academyApiError, academyResponse, listAcademyInventories } from '@/services/academy.service';
import { academyInteger } from '@/lib/academy-validation';
export async function GET(request: Request): Promise<Response> {
  try {
    const owner = await requireAcademyAdmin(request);
    return academyResponse(await listAcademyInventories(owner, academyInteger(new URL(request.url).searchParams.get('offset'), 0)));
  } catch (error) { return academyApiError(error); }
}
