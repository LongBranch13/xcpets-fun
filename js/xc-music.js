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
  function hzc(m) { return 432 * Math.pow(2, (m - 69) / 12); } // 8-bit style: A4 = 432 Hz (owner, Nov 4)
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

  function chordTones(c) { var p = c.split(' '); var r = n(p[0]), q = p[1]; return [r, r + (q === 'm' ? 3 : 4), r + 7, r + (q === 'M' ? 11 : 10)]; } // M = maj7, m = m7, 7 = dominant 7

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

  // ---- 8-bit style (default). Owner Nov 4: "All need to be epic." Grand classic-RPG overworld / boss feel, each track distinct.
  // Original melodies, written here note by note. One chord per bar; each bar has T.meter steps ('.' rest, '-' hold).
  // Form: Intro build (4) | A x2 | B x2 | A x2 (+harmony, counter) | Bridge x2 | Climax = B x2 lifted by T.lift semitones, all layers | turnaround (1).
  // Lead sits ~G3-E5 (pulse + triangle mix, low-passed ~3 kHz); 3rd/6th harmony voice; held chord pad (organ on crypt); strong triangle bass; noise drums.
  var CHIP = {
    meadow: { title: 'Pixel Meadow', bpm: 108, meter: 8, duty: 0.25, lift: 2, // heroic overworld, D major, 4/4
      ic: ['D3 T', 'G2 T', 'B2 t', 'A2 s'], I: ['. . . . . . . .', '. . . . . . . .', 'D4 - - - F#4 - - -', 'A4 - - - - - A3 -'],
      ac: ['D3 T', 'A2 T', 'B2 t', 'G2 T'], Ac2: ['E3 m', 'A2 7'],
      A: ['D4 - - A3 D4 - F#4 -', 'E4 - - C#4 A3 - E4 -', 'F#4 - E4 D4 B3 - D4 F#4', 'G4 - - - - - A4 -'], Aa: ['G4 - F#4 E4 B3 - E4 G4', 'A4 - - - - - . .'],
      bc: ['G2 M', 'A2 T', 'F#3 t', 'B2 t'], Bc2: ['G2 T', 'A2 7'],
      B: ['B4 - - A4 G4 - D4 -', 'C#5 - - B4 A4 - E4 -', 'D5 - C#5 B4 F#4 - A4 C#5', 'D5 - - - B4 - - -'], Ba: ['B4 - D5 - G4 - B4 D5', 'C#5 - - - E5 - - -'],
      rc: ['B2 t', 'G2 T', 'E3 t', 'A2 s'], Rc2: ['G2 T', 'A2 7'],
      R: ['F#4 - - - D4 - B3 -', 'D4 - - - B3 - G3 -', 'G4 - - - E4 - B3 -', 'A4 - - - - - - -'], Ra: ['B4 - A4 G4 D4 - G4 B4', 'C#5 - B4 A4 E4 - C#5 E5'],
      oc: 'A2 7', O: '. . . . A3 - C#4 E4' },
    parade: { title: 'Snack Parade', bpm: 120, meter: 12, duty: 0.25, lift: 2, // regal festival march, Bb major, 12/8
      ic: ['Bb2 T', 'Bb2 T', 'Eb3 T', 'F2 s'], I: ['. . . . . . . . . . . .', '. . . . . . . . . . . .', 'Bb3 - - D4 - - F4 - - Bb4 - -', 'A4 - - - - - F4 - - - - -'],
      ac: ['Bb2 T', 'F2 T', 'G2 t', 'Eb2 T'], Ac2: ['C3 m', 'F2 7'],
      A: ['F4 - - Bb4 - - D5 - C5 Bb4 - -', 'C5 - - A4 - - F4 - G4 A4 - -', 'Bb4 - - G4 - - D4 - Eb4 F4 - -', 'G4 - - - - - Eb4 - - - - -'], Aa: ['Eb4 - - G4 - - C5 - Bb4 A4 - -', 'F4 - - - - - . . . C4 D4 Eb4'],
      bc: ['Eb2 M', 'F2 T', 'D3 t', 'G2 t'], Bc2: ['Eb2 T', 'F2 7'],
      B: ['G4 - - Bb4 - - Eb5 - - D5 - -', 'C5 - - A4 - - F4 - - C5 - -', 'D5 - - A4 - - F4 - G4 A4 - -', 'Bb4 - - - - - G4 - - D4 - -'], Ba: ['Eb4 - - G4 - - Bb4 - - Eb5 - -', 'D5 - - C5 - - A4 - - F4 - -'],
      rc: ['G2 t', 'D3 t', 'Eb2 T', 'F2 s'], Rc2: ['Eb2 T', 'F2 7'],
      R: ['Bb4 - - - - - G4 - - D4 - -', 'A4 - - - - - F4 - - D4 - -', 'G4 - - Bb4 - - Eb5 - - - - -', 'F4 - - - - - - - - - - -'], Ra: ['G4 - - Bb4 - - Eb5 - D5 C5 - -', 'C5 - - - - - A4 - - F4 G4 A4'],
      oc: 'F2 7', O: '. . . . . . F3 - - A3 - -' },
    'arena-chip': { title: 'Arena Rush', bpm: 152, meter: 8, duty: 0.5, lift: 1, // boss battle, E minor, 4/4
      ic: ['E2 t', 'E2 t', 'E2 t', 'B2 7'], I: ['. . . . . . . .', '. . . . . . . .', 'E4 - E4 - E4 - E4 E4', 'D#4 - - - B3 - - -'],
      ac: ['E2 t', 'C3 T', 'D3 T', 'B2 7'], Ac2: ['A2 t', 'B2 7'],
      A: ['E4 - - B3 E4 - G4 -', 'G4 - - E4 C4 - E4 G4', 'F#4 - - D4 A4 - F#4 D4', 'D#4 - - - B3 - F#4 -'], Aa: ['C5 - B4 A4 E4 - A4 C5', 'B4 - - - D#4 - F#4 -'],
      bc: ['C3 T', 'D3 T', 'B2 t', 'E2 t'], Bc2: ['A2 t', 'B2 7'],
      B: ['G4 - G4 A4 B4 - A4 G4', 'A4 - A4 B4 C5 - B4 A4', 'B4 - F#4 - D4 F#4 B4 D5', 'E5 - - - B4 - G4 -'], Ba: ['A4 - C5 - E5 - D5 C5', 'B4 - A4 - F#4 - D#4 -'],
      rc: ['A2 t', 'F2 T', 'C3 T', 'B2 7'], Rc2: ['A2 t', 'B2 7'],
      R: ['A4 - - - C5 - - -', 'A4 - - - F4 - - -', 'G4 - - - E4 - C4 -', 'B3 - - - D#4 - F#4 -'], Ra: ['C5 - B4 C5 E5 - C5 A4', 'B4 - - - - - - -'],
      oc: 'B2 7', O: 'B3 - - - D#4 - F#4 -' },
    crypt: { title: 'Lantern Crypt', bpm: 84, meter: 6, duty: 0.25, lift: 0, organ: 1, // dark cathedral, C harmonic minor, 3/4
      ic: ['C3 t', 'Ab2 T', 'F2 t', 'G2 7'], I: ['. . . . . .', '. . . . . .', 'C4 - - - Eb4 -', 'D4 - - - B3 -'],
      ac: ['C3 t', 'Ab2 T', 'F2 t', 'G2 7'], Ac2: ['Ab2 M', 'G2 7'],
      A: ['C4 - Eb4 - G4 -', 'Ab4 - - G4 F4 Eb4', 'F4 - - Eb4 D4 C4', 'B3 - - - G3 -'], Aa: ['Eb4 - F4 - G4 Ab4', 'G4 - - - B3 -'],
      bc: ['F2 t', 'C3 t', 'Ab2 T', 'G2 T'], Bc2: ['Db3 T', 'G2 7'],
      B: ['Ab4 - - - G4 F4', 'G4 - - - Eb4 C4', 'C5 - - Ab4 Eb4 C4', 'B3 - D4 - G4 -'], Ba: ['F4 - Ab4 - Db5 -', 'B4 - - - G4 -'],
      rc: ['Eb3 T', 'B2 o', 'C3 t', 'G2 7'], Rc2: ['Ab2 T', 'G2 7'],
      R: ['G4 - - - Bb4 -', 'Ab4 - - - F4 -', 'G4 - - - Eb4 -', 'D4 - - - B3 -'], Ra: ['C5 - - Ab4 Eb4 C4', 'D4 - F4 - B4 -'],
      oc: 'G2 7', O: 'D4 - - - B3 -' }
  };
  function composeChip(key) {
    var T = CHIP[key], M = T.meter, e = 60 / T.bpm / (M === 12 ? 3 : 2), ev = [], bar = 0, sec = [];
    function part(name, ch, lines, alt, lvl, tr) { for (var r = 0; r < 2; r++) for (var i = 0; i < 4; i++) sec.push({ r: r, s: name, ch: (r && i >= 2) ? T[name + 'c2'][i - 2] : ch[i], m: (r && i >= 2) ? alt[i - 2] : lines[i], lvl: lvl, tr: tr || 0 }); }
    for (var i0 = 0; i0 < 4; i0++) sec.push({ s: 'I', ch: T.ic[i0], m: T.I[i0], lvl: 0, ramp: (i0 + 1) / 4, roll: i0 === 3 });
    part('A', T.ac, T.A, T.Aa, 1); part('B', T.bc, T.B, T.Ba, 2); part('A', T.ac, T.A, T.Aa, 2);
    part('R', T.rc, T.R, T.Ra, 1); part('B', T.bc, T.B, T.Ba, 3, T.lift);
    sec.push({ s: 'O', ch: T.oc, m: T.O, lvl: 1, roll: true });
    sec[3].riser = 1; sec[35].riser = 1; // last intro bar, last bridge bar
    function chordT(c) { var p = c.split(' '), r = n(p[0]), q = p[1];
      if (q === 'T') return [r, r + 4, r + 7, r + 12]; if (q === 't') return [r, r + 3, r + 7, r + 12]; if (q === 's') return [r, r + 5, r + 7, r + 12]; if (q === 'o') return [r, r + 3, r + 6, r + 9];
      return chordTones(c); }
    sec.forEach(function (S) {
      S.tr = S.tr || 0; var t0 = bar * M * e, ct = chordT(S.ch).map(function (x) { return x + S.tr; }), tok = S.m.split(/\s+/), L = S.lvl, amp = S.ramp || 1, i, j, k;
      if (tok.length !== M) throw new Error(key + ' bar ' + bar + ' has ' + tok.length + ' steps');
      var big = L === 3;
      // lead (+ harmony a 3rd/6th below from level 2; climax also doubles the lead an octave down)
      for (i = 0; i < M; i++) {
        if (tok[i] === '.' || tok[i] === '-') continue;
        j = i + 1; while (j < M && tok[j] === '-') j++;
        var p = n(tok[i]) + S.tr, held = j - i > 1, d = e * ((j - i) - (held ? 0.1 : 0.2));
        [-1, 1].forEach(function (sd) { ev.push({ t: t0 + i * e, d: d, f: hzc(p) * (1 + sd * 0.0035), v: 0.05, w: 'pulse', duty: T.duty, att: 0.02, rel: 0.22, vib: 0.007, vd: 0.18, pan: 0.5 * sd }); }); // detuned unison, spread L/R
        ev.push({ t: t0 + i * e, d: d, f: hzc(p), v: 0.06, w: 'tri', att: 0.02, rel: 0.22, vib: 0.007, vd: 0.18 });
        if (big || T.organ && L >= 2) ev.push({ t: t0 + i * e, d: d, f: hzc(p - 12), v: 0.05, w: 'pulse', duty: 0.5, att: 0.02, rel: 0.22, pan: -0.3 });
        if (L >= 2 || S.s === 'I') { var sixth = (bar % 4) >= 2, h = p - (sixth ? 8 : 3), ok = ct.map(function (x) { return ((x - ct[0]) % 12 + 12) % 12; });
          while (h > p - (sixth ? 10 : 6) && ok.indexOf(((h - ct[0]) % 12 + 12) % 12) < 0) h--;
          if (ok.indexOf(((h - ct[0]) % 12 + 12) % 12) >= 0) ev.push({ t: t0 + i * e, d: d, f: hzc(h), v: 0.045, w: 'pulse', duty: 0.5, att: 0.03, rel: 0.22, vib: 0.005, vd: 0.2, pan: 0.35 }); }
      }
      // held chord pad (3 notes); organ on the crypt: pulse + triangle with a low octave root
      [ct[1], ct[2], ct[3]].forEach(function (pp, q) {
        ev.push({ t: t0, d: M * e, f: hzc(pp) * (1 + 0.002 * (q - 1)), v: 0.035 * amp, w: 'tri', att: 0.2, rel: 0.35, pan: (q - 1) * 0.6, duck: 1 });
        ev.push({ t: t0, d: M * e, f: hzc(pp + 12) * (1 - 0.002 * (q - 1)), v: 0.016 * amp, w: 'pulse', duty: 0.5, att: 0.25, rel: 0.35, pan: (1 - q) * 0.6, duck: 1 }); // octave doubling, opposite side
        if (T.organ) ev.push({ t: t0, d: M * e, f: hzc(pp), v: 0.022 * amp, w: 'pulse', duty: 0.5, att: 0.15, rel: 0.35, pan: (1 - q) * 0.4, duck: 1 });
      });
      if (T.organ) ev.push({ t: t0, d: M * e, f: hzc(ct[0] - 12), v: 0.06 * amp, w: 'tri', att: 0.15, rel: 0.35, duck: 1 });
      // counter-melody on triangle (beat notes through chord tones), levels 2-3
      if (L >= 2) { var beat = M === 12 ? 3 : 2, cm = (bar % 2) ? [3, 2, 1, 2] : [2, 3, 2, 1];
        for (k = 0; k * beat < M; k++) ev.push({ t: t0 + k * beat * e, d: e * beat * 0.9, f: hzc(ct[cm[k % 4]] + (cm[k % 4] === 3 ? 0 : 12)), v: 0.035, w: 'tri', att: 0.04, rel: 0.2, pan: -0.4 }); }
      // arpeggio (16ths in 4/4 and 3/4, 8th-note triplets in 12/8)
      if (L >= 1) { var as = M === 12 ? e : e / 2, arp = [0, 1, 2, 3, 2, 1];
        for (k = 0; k < M * e / as - 0.5; k++) ev.push({ t: t0 + k * as, d: as * 0.85, f: hzc(ct[arp[k % 6]] + 12), v: big ? 0.026 : 0.02, w: 'tri', att: 0.006, rel: 0.1, pan: k % 2 ? 0.45 : -0.45 }); }
      // strong triangle bass
      var BP = M === 8 ? (key === 'arena-chip' || big ? [0, 0, 12, 0, 0, 12, 7, 12] : [0, null, 7, null, 0, null, 7, 12])
        : M === 12 ? [0, null, null, 7, null, null, 0, null, null, 7, null, 12] : [0, null, 7, null, 12, null];
      for (i = 0; i < M; i++) if (BP[i] != null) { j = i + 1; while (j < M && BP[j] == null) j++;
        ev.push({ t: t0 + i * e, d: e * (j - i) * 0.85, f: hzc(ct[0] - 12 + BP[i]), v: 0.17 * amp, w: 'tri', att: 0.008, rel: 0.08 });
        var sb = ct[0] - 12 + (BP[i] % 12 ? 0 : 0) - 12; ev.push({ t: t0 + i * e, d: e * (j - i) * 0.85, f: hzc(sb < 31 ? sb + 12 : sb), v: 0.16 * amp, w: 'sine', att: 0.01, rel: 0.08 }); } // sub-bass
      // drums (noise snare/hats + triangle kick); intro builds with a snare roll into A
      for (i = 0; i < M; i++) {
        var kick, snare, hat;
        if (M === 8) { kick = i === 0 || i === 4 || (big || key === 'arena-chip') && (i === 3 || i === 7); snare = i === 2 || i === 6; hat = true; }
        else if (M === 12) { kick = i === 0 || i === 6; snare = i === 3 || i === 9 || big && i === 11; hat = i % 3 === 0 || big; }
        else { kick = i === 0 || big && i === 3; snare = i === 2 || i === 4; hat = i % 2 === 0; }
        if (S.s === 'I' && bar < 2) { snare = false; hat = i === 0; }
        if (S.s === 'R' && !S.r) { kick = i === 0; snare = i === M / 2; hat = i % (M === 12 ? 3 : 2) === 0; } // half-time drop (1st bridge pass)
        if (S.roll && i >= M / 2) { for (var q = 0; q < 2; q++) ev.push({ t: t0 + (i + q / 2) * e, d: 0.08, f: 0, v: 0.03 + 0.02 * (i - M / 2) / M + 0.004 * q, w: 'noise', dec: 0.04, rel: 0.02 }); continue; }
        if (kick) { ev.push({ t: t0 + i * e, d: 0.18, f: 110, v: 0.32 * amp, w: 'kick', rel: 0.02 }); ev.push({ t: t0 + i * e, d: 0.02, f: 0, v: 0.04 * amp, w: 'noise', dec: 0.004, rel: 0.01 }); } // sine thump + click
        if (snare && L >= 1) { ev.push({ t: t0 + i * e, d: 0.16, f: 0, v: big ? 0.075 : 0.06, w: 'noise', dec: 0.09, rel: 0.02, pan: 0.1 }); ev.push({ t: t0 + i * e, d: 0.1, f: 150, v: 0.12, w: 'kick', dec: 0.04, rel: 0.02 }); } // noise + sine body
        if (hat && L >= 1) ev.push({ t: t0 + i * e, d: 0.03, f: 0, v: 0.01, w: 'noise', rel: 0.01, pan: 0.3 });
      }
      // riser into the climax and into A after the intro: noise swell + upward pitch sweep
      if (S.riser) { ev.push({ t: t0, d: M * e, f: 0, v: 0.05, w: 'rise', rel: 0.02 }); ev.push({ t: t0, d: M * e, f: hzc(ct[0]), v: 0.03, w: 'sweep', rel: 0.02 });
      }
      bar++;
    });
    return { events: ev, length: bar * M * e, title: T.title, echo: e * 3, bpm: T.bpm, beat: e * (M === 12 ? 3 : 2), intro: 4 * M * e };
  }
  function blep(t, dt) { if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; }

  // Render to Float32Array of exactly `length` seconds; overflow wraps to the start (seamless loop)
  function render(key, sr) {
    if (CHIP[key]) return renderChip(key, sr);
    var chip = false; sr = sr || (chip ? 44100 : SR);
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
    var a = chip ? 1 - Math.exp(-2 * Math.PI * 3000 / sr) : 0.28, y = 0;
    // warm echo on the 8-bit style (dotted quarter, circular so the tail wraps into the loop start)
    if (chip && c.echo) { var D = Math.round(c.echo * sr), wet = new Float32Array(N); for (var ep = 0; ep < 3; ep++) for (var ei = 0; ei < N; ei++) wet[ei] = 0.3 * (out[(ei - D + N) % N] + wet[(ei - D + N) % N]); for (ei = 0; ei < N; ei++) out[ei] += 0.7 * wet[ei]; }
    for (var st = 0; st < (chip ? 2 : 1); st++) { y = 0; for (var pass = 0; pass < 2; pass++) for (var i = 0; i < N; i++) { y += a * (out[i] - y); if (pass) out[i] = y; } }
    // DC blocker (pulse waves are lopsided; without this the level jumps at the loop point). Two passes so its state wraps too.
    var xp = 0, yp = 0, R = 0.997, o;
    for (pass = 0; pass < 2; pass++) for (i = 0; i < N; i++) { o = out[i] - xp + R * yp; xp = out[i]; yp = o; if (pass) out[i] = o; }
    var pk = 0; for (i = 0; i < N; i++) pk = Math.max(pk, Math.abs(out[i]));
    var g = pk > 0 ? 0.8 / pk : 1; for (i = 0; i < N; i++) out[i] *= g; // peak 0.8 before the volume gain (max 0.55) -> never above 0.44 full scale
    return { samples: out, sampleRate: sr, seconds: c.length, title: c.title };
  }

  // 8-bit style: stereo render. Pads go to a sidechain bus that pumps on every beat; big circular reverb + ping-pong echo;
  // filter sweep opens over the intro. Everything that runs past the end wraps to the start, so the loop is seamless.
  function renderChip(key, sr) {
    sr = sr || 44100;
    var c = composeChip(key), N = Math.round(c.length * sr), L = new Float32Array(N), Rr = new Float32Array(N), PL = new Float32Array(N), PR = new Float32Array(N), nz = rng(7), TAU = 2 * Math.PI;
    c.events.forEach(function (e) {
      var s0 = Math.round(e.t * sr), len = Math.max(1, Math.round(e.d * sr)), rel = Math.round((e.rel != null ? e.rel : 0.06) * sr), atk = Math.max(80, Math.round((e.att || 0) * sr)), tot = len + rel, ph = 0, inc = e.f / sr;
      var pan = e.pan || 0, gl = Math.cos((pan + 1) * Math.PI / 4) * 1.414, gr = Math.sin((pan + 1) * Math.PI / 4) * 1.414, oL = e.duck ? PL : L, oR = e.duck ? PR : Rr;
      var nv = 0, nc = 0, lp = 0, k = { pulse: 1, tri: 2, sine: 3, kick: 4, sweep: 5, rise: 6 }[e.w] || 7, duty = e.duty, ev = e.v;
      var dk = Math.exp(-1 / ((e.dec || (k === 4 ? 0.09 : 0.012)) * sr)), dkf = Math.exp(-1 / (0.035 * sr)), ex = 1, exf = 1, at = s0 % N, vib = e.vib, vd = (e.vd || 0) * sr, w55 = TAU * 5.5 / sr, ra = 1 / atk, rl = 1 / len, rr = 1 / rel;
      for (var i = 0; i < tot; i++, at++) {
        if (at >= N) at -= N;
        var env, x, q;
        if (k === 4 || k === 7) { env = ex; ex *= dk; }
        else if (k === 5 || k === 6) { var u = i * rl; env = i < len ? (k === 5 ? u * u : u * u * u) : Math.max(0, 1 - (i - len) * rr); }
        else if (i < atk) env = i * ra; else if (i < len) env = 1 - 0.3 * i * rl; else { q = 1 - (i - len) * rr; env = 0.7 * q * q; }
        switch (k) {
          case 1: x = (ph < duty ? 1 : -1) + blep(ph, inc) - blep((ph - duty + 1) % 1, inc); break;
          case 2: x = 4 * Math.abs(ph - 0.5) - 1; break;
          case 3: x = Math.sin(TAU * ph); break;
          case 4: x = Math.sin(TAU * ph); inc = (e.f * exf + 42) / sr; exf *= dkf; break;
          case 5: x = 4 * Math.abs(ph - 0.5) - 1; inc = e.f * Math.pow(4, Math.min(1, i * rl)) / sr; break;
          case 6: if (nc-- <= 0) { nv = nz() * 2 - 1; nc = 1; } var u2 = Math.min(1, i * rl); lp += (0.02 + 0.5 * u2 * u2) * (nv - lp); x = lp; break;
          default: if (nc-- <= 0) { nv = nz() * 2 - 1; nc = 2; } x = nv;
        }
        ph += vib ? inc * (1 + vib * Math.min(1, Math.max(0, i - vd) / (0.15 * sr)) * Math.sin(i * w55)) : inc;
        if (ph >= 1) ph -= Math.floor(ph);
        var v = x * ev * env; oL[at] += v * gl; oR[at] += v * gr;
      }
    });
    // sidechain pump: pads dip on each beat and swell back (modern pumping), then join the mix
    var bt = c.beat * sr, i, j;
    for (i = 0; i < N; i++) { var ph2 = (i % bt) / sr, g2 = 1 - 0.65 * Math.exp(-ph2 / 0.09) * (ph2 < 0.004 ? ph2 / 0.004 : 1); L[i] += PL[i] * g2; Rr[i] += PR[i] * g2; }
    PL = PR = null;
    // ping-pong echo (dotted 8th-ish) and a big circular reverb (4 combs per side, decorrelated L/R)
    function wrapComb(src, dst, D, fb, mix) { var w = new Float32Array(N), W = Math.min(N, 3 * sr); for (var pass = 0; pass < 2; pass++) for (var q = 0; q < (pass ? W : N); q++) { var r = q - D; if (r < 0) r += N; w[q] = src[q] + fb * w[r]; } for (q = 0; q < N; q++) dst[q] += mix * w[q]; }
    var D = Math.round(c.echo * sr), eL = new Float32Array(N), eR = new Float32Array(N);
    for (var pass = 0; pass < 2; pass++) for (i = 0; i < (pass ? Math.min(N, 4 * sr) : N); i++) { var a1 = i - D; if (a1 < 0) a1 += N; eL[i] = 0.35 * (Rr[a1] + eR[a1]); eR[i] = 0.35 * (L[a1] + eL[a1]); }
    var mL = new Float32Array(N); for (i = 0; i < N; i++) mL[i] = 0.5 * (L[i] + Rr[i]);
    var vL = new Float32Array(N), vR = new Float32Array(N);
    [0.0297, 0.0371, 0.0437].forEach(function (t, q) { wrapComb(mL, vL, Math.round(t * sr * 2.2), 0.8, 0.06); wrapComb(mL, vR, Math.round((t + 0.0023 * (q + 1)) * sr * 2.2), 0.8, 0.06); });
    mL = null;
    // soften the reverb (one-pole ~2.5 kHz)
    var ar = 1 - Math.exp(-TAU * 2500 / sr);
    var WU = Math.max(0, N - sr); [vL, vR].forEach(function (b) { var y = 0, q; for (q = WU; q < N; q++) y += ar * (b[q] - y); for (q = 0; q < N; q++) { y += ar * (b[q] - y); b[q] = y; } });
    for (i = 0; i < N; i++) { L[i] += 0.55 * eL[i] + vL[i]; Rr[i] += 0.55 * eR[i] + vR[i]; }
    eL = eR = vL = vR = null;
    // 2-pole low-pass ~3 kHz; over the intro it sweeps up from ~400 Hz (filter-sweep build)
    var introN = Math.round(c.intro * sr), aFull = 1 - Math.exp(-TAU * 3000 / sr), coef = new Float32Array(introN);
    for (i = 0; i < introN; i++) coef[i] = 1 - Math.exp(-TAU * 400 * Math.pow(7.5, i / introN) / sr);
    [L, Rr].forEach(function (b) { var y1 = 0, y2 = 0, q; for (q = WU; q < N; q++) { y1 += aFull * (b[q] - y1); y2 += aFull * (y1 - y2); } for (q = 0; q < N; q++) { var cf = q < introN ? coef[q] : aFull; y1 += cf * (b[q] - y1); y2 += cf * (y1 - y2); b[q] = y2; } });
    // DC blocker, two passes so its state wraps
    [L, Rr].forEach(function (b) { var xp = 0, yp = 0, o, q, last = b[N - 1]; for (q = WU; q < N; q++) { o = b[q] - xp + 0.997 * yp; xp = b[q]; yp = o; } for (q = 0; q < N; q++) { o = b[q] - xp + 0.997 * yp; xp = b[q]; yp = o; b[q] = o; } });
    var pk = 0; for (i = 0; i < N; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(Rr[i]));
    var g = pk > 0 ? 0.8 / pk : 1; for (i = 0; i < N; i++) { L[i] *= g; Rr[i] *= g; } // peak 0.8 before the volume gain (max 0.55)
    return { samples: L, samplesR: Rr, sampleRate: sr, seconds: c.length, title: c.title };
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
      var buf = ctx.createBuffer(r.samplesR ? 2 : 1, r.samples.length, r.sampleRate); buf.getChannelData(0).set(r.samples); if (r.samplesR) buf.getChannelData(1).set(r.samplesR);
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
