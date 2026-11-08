#!/usr/bin/env node
/* Write a short excerpt of each new playlist track. node tools/render-playlist-samples.js <outdir> [seconds] */
'use strict';
const M = require('../js/xc-music.js'), fs = require('fs'), path = require('path');
const out = process.argv[2] || '.';
const dur = Math.max(5, Math.min(40, +(process.argv[3] || 25)));
const keys = ['night-market', 'glass-gate', 'neon-rook', 'block-party', 'rift-wub', 'grid-ritual', 'canopy-break'];
fs.mkdirSync(out, { recursive: true });
function slice(r, t0, seconds) {
  const a = Math.max(0, Math.floor(t0 * r.sampleRate)), n = Math.min(r.samples.length - a, Math.floor(seconds * r.sampleRate));
  return { samples: r.samples.subarray(a, a + n), samplesR: r.samplesR ? r.samplesR.subarray(a, a + n) : null, sampleRate: r.sampleRate, seconds: n / r.sampleRate };
}
function wav(r) {
  const C = r.samplesR ? 2 : 1, N = r.samples.length * C, b = Buffer.alloc(44 + N * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + N * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(C, 22);
  b.writeUInt32LE(r.sampleRate, 24); b.writeUInt32LE(r.sampleRate * 2 * C, 28); b.writeUInt16LE(2 * C, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(N * 2, 40);
  const S = i => C === 2 ? (i % 2 ? r.samplesR : r.samples)[i >> 1] : r.samples[i];
  for (let i = 0; i < N; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, S(i))) * 32767), 44 + i * 2);
  return b;
}
for (const k of keys) {
  const full = M.render(k), meta = M.trackMeta(k);
  const start = Math.min(full.seconds * 0.34, Math.max(0, full.seconds - dur - 1));
  const part = slice(full, start, dur);
  const name = k + '-' + meta.genre.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  fs.writeFileSync(path.join(out, name + '.wav'), wav(part));
  console.log(name, meta.title, meta.genre, 'from', start.toFixed(1) + 's', 'len', part.seconds.toFixed(1) + 's');
}
