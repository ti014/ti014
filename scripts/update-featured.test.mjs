import assert from "node:assert/strict";
import test from "node:test";
import { classifyRepo, groupRepos, renderProject } from "./update-featured.mjs";

test("topics take priority; names and descriptions provide a fallback", () => {
  for (const [repo, expected] of [
    [{ name: "camera-detection", topics: ["esp32", "platformio"] }, "IoT & Embedded"],
    [{ name: "esp32-demo", topics: ["developer-tools"] }, "Tools & Apps"],
    [{ name: "tool", topics: ["machine-learning"] }, "AI / ML"],
    [{ name: "timewo-macropad" }, "IoT & Embedded"],
    [{ name: "Session_Based_RS_Project" }, "AI / ML"],
    [{ name: "vfl-splitnn-bancassurance" }, "AI / ML"],
    [{ name: "OCRLabeler" }, "AI / ML"],
    [{ name: "semantic_surveillance" }, "AI / ML"],
    [{ name: "bank-churn-statistical-analysis" }, "AI / ML"],
    [{ name: "translate-vn-extension-releases" }, "Tools & Apps"],
    [{ name: "IDM-Activator-Tool" }, "Tools & Apps"],
    [{ name: "demo", description: "ESP32 firmware" }, "IoT & Embedded"],
    [{ name: "chair" }, "Other Projects"],
    [{ name: "latex-report-template", topics: [] }, "Other Projects"],
  ]) assert.equal(classifyRepo(repo), expected, repo.name);
});

const NOW = Date.parse("2026-10-19T00:00:00Z");
const sourceRepo = (name, extra = {}) => ({
  name, language: "Python", size: 10, pushed_at: "2026-10-01T00:00:00Z", ...extra,
});

test("category limits are independent and unknown projects stay out", () => {
  const repos = Array.from({ length: 6 }, (_, i) => ({
    ...sourceRepo(`ml-${i}`), pushed_at: `2026-10-0${i + 1}T00:00:00Z`,
  }));
  const groups = groupRepos([
    ...repos,
    ...Array.from({ length: 3 }, (_, i) => sourceRepo(`esp32-${i}`)),
    ...Array.from({ length: 3 }, (_, i) => sourceRepo(`tool-${i}`)),
    sourceRepo("unclassified"),
  ], NOW);
  assert.deepEqual(groups.map(([name]) => name), ["AI / ML", "Tools & Apps", "IoT & Embedded"]);
  assert.deepEqual(groups[0][1].map((repo) => repo.name), ["ml-5", "ml-4", "ml-3", "ml-2"]);
  assert.equal(groups[1][1].length, 2);
  assert.equal(groups[2][1].length, 2);
  assert.equal(repos.length, 6);
  assert.equal(repos[0].name, "ml-0");
  assert.deepEqual(groupRepos([], NOW), []);
  assert.deepEqual(groupRepos([sourceRepo("unclassified")], NOW), []);
});

test("exclude unsuitable repos even when their topic matches", () => {
  const rejected = [
    ...["fork", "archived", "private", "is_template"].map((flag) => sourceRepo("ml-hidden", { [flag]: true })),
    ...["ti014", "ti014.github.io", "ml-template", "MLTutorial", "ai-homework", "ai-exercise", "ai-HW1", "app-releases"].map((name) => sourceRepo(name, { topics: ["machine-learning"] })),
    sourceRepo("ml-empty", { size: 0 }),
    sourceRepo("ml-docs", { language: "TeX" }),
    sourceRepo("ml-binaries", { language: null }),
    sourceRepo("ml-old", { pushed_at: "2024-01-01T00:00:00Z", stargazers_count: 50 }),
    sourceRepo("ml-undated", { pushed_at: null }),
  ];
  assert.deepEqual(groupRepos(rejected, NOW), []);
});

test("clear descriptions and stars outrank a bare recent push", () => {
  const groups = groupRepos([
    sourceRepo("ml-recent", { pushed_at: "2026-10-18T00:00:00Z" }),
    sourceRepo("ml-described", { description: "Image classifier", pushed_at: "2025-01-01T00:00:00Z" }),
    sourceRepo("ml-starred", { stargazers_count: 2 }),
  ], NOW);
  assert.deepEqual(groups[0][1].map((repo) => repo.name), ["ml-described", "ml-starred", "ml-recent"]);
});

test("render a compact link, escape metadata and fall back to language", () => {
  assert.equal(renderProject(sourceRepo("esp32-board")), "- **[Esp32 Board](https://github.com/ti014/esp32-board)** — Python");
  const line = renderProject(sourceRepo("tool", { description: "<script>\n[link](https://example.com) *bold*" }));
  assert.ok(!line.includes("<script>"));
  assert.ok(!line.includes("\n"));
  assert.ok(line.includes("\\[link\\]"));
  assert.ok(line.includes("\\*bold\\*"));
  assert.ok(renderProject(sourceRepo("tool", { description: "word ".repeat(100) })).endsWith("..."));
});
