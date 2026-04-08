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

# CSV column mapping: CSV column name -> internal field name
COLUMN_MAP = {
    "OBJECTID": "oid",
    "oid": "oid",
    "name": "name",
    "alt_names": "alt_names",
    "Country": "country",
    "country": "country",
    "State": "state",
    "state": "state",
    "Region": "region",
    "region": "region",
    "District": "district",
    "district": "district",
}


def normalize(s: str) -> str:
    s = (s or "").lower().strip()
    s = re.sub(r"\s+", " ", s)
    return s


def trigrams(s: str):
    s = normalize(s)
    s = re.sub(r"[^a-z0-9 ]", "", s)
    s = f"  {s}  "
    return {s[i:i + 3] for i in range(len(s) - 2)}


def detect_delimiter(path: Path) -> str:
    """Detect whether CSV uses comma or semicolon delimiter."""
    with path.open(newline="", encoding="utf-8-sig") as f:
        first_line = f.readline()
    return ";" if first_line.count(";") > first_line.count(",") else ","


def main():
    if not INPUT.exists():
        raise FileNotFoundError(f"Input CSV not found: {INPUT}")

    delimiter = detect_delimiter(INPUT)
    print(f"Detected delimiter: {repr(delimiter)}")

    records = []
    tri_to_ids = defaultdict(set)

    with INPUT.open(newline="", encoding="utf-8-sig") as f:
        r = csv.DictReader(f, delimiter=delimiter)
        fieldnames = set(r.fieldnames or [])

        # Remap fieldnames using COLUMN_MAP
        mapped = {COLUMN_MAP[col]: col for col in fieldnames if col in COLUMN_MAP}

        if "oid" not in mapped:
            raise ValueError(f"No OID column found. Expected one of: {[k for k,v in COLUMN_MAP.items() if v == 'oid']}. Found: {sorted(fieldnames)}")
        if "name" not in mapped:
            raise ValueError(f"No name column found. Found: {sorted(fieldnames)}")

        print(f"Mapped columns: {mapped}")

        for row in r:
            oid_raw = (row.get(mapped["oid"]) or "").strip()
            if not oid_raw.isdigit():
                continue

            oid = int(oid_raw)
            name = (row.get(mapped.get("name", "name")) or "").strip()
            if not name:
                continue

            alt_raw = (row.get(mapped.get("alt_names", "alt_names")) or "").strip()
            alt_list = [a.strip() for a in re.split(r"[;,]", alt_raw) if a.strip()]

            rec_id = len(records)
            records.append({
                "id": rec_id,
                "oid": oid,
                "name": name,
                "alt_names": alt_list,
                "country": (row.get(mapped.get("country", ""), "") or "").strip(),
                "state":   (row.get(mapped.get("state",   ""), "") or "").strip(),
                "region":  (row.get(mapped.get("region",  ""), "") or "").strip(),
                "district":(row.get(mapped.get("district",""), "") or "").strip(),
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
