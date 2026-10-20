/* XCPETS 8-bit sound blips (quick wins, 2026-10-19, DRAFT): WebAudio square/noise blips, no audio files, no network.
 * OFF by default. One shared setting with the X Circus Kekimus announcer speaker (#arVoice, localStorage xcpets-announcer-voice via V2Announcer);
 * the Lair and the motel get the same small 🔇/🔊 toggle. Sounds: coin clink when a burn is signed/sent (wraps V2Wallet.send's success),
 * punch thud on fight hits, door creak at the motel door, crowd roar on a win. Display/sound only; no rule change. */
(function () {
  'use strict';
  var KEY = 'xcpets-announcer-voice', ctx = null;
  function on() { try { return window.V2Announcer ? V2Announcer.voiceOn() : localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function ac() { if (!ctx) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); } if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  function tone(type, f0, f1, dur, vol, delay) { var a = ac(); if (!a) return; var t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02); }
  function noise(dur, vol, lp, delay, swell) { var a = ac(); if (!a) return; var n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    var s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime + (delay || 0); s.buffer = b; f.type = 'lowpass'; f.frequency.value = lp || 1200;
    if (swell) { g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.001, t + dur); } else { g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); }
    s.connect(f); f.connect(g); g.connect(a.destination); s.start(t); }
  var S = {
    coin: function () { if (!on()) return; tone('square', 988, 0, 0.08, 0.12); tone('square', 1319, 0, 0.22, 0.12, 0.08); },
    punch: function (big) { if (!on()) return; tone('square', big ? 140 : 180, 50, big ? 0.16 : 0.1, big ? 0.3 : 0.2); noise(big ? 0.12 : 0.07, big ? 0.35 : 0.2, 900); },
    creak: function () { if (!on()) return; tone('sawtooth', 220, 330, 0.25, 0.06); tone('sawtooth', 300, 180, 0.35, 0.06, 0.22); },
    roar: function () { if (!on()) return; noise(1.4, 0.28, 1800, 0, true); tone('square', 523, 0, 0.12, 0.08, 0.1); tone('square', 659, 0, 0.12, 0.08, 0.22); tone('square', 784, 0, 0.3, 0.08, 0.34); },
    on: on,
    set: function (v) { if (window.V2Announcer) V2Announcer.setVoice(v); else try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) { } paint(); },
    /** toggle(): a small speaker button for the Lair / motel, same saved setting as the arena announcer button */
    toggle: function (cls) { return '<button type="button" class="q sfx-tog ' + (cls || '') + '" data-sfx="1" aria-pressed="' + (on() ? 'true' : 'false') + '" title="8-bit sound (shared with the announcer)">' + (on() ? '🔊' : '🔇') + '</button>'; }
  };
  function paint() { document.querySelectorAll('[data-sfx]').forEach(function (b) { b.textContent = on() ? '🔊' : '🔇'; b.setAttribute('aria-pressed', on() ? 'true' : 'false'); });
    var v = document.getElementById('arVoice'); if (v) { v.textContent = (on() ? '🔊' : '🔇') + ' Announcer'; v.setAttribute('aria-pressed', on() ? 'true' : 'false'); } }
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-sfx]'); if (b) { e.preventDefault(); e.stopPropagation(); S.set(!on()); if (on()) S.coin(); return; }
    if (e.target.closest && e.target.closest('#arVoice')) setTimeout(paint, 0); }, true);
  if (window.V2Wallet && V2Wallet.send && !V2Wallet.send._sfx) { var orig = V2Wallet.send; V2Wallet.send = function () { var p = orig.apply(this, arguments); if (p && p.then) p.then(function (r) { if (r && r.txid) S.coin(); return r; }, function () { }); return p; }; V2Wallet.send._sfx = 1; }
  window.V2Sfx = S;
})();
