import type { AcademyManifest } from './academy-types.ts';
import { parseAcademyManifest } from './academy-manifest.ts';

// Transcribed from the four NBC Skool screenshots provided by Franco on 2026-09-15.
// Course titles/descriptions only: no inferred lessons, progress or membership rules.
const NBC_COURSES: readonly (readonly [string, string])[] = [
  ['Start Here!', ''],
  ['Mindset Mastery', 'Success Is 80% Psychology + Strategy & Tactics (Mechanics)'],
  ['ULTRA HIGH PERFORMANCE', ''],
  ['ADS + Funnels', 'Masterclass on running ads, vsl, pre-calls'],
  ['Client Service Delivery', 'How to get clients World class results'],
  ['TECH STACK', ''],
  ['NBC Setting & Outbound Mastery', 'Turn a stranger into a qualified lead and have them booked on the calendar'],
  ['NBC Sales Fast Track', 'Rapid Break-Down Of The NBC Sales Process In Under 4 Hours'],
  ['Stage 0 - NBC Fundamentals', ''],
  ['Stage 1 - AMP', ''],
  ['Stage 2 - GITS', ''],
  ['Stage 3 - Fact-Finding', ''],
  ['Stage 4 Dreams & Aspirations', ''],
  ['Stage 5 - The Bullet-Proof Presentation', ''],
  ['Stage 6 - Closing', ''],
  ['Stage 7 - Advanced Objection Handling', ''],
  ['Stage 8 - Follow Up', ''],
  ['TUNE UP', 'Come back anytime for a TUNEUP'],
  ['NBC Consequence Training', ''],
  ['LIVE NBC SALES CALLS', ''],
  ['Team Hiring', 'How to Hire'],
  ['What is Inner Circle?', ''],
];
export function nbcProgramOutline(): AcademyManifest {
  return { version: 2, courses: NBC_COURSES.map(([title, description], i) => ({ id: `nbc-course-${i + 1}`, title, ...(description ? { description } : {}), modules: [] })) };
}
export function changeCourseDetails(manifest: AcademyManifest, id: string, values: { title: string; description: string; coverId?: string }): AcademyManifest {
  const next = structuredClone(manifest);
  const course = next.courses.find(item => item.id === id);
  if (!course) throw new Error('Choose a course first.');
  course.title = values.title;
  if (values.description || course.description !== undefined || values.coverId) next.version = 2;
  if (next.version === 2) course.description = values.description;
  if (values.coverId) course.coverId = values.coverId; else delete course.coverId;
  return parseAcademyManifest(JSON.stringify(next));
}
export function changeProgramOrder(manifest: AcademyManifest, target: { courseId: string; moduleId?: string; lessonId?: string }, action: 'up' | 'down' | 'remove'): AcademyManifest {
  const next = structuredClone(manifest);
  const course = next.courses.find(item => item.id === target.courseId);
  if (!course) throw new Error('Course no longer exists.');
  const module = target.moduleId ? course.modules.find(item => item.id === target.moduleId) : undefined;
  if (target.moduleId && !module) throw new Error('Module no longer exists.');
  const items = target.lessonId ? module!.lessons : target.moduleId ? course.modules : next.courses;
  const id = target.lessonId ?? target.moduleId ?? target.courseId;
  const index = items.findIndex(item => item.id === id);
  if (index < 0) throw new Error('This item no longer exists.');
  if (action === 'remove') items.splice(index, 1);
  else { const to = index + (action === 'up' ? -1 : 1); if (to >= 0 && to < items.length) [items[index], items[to]] = [items[to], items[index]]; }
  return parseAcademyManifest(JSON.stringify(next));
}
