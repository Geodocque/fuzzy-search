# Fuzzy Search

A lightweight, client-side fuzzy search tool for geographic place names, designed to be embedded in an ArcGIS Experience Builder application. It supports typos, partial matches, and alternative name lookups.

---

## How It Works

The search uses a **two-stage pipeline** to efficiently find the best matching records:

### Stage 1 — Trigram Candidate Filtering

When you type a query, it is first broken down into **trigrams** — overlapping sequences of 3 characters.

**Example:** `"baki"` → `[" ba", "bak", "aki", "ki "]`

These trigrams are looked up in a pre-built index (`trigram_index.json`), which maps each trigram to all record IDs that contain it. Records are ranked by how many trigrams they share with the query. The **top 500 candidates** are selected and passed to Stage 2.

This makes the search fast — instead of comparing the query against every record, only a small, highly relevant subset is scored.

---

### Stage 2 — Levenshtein Scoring

Each candidate is scored using the **Levenshtein (edit distance) algorithm**, which measures how many single-character insertions, deletions, or substitutions are needed to turn one string into another.

The raw edit distance is normalised into a **score between 0.0 and 1.0**:

```
score = 1 - (editDistance / max(len(query), len(candidate)))
```

- Each record is scored against both its primary `name` and any `alt_names`.
- The **highest score** across all name variants is used.
- A small **prefix boost of +0.08** is applied if the candidate name starts with the query (minimum 3 characters), to improve usability for prefix-style searches. The score is capped at 1.0.

---

### Filtering & Sorting

- Results with a score **below 0.65** are discarded.
- Remaining results are **sorted highest score first**.
- The **top 20 results** are displayed.

---

## Reading the Scores

Scores are displayed as a percentage (0–100) in the results list next to each record's OID.

| Score (%) | Meaning |
|-----------|---------|
| **100** | Exact match |
| **90–99** | Very close match — likely a minor typo (1–2 characters off) |
| **75–89** | Good match — a few differences, probably the right record |
| **65–74** | Weak match — shown as a suggestion, verify manually |
| **< 65** | Not shown — filtered out as too dissimilar |

**Example:**
> Searching for `"Bakii"` (typo) against `"Baki"` → edit distance of 1, max length of 5 → score = `1 - (1/5)` = **0.80 (80%)**

---

## Data Format

### `records.json`
An array of place records with the following fields:

| Field | Description |
|-------|-------------|
| `id` | Internal array index (used by the trigram index) |
| `oid` | ArcGIS Object ID — used to open the record in Experience Builder |
| `name` | Primary place name |
| `alt_names` | Array of alternative names (e.g. other spellings, local names) |
| `country` | Country name |
| `state` | State or administrative level 1 |
| `region` | Region or administrative level 2 |
| `district` | District or administrative level 3 |

**Example record:**
```json
{
  "id": 2,
  "oid": 3,
  "name": "Baki",
  "alt_names": ["Baaki", "Bakey"],
  "country": "Somalie",
  "state": "Somaliland",
  "region": "Awdal",
  "district": "Baki"
}
```

### `trigram_index.json`
A pre-built lookup table mapping trigrams to arrays of record IDs. This is generated separately and must be regenerated whenever `records.json` changes.

---

## UI Features

- **Keyboard navigation:** Use `↑` / `↓` to move through results, `Enter` to open the selected record, `Escape` to clear the search.
- **Hover selection:** Hovering over a result selects it.
- **Highlighted matches:** Matching characters in the result name are highlighted using subsequence matching.
- **Match source badge:** Each result shows whether the match was on the primary `name` or an `alt name`.
- **Open button:** Opens the record in ArcGIS Experience Builder in a new tab using the record's OID.

---

## Configuration

In `search.js`, the following values can be tuned:

| Variable / Value | Description |
|-----------------|-------------|
| `EXPERIENCE_URL_TEMPLATE` | The ArcGIS Experience Builder URL with `{oid}` as a placeholder |
| `0.65` (filter threshold) | Minimum score to show a result — raise to be stricter, lower to show more results |
| `500` (candidate limit) | Max candidates passed from trigram stage to scoring — raise for better recall on large datasets |
| `20` (result limit) | Max results shown in the UI |
| `0.08` (prefix boost) | Score bonus for prefix matches |

---

## ⚠️ Warning

Opening a result navigates to the Experience Builder page but **loses the relationship with the case you are working in**. Always continue your work in the original tab.
