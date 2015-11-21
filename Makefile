all: js html
	@echo "All done"

js:
	grep "^    " litsynth.js.md | sed 's/^    //' > litsynth.js

html:
	docco litsynth.js.md

gh-page: html
	cp ./clap.ogg ./docs
	cp ./demo.html ./docs
	cp ./litsynth.js ./docs
	git checkout gh-pages
	rm -f litsynth.js.md LICENSE README.md Makefile
	cp -r ./docs/* . && rm -R ./docs/*
	rmdir docs
	mv litsynth.js.html index.html
