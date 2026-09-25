import type { AcademyManifest } from './academy-types.ts';

export interface AcademyOrigin { label: string; url?: string }
export interface AcademySave { expectedRevision: number; name: string; manifest: AcademyManifest; origin: AcademyOrigin }
export interface AcademySummary { id: string; name: string; revision: number; createdAt: string; updatedAt: string }
export interface AcademyDocument extends AcademySummary { manifest: AcademyManifest; origin: AcademyOrigin }
export interface AcademyPage { inventories: AcademySummary[]; nextOffset: number | null }
export interface AcademyRevision { revision: number; name: string; createdAt: string }
export interface AcademyRevisionPage { revisions: AcademyRevision[]; nextOffset: number | null }
export interface AcademyDraft { id: string; revision: number; name: string; manifest: AcademyManifest; origin: AcademyOrigin; dirty: boolean }
