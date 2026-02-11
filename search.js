let RECORDS = [];
let TRI = {};

function normalize(s) {
  return (s || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function trigrams(s) {
  s = normalize(s).replace(/[^a-z0-9 ]/g, "");
  s = `  ${s}  `;
  const set = new Set();
  for (let i = 0; i < s.length - 2; i++) set.add(s.slice(i, i+3));
  return [...set];
}

// Simple edit-distance score (OK for candidate set sizes)
// 1.0 = perfect, 0.0 = terrible
function levenshteinScore(a, b) {
  a = normalize(a); b = normalize(b);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const m = a.length, n = b.length;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j-1] + 1,
        prev + cost
      );
      prev = tmp;
    }
  }
  const dist = dp[n];
  const maxLen = Math.max(m, n);
  return 1 - (dist / maxLen);
}

function bestFieldScore(q, rec) {
  let best = levenshteinScore(q, rec.name);
  for (const a of rec.alt_names || []) {
    best = Math.max(best, levenshteinScore(q, a));
  }
  // small boost if prefix matches
  const nq = normalize(q);
  const nname = normalize(rec.name);
  if (nname.startsWith(nq) && nq.length >= 3) best += 0.1;
  return Math.min(best, 1);
}

// Replace this with your generated Experience URL pattern from the Share widget
const EXPERIENCE_URL_TEMPLATE =
  "https://experience.arcgis.com/experience/989a505311c74cab96cad936553caa20/page/Eritrea#data_s=id%3AdataSource_2-195fafec267-layer-9%3A{oid}&zoom_to_selection=true";

function experienceUrlForOid(oid) {
  return EXPERIENCE_URL_TEMPLATE.replace("{oid}", String(oid));
}

function render(results) {
  const el = document.getElementById("results");
  el.innerHTML = "";
  for (const r of results) {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div style="flex:1">
        <div><b>${r.name}</b></div>
        <div class="meta">OID: ${r.oid} • score: ${Math.round(r.score*100)}</div>
      </div>
      <div>
        <a href="${experienceUrlForOid(r.oid)}" target="_blank" rel="noopener noreferrer">
          <button>Open</button>
        </a>
      </div>
    `;
    el.appendChild(div);
  }
}

function search(q) {
  q = normalize(q);
  if (q.length < 2) return [];

  // candidate retrieval via trigram overlap
  const tris = trigrams(q);
  const counts = new Map();

  for (const t of tris) {
    const ids = TRI[t];
    if (!ids) continue;
    for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
  }

  // take top candidates by trigram overlap
  const candidates = [...counts.entries()]
    .sort((a,b) => b[1] - a[1])
    .slice(0, 500) // tune: 200–1000
    .map(([id]) => RECORDS[id]);

  // score candidates
  const scored = candidates
    .map(rec => ({...rec, score: bestFieldScore(q, rec)}))
    .filter(x => x.score >= 0.65) // tune threshold
    .sort((a,b) => b.score - a.score)
    .slice(0, 20);

  return scored;
}

async function init() {
  [RECORDS, TRI] = await Promise.all([
    fetch("records.json").then(r => r.json()),
    fetch("trigram_index.json").then(r => r.json()),
  ]);

  const input = document.getElementById("q");
  input.addEventListener("input", () => {
    const res = search(input.value);
    render(res);
  });
}

init();
