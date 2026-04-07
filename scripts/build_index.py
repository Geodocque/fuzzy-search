from pathlib import Path
import csv
import json
import re
from collections import defaultdict

# Repo-relative paths
REPO_ROOT = Path(__file__).resolve().parent.parent
INPUT = REPO_ROOT / "data" / "input" / "latest.csv"
RECORDS_OUT = REPO_ROOT / "records.json"
TRIGRAMS_OUT = REPO_ROOT / "trigram_index.json"


def normalize(s: str) -> str:
    s = (s or "").lower().strip()
    s = re.sub(r"\s+", " ", s)
    return s


def trigrams(s: str):
    s = normalize(s)
    s = re.sub(r"[^a-z0-9 ]", "", s)
    s = f"  {s}  "
    return {s[i:i + 3] for i in range(len(s) - 2)}


def main():
    if not INPUT.exists():
        raise FileNotFoundError(f"Input CSV not found: {INPUT}")

    records = []
    tri_to_ids = defaultdict(set)

    with INPUT.open(newline="", encoding="utf-8-sig") as f:
        r = csv.DictReader(f, delimiter=";")
        expected = {"oid", "name", "alt_names"}
        missing = expected - set(r.fieldnames or [])
        if missing:
            raise ValueError(f"Missing columns: {missing}. Found: {r.fieldnames}")

        for row in r:
            oid_raw = (row.get("oid") or "").strip()
            if not oid_raw.isdigit():
                continue

            oid = int(oid_raw)
            name = (row.get("name") or "").strip()

            alt_raw = (row.get("alt_names") or "").strip()
            alt_list = [a.strip() for a in re.split(r"[;,]", alt_raw) if a.strip()]

            rec_id = len(records)
            records.append({
                "id": rec_id,
                "oid": oid,
                "name": name,
                "alt_names": alt_list
            })

            for text in [name] + alt_list:
                for tri in trigrams(text):
                    tri_to_ids[tri].add(rec_id)

    with RECORDS_OUT.open("w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False)

    with TRIGRAMS_OUT.open("w", encoding="utf-8") as f:
        json.dump(
            {k: sorted(list(v)) for k, v in tri_to_ids.items()},
            f,
            ensure_ascii=False
        )

    print(f"Built index: {len(records)} records, {len(tri_to_ids)} trigrams")
    print(f"Wrote: {RECORDS_OUT}")
    print(f"Wrote: {TRIGRAMS_OUT}")


if __name__ == "__main__":
    main()