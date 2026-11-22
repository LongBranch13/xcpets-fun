#!/usr/bin/env node
/* Writes hatchbot/memes.json: [{ id, name }] for every pet that has a 512x512 picture in t/ (tokened pets).
 * /meme picks one at random. Run by the deploy workflow before it uploads the worker. */
'use strict';
const fs = require('fs'), path = require('path');
const T = path.resolve(__dirname, '..', 't'), out = [];
fs.readdirSync(T).filter(f => /^\d+\.json$/.test(f)).forEach(f => {
  const id = +f.slice(0, -5); if (!fs.existsSync(path.join(T, id + '.png'))) return;
  try { const j = JSON.parse(fs.readFileSync(path.join(T, f), 'utf8')); const m = String(j.name || '').match(/^XCPETS #\d+ (.+)$/); out.push({ id, name: m ? m[1] : 'Pet #' + id }); } catch (e) {}
});
out.sort((a, b) => a.id - b.id);
fs.writeFileSync(path.join(__dirname, 'memes.json'), JSON.stringify(out));
console.log('memes.json: ' + out.length + ' pets');
