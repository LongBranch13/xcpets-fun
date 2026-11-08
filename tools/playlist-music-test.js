#!/usr/bin/env node
/* playlist-music-1107: one site-wide playlist, original chip tracks, old songs unchanged in length. */
'use strict';
const M = require('../js/xc-music.js');
let fail = 0;
function ok(c, m) { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; }

const pages = ['/index.html', '/cemetery.html', '/fight.html', '/raid.html', '/shop.html', '/pets.html', '/breed.html'];
pages.forEach(function (p) {
  ok(M.pickTrack(p, 'chip') === M.pickTrack('/index.html', 'chip'), 'chip lane ignores page ' + p);
  ok(M.pickTrack(p, 'chill') === M.pickTrack('/', 'chill'), 'chill lane ignores page ' + p);
});

const chip = M.playlistFor('chip'), chill = M.playlistFor('chill');
['night-market', 'glass-gate', 'neon-rook', 'block-party', 'rift-wub', 'grid-ritual', 'canopy-break', 'meadow', 'parade', 'arena-chip', 'crypt'].forEach(function (k) {
  ok(chip.indexOf(k) >= 0, 'chip playlist has ' + k);
});
ok(chill.join(',') === 'yard,cemetery,arena', 'chill lane is the three original loops');
ok(M.playlist.length === chip.length + chill.length, 'one playlist holds both lanes');
ok(!M.playlist.some(function (t) { return !t.key || (t.style !== 'chip' && t.style !== 'chill'); }), 'every playlist row has a key and a lane');

const expect = { meadow: 100, parade: 90, 'arena-chip': 71.0526, crypt: 96.4286 };
Object.keys(expect).forEach(function (k) {
  const s = M.songLength(k);
  ok(Math.abs(s - expect[k]) < 0.05, k + ' length stays ' + expect[k] + ' (got ' + s.toFixed(2) + ')');
});

const genres = { 'night-market': 'Drum and bass', 'glass-gate': 'Trance', 'neon-rook': 'Synthwave', 'block-party': 'House', 'rift-wub': 'Dubstep', 'grid-ritual': 'Techno', 'canopy-break': 'Jungle' };
Object.keys(genres).forEach(function (k) {
  const s = M.songLength(k), meta = M.trackMeta(k);
  ok(s > 45 && s < 140, k + ' duration ' + s.toFixed(1) + 's');
  ok(meta.genre === genres[k] && meta.title, k + ' is ' + meta.title + ' / ' + meta.genre);
});

function wrap(list, i, pos) {
  let g = 0;
  while (g++ < list.length + 2) {
    const len = M.songLength(list[i]);
    if (pos < len - 0.08) return { i: i, pos: pos, key: list[i] };
    pos -= len; i = (i + 1) % list.length;
  }
  return { i: i, pos: pos, key: list[i] };
}
const len0 = M.songLength(chip[0]);
const w = wrap(chip, 0, len0 + 1.25);
ok(w.key === chip[1] && Math.abs(w.pos - 1.25) < 0.02, 'playhead wraps onto the next song');
const back = wrap(chip, chip.length - 1, M.songLength(chip[chip.length - 1]) + 0.4);
ok(back.key === chip[0], 'playlist loops to the first song');

['meadow', 'night-market', 'rift-wub', 'glass-gate'].forEach(function (k) {
  const r = M.render(k);
  let acc = 0, n = 0, peak = 0;
  for (let i = 0; i < r.samples.length; i += 19) { acc += r.samples[i] * r.samples[i]; peak = Math.max(peak, Math.abs(r.samples[i])); n++; }
  const rms = Math.sqrt(acc / n);
  ok(!!r.samplesR && r.samplesR.length === r.samples.length, k + ' is stereo');
  ok(rms > 0.03 && rms < 0.45 && peak > 0.2 && peak <= 0.81, k + ' level rms ' + rms.toFixed(3) + ' peak ' + peak.toFixed(2));
  const a = rmsOf(r, 2, 6), b = rmsOf(r, r.seconds * 0.45, r.seconds * 0.45 + 6);
  ok(b > a * 0.85, k + ' keeps energy after the intro (' + a.toFixed(3) + ' -> ' + b.toFixed(3) + ')');
});

function rmsOf(r, t0, t1) {
  const sr = r.sampleRate, a = Math.max(0, Math.floor(t0 * sr)), b = Math.min(r.samples.length, Math.floor(t1 * sr));
  let acc = 0, n = 0;
  for (let i = a; i < b; i += 17) { acc += r.samples[i] * r.samples[i]; n++; }
  return n ? Math.sqrt(acc / n) : 0;
}

process.exit(fail ? 1 : 0);
