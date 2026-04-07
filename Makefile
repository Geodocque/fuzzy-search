test:
	node --check search.js

serve:
	python3 -m http.server 8000

build-data:
	python3 scripts/build_index.py

lint:
	node --check search.js
