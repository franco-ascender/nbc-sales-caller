import { requireAcademyAdmin } from '@/services/academy-access';
import { academyApiError, academyResponse, getAcademyInventory, saveAcademyInventory } from '@/services/academy.service';
import { academyId, academyInteger, readAcademyJson } from '@/lib/academy-validation';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const owner = await requireAcademyAdmin(request);
    const id = academyId((await context.params).id);
    const revision = new URL(request.url).searchParams.get('revision');
    return academyResponse({ inventory: await getAcademyInventory(owner, id, revision === null ? undefined : academyInteger(revision, 1, 1)) });
  } catch (error) { return academyApiError(error); }
}
export async function PUT(request: Request, context: Context): Promise<Response> {
  try {
    const owner = await requireAcademyAdmin(request);
    const id = academyId((await context.params).id);
    const inventory = await saveAcademyInventory(owner, id, await readAcademyJson(request));
    return academyResponse({ inventory }, inventory.revision === 1 ? 201 : 200);
  } catch (error) { return academyApiError(error); }
}
