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

  // ---- meme style (music-btn-pos-1103, owner Nov 3): goofy, bouncy, hooky chiptune. Original melodies, written here note by note.
  // Each bar = 8 eighth notes. '.' rest, '-' hold previous note. Chords: one per bar, cycling.
  var MEME = {
    bop: { title: 'Pixel Bop (meme)', bpm: 128, chords: ['C4 M', 'G3 M', 'A3 m', 'F3 M'], form: 'AABA', duty: 0.25,
      A: ['C5 C5 E5 G5 - E5 G5 A5', 'G5 - E5 - D5 - . .', 'C5 C5 E5 G5 - E5 A5 C6', 'B5 - G5 - . . . .'],
      B: ['A5 A5 G5 E5 - C5 D5 E5', 'D5 D5 C5 A4 - G4 A4 C5', 'C5 E5 G5 C6 - B5 G5 E5', 'D5 - - - . . G4 G4'] },
    spook: { title: 'Grave Wiggle (meme)', bpm: 112, chords: ['A3 m', 'A3 m', 'D3 m', 'E3 M'], form: 'AABA', duty: 0.125,
      A: ['A4 . C5 . E5 D#5 E5 .', 'A4 . C5 . E5 F5 E5 .', 'D5 . F5 . A5 G#5 A5 .', 'B4 C5 B4 G#4 E4 . . .'],
      B: ['E5 - D5 - C5 - B4 -', 'A4 C5 E5 A5 - . . .', 'F5 E5 D5 F5 E5 D5 C5 B4', 'G#4 - B4 - E5 - . .'] },
    battle: { title: 'Bonk Arena (meme)', bpm: 140, chords: ['E3 m', 'C3 M', 'D3 M', 'B2 M'], form: 'AABA', duty: 0.5,
      A: ['E5 E5 . E5 G5 . E5 D5', 'C5 C5 . C5 E5 . C5 B4', 'D5 D5 . D5 F#5 . A5 G5', 'F#5 - D#5 - B4 - . .'],
      B: ['G5 . G5 A5 B5 . A5 G5', 'E5 . E5 G5 C6 - B5 A5', 'A5 . A5 G5 F#5 . D5 E5', 'F#5 . B4 . D#5 . F#5 .'] },
    hop: { title: 'Snack Hop (meme)', bpm: 120, chords: ['F3 M', 'D3 m', 'Bb2 M', 'C3 M'], form: 'AABA', duty: 0.25,
      A: ['F5 . A5 F5 C6 . A5 .', 'D5 . F5 D5 A5 . G5 F5', 'Bb4 D5 F5 D5 Bb5 - A5 G5', 'A5 - G5 - E5 - C5 .'],
      B: ['C6 C6 A5 A5 F5 F5 A5 .', 'D6 C6 A5 F5 D5 - . .', 'Bb5 A5 G5 F5 D5 F5 G5 .', 'G5 - E5 - C5 E5 G5 .'] }
  };
  function composeMeme(key) {
    var T = MEME[key], e8 = 60 / T.bpm / 2, ev = [], bar = 0;
    T.form.split('').forEach(function (sec) {
      T[sec].forEach(function (line, bi) {
        var t0 = bar * 8 * e8, ct = chordTones(T.chords[bi % T.chords.length]), tok = line.split(/\s+/);
        for (var i = 0; i < 8; i++) {
          if (tok[i] === '.' || tok[i] === '-') continue;
          var j = i + 1; while (j < 8 && tok[j] === '-') j++;
          var held = j - i > 1;
          ev.push({ t: t0 + i * e8, d: e8 * (held ? (j - i) - 0.2 : 0.6), f: hz(n(tok[i])), v: 0.13, w: 'pulse', duty: T.duty, rel: 0.05, vib: held ? 0.006 : 0 });
          ev.push({ t: t0 + i * e8 + e8 * 0.02, d: e8 * 0.5, f: hz(n(tok[i]) - 12) * 1.003, v: 0.035, w: 'pulse', duty: 0.5, rel: 0.04 }); // fat double
        }
        for (i = 0; i < 8; i++) {
          ev.push({ t: t0 + i * e8, d: e8 * 0.7, f: hz(ct[0] - 12 + (i % 2 ? 12 : 0)), v: 0.17, w: 'tri', rel: 0.03 }); // bouncy octave bass
          if (i % 4 === 0) ev.push({ t: t0 + i * e8, d: 0.12, f: 140, v: 0.32, w: 'kick', rel: 0.02 });
          if (i % 4 === 2) ev.push({ t: t0 + i * e8, d: 0.12, f: 0, v: 0.12, w: 'noise', dec: 0.06, rel: 0.02 });
          else ev.push({ t: t0 + i * e8 + e8 * 0.5, d: 0.03, f: 0, v: 0.03, w: 'noise', rel: 0.01 });
          if (i % 2) ev.push({ t: t0 + i * e8, d: e8 * 0.35, f: hz(ct[(i >> 1) % 3] + 24), v: 0.03, w: 'pulse', duty: 0.125, rel: 0.02 }); // blip arp
        }
        bar++;
      });
    });
    return { events: ev, length: bar * 8 * e8, title: T.title };
  }

  // Render to Float32Array of exactly `length` seconds; overflow wraps to the start (seamless loop)
  function render(key, sr) {
    sr = sr || SR;
    var c = MEME[key] ? composeMeme(key) : compose(key), N = Math.round(c.length * sr), out = new Float32Array(N), nz = rng(7);
    c.events.forEach(function (e) {
      var s0 = Math.round(e.t * sr), len = Math.round(e.d * sr), rel = Math.round((e.rel != null ? e.rel : e.w === 'noise' ? 0.06 : 0.9) * sr), atk = Math.max(80, Math.round((e.att || 0) * sr)), tot = len + rel, ph = 0, inc = e.f / sr;
      var nv = 0, nc = 0;
      for (var i = 0; i < tot; i++) {
        var env = i < atk ? i / atk : (i < len ? 1 - 0.3 * (i / len) : 0.7 * Math.pow(1 - (i - len) / rel, 2));
        var x;
        if (e.w === 'pulse') x = (ph < e.duty ? 1 : -1);
        else if (e.w === 'tri') x = 4 * Math.abs(ph - 0.5) - 1;
        else if (e.w === 'kick') { x = 4 * Math.abs(ph - 0.5) - 1; inc = (e.f * Math.exp(-i / (0.03 * sr)) + 45) / sr; env = Math.exp(-i / (0.07 * sr)); }
        else { if (nc-- <= 0) { nv = nz() * 2 - 1; nc = 2; } x = nv; env = Math.exp(-i / ((e.dec || 0.012) * sr)); }
        ph += e.vib ? inc * (1 + e.vib * Math.sin(i / sr * 2 * Math.PI * 4.5)) : inc; if (ph >= 1) ph -= 1;
        out[(s0 + i) % N] += x * e.v * env;
      }
    });
    // gentle one-pole low-pass (softens the square edges); run twice so the filter state wraps too
    var a = MEME[key] ? 0.55 : 0.28, y = 0;
    for (var pass = 0; pass < 2; pass++) for (var i = 0; i < N; i++) { y += a * (out[i] - y); if (pass) out[i] = y; }
    var pk = 0; for (i = 0; i < N; i++) pk = Math.max(pk, Math.abs(out[i]));
    var g = pk > 0 ? 0.8 / pk : 1; for (i = 0; i < N; i++) out[i] *= g; // peak 0.8 before the volume gain (max 0.55) -> never above 0.44 full scale
    return { samples: out, sampleRate: sr, seconds: c.length, title: c.title };
  }

  // style 'meme' (default) or 'chill'
  function pickTrack(path, style) {
    var p = String(path || '').toLowerCase(), chill = style === 'chill';
    if (/cemetery/.test(p)) return chill ? 'cemetery' : 'spook';
    if (/fight|raid|arena/.test(p)) return chill ? 'arena' : 'battle';
    if (!chill && /pet|breed|hatch|shop/.test(p)) return 'hop';
    return chill ? 'yard' : 'bop';
  }

  var api = { render: render, pickTrack: pickTrack, tracks: Object.keys(TRACKS), memeTracks: Object.keys(MEME) };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // ---- browser player ----
  var ctx = null, src = null, srcKey = '', gain = null, cache = {};
  api.LEVELS = { low: 0.18, med: 0.35, high: 0.55 };
  api.VOLUME = 0.35;
  api.style = 'meme';
  api.setVolume = function (v) { api.VOLUME = v; if (ctx && src) { gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.setTargetAtTime(v, ctx.currentTime, 0.1); } };
  api.setStyle = function (st) { api.style = st === 'chill' ? 'chill' : 'meme'; if (src) { try { src.stop(); } catch (e) {} src.disconnect(); src = null; api.start(); } };
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
