let RECORDS = [];
let TRI = {};

let currentResults = [];
let selectedIndex = -1;

// Replace this with your working Experience URL template:
const EXPERIENCE_URL_TEMPLATE =
  "https://experience.arcgis.com/experience/989a505311c74cab96cad936553caa20/page/Eritrea#data_s=id%3AdataSource_2-195fafec267-layer-9%3A{oid}&zoom_to_selection=true";

function experienceUrlForOid(oid) {
  return EXPERIENCE_URL_TEMPLATE.replace("{oid}", String(oid));
}

function normalize(s) {
  return (s || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function trigrams(s) {
  s = normalize(s).replace(/[^a-z0-9 ]/g, "");
  s = `  ${s}  `;
  const set = new Set();
  for (let i = 0; i < s.length - 2; i++) set.add(s.slice(i, i + 3));
  return [...set];
}

// Simple edit-distance score (OK on reduced candidate set)
// 1.0 = perfect, 0.0 = terrible
function levenshteinScore(a, b) {
  a = normalize(a);
  b = normalize(b);
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
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + cost
      );
      prev = tmp;
    }
  }
  const dist = dp[n];
  const maxLen = Math.max(m, n);
  return 1 - (dist / maxLen);
}

/**
 * Highlight query characters as a subsequence inside text (best-effort).
 * Works well for typo scenarios like objct -> Object (highlights o b j c t).
 */
function highlightSubsequence(text, query) {
  const t = text || "";
  const q = normalize(query).replace(/[^a-z0-9 ]/g, "");
  if (!q) return escapeHtml(t);

  let qi = 0;
  const marks = new Array(t.length).fill(false);

  for (let i = 0; i < t.length && qi < q.length; i++) {
    const tc = t[i].toLowerCase();
    const qc = q[qi];

    // skip spaces in query matching
    if (qc === " ") {
      qi++;
      i--;
      continue;
    }

    if (/[a-z0-9]/.test(tc) && tc === qc) {
      marks[i] = true;
      qi++;
    }
  }

  let out = "";
  let inMark = false;
  for (let i = 0; i < t.length; i++) {
    const ch = escapeHtml(t[i]);
    if (marks[i] && !inMark) {
      out += "<mark>";
      inMark = true;
    } else if (!marks[i] && inMark) {
      out += "</mark>";
      inMark = false;
    }
    out += ch;
  }
  if (inMark) out += "</mark>";
  return out;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Formats context fields (Country, State, Region, District) into a single line.
 * Records are expected to contain: country/state/region/district (lowercase).
 * If your JSON uses different casing (e.g. Country), adapt here.
 */
function formatContext(r) {
  const parts = [];
  if (r.country) parts.push(r.country);
  if (r.state) parts.push(r.state);
  if (r.region) parts.push(r.region);
  if (r.district) parts.push(r.district);
  return parts.join(" • ");
}

function bestMatchInfo(q, rec) {
  let best = {
    score: levenshteinScore(q, rec.name),
    source: "name",
    matchedText: rec.name,
  };

  for (const alt of (rec.alt_names || [])) {
    const s = levenshteinScore(q, alt);
    if (s > best.score) {
      best = { score: s, source: "alt", matchedText: alt };
    }
  }

  // small boost if prefix matches the name (helps usability)
  const nq = normalize(q);
  const nname = normalize(rec.name);
  if (nname.startsWith(nq) && nq.length >= 3) best.score = Math.min(best.score + 0.08, 1);

  return best;
}

function getCandidates(q) {
  const tris = trigrams(q);
  const counts = new Map();

  for (const t of tris) {
    const ids = TRI[t];
    if (!ids) continue;
    for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 500) // tune if needed
    .map(([id]) => RECORDS[id]);
}

function search(q) {
  q = normalize(q);
  if (q.length < 2) return [];

  const candidates = getCandidates(q);

  return candidates
    .map(rec => {
      const info = bestMatchInfo(q, rec);
      return {
        ...rec,
        score: info.score,
        matchSource: info.source,       // "name" | "alt"
        matchedText: info.matchedText,  // specific alt_name or name
      };
    })
    .filter(x => x.score >= 0.65)       // tune threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

function setSelectedIndex(idx) {
  if (!currentResults.length) {
    selectedIndex = -1;
    return;
  }
  selectedIndex = Math.max(0, Math.min(idx, currentResults.length - 1));
  render(currentResults);
  scrollSelectedIntoView();
}

function scrollSelectedIntoView() {
  const el = document.querySelector(".item.selected");
  if (el) el.scrollIntoView({ block: "nearest" });
}

function openResult(r) {
  const url = experienceUrlForOid(r.oid);
  // _blank works reliably in Experience Builder embed/iframe
  window.open(url, "_blank", "noopener,noreferrer");
}

function render(results) {
  const el = document.getElementById("results");
  const qValue = document.getElementById("q").value;
  el.innerHTML = "";

  results.forEach((r, i) => {
    const div = document.createElement("div");
    div.className = "item" + (i === selectedIndex ? " selected" : "");
    div.tabIndex = 0;

    const matchLabel =
      r.matchSource === "alt"
        ? `<span class="badge">alt name</span>`
        : `<span class="badge">name</span>`;

    const matchedLine =
      r.matchSource === "alt"
        ? `<div class="meta">Matched alt: ${highlightSubsequence(r.matchedText, qValue)}</div>`
        : "";

    const ctx = formatContext(r);
    const ctxLine = ctx ? `<div class="meta">${escapeHtml(ctx)}</div>` : "";

    div.innerHTML = `
      <div style="flex:1; min-width:0">
        <div><b>${highlightSubsequence(r.name, qValue)}</b> ${matchLabel}</div>
        ${ctxLine}
        <div class="meta">OID: ${r.oid} • score: ${Math.round(r.score * 100)}</div>
        ${matchedLine}
      </div>
      <div>
        <button type="button">Open</button>
      </div>
    `;

    // Click Open button
    div.querySelector("button").addEventListener("click", (e) => {
      e.preventDefault();
      openResult(r);
    });

    // Hover selects (lightweight)
    div.addEventListener("mousemove", () => {
      if (selectedIndex !== i) {
        selectedIndex = i;
        render(currentResults);
      }
    });

    // Double-click row opens
    div.addEventListener("dblclick", () => openResult(r));

    el.appendChild(div);
  });
}

async function init() {
  [RECORDS, TRI] = await Promise.all([
    fetch("records.json").then(r => r.json()),
    fetch("trigram_index.json").then(r => r.json()),
  ]);

  const input = document.getElementById("q");

  input.addEventListener("input", () => {
    currentResults = search(input.value);
    selectedIndex = currentResults.length ? 0 : -1;
    render(currentResults);
  });

  input.addEventListener("keydown", (e) => {
    if (!currentResults.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(selectedIndex + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(selectedIndex - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = currentResults[selectedIndex];
      if (r) openResult(r);
    } else if (e.key === "Escape") {
      input.value = "";
      currentResults = [];
      selectedIndex = -1;
      render(currentResults);
    }
  });
}

init();
