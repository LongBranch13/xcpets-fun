#!/usr/bin/env node
/* Writes hatchbot/memes.json from hb-memes/manifest.json: [{ id, url, caption }].
 * /meme sends https://xcpets.fun/hb-memes/<file> with that meme's own caption.
 * Also writes hatchbot/tokens.json: [{ id, name }] for every pet with a 512x512
 * picture in t/. /pet, /whosthat and the other pet commands still use that list.
 * Run by the deploy workflow before it uploads the worker.
 * GIF and MP4 memes are left for later; this list is PNG only. */
'use strict';
const fs = require('fs'), path = require('path');

const dir = path.resolve(__dirname, '..', 'hb-memes');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
if (!Array.isArray(manifest)) throw new Error('hb-memes/manifest.json must be an array');
const seen = new Set(), memes = [];
for (const row of manifest) {
  const id = String(row && row.id || ''), file = String(row && row.file || ''), caption = String(row && row.caption == null ? '' : row.caption);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.png$/.test(file)) throw new Error('bad meme file: ' + file);
  if (!fs.existsSync(path.join(dir, file))) throw new Error('missing meme file: ' + file);
  if (!caption.trim()) throw new Error('empty caption: ' + file);
  if (/start\s*9|onion|\/home\//i.test(caption)) throw new Error('caption blocked: ' + file);
  if (seen.has(file)) throw new Error('duplicate meme file: ' + file);
  seen.add(file);
  memes.push({ id: id || file.replace(/\.png$/, ''), url: 'https://xcpets.fun/hb-memes/' + file, caption });
}
if (!memes.length) throw new Error('no memes in hb-memes/manifest.json');
fs.writeFileSync(path.join(__dirname, 'memes.json'), JSON.stringify(memes));
console.log('memes.json: ' + memes.length + ' memes');

const T = path.resolve(__dirname, '..', 't'), tokens = [];
fs.readdirSync(T).filter(f => /^\d+\.json$/.test(f)).forEach(f => {
  const id = +f.slice(0, -5); if (!fs.existsSync(path.join(T, id + '.png'))) return;
  try { const j = JSON.parse(fs.readFileSync(path.join(T, f), 'utf8')); const m = String(j.name || '').match(/^XCPETS #\d+ (.+)$/); tokens.push({ id, name: m ? m[1] : 'Pet #' + id }); } catch (e) {}
});
tokens.sort((a, b) => a.id - b.id);
fs.writeFileSync(path.join(__dirname, 'tokens.json'), JSON.stringify(tokens));
console.log('tokens.json: ' + tokens.length + ' pets');
