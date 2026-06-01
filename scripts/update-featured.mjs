import { readFileSync, writeFileSync } from "node:fs";

const USER = "ti014";
const TOP_N = 8;
const README = "README.md";
const START = "<!-- FEATURED:START -->";
const END = "<!-- FEATURED:END -->";

const EXCLUDE = new Set([USER, `${USER}.github.io`]);

const EMOJI_RULES = [
  [/federat|split.?nn|vfl/i, "🤝"],
  [/adversarial|robust/i, "🛡"],
  [/surveil|video|camera|detect|yolo|fall/i, "📹"],
  [/tensorrt|onnx|optim|quant|inference/i, "⚡"],
  [/recommend|session.?based|rs[-_ ]/i, "🎯"],
  [/churn|statistical|analysis|eda/i, "📊"],
  [/ocr|label|annota/i, "🏷"],
  [/llm|rag|agent|chat|gpt/i, "🤖"],
  [/regress|classif|cluster|gauss|bayes/i, "📈"],
  [/nlp|text|bert|tokeni/i, "📝"],
  [/latex|report|paper|thesis/i, "📄"],
  [/web|vue|react|next|frontend/i, "🌐"],
  [/tool|util|cli|script/i, "🛠"],
];

const pickEmoji = (name, desc = "") => {
  const hay = `${name} ${desc}`;
  for (const [re, em] of EMOJI_RULES) if (re.test(hay)) return em;
  return "🧪";
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

const renderCell = (repo) => {
  const emoji = pickEmoji(repo.name, repo.description ?? "");
  const title = prettifyName(repo.name);
  const desc = repo.description?.trim();
  const lang = repo.language ? `<code>${repo.language}</code>` : "";
  const stars = repo.stargazers_count ? ` ⭐ ${repo.stargazers_count}` : "";
  const meta = (lang || stars) ? `<p>${lang}${stars}</p>` : "";
  const descBlock = desc ? `<p>${desc}</p>` : "";
  const badgeName = repo.name.replace(/-/g, "--").replace(/_/g, "__");
  return `    <td width="50%" valign="top">
      <h3>${emoji} ${title}</h3>
      ${descBlock}${meta}
      <a href="https://github.com/${USER}/${repo.name}"><img src="https://img.shields.io/badge/Repo-${badgeName}-05122A?style=flat&logo=github" /></a>
    </td>`;
};

const renderTable = (repos) => {
  const rows = [];
  for (let i = 0; i < repos.length; i += 2) {
    const a = renderCell(repos[i]);
    const b = repos[i + 1] ? renderCell(repos[i + 1]) : `    <td width="50%"></td>`;
    rows.push(`  <tr>\n${a}\n${b}\n  </tr>`);
  }
  return `<table>\n${rows.join("\n")}\n</table>`;
};

const main = async () => {
  const all = await fetchRepos();
  const picked = all
    .filter((r) => !r.fork && !r.archived && !r.private && !EXCLUDE.has(r.name))
    .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
    .slice(0, TOP_N);

  if (picked.length === 0) {
    console.error("No repos matched filters");
    process.exit(1);
  }

  const table = renderTable(picked);
  const readme = readFileSync(README, "utf8");
  const startIdx = readme.indexOf(START);
  const endIdx = readme.indexOf(END);
  if (startIdx === -1 || endIdx === -1) throw new Error("Markers not found in README");

  const before = readme.slice(0, startIdx + START.length);
  const after = readme.slice(endIdx);
  const next = `${before}\n${table}\n${after}`;

  if (next === readme) {
    console.log("No changes.");
    return;
  }
  writeFileSync(README, next);
  console.log(`Updated README with ${picked.length} repos.`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
