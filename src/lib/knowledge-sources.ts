import type { AcademyManifest } from './academy-types.ts';
import type { AcademyOrigin } from './academy-storage-types.ts';
export interface KnowledgeSource {
  courseId: string; moduleId: string; lessonId: string; path: string; videoUrl: string | null;
  transcriptUrl: null; contentStatus: 'pending'; origin: AcademyOrigin; videoReason: string; contentReason: string; transcriptReason: string;
}
export function knowledgeSources(manifest: AcademyManifest, origin: AcademyOrigin): KnowledgeSource[] {
  return manifest.courses.flatMap(course => course.modules.flatMap(module => module.lessons.map(lesson => ({
    courseId: course.id, moduleId: module.id, lessonId: lesson.id, path: `${course.title} / ${module.title} / ${lesson.title}`,
    videoUrl: lesson.videoUrl ?? null, transcriptUrl: null, contentStatus: 'pending' as const, origin,
    videoReason: lesson.videoUrl ? 'Video reference registered; not downloaded or verified.' : 'Video reference pending; none was provided.',
    contentReason: 'Content pending; no lesson material has been ingested.',
    transcriptReason: 'Transcript not yet available; no transcript has been received.',
  }))));
}
