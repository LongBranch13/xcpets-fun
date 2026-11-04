/* ambient-music-1103 (PREVIEW, UI only, no rule change): three original, very chill 8-bit loops made entirely in code.
 * Mood only (warm Tycho-like pads, Selected-Ambient-Works-like soft textures, small glitchy arps); no melodies copied.
 * Speed drifts between slower and slightly quicker sections inside each loop.
 * Loaded only after the first tap on the speaker button (see xc-music-btn in js/xc-select.js).
 * Each track is rendered once into a mono PCM buffer (pulse lead, triangle bass, soft noise hats) and played
 * with loop=true. Note tails that run past the end are wrapped onto the start, so the loop point is seamless.
 * Same file renders the preview MP3s in Node: tools/render-ambient-music.js */
(function (root) {
  'use strict';
  var SR = 22050;
  // MIDI note helpers
  var NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function n(s) { var m = /^([A-G])(#|b)?(\d)$/.exec(s); return 12 * (+m[3] + 1) + NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); }
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  // chord = [root midi, quality]; scale = intervals used for melody passing tones
  // all three are slow, soft and dreamy (owner, Nov 3: very chill background, nothing upbeat)
  var TRACKS = {
    yard: { title: 'Cozy Yard (chill)', bpm: 66, seed: 11, scale: [0, 2, 4, 7, 9], duty: 0.25, lead: 0.07, bass: 0.10, hat: 0, swing: 0, pad: 0.035, arpV: 0.028,
      prog: ['C4 M', 'A3 m', 'F3 M', 'G3 M', 'C4 M', 'E3 m', 'F3 M', 'G3 M', 'A3 m', 'F3 M', 'C4 M', 'G3 M'],
      form: 'AABA', tempo: { A: 1, B: 1.2 }, density: 0.18, arp: 2, bassPat: [0, null, null, null, null, null, null, null], hatPat: [] },
    cemetery: { title: 'Misty Cemetery (chill)', bpm: 58, seed: 66, scale: [0, 2, 3, 7, 8], duty: 0.125, lead: 0.06, bass: 0.10, hat: 0, swing: 0, pad: 0.04, arpV: 0.022,
      prog: ['A3 m', 'A3 m', 'F3 M', 'E3 M', 'D3 m', 'A3 m', 'F3 M', 'E3 M', 'A3 m', 'F3 M'],
      form: 'ABAB', tempo: { A: 0.92, B: 1.12 }, density: 0.14, echo: true, arp: 4, bassPat: [0, null, null, null, null, null, null, null], hatPat: [] },
    arena: { title: 'Sunset Arena (chill)', bpm: 72, seed: 690, scale: [0, 2, 4, 7, 9, 11], duty: 0.25, lead: 0.065, bass: 0.10, hat: 0, swing: 0, pad: 0.035, arpV: 0.03,
      prog: ['F3 M', 'G3 M', 'E3 m', 'A3 m', 'D3 m', 'G3 M', 'C4 M', 'C4 M', 'F3 M', 'G3 M', 'E3 m', 'A3 m', 'D3 m', 'E3 m', 'F3 M', 'G3 M'],
      form: 'AABB', tempo: { A: 0.9, B: 1.18 }, density: 0.2, arp: 2, bassPat: [0, null, null, null, 7, null, null, null], hatPat: [] }
  };

  function chordTones(c) { var p = c.split(' '); var r = n(p[0]), q = p[1]; return [r, r + (q === 'm' ? 3 : 4), r + 7, r + (q === 'm' ? 10 : 11)]; }

  // Build note events: {t (seconds), d (seconds), f (hz), v (0..1), w ('pulse'|'tri'|'noise'), duty}
  function compose(key) {
    var T = TRACKS[key], R = rng(T.seed), base = 60 / T.bpm / 4, step = base, pos = 0, bars = T.prog.length, ev = [];
    var motifs = {};
    function motif(label, chord) { // a bar of 16 steps, reused per section label so themes come back
      if (!motifs[label]) {
        var pat = [];
        for (var i = 0; i < 16; i++) pat.push(i % 4 === 0 ? (R() < 0.85) : (R() < T.density * (i % 2 ? 0.5 : 1)));
        var deg = []; for (i = 0; i < 16; i++) deg.push(Math.floor(R() * 7) - 1);
        motifs[label] = { pat: pat, deg: deg };
      }
      return motifs[label];
    }
    var secLen = bars / T.form.length;
    var ar;
    for (var b = 0; b < bars; b++) {
      var ct = chordTones(T.prog[b]), sec = T.form[Math.floor(b / secLen)], bar0 = pos;
      // speed drifts between sections (gentle ease over 2 bars toward each section's tempo), so loops never feel flat
      var want = (T.tempo && T.tempo[sec]) || 1, prevF = base / step;
      step = base / (prevF + (want - prevF) * 0.6); pos += 16 * step;
      var m = motif(sec + (b % secLen), ct), root = ct[0] + 12;
      // melody: chord tones on strong steps, scale tones elsewhere, held until the next note
      var last = -1;
      for (var i = 0; i < 16; i++) {
        if (!m.pat[i]) continue;
        var dg = m.deg[i], pitch;
        if (i % 4 === 0) pitch = ct[((dg % 4) + 4) % 4] + 12;
        else { var sc = T.scale, k = ((dg % sc.length) + sc.length) % sc.length; pitch = (ct[0] - (ct[0] % 12)) + sc[k] + 12 + (k ? 0 : 12) + (n(T.prog[0].split(' ')[0]) % 12); while (pitch < root - 3) pitch += 12; while (pitch > root + 14) pitch -= 12; }
        var j = i + 1; while (j < 16 && !m.pat[j]) j++;
        var len = (j - i) * step * 0.95, sw = (i % 2) ? T.swing * step : 0;
        ev.push({ t: bar0 + i * step + sw, d: len, f: hz(pitch), v: T.lead, w: 'pulse', duty: T.duty, att: 0.06, vib: 0.004 });
        if (T.echo) ev.push({ t: bar0 + i * step + 3 * step, d: len, f: hz(pitch), v: T.lead * 0.35, w: 'pulse', duty: 0.25 });
        last = pitch;
      }
      // arena: quiet 16th arpeggio under the lead
      // slow arpeggio (every T.arp steps) + a soft triangle pad holding the chord for the bar
      var ar = [0, 1, 2, 1];
      // quirky little glitches: now and then an arp note stutters (ratchet) or jumps an octave, mood only
      ar = [0, 2, 1, 3];
      if (T.arp) for (i = 0; i < 16; i += T.arp) {
        var ap = ct[ar[(i / T.arp) % 4]] + 24, g = R();
        if (g < 0.12) ap += 12;
        if (g > 0.86) { for (var r2 = 0; r2 < 3; r2++) ev.push({ t: bar0 + i * step + r2 * step / 3, d: step / 4, f: hz(ap), v: T.arpV * (0.9 - r2 * 0.25), w: 'pulse', duty: 0.125 }); continue; }
        ev.push({ t: bar0 + i * step, d: step * T.arp * 1.6, f: hz(ap), v: T.arpV, w: 'tri', att: 0.03 });
      }
      ct.forEach(function (p, q) { ev.push({ t: bar0, d: 16 * step, f: hz(p + 12) * (1 + 0.003 * (q - 1.5)), v: T.pad * (q === 3 ? 0.7 : 1), w: 'tri', att: 1.4, vib: 0.0025 }); });
      // bass on triangle
      for (i = 0; i < 16; i++) { var bp = T.bassPat[i % 8]; if (bp == null) continue; 
        ev.push({ t: bar0 + i * step, d: step * 7.5, att: 0.15, f: hz(ct[0] - 12 + bp), v: T.bass, w: 'tri' }); }
      // soft hats
      for (i = 0; i < 16; i++) if (T.hatPat[i]) ev.push({ t: bar0 + i * step, d: 0.04, f: 0, v: T.hat, w: 'noise' });
    }
    return { events: ev, length: pos, title: T.title };
  }

  // ---- 8-bit style (default; owner Nov 4: warm, nostalgic RPG town / overworld chiptune). Original melodies, written here note by note.
  // Bars of 8 eighth notes: '.' rest, '-' hold. Each part = 4 written bars played twice (2nd time bars 3-4 use the alt ending).
  // Form: A, B, A (with harmony), Bridge, B (with harmony) = 40 bars -> 83-102 s per loop. Soft square lead, flowing 16th arpeggio,
  // soft triangle bass, light noise drums, and a circular echo (wraps around the loop, so the restart is seamless).
  var CHIP = {
    meadow: { title: 'Pixel Meadow', bpm: 104, duty: 0.25,
      ac: ['C4 M', 'A3 m', 'F3 M', 'G3 M'], bc: ['F3 M', 'C4 M', 'D3 m', 'G3 M'], rc: ['A3 m', 'E3 m', 'F3 M', 'G3 M'],
      A: ['E5 - - D5 C5 - G4 -', 'A4 - C5 - E5 - D5 C5', 'F5 - E5 - D5 - C5 A4', 'B4 - - - G4 - . .'],
      Aa: ['A4 C5 F5 - E5 - D5 C5', 'D5 - - - B4 - . .'],
      B: ['A5 - G5 - F5 - C5 -', 'E5 - - G5 C6 - B5 A5', 'A5 - - F5 D5 - F5 A5', 'G5 - - - B4 D5 G5 -'],
      Ba: ['F5 - E5 D5 A4 - D5 F5', 'G5 - F5 - D5 - B4 .'],
      R: ['C5 - - E5 A5 - G5 E5', 'B4 - - - E5 - D5 B4', 'C5 - A4 - F5 - E5 C5', 'D5 - - - G5 - - -'],
      Ra: ['A5 - G5 F5 C6 - A5 F5', 'G5 - F5 - D5 - B4 .'] },
    parade: { title: 'Snack Parade', bpm: 112, duty: 0.25,
      ac: ['F3 M', 'D3 m', 'Bb2 M', 'C3 M'], bc: ['Bb2 M', 'F3 M', 'G2 m', 'C3 M'], rc: ['D3 m', 'A2 m', 'Bb2 M', 'C3 M'],
      A: ['C5 - F5 - A5 - G5 F5', 'D5 - - F5 A5 - F5 D5', 'Bb4 - D5 - F5 - E5 D5', 'E5 - - - C5 - . .'],
      Aa: ['D5 - F5 - Bb5 - A5 G5', 'G5 - - - E5 - C5 .'],
      B: ['D6 - - C6 Bb5 - F5 -', 'A5 - C6 - F5 - A5 C6', 'Bb5 - - A5 G5 - D5 -', 'E5 - - - G5 - C6 -'],
      Ba: ['Bb5 - A5 G5 D5 - G5 Bb5', 'C6 - Bb5 - G5 - E5 .'],
      R: ['F5 - - A5 D5 - F5 A5', 'E5 - - - C5 - A4 -', 'D5 - F5 - Bb5 - A5 F5', 'G5 - - - E5 - - -'],
      Ra: ['F5 - D5 F5 Bb5 - D6 -', 'C6 - - - Bb5 - G5 E5'] },
    'arena-chip': { title: 'Arena Rush', bpm: 115, duty: 0.5,
      ac: ['E3 m', 'C3 M', 'D3 M', 'B2 M'], bc: ['C3 M', 'D3 M', 'B2 m', 'E3 m'], rc: ['A2 m', 'D3 M', 'G3 M', 'B2 M'],
      A: ['E5 - - B4 E5 - G5 -', 'G5 - - E5 C5 - E5 G5', 'F#5 - - D5 A5 - F#5 D5', 'D#5 - - - B4 - . .'],
      Aa: ['F#5 - A5 - D6 - A5 F#5', 'D#6 - - - B5 - F#5 D#5'],
      B: ['G5 - - E5 C6 - B5 G5', 'A5 - - F#5 D6 - C6 A5', 'B5 - - D6 F#5 - B5 D6', 'E6 - - - B5 - G5 -'],
      Ba: ['D6 - C#6 B5 F#5 - D5 F#5', 'G5 - - F#5 E5 - - .'],
      R: ['C5 - E5 - A5 - G5 E5', 'F#5 - - - D5 - A4 -', 'B4 - D5 - G5 - F#5 G5', 'F#5 - - - D#5 - B4 -'],
      Ra: ['D5 - G5 - B5 - A5 G5', 'F#5 - - - D#5 F#5 B5 -'] },
    crypt: { title: 'Lantern Crypt', bpm: 94, duty: 0.125,
      ac: ['A3 m', 'F3 M', 'C4 M', 'E3 M'], bc: ['D3 m', 'A3 m', 'F3 M', 'E3 M'], rc: ['F3 M', 'G3 M', 'E3 m', 'A3 m'],
      A: ['A4 - - C5 E5 - D5 C5', 'C5 - - A4 F4 - A4 C5', 'E5 - - D5 C5 - G4 -', 'G#4 - - - B4 - E5 -'],
      Aa: ['G5 - E5 - C5 - E5 G5', 'B5 - - G#5 E5 - - .'],
      B: ['F5 - - E5 D5 - A5 -', 'E5 - - C5 A4 - C5 E5', 'A5 - - G5 F5 - C5 A4', 'B4 - - - G#4 - E4 -'],
      Ba: ['C5 - F5 - A5 - G5 F5', 'E5 - - - D5 - B4 G#4'],
      R: ['A4 - C5 F5 E5 - C5 A4', 'B4 - D5 G5 F5 - D5 B4', 'G4 - B4 E5 D5 - B4 G4', 'A4 - - - C5 - E5 -'],
      Ra: ['F5 - E5 D5 C5 - A4 C5', 'B4 - - - G#4 - - .'] }
  };
  function composeChip(key) {
    var T = CHIP[key], e8 = 60 / T.bpm / 2, ev = [], bar = 0, sec = [];
    function part(name, ch, lines, alt, opt) { for (var r = 0; r < 2; r++) for (var i = 0; i < 4; i++) sec.push({ s: name, ch: (r && i >= 2 && T[name + 'c2']) ? T[name + 'c2'][i - 2] : ch[i], m: (r && i >= 2) ? alt[i - 2] : lines[i], o: opt }); }
    part('A', T.ac, T.A, T.Aa, {}); part('B', T.bc, T.B, T.Ba, {});
    part('A', T.ac, T.A, T.Aa, { harm: 1 }); part('R', T.rc, T.R, T.Ra, { soft: 1 }); part('B', T.bc, T.B, T.Ba, { harm: 1 });
    sec[sec.length - 1].fill = true;
    sec.forEach(function (S) {
      var t0 = bar * 8 * e8, ct = chordTones(S.ch), tok = S.m.split(/\s+/);
      if (tok.length !== 8) throw new Error(key + ' bar ' + bar + ' has ' + tok.length + ' steps');
      for (var i = 0; i < 8; i++) {
        if (tok[i] === '.' || tok[i] === '-') continue;
        var j = i + 1; while (j < 8 && tok[j] === '-') j++;
        var p = n(tok[i]), held = j - i > 1, d = e8 * ((j - i) - (held ? 0.12 : 0.25));
        ev.push({ t: t0 + i * e8, d: d, f: hz(p), v: 0.11, w: 'pulse', duty: T.duty, att: 0.008, rel: 0.12, vib: held ? 0.01 : 0, vd: 0.2 });
        if (S.o.harm) { var h = p - 3, ok = [0, ct[1] - ct[0], 7]; while (h > p - 9 && ok.indexOf(((h - ct[0]) % 12 + 12) % 12) < 0) h--;
          ev.push({ t: t0 + i * e8, d: d, f: hz(h), v: 0.045, w: 'pulse', duty: 0.5, att: 0.008, rel: 0.12 }); }
      }
      // flowing 16th arpeggio (up and down the chord), quiet, under the lead
      var arp = [0, 1, 2, 3, 2, 1, 2, 1], tones = [ct[0], ct[1], ct[2], ct[0] + 12];
      for (var k = 0; k < 16; k++) ev.push({ t: t0 + k * e8 / 2, d: e8 * 0.4, f: hz(tones[arp[k % 8]] + 12), v: S.o.soft ? 0.03 : 0.026, w: 'pulse', duty: 0.125, att: 0.004, rel: 0.08 });
      // soft triangle bass: root on 1, fifth on 3, passing octave
      var bp = S.o.soft ? [[0, 0, 7.6]] : [[0, 0, 3.6], [4, 7, 2.6], [7, 12, 0.9]];
      bp.forEach(function (q) { ev.push({ t: t0 + q[0] * e8, d: q[2] * e8, f: hz(ct[0] - 12 + q[1]), v: 0.17, w: 'tri', att: 0.01, rel: 0.1 }); });
      // light noise drums
      for (i = 0; i < 8; i++) {
        if (S.fill && i >= 6) { for (var q = 0; q < 2; q++) ev.push({ t: t0 + (i + q / 2) * e8, d: 0.08, f: 0, v: 0.05 + 0.01 * q, w: 'noise', dec: 0.04, rel: 0.02 }); continue; }
        if (S.o.soft) { if (i === 0) ev.push({ t: t0, d: 0.12, f: 120, v: 0.14, w: 'kick', rel: 0.02 }); if (i % 2 === 1) ev.push({ t: t0 + i * e8, d: 0.03, f: 0, v: 0.012, w: 'noise', rel: 0.01 }); continue; }
        if (i === 0 || i === 5) ev.push({ t: t0 + i * e8, d: 0.12, f: 120, v: 0.18, w: 'kick', rel: 0.02 });
        if (i === 2 || i === 6) ev.push({ t: t0 + i * e8, d: 0.12, f: 0, v: 0.07, w: 'noise', dec: 0.06, rel: 0.02 });
        ev.push({ t: t0 + i * e8, d: 0.03, f: 0, v: i % 2 ? 0.014 : 0.02, w: 'noise', rel: 0.01 });
      }
      bar++;
    });
    return { events: ev, length: bar * 8 * e8, title: T.title, echo: e8 * 3, bpm: T.bpm };
  }
  function blep(t, dt) { if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; }

  // Render to Float32Array of exactly `length` seconds; overflow wraps to the start (seamless loop)
  function render(key, sr) {
    var chip = !!CHIP[key]; sr = sr || (chip ? 44100 : SR);
    var c = CHIP[key] ? composeChip(key) : compose(key), N = Math.round(c.length * sr), out = new Float32Array(N), nz = rng(7);
    c.events.forEach(function (e) {
      var s0 = Math.round(e.t * sr), len = Math.round(e.d * sr), rel = Math.round((e.rel != null ? e.rel : e.w === 'noise' ? 0.06 : 0.9) * sr), atk = Math.max(80, Math.round((e.att || 0) * sr)), tot = len + rel, ph = 0, inc = e.f / sr;
      var nv = 0, nc = 0;
      for (var i = 0; i < tot; i++) {
        var env = i < atk ? i / atk : (i < len ? 1 - 0.3 * (i / len) : 0.7 * Math.pow(1 - (i - len) / rel, 2));
        var x;
        if (e.w === 'pulse') { x = (ph < e.duty ? 1 : -1); if (chip) x += blep(ph, inc) - blep((ph - e.duty + 1) % 1, inc); }
        else if (e.w === 'tri') x = 4 * Math.abs(ph - 0.5) - 1;
        else if (e.w === 'kick') { x = 4 * Math.abs(ph - 0.5) - 1; inc = (e.f * Math.exp(-i / (0.03 * sr)) + 45) / sr; env = Math.exp(-i / (0.07 * sr)); }
        else { if (nc-- <= 0) { nv = nz() * 2 - 1; nc = 2; } x = nv; env = Math.exp(-i / ((e.dec || 0.012) * sr)); }
        ph += e.vib ? inc * (1 + e.vib * Math.min(1, Math.max(0, i / sr - (e.vd || 0)) / 0.15) * Math.sin(i / sr * 2 * Math.PI * 5.5)) : inc; // delayed vibrato
        if (ph >= 1) ph -= Math.floor(ph);
        out[(s0 + i) % N] += x * e.v * env;
      }
    });
    // gentle one-pole low-pass (softens the square edges); run twice so the filter state wraps too
    var a = chip ? 1 - Math.exp(-2 * Math.PI * 4200 / sr) : 0.28, y = 0;
    // warm echo on the 8-bit style (dotted quarter, circular so the tail wraps into the loop start)
    if (chip && c.echo) { var D = Math.round(c.echo * sr), wet = new Float32Array(N); for (var ep = 0; ep < 3; ep++) for (var ei = 0; ei < N; ei++) wet[ei] = 0.3 * (out[(ei - D + N) % N] + wet[(ei - D + N) % N]); for (ei = 0; ei < N; ei++) out[ei] += 0.7 * wet[ei]; }
    for (var pass = 0; pass < 2; pass++) for (var i = 0; i < N; i++) { y += a * (out[i] - y); if (pass) out[i] = y; }
    // DC blocker (pulse waves are lopsided; without this the level jumps at the loop point). Two passes so its state wraps too.
    var xp = 0, yp = 0, R = 0.997, o;
    for (pass = 0; pass < 2; pass++) for (i = 0; i < N; i++) { o = out[i] - xp + R * yp; xp = out[i]; yp = o; if (pass) out[i] = o; }
    var pk = 0; for (i = 0; i < N; i++) pk = Math.max(pk, Math.abs(out[i]));
    var g = pk > 0 ? 0.8 / pk : 1; for (i = 0; i < N; i++) out[i] *= g; // peak 0.8 before the volume gain (max 0.55) -> never above 0.44 full scale
    return { samples: out, sampleRate: sr, seconds: c.length, title: c.title };
  }

  // style 'chip' (default, classic 8-bit) or 'chill'
  function pickTrack(path, style) {
    var p = String(path || '').toLowerCase(), chill = style === 'chill';
    if (/cemetery/.test(p)) return chill ? 'cemetery' : 'crypt';
    if (/fight|raid|arena/.test(p)) return chill ? 'arena' : 'arena-chip';
    if (!chill && /pet|breed|hatch|shop/.test(p)) return 'parade';
    return chill ? 'yard' : 'meadow';
  }

  var api = { render: render, pickTrack: pickTrack, tracks: Object.keys(TRACKS), chipTracks: Object.keys(CHIP) };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // ---- browser player ----
  var ctx = null, src = null, srcKey = '', gain = null, cache = {};
  api.LEVELS = { low: 0.18, med: 0.35, high: 0.55 };
  api.VOLUME = 0.35;
  api.style = 'chip';
  api.setVolume = function (v) { api.VOLUME = v; if (ctx && src) { gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.setTargetAtTime(v, ctx.currentTime, 0.1); } };
  api.setStyle = function (st) { api.style = st === 'chill' ? 'chill' : 'chip'; if (src) { try { src.stop(); } catch (e) {} src.disconnect(); src = null; api.start(); } };
  api.start = function () {
    var AC = root.AudioContext || root.webkitAudioContext; if (!AC) return false;
    if (!ctx) { ctx = new AC(); gain = ctx.createGain(); gain.gain.value = 0; gain.connect(ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume();
    if (!src) {
      var key = pickTrack(root.location.pathname, api.style); srcKey = key;
      var r = cache[key] || (cache[key] = render(key, SR));
      var buf = ctx.createBuffer(1, r.samples.length, r.sampleRate); buf.getChannelData(0).set(r.samples);
      src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(gain); src.start();
    }
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setTargetAtTime(api.VOLUME, ctx.currentTime, 0.4);
    return true;
  };
  api.stop = function () {
    if (!ctx) return;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    setTimeout(function () { if (ctx && gain.gain.value < 0.01 && ctx.state === 'running') ctx.suspend(); }, 900);
  };
  root.XCMusic = api;
})(typeof window !== 'undefined' ? window : this);
