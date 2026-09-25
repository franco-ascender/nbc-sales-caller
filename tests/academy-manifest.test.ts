import assert from "node:assert/strict";
import test from "node:test";
import { ACADEMY_TEMPLATE, MAX_MANIFEST_BYTES, academyInventory, parseAcademyManifest } from "../src/lib/academy-manifest.ts";

test("academy accepts an ordered inventory with pending and referenced videos", () => {
  const input = structuredClone(ACADEMY_TEMPLATE);
  input.courses[0].modules[0].lessons.push({ id: "lesson-02", title: "  Sales practice  ", videoUrl: "https://video.example/lesson-02" });
  const parsed = parseAcademyManifest(JSON.stringify(input));
  assert.deepEqual(academyInventory(parsed), { courses: 1, modules: 1, lessons: 2, videos: 1 });
  assert.equal(parsed.courses[0].modules[0].lessons[1].title, "Sales practice");
  assert.equal(parsed.courses[0].modules[0].lessons[0].videoUrl, undefined);
  assert.deepEqual(academyInventory(null), { courses: 0, modules: 0, lessons: 0, videos: 0 });
});

test("academy rejects duplicate IDs across all hierarchy levels", () => {
  const input = structuredClone(ACADEMY_TEMPLATE);
  input.courses[0].modules[0].lessons[0].id = input.courses[0].id;
  assert.throws(() => parseAcademyManifest(JSON.stringify(input)), /repeats an ID/);
});

test("academy rejects untrusted executable references, credentials and unknown content", () => {
  for (const videoUrl of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "http://video.example/a", "https://user:password@video.example/a", "<iframe src='https://video.example'></iframe>", ""]) {
    const input = structuredClone(ACADEMY_TEMPLATE);
    input.courses[0].modules[0].lessons[0].videoUrl = videoUrl;
    assert.throws(() => parseAcademyManifest(JSON.stringify(input)));
  }
  assert.throws(() => parseAcademyManifest(JSON.stringify({ ...ACADEMY_TEMPLATE, apiKey: "do-not-import" })), /unsupported field/);
});

test("academy rejects malformed hierarchy, missing fields and unsupported versions", () => {
  for (const input of [null, [], { version: 3, courses: [] }, { version: 1 }, { version: 1, courses: [{ id: "c", title: "Course", modules: null }] }, { version: 1, courses: [{ id: "bad id", title: "Course", modules: [] }] }, { version: 1, courses: [{ id: "c", title: " ", modules: [] }] }]) {
    assert.throws(() => parseAcademyManifest(JSON.stringify(input)));
  }
  assert.throws(() => parseAcademyManifest("{broken"), /not valid JSON/);
});

test("academy enforces byte limits, hierarchy limits and total lessons", () => {
  assert.throws(() => parseAcademyManifest(" ".repeat(MAX_MANIFEST_BYTES + 1)), /exceeds 1 MiB/);
  assert.throws(() => parseAcademyManifest(JSON.stringify({ version: 1, courses: Array(21).fill({}) })), /at most 20/);
  const input = structuredClone(ACADEMY_TEMPLATE);
  input.courses[0].modules = Array.from({ length: 11 }, (_, m) => ({ id: `m${m}`, title: "Module", lessons: Array.from({ length: 200 }, (_, l) => ({ id: `m${m}-l${l}`, title: "Lesson" })) }));
  assert.throws(() => parseAcademyManifest(JSON.stringify(input)), /at most 2000 lessons/);
  input.courses[0].modules = [{ id: "m", title: "Module", lessons: Array.from({ length: 201 }, (_, i) => ({ id: `l${i}`, title: "Lesson" })) }];
  assert.throws(() => parseAcademyManifest(JSON.stringify(input)), /at most 200 items/);
});
