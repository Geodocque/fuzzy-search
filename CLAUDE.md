# Fuzzy Search Tool

Project type:
- Static browser app
- Main files: index.html, search.js
- Data files: records.json, trigram_index.json

Data pipeline:
- Source CSV goes in data/input/latest.csv
- Generator script is scripts/build_index.py
- Generated files are records.json and trigram_index.json

Rules:
- Only work inside this repository.
- Keep changes minimal and focused.
- Do not modify records.json or trigram_index.json unless I explicitly ask.
- After editing search.js, run: node --check search.js
- If syntax check fails, fix it before finishing.
- Use `make test` to validate code before committing.
- Only create a git commit if the syntax check passes.
- Never push to origin unless I explicitly say: push to origin.
- Treat this repository root as /workspace/group/workspace/projects/fuzzy-search
- Do not modify records.json or trigram_index.json manually.
- Regenerate them only via the Python build script called build_index.py.
- Do not commit CSV input files unless explicitly asked.
- When data changes, run the build-data command before committing.