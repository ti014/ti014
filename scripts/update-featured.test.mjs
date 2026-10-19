import assert from "node:assert/strict";
import test from "node:test";
import { classifyRepo, groupRepos } from "./update-featured.mjs";

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

test("each category has its own four-repo limit, sorted by latest push", () => {
  const repos = Array.from({ length: 6 }, (_, i) => ({
    name: `ml-${i}`, pushed_at: `2026-10-0${i + 1}T00:00:00Z`,
  }));
  const groups = groupRepos([
    ...repos,
    { name: "esp32-board", pushed_at: "2025-01-01T00:00:00Z" },
    { name: "example-tool", pushed_at: "2025-01-01T00:00:00Z" },
    ...["fork", "archived", "private"].map((flag) => ({ name: "ml-hidden", [flag]: true })),
    { name: "ti014" }, { name: "ti014.github.io" },
  ]);
  assert.deepEqual(groups.map(([name]) => name), ["AI / ML", "Tools & Apps", "IoT & Embedded"]);
  assert.deepEqual(groups[0][1].map((repo) => repo.name), ["ml-5", "ml-4", "ml-3", "ml-2"]);
  assert.equal(groups[1][1][0].name, "example-tool");
  assert.equal(groups[2][1][0].name, "esp32-board");
  assert.equal(repos.length, 6);
  assert.equal(repos[0].name, "ml-0");
  assert.deepEqual(groupRepos([]), []);
  assert.deepEqual(groupRepos([{ name: "unclassified" }]).map(([name]) => name), ["Other Projects"]);
});
