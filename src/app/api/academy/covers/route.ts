import { requireAcademyAdmin } from '@/services/academy-access';
import { academyApiError, academyResponse } from '@/services/academy.service';
import { readAcademyCoverBody } from '@/lib/academy-cover';
import { uploadAcademyCover } from '@/services/academy-covers';
export async function POST(request: Request): Promise<Response> {
  try {
    const owner = await requireAcademyAdmin(request);
    return academyResponse(await uploadAcademyCover(owner, await readAcademyCoverBody(request)), 201);
  } catch (error) { return academyApiError(error); }
}
