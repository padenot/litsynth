all: js html
	@echo "All done"

js:
	grep "^    " litsynth.js.md | sed 's/^    //' > litsynth.js

html:
	docco litsynth.js.md

gh-page: html
	git checkout gh-pages
	rm litsynth.js.md LICENSE README.me Makefile
	mv docs/* .
	rmdir docs
