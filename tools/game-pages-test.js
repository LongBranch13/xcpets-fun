#!/usr/bin/env node
/* species-ranks-split: play.html / fight.html / rare-room.html / breed.html must match templates/game.html (node tools/build-game-pages.js) */
'use strict';
require('child_process').execFileSync(process.execPath, [require('path').join(__dirname, 'build-game-pages.js'), '--check'], { stdio: 'inherit' });
