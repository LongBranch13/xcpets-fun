#!/usr/bin/env node
/* playlist-music-1107: one site-wide playlist. Written melodies stay the same length; an outro and fade sit after them. */
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
  const body = M.bodyLength(k), full = M.songLength(k);
  ok(Math.abs(body - expect[k]) < 0.05, k + ' melody stays ' + expect[k] + 's (got ' + body.toFixed(2) + ')');
  ok(full > body + M.FADE && full < body + M.FADE + 8, k + ' outro follows the melody (' + full.toFixed(2) + 's)');
});
ok(chip.slice(-3).join(',') === 'bog-motor,gutter-bloom,moss-clank', 'three new songs follow the original eleven');
ok(chip[8] === 'rift-wub' && chip.length === 14, 'saved chip index 8 is still Rift Wub');

const genres = { 'night-market': 'Drum and bass', 'glass-gate': 'Trance', 'neon-rook': 'Synthwave', 'block-party': 'House', 'rift-wub': 'Dubstep', 'grid-ritual': 'Techno', 'canopy-break': 'Jungle', 'bog-motor': 'Dubstep', 'gutter-bloom': 'Dubstep', 'moss-clank': 'Dubstep' };
const titles = { 'bog-motor': 'Bog Motor', 'gutter-bloom': 'Gutter Bloom', 'moss-clank': 'Moss Clank' };
Object.keys(genres).forEach(function (k) {
  const s = M.songLength(k), meta = M.trackMeta(k);
  ok(s > 45 && s < 140, k + ' duration ' + s.toFixed(1) + 's');
  ok(meta.genre === genres[k] && meta.title && (!titles[k] || meta.title === titles[k]), k + ' is ' + meta.title + ' / ' + meta.genre);
  ok(M.songLength(k) > M.bodyLength(k) + 3, k + ' has an outro after the written bars');
});

const len0 = M.songLength(chip[0]);
const w = M.advance(chip, 0, len0 + 1.25);
ok(w.key === chip[1] && Math.abs(w.pos - 1.25) < 0.02, 'playhead wraps onto the next song');
const back = M.advance(chip, chip.length - 1, M.songLength(chip[chip.length - 1]) + 0.4);
ok(back.key === chip[0], 'playlist loops to the first song');
const mid = M.advance(chip, 0, 12.5);
ok(mid.key === 'meadow' && Math.abs(mid.pos - 12.5) < 0.001, 'saved position in the middle stays on that song');
const oldEnd = M.advance(chip, 8, 70);
ok(oldEnd.key === 'rift-wub' && Math.abs(oldEnd.pos - 70) < 0.001, 'saved Rift Wub position stays on Rift Wub');
const nearOld = M.advance(chip, 0, 99.6);
ok(nearOld.key === 'meadow', 'a position saved near the old ending still resumes that song');
const chillMid = M.advance(chill, 1, 3);
ok(chillMid.key === 'cemetery' && Math.abs(chillMid.pos - 3) < 0.001, 'chill saved position stays on that song');
const plan = M.crossfadePlan(80, 10, M.XFADE);
ok(M.FADE >= 3 && M.FADE <= 5 && M.XFADE >= 1 && M.XFADE <= 2, 'ending fade is 3-5s and crossfade is 1-2s');
ok(Math.abs(plan.delay - (70 - M.XFADE)) < 0.01 && plan.overlap === M.XFADE && !plan.startNow, 'next song starts during the last 1-2s');

['meadow', 'night-market', 'rift-wub', 'glass-gate'].forEach(function (k) {
  const r = M.render(k);
  let acc = 0, n = 0, peak = 0;
  for (let i = 0; i < r.samples.length; i += 19) { acc += r.samples[i] * r.samples[i]; peak = Math.max(peak, Math.abs(r.samples[i])); n++; }
  const rms = Math.sqrt(acc / n);
  ok(!!r.samplesR && r.samplesR.length === r.samples.length, k + ' is stereo');
  ok(rms > 0.03 && rms < 0.45 && peak > 0.2 && peak <= 0.81, k + ' level rms ' + rms.toFixed(3) + ' peak ' + peak.toFixed(2));
  const a = rmsOf(r, 2, 6), b = rmsOf(r, r.seconds * 0.45, r.seconds * 0.45 + 6);
  ok(b > a * 0.85, k + ' keeps energy after the intro (' + a.toFixed(3) + ' -> ' + b.toFixed(3) + ')');
  const tail = rmsOf(r, r.seconds - 0.35, r.seconds);
  const beforeFade = rmsOf(r, r.seconds - M.FADE - 1.2, r.seconds - M.FADE - 0.3);
  ok(tail < 0.02 && tail < beforeFade * 0.35, k + ' fades out (' + beforeFade.toFixed(3) + ' -> ' + tail.toFixed(3) + ')');
});

function rmsOf(r, t0, t1) {
  const sr = r.sampleRate, a = Math.max(0, Math.floor(t0 * sr)), b = Math.min(r.samples.length, Math.floor(t1 * sr));
  let acc = 0, n = 0;
  for (let i = a; i < b; i += 17) { acc += r.samples[i] * r.samples[i]; n++; }
  return n ? Math.sqrt(acc / n) : 0;
}

process.exit(fail ? 1 : 0);
