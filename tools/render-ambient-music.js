// node tools/render-ambient-music.js <outdir>  -> <track>.wav (then encode with ffmpeg)
const M = require('../js/xc-music.js'), fs = require('fs'), path = require('path');
const out = process.argv[2] || '.';
const which = process.argv[3] === 'meme' ? M.memeTracks : M.tracks;
for (const k of which) {
  const r = M.render(k), N = r.samples.length, b = Buffer.alloc(44 + N * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + N * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(r.sampleRate, 24); b.writeUInt32LE(r.sampleRate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(N * 2, 40);
  let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(r.samples[i]));
  for (let i = 0; i < N; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r.samples[i])) * 32767), 44 + i * 2);
  fs.writeFileSync(path.join(out, k + '.wav'), b);
  console.log(k, r.title, r.seconds.toFixed(1) + 's', 'peak', peak.toFixed(2));
}
