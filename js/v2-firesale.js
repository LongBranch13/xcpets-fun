/* XCPETS Fire Sale UI (fire-sales, owner approved Oct 22 2026; design/halving-schedule.md 6-7). DISPLAY ONLY: reads V2Rules.fireInfo from the replayed
 * world; burns are still built by the game's confirm flow (V2Rules.planAmount prices the next block) and signed in the player's wallet.
 * Banner + chaos look: pixel flames, panicked pets, a shopkeeper yelling, a siren. The siren is OFF until the player taps 🔈 (no autoplay; choice kept
 * in localStorage). Reduced motion: static banner. ?preview=firesale (live) / ?preview=firesale-warn (warning) fake the state, prices untouched.
 * Saved spins earned by full-price burns are recorded in the replay ledger only (w.fireSpins); nothing about them is shown here yet. */
(function () {
  'use strict';
  var V = window.V2Rules, M = window.V2Mock, R = function () { return window.V2Render; }; if (!V || !V.fireInfo || !M) return;
  var pv = /[?&]preview=firesale(-warn)?\b/.exec(location.search), SK = 'xcpets-firesale-siren', rm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var YELLS = ['EVERYTHING MUST BURN!', 'THE FIRE SALE IS ON!', 'HATCH! SPIN! FEED! GO GO GO!', 'WHO LEFT THE OVEN ON?!', 'ONE DAY ONLY... WELL, 36 BLOCKS!'];
  function fmt(n) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: 8 }); }
  function info() { var w = M.world(), S = M.state(), tip = S.tip || w.tip || 0, f = V.fireInfo(w, tip); f.tip = tip; f.w = w;
    if (pv) { var s = pv[1] ? { arm: tip - 2, start: tip + 4, end: tip + 40 } : { arm: tip - 10, start: tip - 4, end: tip + 32 }; f.live = pv[1] ? null : s; f.warning = pv[1] ? s : null; }
    return f; }
  var el, ctx, osc, gain, yi = 0, pets = false;
  function sirenOn() { try { return localStorage.getItem(SK) === 'on'; } catch (e) { return false; } }
  function siren(on) { try { if (!on) { if (osc) { osc.stop(); osc = null; } return; } if (osc) return; ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      osc = ctx.createOscillator(); gain = ctx.createGain(); gain.gain.value = 0.04; osc.type = 'square'; osc.connect(gain); gain.connect(ctx.destination);
      var t = ctx.currentTime; for (var i = 0; i < 600; i++) { osc.frequency.setValueAtTime(i % 2 ? 660 : 880, t + i * 0.5); } osc.start(); } catch (e) { } }
  function build() { el = document.createElement('div'); el.id = 'fireSale'; el.className = 'firesale' + (rm ? ' fs-still' : ''); el.setAttribute('role', 'status');
    var nav = document.querySelector('nav, .nav, header'); if (nav && nav.parentNode) nav.parentNode.insertBefore(el, nav.nextSibling); else document.body.insertBefore(el, document.body.firstChild);
    el.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('#fsSiren'); if (!b) return; var on = !sirenOn(); try { localStorage.setItem(SK, on ? 'on' : 'off'); } catch (er) { } b.textContent = on ? '🔊 Siren on' : '🔈 Siren off'; b.setAttribute('aria-pressed', String(on)); siren(on && !!el.dataset.live); }); }
  function drawPets(w) { if (pets || !R() || !R().animate || !R().petFrames) return; var cvs = el.querySelectorAll('.fs-pet'); if (!cvs.length) return; pets = true;
    var list = (w.pets || []).filter(function (p) { return !p.dead && !p.released && !p.community && p.stage >= 1; }).slice(-40);
    [].forEach.call(cvs, function (cv, i) { var p = list[(i * 13) % Math.max(1, list.length)]; if (!p) return; try { R().animate(cv, R().petFrames(p, w)); } catch (e) { } }); }
  function render(f) { var s = f.live || f.warning; if (!s) { if (el) { el.remove(); el = null; pets = false; siren(false); } return; } if (!el) build();
    var live = !!f.live, left = live ? s.end - f.nextBlock + 1 : s.start - f.nextBlock + 1, key = (live ? 'L' : 'W') + s.arm;
    if (el.dataset.key !== key) { el.dataset.key = key; pets = false; var on = sirenOn();
      el.innerHTML = '<div class="fs-flames" aria-hidden="true">' + new Array(24).join('<i></i>') + '</div><div class="fs-body">' +
        (live ? '<b class="fs-title">🔥 FIRE SALE 🔥</b><span class="fs-txt">Every burn is 69% off. Meals are half off. <b id="fsLeft"></b></span>' : '<b class="fs-title">🚨 FIRE SALE INCOMING</b><span class="fs-txt">Starts at block ' + fmt(s.start) + '. <b id="fsLeft"></b></span>') +
        (live ? '<div class="fs-pets" aria-hidden="true"><canvas class="fs-pet" width="32" height="32"></canvas><canvas class="fs-pet" width="32" height="32"></canvas><canvas class="fs-pet" width="32" height="32"></canvas></div><span class="fs-yell" id="fsYell"></span>' : '') +
        '<button type="button" class="q fs-siren" id="fsSiren" aria-pressed="' + on + '">' + (on ? '🔊 Siren on' : '🔈 Siren off') + '</button></div>'; }
    el.dataset.live = live ? '1' : ''; var lf = document.getElementById('fsLeft'); if (lf) lf.textContent = left + ' block' + (left === 1 ? '' : 's') + (live ? ' left' : ' to go');
    var y = document.getElementById('fsYell'); if (y) y.textContent = YELLS[yi++ % YELLS.length];
    if (live) drawPets(f.w); siren(live && sirenOn()); }
  function tick() { if (document.getElementById('v2boot') || !(M.state().rows || []).length) return; try { render(info()); } catch (e) { } }
  function start() { tick(); setInterval(tick, 3000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
