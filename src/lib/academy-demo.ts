import type { AcademyManifest } from './academy-types.ts';

// Original illustrative curriculum. Not Anas's program, recordings or methodology.
const catalog = [
  { title: 'The sales foundations', subtitle: 'Build your practice on a stronger foundation.', chapters: [
    ['A considered approach', 'Start with the customer', 'Define a useful outcome', 'Prepare for the conversation'],
    ['Your daily practice', 'Build a repeatable routine', 'Review what you learned', 'Put the fundamentals to work'],
  ] },
  { title: 'The art of discovery', subtitle: 'Ask with intention. Listen with attention.', chapters: [
    ['Understand the situation', 'Open the conversation', 'Ask a better question', 'Listen beyond the first answer'],
    ['Find the real priority', 'Explore the impact', 'Clarify the decision', 'Reflect what you heard'],
  ] },
  { title: 'Conversations that move forward', subtitle: 'Make space for questions and uncertainty.', chapters: [
    ['Understand the hesitation', 'Invite the concern', 'Separate questions from assumptions', 'Respond with clarity'],
    ['Keep the conversation open', 'Check for understanding', 'Work through a practice scenario', 'Agree on the next step'],
  ] },
  { title: 'From conversation to commitment', subtitle: 'Turn a shared understanding into a clear next step.', chapters: [
    ['Build a shared plan', 'Recap the priorities', 'Present a relevant proposal', 'Make the next step specific'],
    ['Follow through', 'Write a useful recap', 'Confirm responsibilities', 'Review and improve'],
  ] },
];
export const ACADEMY_DEMO: AcademyManifest = { version: 1, courses: catalog.map((course, c) => ({ id: `demo-course-${c}`, title: course.title, modules: course.chapters.map((chapter, m) => ({ id: `demo-module-${c}-${m}`, title: chapter[0], lessons: chapter.slice(1).map((title, l) => ({ id: `demo-lesson-${c}-${m}-${l}`, title })) })) })) };
export const ACADEMY_DEMO_DESCRIPTIONS: Record<string, string> = Object.fromEntries(catalog.map((course, c) => [`demo-course-${c}`, course.subtitle]));
export function demoTranscript(title: string): string {
  return `NBC ACADEMY — DEMONSTRATION MATERIAL\n${title}\n\nThis is original sample text for reviewing the learning experience. It is not a transcript of a real video or material attributed to Anas.\n\n00:00 — Begin with one question you want this practice session to answer. Write it down before the conversation.\n\n00:12 — Listen for the other person's priorities. Use your notes to separate what you heard from what you assumed.\n\n00:24 — At the end, summarize what you learned and choose one thing to practice next.\n`;
}
export function demoCaptions(): string {
  return 'WEBVTT\n\nNOTE Demonstration captions only. Not linked to a real video.\n\n00:00:00.000 --> 00:00:12.000\nBegin with one question you want this practice session to answer.\n\n00:00:12.000 --> 00:00:24.000\nSeparate what you heard from what you assumed.\n\n00:00:24.000 --> 00:00:36.000\nChoose one thing to practice next.\n';
}
export function demoWorksheet(title: string): string {
  return `NBC ACADEMY — DEMO PRACTICE SHEET\nLesson: ${title}\nOriginal illustrative resource. Not Anas's course material.\n\n1. What do you want to practice?\n\n2. What did you hear? What did you assume?\n\n3. What would you ask differently next time?\n\n4. Write one specific next step.\n`;
}
