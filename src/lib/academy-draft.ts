import type { AcademyDocument, AcademyDraft, AcademyOrigin } from './academy-storage-types.ts';
import { setAcademyCoverOwner } from './academy-cover-draft.ts';
import { parseAcademyManifest } from './academy-manifest.ts';

// Browser memory only. No storage, tokens, network requests or SSR writes.
let current: AcademyDraft | null = null;
let draftOwner: string | null = null;
export function setAcademyDraftOwner(owner: string | null): void {
  setAcademyCoverOwner(owner);
  if (owner !== draftOwner) { current = null; editorText = null; draftOwner = owner; }
}
let editorText: string | null = null;
export function readAcademyEditor(): string | null { return editorText; }
export function keepAcademyEditor(text: string): void { editorText = text; }
export function readAcademyDraft(): AcademyDraft | null { return current; }
export function keepAcademyDraft(draft: AcademyDraft | null): void { current = draft; if (!draft) editorText = null; }
export function importAcademyDraft(text: string, id: string, label: string): AcademyDraft {
  const manifest = parseAcademyManifest(text); // Validate before caller replaces anything.
  return { id, revision: 0, name: label.slice(0, 160), manifest, origin: { label: label.slice(0, 160) }, dirty: true };
}
export function editAcademyDraft(draft: AcademyDraft, text: string, name: string, origin: AcademyOrigin): AcademyDraft {
  return { ...draft, manifest: parseAcademyManifest(text), name, origin, dirty: true };
}
export function openAcademyDraft(document: AcademyDocument): AcademyDraft { return { ...document, dirty: false }; }
