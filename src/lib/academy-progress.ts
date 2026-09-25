import type { AcademyCourse } from './academy-types.ts';

/** Completion only reflects explicit actions against known lesson IDs. */
export function academyCourseProgress(course: AcademyCourse, completed: ReadonlySet<string>): { done: number; total: number; percent: number; nextLessonId: string | null } {
  const lessons = course.modules.flatMap(module => module.lessons);
  const done = lessons.filter(lesson => completed.has(lesson.id)).length;
  return { done, total: lessons.length, percent: lessons.length ? Math.round(done / lessons.length * 100) : 0, nextLessonId: lessons.find(lesson => !completed.has(lesson.id))?.id ?? lessons[0]?.id ?? null };
}
