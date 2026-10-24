#!/usr/bin/env node
/* all-places: the header Places menu on every page matches js/v2-places.js */
require('child_process').execFileSync(process.execPath, [require('path').join(__dirname, 'build-places.js'), '--check'], { stdio: 'inherit' });
