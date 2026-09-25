import type { AcademyManifest, AcademyInventory } from "./academy-types.ts";

export const MAX_MANIFEST_BYTES = 1024 * 1024;

export const ACADEMY_TEMPLATE: AcademyManifest = {
  version: 1,
  courses: [{ id: "course-01", title: "Replace with your course title", modules: [
    { id: "module-01", title: "Replace with your module title", lessons: [
      { id: "lesson-01", title: "Replace with your lesson title" },
    ] },
  ] }],
};

function object(value: unknown, path: string, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path} must be an object.`);
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some(key => !keys.includes(key))) throw new Error(`${path} contains an unsupported field. Use the template structure.`);
  return result;
}

function list(value: unknown, path: string, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) throw new Error(`${path} must be an array with at most ${maximum} items.`);
  return value;
}

function title(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 160) throw new Error(`${path} must contain between 1 and 160 characters.`);
  return value.trim();
}

function video(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("https://")) throw new Error(`${path} must be an HTTPS reference or omitted while pending.`);
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${path} must be a valid HTTPS reference.`); }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password) throw new Error(`${path} cannot contain credentials or a non-HTTPS protocol.`);
  // References remain text. Importing never fetches, embeds, or opens the URL.
  return url.href;
}

export function parseAcademyManifest(text: string): AcademyManifest {
  if (new TextEncoder().encode(text).length > MAX_MANIFEST_BYTES) throw new Error("The manifest exceeds 1 MiB. Split it into smaller inventories.");
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error("The file is not valid JSON. Download the template to see the expected format."); }
  const root = object(parsed, "Manifest", ["version", "courses"]);
  if (root.version !== 1 && root.version !== 2) throw new Error("Manifest version must be 1 or 2.");
  const ids = new Set<string>();
  let totalLessons = 0;
  function id(value: unknown, path: string): string {
    if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value)) throw new Error(`${path} must be an ID of 1–80 letters, numbers, underscores or hyphens.`);
    if (ids.has(value)) throw new Error(`${path} repeats an ID. Every course, module and lesson needs a unique ID.`);
    ids.add(value);
    return value;
  }
  return { version: root.version, courses: list(root.courses, "Courses", root.version === 2 ? 100 : 20).map((rawCourse, c) => {
    const path = `Course ${c + 1}`;
    const course = object(rawCourse, path, root.version === 2 ? ["id", "title", "modules", "description", "coverId"] : ["id", "title", "modules"]);
    if (course.description !== undefined && (typeof course.description !== 'string' || course.description.length > 500)) throw new Error(`${path} description must be text of at most 500 characters.`);
    if (course.coverId !== undefined && (typeof course.coverId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(course.coverId))) throw new Error(`${path} coverId must be an uploaded cover ID. Images, HTML and URLs do not belong in the manifest.`);
    return { id: id(course.id, `${path} ID`), title: title(course.title, `${path} title`), ...(course.description !== undefined ? { description: (course.description as string).trim() } : {}), ...(course.coverId ? { coverId: course.coverId as string } : {}), modules: list(course.modules, `${path} modules`, 100).map((rawModule, m) => {
      const modulePath = `${path}, module ${m + 1}`;
      const module = object(rawModule, modulePath, ["id", "title", "lessons"]);
      return { id: id(module.id, `${modulePath} ID`), title: title(module.title, `${modulePath} title`), lessons: list(module.lessons, `${modulePath} lessons`, 200).map((rawLesson, l) => {
        totalLessons += 1;
        if (totalLessons > 2000) throw new Error("An inventory can contain at most 2000 lessons.");
        const lessonPath = `${modulePath}, lesson ${l + 1}`;
        const lesson = object(rawLesson, lessonPath, ["id", "title", "videoUrl"]);
        const videoUrl = video(lesson.videoUrl, `${lessonPath} videoUrl`);
        return { id: id(lesson.id, `${lessonPath} ID`), title: title(lesson.title, `${lessonPath} title`), ...(videoUrl ? { videoUrl } : {}) };
      }) };
    }) };
  }) };
}

export function academyInventory(manifest: AcademyManifest | null): AcademyInventory {
  const result: AcademyInventory = { courses: 0, modules: 0, lessons: 0, videos: 0 };
  for (const course of manifest?.courses ?? []) {
    result.courses++;
    result.modules += course.modules.length;
    for (const module of course.modules) for (const lesson of module.lessons) {
      result.lessons++;
      if (lesson.videoUrl) result.videos++;
    }
  }
  return result;
}
