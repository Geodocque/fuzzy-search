test:
	node --check search.js

serve:
	python3 -m http.server 8000

lint:
	node --check search.js
