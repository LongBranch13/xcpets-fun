/* Site-wide playlist (music-playlist-1107, more-wub-1107). Original loops only: pulse, triangle, sine and noise, no samples.
 * Chill loops stay soft and slow. 8-bit loops are written note by note. New electronic tracks use the same
 * chip writer with their own drum kit, bass motion and melody (drum and bass, trance, synthwave, house,
 * dubstep, techno, jungle). Nothing here is a copied melody.
 * Each song keeps its written melody, then resolves with a short original cadence that thins out, a 4s fade,
 * and a 1.5s crossfade into the next playlist song. The melodies themselves are not rewritten.
 * The speaker button in js/xc-select.js loads this file on the first tap. One playlist per style plays on
 * every page and advances when a song ends. The browser player remembers the song and position in sessionStorage.
 * Same file renders preview audio in Node: tools/render-ambient-music.js */
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
    yard: { title: 'Cozy Yard (chill)', genre: 'Chill', bpm: 66, seed: 11, scale: [0, 2, 4, 7, 9], duty: 0.25, lead: 0.07, bass: 0.10, hat: 0, swing: 0, pad: 0.035, arpV: 0.028,
      prog: ['C4 M', 'A3 m', 'F3 M', 'G3 M', 'C4 M', 'E3 m', 'F3 M', 'G3 M', 'A3 m', 'F3 M', 'C4 M', 'G3 M'],
      form: 'AABA', tempo: { A: 1, B: 1.2 }, density: 0.18, arp: 2, bassPat: [0, null, null, null, null, null, null, null], hatPat: [] },
    cemetery: { title: 'Misty Cemetery (chill)', genre: 'Chill', bpm: 58, seed: 66, scale: [0, 2, 3, 7, 8], duty: 0.125, lead: 0.06, bass: 0.10, hat: 0, swing: 0, pad: 0.04, arpV: 0.022,
      prog: ['A3 m', 'A3 m', 'F3 M', 'E3 M', 'D3 m', 'A3 m', 'F3 M', 'E3 M', 'A3 m', 'F3 M'],
      form: 'ABAB', tempo: { A: 0.92, B: 1.12 }, density: 0.14, echo: true, arp: 4, bassPat: [0, null, null, null, null, null, null, null], hatPat: [] },
    arena: { title: 'Sunset Arena (chill)', genre: 'Chill', bpm: 72, seed: 690, scale: [0, 2, 4, 7, 9, 11], duty: 0.25, lead: 0.065, bass: 0.10, hat: 0, swing: 0, pad: 0.035, arpV: 0.03,
      prog: ['F3 M', 'G3 M', 'E3 m', 'A3 m', 'D3 m', 'G3 M', 'C4 M', 'C4 M', 'F3 M', 'G3 M', 'E3 m', 'A3 m', 'D3 m', 'E3 m', 'F3 M', 'G3 M'],
      form: 'AABB', tempo: { A: 0.9, B: 1.18 }, density: 0.2, arp: 2, bassPat: [0, null, null, null, 7, null, null, null], hatPat: [] }
  };

  function chordTones(c) { var p = c.split(' '); var r = n(p[0]), q = p[1]; return [r, r + (q === 'm' ? 3 : 4), r + 7, r + (q === 'M' ? 11 : 10)]; } // M = maj7, m = m7, 7 = dominant 7
  var FADE_S = 4, XFADE_S = 1.5; // ending fade 3-5s, playlist crossfade 1-2s (owner, Nov 8)
  function leadTonic(root) { var t = root; while (t < 60) t += 12; while (t > 72) t -= 12; return t; }
  // Original closing cadence after the written bars. Does not edit those bars. One bar of melody, then a held tonic under the fade.
  function pushOutro(ev, opt) {
    var hzFn = opt.hz, t0 = opt.t0, bar = opt.bar, fade = opt.fade || FADE_S, tonic = opt.tonic, minor = opt.minor;
    var deg = opt.variant === 1 ? (minor ? [3, 5, 7, 0] : [4, 5, 7, 0]) : opt.variant === 2 ? (minor ? [7, 3, 2, 0] : [7, 4, 2, 0]) : (minor ? [7, 5, 3, 0] : [7, 5, 4, 0]);
    var slots = opt.variant === 1 ? [0, 0.5, 0.66, 0.82] : opt.variant === 2 ? [0.1, 0.32, 0.55, 0.78] : [0, 0.25, 0.5, 0.75];
    var holds = opt.variant === 1 ? [0.42, 0.14, 0.14, 0.22] : [0.22, 0.2, 0.2, 0.3];
    var duty = opt.duty || 0.25, lead = opt.lead || 0.05, i, p, tN, d;
    for (i = 0; i < 4; i++) {
      tN = t0 + slots[i] * bar; d = holds[i] * bar; p = tonic + deg[i];
      ev.push({ t: tN, d: d, f: hzFn(p), v: lead, w: 'tri', att: 0.03, rel: 0.32, vib: 0.005, vd: 0.12 });
      if (opt.pulse) {
        ev.push({ t: tN, d: d, f: hzFn(p) * 1.0035, v: lead * 0.8, w: 'pulse', duty: duty, att: 0.02, rel: 0.26, pan: 0.4 });
        ev.push({ t: tN, d: d, f: hzFn(p) * 0.9965, v: lead * 0.8, w: 'pulse', duty: duty, att: 0.02, rel: 0.26, pan: -0.4 });
      }
    }
    ev.push({ t: t0 + bar * 0.98, d: fade * 0.86, f: hzFn(tonic), v: lead * 0.65, w: 'tri', att: 0.08, rel: 0.8, vib: 0.004, vd: 0.25 });
    var outroLen = bar + fade;
    (opt.pad || []).forEach(function (pp, q) {
      ev.push({ t: t0, d: outroLen, f: hzFn(pp) * (1 + 0.002 * (q - 1)), v: opt.padV || 0.018, w: 'tri', att: 0.3, rel: 0.9, pan: (q - 1) * 0.5 });
    });
    if (opt.bass != null) ev.push({ t: t0, d: outroLen * 0.92, f: hzFn(opt.bass), v: opt.bassV || 0.1, w: 'sine', att: 0.02, rel: 0.55 });
    if (opt.kick) ev.push({ t: t0, d: 0.14, f: 90, v: 0.1, w: 'kick', rel: 0.02 });
    return outroLen;
  }

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
    var body = pos, homeC = chordTones(T.prog[0]), qC = T.prog[0].split(' ')[1], barDur = 16 * (60 / T.bpm / 4);
    var outroLen = pushOutro(ev, { t0: body, bar: barDur, tonic: leadTonic(homeC[0]), minor: qC === 'm', duty: T.duty, hz: hz, lead: T.lead * 0.85, pulse: true, pad: [homeC[1], homeC[2], homeC[3]], padV: (T.pad || 0.03) * 0.7, bass: homeC[0] - 12, bassV: T.bass, variant: (homeC[0] + Math.round(T.bpm)) % 3, kick: true });
    return { events: ev, length: body + outroLen, body: body, title: T.title, fade: FADE_S };
  }

  // ---- 8-bit style (default). Owner Nov 4: "All need to be epic." Grand classic-RPG overworld / boss feel, each track distinct.
  // Original melodies, written here note by note. One chord per bar; each bar has T.meter steps ('.' rest, '-' hold).
  // Form: Intro build (4) | A x2 | B x2 | A x2 (+harmony, counter) | Bridge x2 | Climax = B x2 lifted by T.lift semitones, all layers | turnaround (1).
  // Lead sits ~G3-E5 (pulse + triangle mix, low-passed ~3 kHz); 3rd/6th harmony voice; held chord pad (organ on crypt); strong triangle bass; noise drums.
  var CHIP = {
    meadow: { title: 'Pixel Meadow', genre: '8-bit', bpm: 108, meter: 8, duty: 0.25, lift: 2, // heroic overworld, D major, 4/4
      ic: ['D3 T', 'G2 T', 'B2 t', 'A2 s'], I: ['. . . . . . . .', '. . . . . . . .', 'D4 - - - F#4 - - -', 'A4 - - - - - A3 -'],
      ac: ['D3 T', 'A2 T', 'B2 t', 'G2 T'], Ac2: ['E3 m', 'A2 7'],
      A: ['D4 - - A3 D4 - F#4 -', 'E4 - - C#4 A3 - E4 -', 'F#4 - E4 D4 B3 - D4 F#4', 'G4 - - - - - A4 -'], Aa: ['G4 - F#4 E4 B3 - E4 G4', 'A4 - - - - - . .'],
      bc: ['G2 M', 'A2 T', 'F#3 t', 'B2 t'], Bc2: ['G2 T', 'A2 7'],
      B: ['B4 - - A4 G4 - D4 -', 'C#5 - - B4 A4 - E4 -', 'D5 - C#5 B4 F#4 - A4 C#5', 'D5 - - - B4 - - -'], Ba: ['B4 - D5 - G4 - B4 D5', 'C#5 - - - E5 - - -'],
      rc: ['B2 t', 'G2 T', 'E3 t', 'A2 s'], Rc2: ['G2 T', 'A2 7'],
      R: ['F#4 - - - D4 - B3 -', 'D4 - - - B3 - G3 -', 'G4 - - - E4 - B3 -', 'A4 - - - - - - -'], Ra: ['B4 - A4 G4 D4 - G4 B4', 'C#5 - B4 A4 E4 - C#5 E5'],
      oc: 'A2 7', O: '. . . . A3 - C#4 E4' },
    parade: { title: 'Snack Parade', genre: '8-bit', bpm: 120, meter: 12, duty: 0.25, lift: 2, // regal festival march, Bb major, 12/8
      ic: ['Bb2 T', 'Bb2 T', 'Eb3 T', 'F2 s'], I: ['. . . . . . . . . . . .', '. . . . . . . . . . . .', 'Bb3 - - D4 - - F4 - - Bb4 - -', 'A4 - - - - - F4 - - - - -'],
      ac: ['Bb2 T', 'F2 T', 'G2 t', 'Eb2 T'], Ac2: ['C3 m', 'F2 7'],
      A: ['F4 - - Bb4 - - D5 - C5 Bb4 - -', 'C5 - - A4 - - F4 - G4 A4 - -', 'Bb4 - - G4 - - D4 - Eb4 F4 - -', 'G4 - - - - - Eb4 - - - - -'], Aa: ['Eb4 - - G4 - - C5 - Bb4 A4 - -', 'F4 - - - - - . . . C4 D4 Eb4'],
      bc: ['Eb2 M', 'F2 T', 'D3 t', 'G2 t'], Bc2: ['Eb2 T', 'F2 7'],
      B: ['G4 - - Bb4 - - Eb5 - - D5 - -', 'C5 - - A4 - - F4 - - C5 - -', 'D5 - - A4 - - F4 - G4 A4 - -', 'Bb4 - - - - - G4 - - D4 - -'], Ba: ['Eb4 - - G4 - - Bb4 - - Eb5 - -', 'D5 - - C5 - - A4 - - F4 - -'],
      rc: ['G2 t', 'D3 t', 'Eb2 T', 'F2 s'], Rc2: ['Eb2 T', 'F2 7'],
      R: ['Bb4 - - - - - G4 - - D4 - -', 'A4 - - - - - F4 - - D4 - -', 'G4 - - Bb4 - - Eb5 - - - - -', 'F4 - - - - - - - - - - -'], Ra: ['G4 - - Bb4 - - Eb5 - D5 C5 - -', 'C5 - - - - - A4 - - F4 G4 A4'],
      oc: 'F2 7', O: '. . . . . . F3 - - A3 - -' },
    'arena-chip': { title: 'Arena Rush', genre: '8-bit', bpm: 152, meter: 8, duty: 0.5, lift: 1, // boss battle, E minor, 4/4
      ic: ['E2 t', 'E2 t', 'E2 t', 'B2 7'], I: ['. . . . . . . .', '. . . . . . . .', 'E4 - E4 - E4 - E4 E4', 'D#4 - - - B3 - - -'],
      ac: ['E2 t', 'C3 T', 'D3 T', 'B2 7'], Ac2: ['A2 t', 'B2 7'],
      A: ['E4 - - B3 E4 - G4 -', 'G4 - - E4 C4 - E4 G4', 'F#4 - - D4 A4 - F#4 D4', 'D#4 - - - B3 - F#4 -'], Aa: ['C5 - B4 A4 E4 - A4 C5', 'B4 - - - D#4 - F#4 -'],
      bc: ['C3 T', 'D3 T', 'B2 t', 'E2 t'], Bc2: ['A2 t', 'B2 7'],
      B: ['G4 - G4 A4 B4 - A4 G4', 'A4 - A4 B4 C5 - B4 A4', 'B4 - F#4 - D4 F#4 B4 D5', 'E5 - - - B4 - G4 -'], Ba: ['A4 - C5 - E5 - D5 C5', 'B4 - A4 - F#4 - D#4 -'],
      rc: ['A2 t', 'F2 T', 'C3 T', 'B2 7'], Rc2: ['A2 t', 'B2 7'],
      R: ['A4 - - - C5 - - -', 'A4 - - - F4 - - -', 'G4 - - - E4 - C4 -', 'B3 - - - D#4 - F#4 -'], Ra: ['C5 - B4 C5 E5 - C5 A4', 'B4 - - - - - - -'],
      oc: 'B2 7', O: 'B3 - - - D#4 - F#4 -' },
    crypt: { title: 'Lantern Crypt', genre: '8-bit', bpm: 84, meter: 6, duty: 0.25, lift: 0, organ: 1, // dark cathedral, C harmonic minor, 3/4
      ic: ['C3 t', 'Ab2 T', 'F2 t', 'G2 7'], I: ['. . . . . .', '. . . . . .', 'C4 - - - Eb4 -', 'D4 - - - B3 -'],
      ac: ['C3 t', 'Ab2 T', 'F2 t', 'G2 7'], Ac2: ['Ab2 M', 'G2 7'],
      A: ['C4 - Eb4 - G4 -', 'Ab4 - - G4 F4 Eb4', 'F4 - - Eb4 D4 C4', 'B3 - - - G3 -'], Aa: ['Eb4 - F4 - G4 Ab4', 'G4 - - - B3 -'],
      bc: ['F2 t', 'C3 t', 'Ab2 T', 'G2 T'], Bc2: ['Db3 T', 'G2 7'],
      B: ['Ab4 - - - G4 F4', 'G4 - - - Eb4 C4', 'C5 - - Ab4 Eb4 C4', 'B3 - D4 - G4 -'], Ba: ['F4 - Ab4 - Db5 -', 'B4 - - - G4 -'],
      rc: ['Eb3 T', 'B2 o', 'C3 t', 'G2 7'], Rc2: ['Ab2 T', 'G2 7'],
      R: ['G4 - - - Bb4 -', 'Ab4 - - - F4 -', 'G4 - - - Eb4 -', 'D4 - - - B3 -'], Ra: ['C5 - - Ab4 Eb4 C4', 'D4 - F4 - B4 -'],
      oc: 'G2 7', O: 'D4 - - - B3 -' },
    // New electronic tracks: 16 sixteenths per bar (div 4). Melodies written for this game, not borrowed.
    'night-market': { title: 'Night Market', genre: 'Drum and bass', bpm: 174, meter: 16, div: 4, duty: 0.25, lift: 0, kit: 'dnb', bass: 'reese', pump: 0.22, pad: 0.028, arpEvery: 2, arpV: 0.016, counter: false,
      ic: ['F#2 t', 'F#2 t', 'C#2 s', 'C#2 7'],
      I: ['. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', 'F#4 - . . A4 - . . G#4 - . . F#4 - . .', 'E4 - . . C#4 - . . . . . . . . . .'],
      ac: ['F#2 t', 'B2 t', 'D2 T', 'E2 T'], Ac2: ['C#2 t', 'C#2 7'],
      A: ['F#4 - . . A4 - G#4 - F#4 - . . E4 - F#4 -', 'D5 - C#5 - A4 - . . B4 - A4 - G#4 - . .', 'F#4 - A4 - C#5 - B4 - A4 - G#4 - F#4 - . .', 'E4 - . . G#4 - . . F#4 - - - - - - -'],
      Aa: ['A4 - B4 - C#5 - D5 - C#5 - B4 - A4 - . .', 'F#5 - . . E5 - C#5 - . . A4 - . . . .'],
      bc: ['D2 T', 'A2 T', 'E2 T', 'C#2 t'], Bc2: ['B2 t', 'C#2 7'],
      B: ['C#5 - . . E5 - D5 - C#5 - B4 - A4 - G#4 -', 'B4 - D5 - F#5 - E5 - D5 - C#5 - B4 - . .', 'A4 - C#5 - E5 - F#5 - E5 - C#5 - A4 - . .', 'G#4 - A4 - B4 - C#5 - - - - - - - . .'],
      Ba: ['F#5 - E5 - D5 - C#5 - B4 - A4 - G#4 - . .', 'F#5 - - - - - E5 - D5 - C#5 - . . . .'],
      rc: ['F#2 t', 'E2 T', 'D2 T', 'C#2 s'], Rc2: ['B2 t', 'C#2 7'],
      R: ['F#4 - - - A4 - - - C#5 - - - A4 - - .', 'E4 - - - G#4 - - - B4 - - - G#4 - - .', 'D4 - - - F#4 - - - A4 - - - F#4 - - .', 'C#4 - - - E4 - - - G#4 - - - - - - .'],
      Ra: ['A4 - - - B4 - - - C#5 - - - E5 - - .', 'F#5 - - - - - E5 - C#5 - - - . . . .'],
      oc: 'C#2 7', O: 'C#4 - E4 - G#4 - . . . . . . . . . .' },
    'glass-gate': { title: 'Glass Gate', genre: 'Trance', bpm: 136, meter: 16, div: 4, duty: 0.5, lift: 0, kit: 'trance', bass: 'offbeat', bassSeq: [0, 0, 7, 12], pump: 0.72, pad: 0.05, arpEvery: 1, arpV: 0.024,
      ic: ['A2 t', 'A2 t', 'F2 T', 'E2 7'],
      I: ['. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', 'A4 - - - C5 - - - E5 - - - . . . .', 'E4 - G#4 - B4 - E5 - . . . . . . . .'],
      ac: ['A2 t', 'F2 T', 'C3 T', 'G2 T'], Ac2: ['D2 t', 'E2 7'],
      A: ['A4 - E5 - E5 - D5 - C5 - A4 - B4 - C5 .', 'D5 - - - B4 - G4 - A4 - C5 - B4 - A4 -', 'E5 - D5 - C5 - A4 - C5 - E5 - D5 - C5 .', 'B4 - - - E5 - - - A4 - - - - - - -'],
      Aa: ['C5 - D5 - E5 - G5 - E5 - D5 - C5 - B4 .', 'A4 - - - - - C5 - E5 - - - . . . .'],
      bc: ['F2 T', 'C3 T', 'G2 T', 'A2 t'], Bc2: ['D2 t', 'E2 7'],
      B: ['E5 - G5 - E5 - D5 - C5 - A4 - B4 - C5 .', 'G5 - E5 - C5 - D5 - E5 - G5 - E5 - C5 .', 'A4 - C5 - E5 - G5 - E5 - D5 - C5 - B4 .', 'A4 - - - C5 - E5 - A4 - - - - - - -'],
      Ba: ['E5 - D5 - C5 - B4 - A4 - G4 - A4 - B4 .', 'C5 - - - B4 - A4 - G#4 - - - . . . .'],
      rc: ['A2 t', 'G2 T', 'F2 T', 'E2 7'], Rc2: ['D2 t', 'E2 7'],
      R: ['A4 - - - C5 - - - E5 - - - C5 - - .', 'G4 - - - B4 - - - D5 - - - B4 - - .', 'F4 - - - A4 - - - C5 - - - A4 - - .', 'E4 - - - G#4 - - - B4 - - - - - - .'],
      Ra: ['C5 - - - D5 - - - E5 - - - G5 - - .', 'E5 - - - D5 - - - C5 - - - B4 - - .'],
      oc: 'E2 7', O: 'E4 - G#4 - B4 - D5 - . . . . . . . .' },
    'neon-rook': { title: 'Neon Rook', genre: 'Synthwave', bpm: 104, meter: 16, div: 4, duty: 0.125, lift: 0, kit: 'synthwave', bass: 'pump8', bassSeq: [0, 12, 0, 12, 0, 7, 0, 12], pump: 0.68, pad: 0.052, arpEvery: 2, arpV: 0.022,
      ic: ['D2 t', 'D2 t', 'Bb2 T', 'A2 7'],
      I: ['. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', 'D4 - - - A4 - - - F4 - - - D4 - - .', 'E4 - - - C#4 - - - D4 - - - . . . .'],
      ac: ['D2 t', 'Bb2 T', 'F2 T', 'C3 T'], Ac2: ['G2 t', 'A2 7'],
      A: ['A4 - D5 - F5 - D5 - A4 - G4 - F4 - E4 .', 'F4 - A4 - D5 - C5 - A4 - G4 - F4 - D4 .', 'D5 - - - C5 - A4 - Bb4 - A4 - G4 - F4 .', 'E4 - - - A4 - - - D4 - - - - - - -'],
      Aa: ['F5 - D5 - A4 - D5 - F5 - E5 - D5 - C5 .', 'D5 - - - - - A4 - . . . . . . . .'],
      bc: ['G2 t', 'D2 t', 'Bb2 T', 'A2 7'], Bc2: ['F2 T', 'A2 7'],
      B: ['G4 - Bb4 - D5 - Bb4 - G4 - F4 - D4 - Bb3 .', 'A4 - D5 - F5 - D5 - A4 - G4 - E4 - C4 .', 'D5 - E5 - F5 - G5 - F5 - D5 - C5 - A4 .', 'A4 - - - G4 - E4 - D4 - - - - - - -'],
      Ba: ['F5 - E5 - D5 - C5 - Bb4 - A4 - G4 - F4 .', 'E4 - - - A4 - C5 - D5 - - - . . . .'],
      rc: ['D2 t', 'Bb2 T', 'C3 T', 'A2 7'], Rc2: ['G2 t', 'A2 7'],
      R: ['D4 - - - F4 - - - A4 - - - F4 - - .', 'Bb3 - - - D4 - - - F4 - - - D4 - - .', 'C4 - - - E4 - - - G4 - - - E4 - - .', 'A3 - - - C#4 - - - E4 - - - - - - .'],
      Ra: ['F4 - - - G4 - - - A4 - - - D5 - - .', 'A4 - - - G4 - F4 - E4 - - - . . . .'],
      oc: 'A2 7', O: 'A3 - C#4 - E4 - G4 - . . . . . . . .' },
    'block-party': { title: 'Block Party', genre: 'House', bpm: 122, meter: 16, div: 4, duty: 0.25, lift: 0, kit: 'house', clap: 1, swing: 0.22, pump: 0.75, pad: 0.04, arpEvery: 2, arpV: 0.018, counter: false,
      bassPat: [0, null, 12, 0, null, 0, 7, 12, 0, null, 12, null, 10, 12, 7, null],
      ic: ['F2 t', 'F2 t', 'Eb2 T', 'C2 7'],
      I: ['. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', 'F4 . . . Ab4 . . . C5 . . . . . . .', 'E4 . . . G4 . . . Bb4 . . . . . . .'],
      ac: ['F2 t', 'Ab2 T', 'Eb2 T', 'C2 7'], Ac2: ['Bb2 T', 'C2 7'],
      A: ['F4 . . . Ab4 . C5 . . . Bb4 . Ab4 . G4 .', 'Ab4 . . . G4 . F4 . . . Eb4 . . . C4 .', 'F4 . Ab4 . C5 . . . Db5 . C5 . Ab4 . . .', 'G4 . . . . . F4 . . . . . . . . .'],
      Aa: ['C5 . Bb4 . Ab4 . G4 . F4 . Eb4 . C4 . . .', 'F4 . . . . . Ab4 . C5 . . . . . . .'],
      bc: ['Db2 T', 'Eb2 T', 'F2 t', 'C2 7'], Bc2: ['Ab2 T', 'C2 7'],
      B: ['C5 . . . F5 . . . Eb5 . C5 . Ab4 . . .', 'Bb4 . . . Db5 . . . C5 . Ab4 . G4 . . .', 'Ab4 . C5 . Eb5 . . . Db5 . C5 . Bb4 . Ab4 .', 'G4 . . . Bb4 . . . C5 . . . . . . .'],
      Ba: ['F5 . Eb5 . C5 . Ab4 . G4 . F4 . Eb4 . C4 .', 'F4 . . . . . . . C5 . . . . . . .'],
      rc: ['F2 t', 'Eb2 T', 'Db2 T', 'C2 7'], Rc2: ['Bb2 t', 'C2 7'],
      R: ['F4 . . . . . Ab4 . . . . . C5 . . .', 'Eb4 . . . . . G4 . . . . . Bb4 . . .', 'Db4 . . . . . F4 . . . . . Ab4 . . .', 'E4 . . . . . G4 . . . . . Bb4 . . .'],
      Ra: ['C5 . . . Ab4 . . . F4 . . . G4 . . .', 'F4 . . . . . . . . . . . . . . .'],
      oc: 'C2 7', O: 'C4 . E4 . G4 . Bb4 . . . . . . . . .' },
    'rift-wub': { title: 'Rift Wub', genre: 'Dubstep', bpm: 140, meter: 16, div: 4, duty: 0.5, lift: 0, kit: 'dubstep', bass: 'wobble', wobGap: 'xxxxxxx..xxxxxxx', bareDrop: 1, pump: 0.5, pad: 0.022, arpEvery: 4, arpV: 0.014, counter: false,
      ic: ['E2 t', 'E2 t', 'C2 t', 'B2 7'],
      I: ['. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', 'E4 . . . B3 . . . E4 . . . . . . .', 'D#4 . . . F#4 . . . B3 . . . . . . .'],
      ac: ['E2 t', 'C2 T', 'G2 T', 'Bb2 T'], Ac2: ['D2 T', 'B2 7'],
      A: ['E4 . . . . . G4 . . . . . F#4 . . .', 'D4 . . . . . E4 . . . . . B3 . . .', 'G4 . . . . . A4 . . . B4 . . . G4 .', 'F#4 . . . . . . . E4 . . . . . . .'],
      Aa: ['B4 . . . G4 . . . E4 . . . D4 . . .', 'E4 . . . . . . . . . . . . . . .'],
      bc: ['E2 t', 'G2 T', 'D2 T', 'Bb2 T'], Bc2: ['C2 T', 'B2 7'],
      B: ['E4 . . . . . . . B4 . . . . . . .', 'D5 . . . . . B4 . . . . . G4 . . .', 'A4 . . . . . G4 . . . F#4 . . . E4 .', 'E4 . . . . . . . . . . . . . . .'],
      Ba: ['B4 . G4 . E4 . . . D4 . B3 . . . . .', 'E4 . . . . . F#4 . G4 . . . . . . .'],
      rc: ['E2 t', 'C2 T', 'A2 t', 'B2 7'], Rc2: ['D2 T', 'B2 7'],
      R: ['E4 - - - G4 - - - B4 - - - G4 - - .', 'A4 - - - G4 - - - F#4 - - - E4 - - .', 'D4 - - - F#4 - - - A4 - - - F#4 - - .', 'D#4 - - - F#4 - - - B4 - - - - - - .'],
      Ra: ['G4 - - - A4 - - - B4 - - - E5 - - .', 'D5 - - - B4 - - - G4 - - - F#4 - - .'],
      oc: 'B2 7', O: 'B3 . D#4 . F#4 . . . . . . . . . . .' },
    'grid-ritual': { title: 'Grid Ritual', genre: 'Techno', bpm: 132, meter: 16, div: 4, duty: 0.125, lift: 0, kit: 'techno', bass: 'offbeat', bassSeq: [0, 0, 0, 0], snareV: 0.55, pump: 0.62, pad: 0.03, arpEvery: 2, arpV: 0.015, counter: false,
      ic: ['A2 t', 'A2 t', 'A2 t', 'G2 s'],
      I: ['. . . . . . . . . . . . . . . .', 'A3 - . . E4 - . . A3 - . . E4 - . .', 'A3 - E4 - G4 - E4 - A3 - E4 - G4 - E4 .', 'G4 - E4 - D4 - B3 - . . . . . . . .'],
      ac: ['A2 t', 'A2 t', 'F2 T', 'E2 t'], Ac2: ['D2 t', 'E2 7'],
      A: ['A3 - E4 - G4 - E4 - A3 - E4 - G4 - E4 .', 'A3 - E4 - G4 - E4 - C4 - E4 - G4 - D4 .', 'A3 - F4 - E4 - C4 - A3 - E4 - D4 - E4 .', 'B3 - E4 - G4 - E4 - A3 - - - - - - -'],
      Aa: ['C4 - E4 - A4 - E4 - G4 - E4 - D4 - C4 .', 'A3 - - - E4 - - - . . . . . . . .'],
      bc: ['A2 t', 'C3 T', 'G2 T', 'E2 t'], Bc2: ['D2 t', 'E2 7'],
      B: ['A4 - C5 - E5 - C5 - A4 - G4 - E4 - C4 .', 'B4 - D5 - E5 - D5 - B4 - G4 - E4 - D4 .', 'C5 - A4 - E4 - C4 - D4 - E4 - G4 - A4 .', 'E4 - - - G4 - B4 - A4 - - - - - - -'],
      Ba: ['A4 - G4 - E4 - D4 - C4 - B3 - A3 - E4 .', 'A3 - - - - - E4 - . . . . . . . .'],
      rc: ['A2 t', 'F2 T', 'C3 T', 'E2 7'], Rc2: ['D2 t', 'E2 7'],
      R: ['A4 - - - G4 - - - E4 - - - C4 - - .', 'D4 - - - E4 - - - G4 - - - E4 - - .', 'A3 - - - C4 - - - E4 - - - C4 - - .', 'B3 - - - D4 - - - E4 - - - - - - .'],
      Ra: ['E4 - - - G4 - - - A4 - - - C5 - - .', 'B4 - - - A4 - - - G4 - - - E4 - - .'],
      oc: 'E2 7', O: 'E4 - G4 - B4 - D5 - . . . . . . . .' },
    'canopy-break': { title: 'Canopy Break', genre: 'Jungle', bpm: 168, meter: 16, div: 4, duty: 0.25, lift: 0, kit: 'jungle', pump: 0.2, pad: 0.026, arpEvery: 2, arpV: 0.016, counter: false,
      bassPat: [0, null, 0, 12, null, 0, null, 10, 0, null, 12, null, 0, 7, null, 12],
      ic: ['G2 t', 'G2 t', 'Eb2 T', 'D2 7'],
      I: ['. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', 'G4 . . . Bb4 . . . D5 . . . . . . .', 'F#4 . . . A4 . . . D5 . . . . . . .'],
      ac: ['G2 t', 'Eb2 T', 'Bb2 T', 'D2 T'], Ac2: ['C2 t', 'D2 7'],
      A: ['G4 . Bb4 . D5 . . . F5 . D5 . Bb4 . G4 .', 'F4 . G4 . A4 . Bb4 . A4 . G4 . F4 . D4 .', 'Bb4 . D5 . . . G4 . . . A4 . Bb4 . D5 .', 'A4 . . . F4 . . . G4 . . . . . . .'],
      Aa: ['D5 . Bb4 . G4 . Bb4 . D5 . F5 . D5 . Bb4 .', 'G4 . . . . . D5 . . . . . . . . .'],
      bc: ['G2 t', 'F2 T', 'Eb2 T', 'D2 7'], Bc2: ['Bb2 T', 'D2 7'],
      B: ['Bb4 . D5 . F5 . D5 . Bb4 . A4 . G4 . F4 .', 'G4 . A4 . Bb4 . D5 . Bb4 . A4 . G4 . D4 .', 'F5 . D5 . Bb4 . G4 . A4 . Bb4 . C5 . D5 .', 'D5 . . . A4 . . . G4 . . . . . . .'],
      Ba: ['F5 . Eb5 . D5 . C5 . Bb4 . A4 . G4 . F4 .', 'G4 . . . D4 . . . . . . . . . . .'],
      rc: ['G2 t', 'Eb2 T', 'C2 t', 'D2 7'], Rc2: ['F2 T', 'D2 7'],
      R: ['G4 - - - Bb4 - - - D5 - - - Bb4 - - .', 'Eb4 - - - G4 - - - Bb4 - - - G4 - - .', 'F4 - - - A4 - - - C5 - - - A4 - - .', 'F#4 - - - A4 - - - C5 - - - - - - .'],
      Ra: ['Bb4 - - - C5 - - - D5 - - - F5 - - .', 'D5 - - - Bb4 - - - G4 - - - F#4 - - .'],
      oc: 'D2 7', O: 'D4 . F#4 . A4 . C5 . . . . . . . . .' },
    // Original dubstep, same kit and wobble bass as Rift Wub, each with its own key, melody, wobble and drop.
    'bog-motor': { title: 'Bog Motor', genre: 'Dubstep', bpm: 140, meter: 16, div: 4, duty: 0.5, lift: 0, kit: 'dubstep', bass: 'wobble',
      wob: [0, 0, 0, 3, 3, 1, 0, 0, 0, 10, 10, 3, 1, 0, 0, 1],
      wobDuty: [0.12, 0.12, 0.5, 0.5, 0.15, 0.42, 0.18, 0.48, 0.1, 0.55, 0.3, 0.2, 0.45, 0.14, 0.4, 0.16],
      wobGap: 'xxxx..xxxx..xx.x', bareDrop: 1, pump: 0.42, pad: 0.02, arpEvery: 4, arpV: 0.012, counter: false,
      dropKit: { k: 'x.......x...x..x', s: '........x.......', h: '..x...x...x...x.', o: '......x.......x.' },
      ic: ['F2 t', 'F2 t', 'Db2 T', 'C2 7'],
      I: ['. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', 'C5 . . Ab4 . . . F4 . . . . . . . .', 'Eb4 . . . . F4 . G4 . . . Ab4 . . . .'],
      ac: ['F2 t', 'Ab2 T', 'Db2 T', 'C2 7'], Ac2: ['Bb2 t', 'C2 7'],
      A: ['Ab4 . . . F4 . . Eb4 . . . C4 . . . .', 'F4 . Ab4 . C5 . . . Ab4 . . F4 . . . .', 'Db5 . . C5 . . Ab4 . . F4 . . . Eb4 . .', 'C4 . . . . . . . F4 . . . . . . .'],
      Aa: ['C5 . . Ab4 . F4 . . Eb4 . . C4 . . . .', 'F4 . . . . . . . . . Ab4 . . . . .'],
      bc: ['F2 t', 'Db2 T', 'Eb2 T', 'C2 7'], Bc2: ['Ab2 T', 'C2 7'],
      B: ['F4 . . . Ab4 . C5 . . . . . . . . .', 'Eb5 . . . . . . . C5 . Ab4 . F4 . . .', 'Db5 . . . Bb4 . . . Ab4 . . . G4 . . .', 'F4 . . . . . . . . . . . . . . .'],
      Ba: ['C5 . . . Ab4 . . . . . F4 . . . . .', 'Eb4 . . F4 . . Ab4 . . . C5 . . . . .'],
      rc: ['F2 t', 'Db2 T', 'Bb2 t', 'C2 7'], Rc2: ['Ab2 T', 'C2 7'],
      R: ['F4 - - - Ab4 - - - C5 - - - . . . .', 'Db5 - - - C5 - - - Ab4 - - - F4 - - .', 'Eb4 - - - G4 - - - Bb4 - - - G4 - - .', 'E4 - - - G4 - - - C5 - - - - - - .'],
      Ra: ['Ab4 - - - C5 - - - Eb5 - - - C5 - - .', 'F5 - - - Eb5 - - - C5 - - - Ab4 - - .'],
      oc: 'C2 7', O: 'C4 . E4 . G4 . Bb4 . . . . . . . . .' },
    'gutter-bloom': { title: 'Gutter Bloom', genre: 'Dubstep', bpm: 146, meter: 16, div: 4, duty: 0.5, lift: 0, kit: 'dubstep', bass: 'wobble',
      wob: [0, 7, 0, 12, 7, 0, 3, 7, 12, 7, 0, 7, 3, 0, 7, 12],
      wobDuty: [0.2, 0.5, 0.15, 0.45, 0.22, 0.48, 0.12, 0.38, 0.18, 0.52, 0.14, 0.42, 0.2, 0.5, 0.16, 0.36],
      wobGap: 'x.x.xxx.x.x.xxxx', bareDrop: 1, pump: 0.58, pad: 0.018, arpEvery: 2, arpV: 0.013, counter: false,
      dropKit: { k: 'x...x.......x...', s: '....x..x.x..x..x', h: 'x.x.x.x.x.x.x.x.', o: '..x.......x.....' },
      ic: ['E2 T', 'E2 T', 'A2 T', 'B2 7'],
      I: ['. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', 'G#4 . B4 . . . E5 . . . . . D#5 . . .', 'B4 . . . . . G#4 . . . E4 . . . . .'],
      ac: ['E2 T', 'C#2 t', 'A2 T', 'B2 7'], Ac2: ['F#2 t', 'B2 7'],
      A: ['E5 . . . . D#5 . . C#5 . . B4 . . . .', 'C#5 . . B4 . . G#4 . . . . E4 . . . .', 'A4 . . B4 . C#5 . . E5 . . . D#5 . . .', 'B4 . . . . . . . . . . . E4 . . .'],
      Aa: ['G#4 . B4 . E5 . . . D#5 . B4 . G#4 . . .', 'E4 . . . . . . . . . . . . . . .'],
      bc: ['E2 T', 'G#2 t', 'A2 T', 'B2 7'], Bc2: ['C#2 t', 'B2 7'],
      B: ['. . E4 . . . G#4 . . . B4 . . . . .', 'C#5 . . . . B4 . . . G#4 . . E4 . . .', '. . A4 . . . G#4 . . . F#4 . . . E4 .', 'E5 . . . . . . . . . . . . . . .'],
      Ba: ['B4 . . G#4 . . E4 . . . D#4 . . . . .', '. . E4 . . . F#4 . . . G#4 . . B4 . .'],
      rc: ['E2 T', 'A2 T', 'F#2 t', 'B2 7'], Rc2: ['C#2 t', 'B2 7'],
      R: ['E5 - D#5 - C#5 - B4 - G#4 - . . . . . .', 'C#5 - B4 - A4 - G#4 - F#4 - . . . . . .', 'D#5 - . . C#5 - . . B4 - . . A4 - . .', 'B4 - - - - - A4 - G#4 - - - . . . .'],
      Ra: ['G#4 . . A4 . . B4 . . E5 . . . D#5 . .', 'B4 - - - G#4 - - - E4 - - - . . . .'],
      oc: 'B2 7', O: '. . . . B3 - D#4 - F#4 - . . . . . .' },
    'moss-clank': { title: 'Moss Clank', genre: 'Dubstep', bpm: 134, meter: 16, div: 4, duty: 0.5, lift: 0, kit: 'dubstep', bass: 'wobble',
      wob: [0, 12, 0, 12, 7, 12, 0, 3, 0, 12, 10, 0, 7, 12, 3, 0],
      wobDuty: [0.5, 0.14, 0.48, 0.12, 0.5, 0.16, 0.42, 0.1, 0.5, 0.18, 0.45, 0.12, 0.4, 0.15, 0.5, 0.2],
      wobGap: 'x.x.x.x.xxxx.x.x', bareDrop: 1, pump: 0.48, pad: 0.024, arpEvery: 8, arpV: 0.011, counter: false,
      dropKit: { k: 'x..x........x..x', s: '..........x..x..', h: 'x...x.x.x...x.x.', o: '....x...x.......' },
      ic: ['C2 t', 'C2 t', 'Ab2 T', 'G2 7'],
      I: ['. . . . . . . . . . . . . . . .', 'C4 . . . . . . . G4 . . . . . . .', 'Eb4 . G4 . . . C5 . . . . . Bb4 . . .', 'Ab4 . . . . . G4 . . . . . . . . .'],
      ac: ['C2 t', 'Eb2 T', 'Ab2 T', 'G2 7'], Ac2: ['F2 t', 'G2 7'],
      A: ['C5 . . Eb5 . . . C5 . . G4 . . . . .', 'Bb4 . . . Ab4 . . G4 . . . Eb4 . . . .', 'G4 . C5 . . . Eb5 . . . D5 . . C5 . .', 'Bb4 . . . . . . . G4 . . . . . . .'],
      Aa: ['Eb5 . . C5 . . G4 . . Eb4 . . C4 . . .', 'C4 . . . . . . . . . . . . . . .'],
      bc: ['C2 t', 'Bb2 T', 'Ab2 T', 'G2 7'], Bc2: ['Eb2 T', 'G2 7'],
      B: ['C5 . . . . . . . . . . . G4 . . .', 'G5 . . . Eb5 . . . C5 . . . . . . .', 'Eb5 . . . C5 . . . Bb4 . . . Ab4 . . .', 'G4 . . . . . . . C5 . . . . . . .'],
      Ba: ['G5 . . Eb5 . . C5 . . . Bb4 . . . . .', 'C5 . . . . . D5 . Eb5 . . . . . . .'],
      rc: ['C2 t', 'Ab2 T', 'F2 t', 'G2 7'], Rc2: ['Bb2 T', 'G2 7'],
      R: ['C5 - - - . . Eb5 - - - . . G4 - - .', 'Bb4 - - - . . Ab4 - - - . . G4 - - .', 'Eb4 - - - G4 - - - Bb4 - - - . . . .', 'F#4 - - - G4 - - - D5 - - - - - - .'],
      Ra: ['Eb5 - - - D5 - - - C5 - - - Bb4 - - .', 'C5 - - - . . . . G4 - - - . . . .'],
      oc: 'G2 7', O: 'G4 . B4 . D5 . . . . . F5 . . . . .' }
  };
  // 16-step drum kits. Each row is one bar of sixteenths. Original patterns, not a transcribed break.
  var KITS = {
    dnb: {
      intro: { k: 'x...............', s: '........x.......', h: 'x...x...x...x...', o: '............x...' },
      break: { k: 'x...............', s: '....x.......x...', h: 'x...x...x...x...', o: '........x.......' },
      main:  { k: 'x..x....x..x.x..', s: '....x..x....x...', h: 'x.x.x.x.x.x.x.x.', o: '......x.......x.' },
      drop:  { k: 'x..x..x...x.x..x', s: '....x..x....x..x', h: 'x.x.x.x.x.x.x.x.', o: '..x.....x...x...' }
    },
    trance: {
      intro: { k: 'x...x...x...x...', s: '................', h: 'x...x...x...x...', o: '..x.....x.......' },
      break: { k: '................', s: '................', h: 'x...x...x...x...', o: '..x...x...x...x.' },
      main:  { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '..x...x...x...x.' },
      drop:  { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '..x...x...x...x.' }
    },
    synthwave: {
      intro: { k: 'x...x...x...x...', s: '................', h: 'x...x...x...x...', o: '......x.........' },
      break: { k: '................', s: '....x.......x...', h: 'x...x...x...x...', o: '......x.........' },
      main:  { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '......x.........' },
      drop:  { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '......x.....x...' }
    },
    house: {
      intro: { k: 'x...x...x...x...', s: '................', h: 'x...x...x...x...', o: '..x.....x.......' },
      break: { k: '................', s: '....x.......x...', h: 'x...x...x...x...', o: '..x...x...x...x.' },
      main:  { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '..x...x...x...x.' },
      drop:  { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '..x...x...x...x.' }
    },
    dubstep: {
      intro: { k: 'x...............', s: '................', h: 'x...x...x...x...', o: '................' },
      break: { k: '................', s: '........x.......', h: 'x.......x.......', o: '................' },
      main:  { k: 'x...............', s: '........x.......', h: '..x...x...x...x.', o: '......x.......x.' },
      drop:  { k: 'x...........x...', s: '........x..x....', h: 'x.x.x.x.x.x.x.x.', o: '....x.......x...' }
    },
    techno: {
      intro: { k: 'x...x...x...x...', s: '................', h: 'x...x...x...x...', o: '......x.........' },
      break: { k: '................', s: '................', h: 'x.x.x.x.x.x.x.x.', o: '..x...x...x...x.' },
      main:  { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '......x.......x.' },
      drop:  { k: 'x...x...x...x...', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', o: '......x.......x.' }
    },
    jungle: {
      intro: { k: 'x...............', s: '....x.......x...', h: 'x...x...x...x...', o: '........x.......' },
      break: { k: 'x...............', s: '........x.......', h: 'x...x...x...x...', o: '................' },
      main:  { k: 'x...x.....x..x..', s: '..x...x....x..x.', h: 'x.x.x.x.x.x.x.x.', o: '....x.......x...' },
      drop:  { k: 'x..x.x....x..x..', s: '..x...x..x.x..x.', h: 'x.x.x.x.x.x.x.x.', o: '..x.....x...x...' }
    }
  };
  function kitHit(kit, S, i, big, dropKit) {
    var K = KITS[kit];
    if (!K) throw new Error('unknown kit ' + kit);
    var name = big ? 'drop' : (S.s === 'I' ? 'intro' : (S.s === 'R' && !S.r ? 'break' : 'main'));
    var P = (big && dropKit) ? dropKit : (K[name] || K.main);
    return { kick: P.k.charAt(i) === 'x', snare: P.s.charAt(i) === 'x', hat: P.h.charAt(i) === 'x', open: P.o.charAt(i) === 'x' };
  }
  function composeChip(key) {
    var T = CHIP[key], M = T.meter, div = T.div || (M === 12 ? 3 : 2), e = 60 / T.bpm / div, ev = [], bar = 0, sec = [];
    if (T.kit) ['intro', 'break', 'main', 'drop'].forEach(function (nm) {
      var P = KITS[T.kit][nm]; if (!P) return; ['k', 's', 'h', 'o'].forEach(function (ch) { if (P[ch] && P[ch].length !== M) throw new Error(key + ' kit ' + nm + ' ' + ch); });
    });
    if (T.dropKit) ['k', 's', 'h', 'o'].forEach(function (ch) { if (!T.dropKit[ch] || T.dropKit[ch].length !== M) throw new Error(key + ' drop ' + ch); });
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
        var tN = t0 + i * e + ((T.swing && (i % 2)) ? T.swing * e : 0);
        [-1, 1].forEach(function (sd) { ev.push({ t: tN, d: d, f: hzc(p) * (1 + sd * 0.0035), v: 0.05, w: 'pulse', duty: T.duty, att: 0.02, rel: 0.22, vib: 0.007, vd: 0.18, pan: 0.5 * sd }); }); // detuned unison, spread L/R
        ev.push({ t: tN, d: d, f: hzc(p), v: 0.06, w: 'tri', att: 0.02, rel: 0.22, vib: 0.007, vd: 0.18 });
        if (big || T.organ && L >= 2) ev.push({ t: tN, d: d, f: hzc(p - 12), v: 0.05, w: 'pulse', duty: 0.5, att: 0.02, rel: 0.22, pan: -0.3 });
        if ((L >= 2 || S.s === 'I') && T.counter !== false) { var sixth = (bar % 4) >= 2, h = p - (sixth ? 8 : 3), ok = ct.map(function (x) { return ((x - ct[0]) % 12 + 12) % 12; });
          while (h > p - (sixth ? 10 : 6) && ok.indexOf(((h - ct[0]) % 12 + 12) % 12) < 0) h--;
          if (ok.indexOf(((h - ct[0]) % 12 + 12) % 12) >= 0) ev.push({ t: tN, d: d, f: hzc(h), v: 0.045, w: 'pulse', duty: 0.5, att: 0.03, rel: 0.22, vib: 0.005, vd: 0.2, pan: 0.35 }); }
      }
      // held chord pad (3 notes); organ on the crypt: pulse + triangle with a low octave root
      var padV = (T.bareDrop && big) ? (T.pad != null ? T.pad : 0.035) * 0.35 : (T.pad != null ? T.pad : 0.035);
      var padP = (T.bareDrop && big) ? 0.006 : 0.016;
      [ct[1], ct[2], ct[3]].forEach(function (pp, q) {
        ev.push({ t: t0, d: M * e, f: hzc(pp) * (1 + 0.002 * (q - 1)), v: padV * amp, w: 'tri', att: 0.2, rel: 0.35, pan: (q - 1) * 0.6, duck: 1 });
        ev.push({ t: t0, d: M * e, f: hzc(pp + 12) * (1 - 0.002 * (q - 1)), v: padP * amp, w: 'pulse', duty: 0.5, att: 0.25, rel: 0.35, pan: (1 - q) * 0.6, duck: 1 }); // octave doubling, opposite side
        if (T.organ) ev.push({ t: t0, d: M * e, f: hzc(pp), v: 0.022 * amp, w: 'pulse', duty: 0.5, att: 0.15, rel: 0.35, pan: (1 - q) * 0.4, duck: 1 });
      });
      if (T.organ) ev.push({ t: t0, d: M * e, f: hzc(ct[0] - 12), v: 0.06 * amp, w: 'tri', att: 0.15, rel: 0.35, duck: 1 });
      // counter-melody on triangle (beat notes through chord tones), levels 2-3
      if (L >= 2 && T.counter !== false) { var beat = M === 12 ? 3 : (T.div ? T.div : 2), cm = (bar % 2) ? [3, 2, 1, 2] : [2, 3, 2, 1];
        for (k = 0; k * beat < M; k++) ev.push({ t: t0 + k * beat * e, d: e * beat * 0.9, f: hzc(ct[cm[k % 4]] + (cm[k % 4] === 3 ? 0 : 12)), v: 0.035, w: 'tri', att: 0.04, rel: 0.2, pan: -0.4 }); }
      // arpeggio (16ths in 4/4 and 3/4, 8th-note triplets in 12/8). New tracks set arpEvery in steps.
      if (L >= 1 && !(T.bareDrop && big)) { var as = T.arpEvery ? e * T.arpEvery : (M === 12 ? e : e / 2), arp = [0, 1, 2, 3, 2, 1], arpV = T.arpV != null ? T.arpV : (big ? 0.026 : 0.02);
        for (k = 0; k < M * e / as - 0.5; k++) ev.push({ t: t0 + k * as + ((T.swing && (k % 2)) ? T.swing * e : 0), d: as * 0.85, f: hzc(ct[arp[k % 6]] + 12), v: arpV, w: 'tri', att: 0.006, rel: 0.1, pan: k % 2 ? 0.45 : -0.45 }); }
      // bass: classic triangle pattern, or a genre motion (reese, offbeat, pulsing 8ths, wobble, or a written pattern)
      function bassNote(time, dur, midi, vMul) {
        ev.push({ t: time, d: dur, f: hzc(midi), v: 0.15 * amp * vMul, w: 'tri', att: 0.005, rel: 0.05 });
        var sb2 = midi - 12; if (sb2 < 31) sb2 += 12;
        ev.push({ t: time, d: dur, f: hzc(sb2), v: 0.15 * amp * vMul, w: 'sine', att: 0.005, rel: 0.05 });
      }
      if (T.bass === 'reese') {
        var mid = ct[0], subR = ct[0] - 12;
        [-0.007, 0.007].forEach(function (det, di) { ev.push({ t: t0, d: M * e * 0.96, f: hzc(mid) * (1 + det), v: 0.05 * amp, w: 'pulse', duty: di ? 0.48 : 0.2, att: 0.03, rel: 0.08, pan: di ? 0.4 : -0.4 }); });
        ev.push({ t: t0, d: M * e * 0.96, f: hzc(mid), v: 0.04 * amp, w: 'tri', att: 0.02, rel: 0.08 });
        ev.push({ t: t0, d: M * e * 0.96, f: hzc(subR < 28 ? subR + 12 : subR), v: 0.16 * amp, w: 'sine', att: 0.01, rel: 0.06 });
        if (L >= 2) ev.push({ t: t0 + 8 * e, d: 6 * e, f: hzc(mid + 7), v: 0.035 * amp, w: 'pulse', duty: 0.35, att: 0.01, rel: 0.05 });
      } else if (T.bass === 'offbeat') {
        var seq = T.bassSeq || [0, 0, 7, 0];
        for (i = 0; i < M; i++) if (i % 4 === 2) {
          var iv = seq[((i / 4) | 0) % seq.length], swb = (T.swing && (i % 2)) ? T.swing * e : 0;
          bassNote(t0 + i * e + swb, e * 1.5, ct[0] - 12 + iv, 1);
          ev.push({ t: t0 + i * e + swb, d: e * 1.15, f: hzc(ct[0] - 12 + iv), v: 0.07 * amp, w: 'pulse', duty: 0.25, att: 0.003, rel: 0.04 });
        }
      } else if (T.bass === 'pump8') {
        var seq8 = T.bassSeq || [0, 12, 0, 12, 0, 7, 0, 12];
        for (i = 0; i < M; i += 2) {
          var iv8 = seq8[((i / 2) | 0) % seq8.length];
          bassNote(t0 + i * e, e * 1.7, ct[0] - 12 + iv8, 1);
        }
      } else if (T.bass === 'wobble') {
        if ((S.s === 'R' && !S.r) || (S.s === 'I' && bar < 3)) bassNote(t0, M * e * 0.92, ct[0] - 12, 0.75);
        else {
          var wseq = T.wob || [0, 0, 3, 1, 0, 7, 1, 3], duties = T.wobDuty || [0.16, 0.46, 0.12, 0.4, 0.2, 0.5, 0.14, 0.34];
          for (i = 0; i < M; i++) {
            if (T.wobGap && T.wobGap.charAt(i) === '.') continue;
            ev.push({ t: t0 + i * e, d: e * 0.9, f: hzc(ct[0] + wseq[i % wseq.length]), v: (big ? 0.1 : 0.075) * amp, w: 'pulse', duty: duties[i % duties.length], att: 0.002, rel: 0.02, pan: i % 2 ? 0.25 : -0.25 });
            if (i % 4 === 0) ev.push({ t: t0 + i * e, d: e * 3.4, f: hzc(ct[0] - 12), v: 0.15 * amp, w: 'sine', att: 0.003, rel: 0.04 });
          }
        }
      } else if (T.bassPat) {
        for (i = 0; i < M; i++) if (T.bassPat[i] != null) {
          var swp = (T.swing && (i % 2)) ? T.swing * e : 0;
          bassNote(t0 + i * e + swp, e * 1.35, ct[0] - 12 + T.bassPat[i], 1);
        }
      } else {
        var BP = M === 8 ? (key === 'arena-chip' || big ? [0, 0, 12, 0, 0, 12, 7, 12] : [0, null, 7, null, 0, null, 7, 12])
          : M === 12 ? [0, null, null, 7, null, null, 0, null, null, 7, null, 12] : [0, null, 7, null, 12, null];
        for (i = 0; i < M; i++) if (BP[i] != null) { j = i + 1; while (j < M && BP[j] == null) j++;
          ev.push({ t: t0 + i * e, d: e * (j - i) * 0.85, f: hzc(ct[0] - 12 + BP[i]), v: 0.17 * amp, w: 'tri', att: 0.008, rel: 0.08 });
          var sb = ct[0] - 12 + (BP[i] % 12 ? 0 : 0) - 12; ev.push({ t: t0 + i * e, d: e * (j - i) * 0.85, f: hzc(sb < 31 ? sb + 12 : sb), v: 0.16 * amp, w: 'sine', att: 0.01, rel: 0.08 }); } // sub-bass
      }
      // drums (noise snare/hats + sine kick). A kit replaces the default rock pattern. Intro still rolls into the next section.
      for (i = 0; i < M; i++) {
        var kick, snare, hat, open = false, swH = (T.swing && (i % 2)) ? T.swing * e : 0;
        if (T.kit) { var hit = kitHit(T.kit, S, i, big, T.dropKit); kick = hit.kick; snare = hit.snare; hat = hit.hat; open = hit.open; }
        else if (M === 8) { kick = i === 0 || i === 4 || (big || key === 'arena-chip') && (i === 3 || i === 7); snare = i === 2 || i === 6; hat = true; }
        else if (M === 12) { kick = i === 0 || i === 6; snare = i === 3 || i === 9 || big && i === 11; hat = i % 3 === 0 || big; }
        else { kick = i === 0 || big && i === 3; snare = i === 2 || i === 4; hat = i % 2 === 0; }
        if (!T.kit && S.s === 'I' && bar < 2) { snare = false; hat = i === 0; }
        if (!T.kit && S.s === 'R' && !S.r) { kick = i === 0; snare = i === M / 2; hat = i % (M === 12 ? 3 : 2) === 0; } // half-time drop (1st bridge pass)
        if (S.roll && i >= M / 2) { for (var q = 0; q < 2; q++) ev.push({ t: t0 + (i + q / 2) * e, d: 0.08, f: 0, v: 0.03 + 0.02 * (i - M / 2) / M + 0.004 * q, w: 'noise', dec: 0.04, rel: 0.02 }); continue; }
        if (kick) { ev.push({ t: t0 + i * e, d: 0.18, f: 110, v: 0.32 * amp, w: 'kick', rel: 0.02 }); ev.push({ t: t0 + i * e, d: 0.02, f: 0, v: 0.04 * amp, w: 'noise', dec: 0.004, rel: 0.01 }); } // sine thump + click
        if (snare && (L >= 1 || T.kit)) { ev.push({ t: t0 + i * e + swH, d: T.clap ? 0.09 : 0.16, f: 0, v: (big ? 0.075 : 0.06) * (T.snareV || 1), w: 'noise', dec: T.clap ? 0.045 : 0.09, rel: 0.02, pan: 0.1 }); ev.push({ t: t0 + i * e + swH, d: 0.1, f: T.clap ? 220 : 150, v: 0.12 * (T.snareV || 1), w: 'kick', dec: 0.04, rel: 0.02 }); }
        if (open && (L >= 1 || T.kit)) ev.push({ t: t0 + i * e + swH, d: 0.12, f: 0, v: 0.02 * amp, w: 'noise', dec: 0.07, rel: 0.02, pan: -0.25 });
        else if (hat && (L >= 1 || T.kit)) ev.push({ t: t0 + i * e + swH, d: 0.03, f: 0, v: 0.012, w: 'noise', rel: 0.01, pan: 0.3 });
      }
      // riser into the climax and into A after the intro: noise swell + upward pitch sweep
      if (S.riser) { ev.push({ t: t0, d: M * e, f: 0, v: 0.05, w: 'rise', rel: 0.02 }); ev.push({ t: t0, d: M * e, f: hzc(ct[0]), v: 0.03, w: 'sweep', rel: 0.02 });
      }
      bar++;
    });
    var bodySec = bar * M * e, home = chordT(T.ac[0]), qH = T.ac[0].split(' ')[1], bnote = home[0] - 12, variant = 0, vi;
    if (bnote < 31) bnote = home[0];
    for (vi = 0; vi < key.length; vi++) variant += key.charCodeAt(vi);
    var outroLen = pushOutro(ev, { t0: bodySec, bar: M * e, tonic: leadTonic(home[0]), minor: qH === 't' || qH === 'm', duty: T.duty, hz: hzc, lead: 0.05, pulse: true, pad: [home[1], home[2], home[3]], padV: 0.016, bass: bnote, bassV: 0.11, variant: variant % 3, kick: true });
    return { events: ev, length: bodySec + outroLen, body: bodySec, title: T.title, echo: e * 3, bpm: T.bpm, beat: e * div, intro: 4 * M * e, pump: T.pump, genre: T.genre, key: key, fade: FADE_S };
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
    if (c.fade) { var fn = Math.min(N, Math.round(c.fade * sr)), f0 = N - fn, fi, fg; for (fi = f0; fi < N; fi++) { fg = Math.cos(((fi - f0) / Math.max(1, fn - 1)) * Math.PI * 0.5); out[fi] *= fg; } }
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
    var bt = c.beat * sr, i, j, pump = c.pump != null ? c.pump : 0.65;
    for (i = 0; i < N; i++) { var ph2 = (i % bt) / sr, g2 = 1 - pump * Math.exp(-ph2 / 0.09) * (ph2 < 0.004 ? ph2 / 0.004 : 1); L[i] += PL[i] * g2; Rr[i] += PR[i] * g2; }
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
    if (c.fade) { var fn = Math.min(N, Math.round(c.fade * sr)), f0 = N - fn, fi, fg; for (fi = f0; fi < N; fi++) { fg = Math.cos(((fi - f0) / Math.max(1, fn - 1)) * Math.PI * 0.5); L[fi] *= fg; Rr[fi] *= fg; } }
    return { samples: L, samplesR: Rr, sampleRate: sr, seconds: c.length, title: c.title };
  }

  // One ordered list for the whole site. Style still picks a lane (8-bit, including the new
  // electronic tracks, or chill) so the existing style control keeps its meaning. The page never picks the song.
  var PLAYLIST = [
    { key: 'meadow', style: 'chip' }, { key: 'parade', style: 'chip' }, { key: 'arena-chip', style: 'chip' }, { key: 'crypt', style: 'chip' },
    { key: 'night-market', style: 'chip' }, { key: 'glass-gate', style: 'chip' }, { key: 'neon-rook', style: 'chip' }, { key: 'block-party', style: 'chip' },
    { key: 'rift-wub', style: 'chip' }, { key: 'grid-ritual', style: 'chip' }, { key: 'canopy-break', style: 'chip' },
    { key: 'bog-motor', style: 'chip' }, { key: 'gutter-bloom', style: 'chip' }, { key: 'moss-clank', style: 'chip' },
    { key: 'yard', style: 'chill' }, { key: 'cemetery', style: 'chill' }, { key: 'arena', style: 'chill' }
  ];
  function playlistFor(style) {
    var s = style === 'chill' ? 'chill' : 'chip', out = [];
    for (var i = 0; i < PLAYLIST.length; i++) if (PLAYLIST[i].style === s) out.push(PLAYLIST[i].key);
    return out;
  }
  function trackMeta(key) {
    var T = CHIP[key] || TRACKS[key] || {};
    return { key: key, title: T.title || key, genre: T.genre || (CHIP[key] ? '8-bit' : 'Chill'), style: CHIP[key] ? 'chip' : 'chill' };
  }
  var lenCache = {}, bodyCache = {};
  function songLength(key) {
    if (lenCache[key]) return lenCache[key];
    var c = CHIP[key] ? composeChip(key) : compose(key);
    lenCache[key] = c.length;
    bodyCache[key] = c.body != null ? c.body : c.length;
    return c.length;
  }
  function bodyLength(key) { if (bodyCache[key] == null) songLength(key); return bodyCache[key]; }
  // Saved playhead across pages: index + seconds, wrapping onto the next song only past the end (including the outro).
  function advance(list, i, pos) {
    var guard = 0;
    i = ((i % list.length) + list.length) % list.length;
    pos = +pos || 0;
    while (guard++ < list.length + 2) {
      var len = songLength(list[i]);
      if (pos < len - 0.08) return { i: i, pos: pos, key: list[i] };
      pos -= len; i = (i + 1) % list.length;
    }
    if (pos < 0) pos = 0;
    return { i: i, pos: pos, key: list[i] };
  }
  function crossfadePlan(duration, offset, xfade) {
    var xf = xfade == null ? XFADE_S : xfade, remain = Math.max(0, duration - (+offset || 0));
    if (remain <= 0.12) return { overlap: 0, delay: 0, startNow: true };
    var ov = remain < xf + 0.35 ? Math.max(0.4, remain * 0.5) : xf;
    return { overlap: ov, delay: Math.max(0, remain - ov), startNow: false };
  }
  // path is ignored: every page shares the playlist. Returns the first song of that lane.
  function pickTrack(path, style) { void path; return playlistFor(style)[0]; }

  var api = { render: render, pickTrack: pickTrack, tracks: Object.keys(TRACKS), chipTracks: Object.keys(CHIP), playlist: PLAYLIST, playlistFor: playlistFor, trackMeta: trackMeta, songLength: songLength, bodyLength: bodyLength, advance: advance, crossfadePlan: crossfadePlan, FADE: FADE_S, XFADE: XFADE_S };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // ---- browser player: songs play back to back. sessionStorage keeps the song and the position across navigations. ----
  var SS = 'xcpets.music.cursor';
  var ctx = null, src = null, srcGain = null, srcKey = '', gain = null, cache = {}, curI = 0, startOffset = 0, startedAt = 0, tick = 0, gen = 0, follower = null, followTimer = 0;
  api.LEVELS = { low: 0.18, med: 0.35, high: 0.55 };
  api.VOLUME = 0.35;
  api.style = 'chip';
  api.onTrack = null;
  function lane() { return api.style === 'chill' ? 'chill' : 'chip'; }
  function loadCursors() { try { return JSON.parse(root.sessionStorage.getItem(SS)) || {}; } catch (e) { return {}; } }
  function saveCursors(all) { try { root.sessionStorage.setItem(SS, JSON.stringify(all)); } catch (e) {} }
  function heardPos() { if (!ctx || !src) return startOffset; return startOffset + Math.max(0, ctx.currentTime - startedAt); }
  function saveNow() {
    if (follower && ctx && ctx.currentTime >= follower.when - 0.03) adoptFollower(gen, true);
    var all = loadCursors();
    var live = ctx && ctx.state === 'running' && gain && gain.gain.value > 0.02;
    all[lane()] = { i: curI, pos: heardPos(), t: live ? Date.now() : 0 };
    saveCursors(all);
  }
  function resolveCursor(style) {
    var all = loadCursors(), c = all[style === 'chill' ? 'chill' : 'chip'] || { i: 0, pos: 0, t: 0 };
    var pos = +c.pos || 0, gap = c.t ? (Date.now() - c.t) / 1000 : 0;
    if (gap > 0 && gap < 20) pos += gap;
    var hit = advance(playlistFor(style), c.i || 0, pos);
    return { i: hit.i, pos: hit.pos < 0 ? 0 : hit.pos };
  }
  function emit() { if (typeof api.onTrack === 'function') { try { api.onTrack(api.current()); } catch (e) {} } }
  function remember(key, rendered) {
    cache[key] = rendered;
    var guard = 0, stereo;
    while (guard++ < 8) {
      stereo = Object.keys(cache).filter(function (k) { return cache[k] && cache[k].samplesR; });
      if (stereo.length <= 2) break;
      var drop = stereo[0] === key ? stereo[1] : stereo[0];
      if (!drop || drop === key) break;
      delete cache[drop];
    }
  }
  function killSrc(s) { if (!s) return; try { s.onended = null; } catch (e) {} try { s.stop(); } catch (e2) {} try { s.disconnect(); } catch (e3) {} }
  function dropGain(g) { if (!g) return; try { g.disconnect(); } catch (e) {} }
  function haltSource() {
    if (followTimer) { clearTimeout(followTimer); followTimer = 0; }
    if (follower) { killSrc(follower.src); dropGain(follower.g); follower = null; }
    dropGain(srcGain); srcGain = null;
    if (!src) return;
    var s = src; src = null; killSrc(s);
  }
  function makeBuf(r) {
    var buf = ctx.createBuffer(r.samplesR ? 2 : 1, r.samples.length, r.sampleRate);
    buf.getChannelData(0).set(r.samples); if (r.samplesR) buf.getChannelData(1).set(r.samplesR);
    return buf;
  }
  function spawn(buf, offset, when, fadeIn, overlap) {
    var g = ctx.createGain(); g.connect(gain);
    var s = ctx.createBufferSource(); s.buffer = buf; s.loop = false; s.connect(g);
    var t = when == null ? ctx.currentTime : when, off = Math.max(0, offset || 0), dur = Math.max(0, buf.duration - off), ov = overlap || api.XFADE;
    if (fadeIn && ov > 0.05) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + Math.min(ov, Math.max(0.05, dur))); }
    else g.gain.setValueAtTime(1, t);
    var endT = t + dur, fo = endT - ov;
    if (dur > ov + 0.3 && fo > t + (fadeIn ? ov : 0) + 0.05) { g.gain.setValueAtTime(1, fo); g.gain.linearRampToValueAtTime(0.0001, endT); }
    s.start(t, off);
    return { src: s, g: g, when: t, offset: off };
  }
  function scheduleFollower(token) {
    if (!ctx || !src || token !== gen) return;
    var list = playlistFor(api.style), ni = (curI + 1) % list.length, nk = list[ni];
    function planNow() {
      if (token !== gen || !src || !ctx) return null;
      return api.crossfadePlan(src.buffer.duration, startOffset + Math.max(0, ctx.currentTime - startedAt), api.XFADE);
    }
    function go() {
      if (token !== gen || !ctx || !src || follower) return;
      var plan = planNow(); if (!plan) return;
      if (plan.startNow) { arm(ni, 0, true); return; }
      var nr = cache[nk] || render(nk, SR); remember(nk, nr);
      follower = spawn(makeBuf(nr), 0, ctx.currentTime + plan.delay, true, plan.overlap);
      follower.i = ni;
      followTimer = root.setTimeout(function () { adoptFollower(token, false); }, Math.max(0, plan.delay * 1000));
    }
    var plan0 = planNow();
    if (!plan0) return;
    if (plan0.startNow) { arm(ni, 0, true); return; }
    if (cache[nk] || plan0.delay < 2) go();
    else followTimer = root.setTimeout(function () { if (token !== gen) return; try { remember(nk, render(nk, SR)); } catch (e) {} go(); }, 700);
  }
  function adoptFollower(token, fromSave) {
    if (token !== gen || !follower || !ctx) return;
    if (ctx.currentTime + 0.05 < follower.when) return;
    if (followTimer) { clearTimeout(followTimer); followTimer = 0; }
    var prev = src, prevG = srcGain, f = follower; follower = null;
    src = f.src; srcGain = f.g; curI = f.i; startOffset = f.offset || 0; startedAt = f.when;
    srcKey = playlistFor(api.style)[curI];
    if (prev && prev !== src) { prev.onended = function () { dropGain(prevG); killSrc(prev); }; }
    if (!fromSave) saveNow();
    emit();
    scheduleFollower(token);
  }
  function arm(i, offset, fade) {
    var list = playlistFor(api.style);
    i = ((i % list.length) + list.length) % list.length;
    var key = list[i], token = ++gen;
    haltSource();
    curI = i; srcKey = key;
    var r = cache[key] || render(key, SR);
    remember(key, r);
    if (!ctx) return;
    var buf = makeBuf(r), off = Math.max(0, offset || 0);
    if (off > buf.duration - 0.12) { arm((i + 1) % list.length, Math.max(0, off - buf.duration), fade); return; }
    var node = spawn(buf, off, ctx.currentTime, false, api.XFADE);
    src = node.src; srcGain = node.g; startOffset = off; startedAt = ctx.currentTime;
    src.onended = function () {
      if (token !== gen) return;
      if (follower) { adoptFollower(token, false); return; }
      if (src === this) arm(i + 1, 0, true);
    };
    gain.gain.cancelScheduledValues(ctx.currentTime);
    if (fade) { gain.gain.setValueAtTime(Math.max(0.0001, api.VOLUME * 0.45), ctx.currentTime); gain.gain.setTargetAtTime(api.VOLUME, ctx.currentTime, 0.08); }
    else gain.gain.setTargetAtTime(api.VOLUME, ctx.currentTime, 0.4);
    saveNow(); emit();
    scheduleFollower(token);
  }
  api.current = function () {
    var list = playlistFor(api.style);
    var i = src ? curI : resolveCursor(api.style).i;
    i = ((i % list.length) + list.length) % list.length;
    var m = trackMeta(list[i]); m.index = i; m.total = list.length; return m;
  };
  api.setVolume = function (v) { api.VOLUME = v; if (ctx && src) { gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.setTargetAtTime(v, ctx.currentTime, 0.1); } };
  api.setStyle = function (st) {
    var next = st === 'chill' ? 'chill' : 'chip';
    if (next === api.style) return;
    if (src) saveNow();
    api.style = next;
    if (!ctx) return;
    haltSource();
    var c = resolveCursor(next);
    arm(c.i, c.pos, false);
  };
  api.skip = function (dir) {
    if (!ctx) return api.start();
    var list = playlistFor(api.style), i = curI + (dir < 0 ? -1 : 1);
    if (i < 0) i = list.length - 1;
    arm(i, 0, true);
    return true;
  };
  api.start = function () {
    var AC = root.AudioContext || root.webkitAudioContext; if (!AC) return false;
    if (!ctx) { ctx = new AC(); gain = ctx.createGain(); gain.gain.value = 0; gain.connect(ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume();
    if (!src) { var c = resolveCursor(api.style); arm(c.i, c.pos, false); }
    else { gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.setTargetAtTime(api.VOLUME, ctx.currentTime, 0.4); if (!follower) scheduleFollower(gen); emit(); }
    if (!tick) tick = root.setInterval(saveNow, 1000);
    return true;
  };
  api.stop = function () {
    if (!ctx) return;
    if (follower && ctx.currentTime >= follower.when - 0.03) adoptFollower(gen, true);
    saveNow();
    if (followTimer) { clearTimeout(followTimer); followTimer = 0; }
    if (follower) { killSrc(follower.src); dropGain(follower.g); follower = null; }
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    root.setTimeout(function () { if (ctx && gain.gain.value < 0.01 && ctx.state === 'running') ctx.suspend(); }, 900);
  };
  root.addEventListener('pagehide', saveNow);
  root.addEventListener('visibilitychange', function () { if (root.document && root.document.visibilityState === 'hidden') saveNow(); });
  root.XCMusic = api;
})(typeof window !== 'undefined' ? window : this);
