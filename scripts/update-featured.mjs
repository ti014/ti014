import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const USER = "ti014";
const CATEGORY_LIMITS = new Map([["AI / ML", 4], ["Tools & Apps", 2], ["IoT & Embedded", 2]]);
const README = "README.md";
const START = "<!-- FEATURED:START -->";
const END = "<!-- FEATURED:END -->";

const EXCLUDE = new Set([USER, `${USER}.github.io`]);

const CATEGORY_RULES = [
  ["IoT & Embedded", /\b(?:iot|esp32(?:[-_ ]?[cs]\d)?|esp8266|arduino|platformio|embedded|firmware|microcontroller|macropad|raspberry[-_ ]?pi)\b/i],
  ["AI / ML", /\b(?:ai|ml|machine[-_ ]learning|deep[-_ ]learning|computer[-_ ]vision|data[-_ ]science|federat\w*|split[-_ ]?nn|vfl|adversarial|robust\w*|surveil\w*|detect\w*|yolo\w*|tensorrt|onnx|inference|recommend\w*|session[-_ ]based|rs|churn|statistical|analysis|eda|ocr\w*|llms?|rag|agents?|gpt\w*|regress\w*|classif\w*|cluster\w*|nlp|bert|huggingface|rul|cmapss|predict\w*)\b/i],
  ["Tools & Apps", /\b(?:developer[-_ ]tools|tools?|util\w*|cli|scripts?|extensions?|browsers?|apps?|bots?|web|vue|react|next|frontend|tkinter|linux|kindle)\b/i],
];

export const classifyRepo = (repo) => {
  const topics = (repo.topics ?? []).join(" ");
  const fromTopics = CATEGORY_RULES.find(([, rule]) => rule.test(topics));
  if (fromTopics) return fromTopics[0];
  // shortcut: names/descriptions are heuristic; add GitHub topics to correct ambiguous repos.
  const text = `${repo.name} ${repo.description ?? ""}`.replace(/_/g, " ");
  return CATEGORY_RULES.find(([, rule]) => rule.test(text))?.[0] ?? "Other Projects";
};

export const groupRepos = (repos, now = Date.now()) => {
  // Featured lists recent source projects; templates, exercises and release mirrors add noise.
  const cutoff = now - 730 * 24 * 60 * 60 * 1000;
  const eligible = repos
    .filter((r) => !r.fork && !r.archived && !r.private && !r.is_template && !EXCLUDE.has(r.name)
      && r.size > 0 && r.language && !["TeX", "Rich Text Format", "Markdown"].includes(r.language)
      && new Date(r.pushed_at).getTime() >= cutoff
      && !/template|tutorial|homework|exercise|(?:^|[-_])(?:hw\d*|releases?)(?:$|[-_])/i.test(r.name))
    .sort((a, b) => Number(Boolean(b.description?.trim())) - Number(Boolean(a.description?.trim()))
      || (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0)
      || new Date(b.pushed_at) - new Date(a.pushed_at)
      || a.name.localeCompare(b.name));
  const groups = new Map([...CATEGORY_LIMITS.keys()].map((category) => [category, []]));
  for (const repo of eligible) {
    const category = classifyRepo(repo);
    const group = groups.get(category);
    if (group && group.length < CATEGORY_LIMITS.get(category)) group.push(repo);
  }
  return [...groups].filter(([, repos]) => repos.length > 0);
};

const ACRONYMS = new Set([
  "vfl", "nn", "rs", "ocr", "idm", "ml", "ai", "nlp", "rag", "llm",
  "gpu", "api", "sql", "dl", "cv", "rl", "gan", "vae", "cnn", "rnn",
  "lstm", "bert", "gpt", "onnx", "tensorrt", "idm", "ui", "ux", "iot",
  "tts", "stt", "asr", "yolo", "vit", "mlp", "svm", "knn", "pca",
]);
const LOWERCASE = new Set([
  "of", "for", "and", "the", "to", "in", "on", "with", "a", "an",
  "at", "by", "from", "or", "as", "is",
]);

const prettifyName = (slug) => {
  const split = slug
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  const parts = split.replace(/\s+/g, " ").trim().split(" ");
  return parts
    .map((w, i) => {
      const lw = w.toLowerCase();
      if (ACRONYMS.has(lw)) return lw.toUpperCase();
      if (i !== 0 && LOWERCASE.has(lw)) return lw;
      return w[0].toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
};

const fetchRepos = async () => {
  const headers = { "User-Agent": "ti014-readme-bot", Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const url = `https://api.github.com/users/${USER}/repos?type=owner&sort=pushed&per_page=100`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  return res.json();
};

const escapeMarkdown = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/[\\`*_[\]{}]/g, "\\$&");

export const renderProject = (repo) => {
  let detail = (repo.description?.trim() || repo.language || "").replace(/\s+/g, " ");
  if (detail.length > 140) detail = `${detail.slice(0, 137).replace(/\s+\S*$/, "")}...`;
  return `- **[${escapeMarkdown(prettifyName(repo.name))}](https://github.com/${USER}/${encodeURIComponent(repo.name)})**${detail ? ` — ${escapeMarkdown(detail)}` : ""}`;
};

const main = async () => {
  const all = await fetchRepos();
  const groups = groupRepos(all);

  if (groups.length === 0) {
    console.error("No repos matched filters");
    process.exit(1);
  }

  const sections = groups.map(([category, repos]) => `### ${category}\n\n${repos.map(renderProject).join("\n")}`).join("\n\n");
  const readme = readFileSync(README, "utf8");
  const startIdx = readme.indexOf(START);
  const endIdx = readme.indexOf(END);
  if (startIdx === -1 || endIdx < startIdx) throw new Error("Invalid FEATURED markers in README");

  const before = readme.slice(0, startIdx + START.length);
  const after = readme.slice(endIdx);
  const next = `${before}\n${sections}\n${after}`;

  if (next === readme) {
    console.log("No changes.");
    return;
  }
  writeFileSync(README, next);
  console.log(`Updated README with ${groups.reduce((count, [, repos]) => count + repos.length, 0)} repos across ${groups.length} categories.`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
