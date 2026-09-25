// Binary image state is separate from exportable metadata. Browser memory only.
export interface AcademyLocalCover { blob: Blob; url: string; uploadedId?: string }
let owner: string | null = null;
const covers = new Map<string, Record<string, AcademyLocalCover>>();
export function setAcademyCoverOwner(id: string | null): void {
  if (owner === id) return;
  for (const items of covers.values()) for (const item of Object.values(items)) URL.revokeObjectURL(item.url);
  covers.clear(); owner = id;
}
export function readAcademyCovers(draftId: string): Record<string, AcademyLocalCover> { return covers.get(draftId) ?? {}; }
export function keepAcademyCovers(draftId: string, next: Record<string, AcademyLocalCover>): void {
  const old = covers.get(draftId) ?? {};
  for (const [id, item] of Object.entries(old)) if (next[id]?.url !== item.url) URL.revokeObjectURL(item.url);
  covers.set(draftId, next);
}
