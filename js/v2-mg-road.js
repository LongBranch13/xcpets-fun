/* ROAD TO MYTHIC GOD (Nov 25 2026): the one panel that says where a player stands on the road, what the next burn is,
 * and what it costs if the roll fails. DISPLAY ONLY: every number comes from V2Rules (mgView, cemResInfo, V2Rules.MG),
 * nothing here is read by replay, and nothing here is a second copy of a rule.
 *
 * Why it exists (audit Nov 25 2026): three players have walked the whole road and all three lost their Mythic.
 *   - the pages promised "you can raise it again" after a failed roll; the rules turn the grave to dust for good,
 *   - pledges past the odds ceiling bought nothing and no page said so (1,353 points pledged where ~694 was the ceiling),
 *   - a page on the fast world has no w.cem.mg table, so a pending unleash and the Pantheon seats went missing.
 * This file holds the honest copy, the ceiling maths and the missing-table guard in one place.
 *
 * API (all display):
 *   V2MgRoad.mgReady(w)        the world really carries the Mythic God table (fast worlds may not)
 *   V2MgRoad.capInfo(w, Z, b)  Mythic Resurrection odds: points, chance, ceiling, points still worth pledging
 *   V2MgRoad.capLine(w, Z, b)  one sentence about the ceiling (or '')
 *   V2MgRoad.riskLine(Z)       the honest one-try warning
 *   V2MgRoad.html(w, p, me, b) the step panel for pet p, or ''
 */
(function () {
  'use strict';
  var V = window.V2Rules; if (!V) return;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function nf(n) { n = Number(n) || 0; return n.toLocaleString('en-US'); }
  function pct(x) { return Math.round((Number(x) || 0) * 100) + '%'; }
  function nameOf(p) { return p ? (p.name || ('#' + p.id)) : ''; }

  /* A world built from the slim view files used to arrive without w.cem.mg (seats, unleash list, per-wallet clocks).
   * Without it a page cannot see a pending unleash, the 30-day wallet gap or how many seats are left, so every caller
   * must hold back instead of offering a burn the rules would reject. zombies.json carries the table from Nov 25 2026;
   * a slim world still missing it keeps cem._slim (set by v2-split.js cemFill), which is the only "not loaded" mark.
   * A full replay never sets _slim: a replayed world with no unleash yet simply has no mg table and is still trustworthy. */
  function mgReady(w) { return !!(w && w.cem) && !w.cem._slim; }

  function MG() { return V.MG || {}; }
  function isMythicGrave(p) { return !!(p && p.mgDead && !p.mgDead.over && !(p.zombie && !p.zombie.end)); }
  function isMythicZ(p) { return !!(p && p.zombie && !p.zombie.end && p.mgDead); }
  function view(w, p, b) { try { return V.mgView ? V.mgView(w, p, b) : null; } catch (e) { return null; } }
  function resInfo(w, p, b) { try { return V.cemResInfo ? V.cemResInfo(w, p, b) : null; } catch (e) { return null; } }

  /* The odds ceiling, from the rules' own constants. chance(P) = min(top, base + span × P / (P + k)).
   * capPts = the smallest whole P that reaches the ceiling, or null when the curve never gets there. */
  function capInfo(w, Z, b) {
    var I = resInfo(w, Z, b); if (!I || !I.mythic) return null;
    var M = MG(), base = M.RES_BASE, span = M.RES_SPAN, k = M.RES_K, hw = !!I.bonus;
    var top = hw ? M.RES_HW_TOP : M.RES_TOP;
    if (base == null || span == null || !k || top == null) return null;
    var room = top - base, capPts = room > 0 && span > room ? Math.ceil(k * room / (span - room)) : null;
    var P = (I.points || 0) + (I.bonus || 0);
    return { points: I.points || 0, bonus: I.bonus || 0, total: P, chance: I.chance, min: I.min || M.RES_MIN,
      top: top, capPts: capPts, atCap: capPts != null && P >= capPts, more: capPts == null ? null : Math.max(0, capPts - P), hw: hw };
  }
  /* One sentence, so a player never pledges into nothing again. */
  function capLine(w, Z, b) {
    var c = capInfo(w, Z, b); if (!c) return '';
    if (c.atCap) return 'Best odds reached: ' + pct(c.top) + '. More pledges will not raise it.';
    if (c.capPts == null) return 'Every pledge still raises the odds (they stop at ' + pct(c.top) + ').';
    return nf(c.more) + ' more point' + (c.more === 1 ? '' : 's') + ' reaches the best odds (' + pct(c.top) + '). Pledges past ' + nf(c.capPts) + ' points add nothing.';
  }
  /* The honest warning. One try, and a failed roll is the end of that Mythic. */
  function riskLine(Z, plain) {
    var n = Z ? (plain ? nameOf(Z) : esc(nameOf(Z))) : 'the Mythic';
    return 'One try only. If the roll fails, ' + n + ' turns to dust and is gone forever: no grave, no second raise, no seat.';
  }

  var STEPS = [
    { k: 'feral', t: 'Starve it', d: 'A zombie of yours goes 3 days unfed and turns feral.' },
    { k: 'unleash', t: 'Unleash', d: 'Six blocks later it eats one of your own Mythics, picked by that block\'s hash.' },
    { k: 'fed', t: 'Mythic-fed', d: 'The zombie is cured forever. The eaten Mythic leaves a violet grave.' },
    { k: 'raise', t: 'Raise the grave', d: 'One Legendary offering raises the violet grave as a Mythic zombie.' },
    { k: 'pledge', t: 'Pledge halo', d: 'Pledge pets and gear until it has enough halo points to try.' },
    { k: 'roll', t: 'The roll', d: 'One Resurrection roll. Win and it rises as a Mythic God with a Pantheon seat.' }
  ];
  function at(k) { for (var i = 0; i < STEPS.length; i++) if (STEPS[i].k === k) return i; return -1; }

  /* Where this pet stands. Returns { step, done, next, note } or null when the pet is not on the road. */
  function state(w, p, me, b) {
    if (!p) return null;
    var mine = !me || p.owner === me, mv = view(w, p, b);
    if (p.mythicGod) return { step: STEPS.length, done: true, seat: p.mythicGod.seat,
      next: 'Seat ' + p.mythicGod.seat + ' of ' + ((MG().SEATS) || 21) + ' in the Pantheon. ' + esc(nameOf(p)) + ' never dies.' };
    if (isMythicZ(p)) {
      var I = resInfo(w, p, b), c = capInfo(w, p, b), min = (I && I.min) || MG().RES_MIN || 66;
      var ready = I && I.points >= min;
      return { step: ready ? at('roll') : at('pledge'), res: I, cap: c,
        next: ready ? 'It can try the Resurrection now: ' + pct(I.chance) + ' chance. ' + capLine(w, p, b)
          : 'It needs ' + nf(min - ((I && I.points) || 0)) + ' more halo point' + (min - ((I && I.points) || 0) === 1 ? '' : 's') + ' before it can try (' + nf((I && I.points) || 0) + ' of ' + nf(min) + ').',
        risk: riskLine(p) };
    }
    if (isMythicGrave(p)) {
      var gw = null; try { gw = V.cemGraveWhy ? V.cemGraveWhy(w, p, p.owner, b) : null; } catch (e) { gw = null; }
      if (gw) return { step: at('raise'), stuck: true, next: 'This violet grave cannot be raised: ' + esc(gw) + '.' };
      return { step: at('raise'), next: 'Raise the violet grave with one Legendary offering (pet or gear). It comes back as a Mythic zombie.' };
    }
    if (mv && mv.fed) return { step: at('fed'), next: esc(nameOf(p)) + ' is cured forever: it never eats, never crumbles and never resurrects. The road goes on at the violet grave of #' + mv.ate + '.', jump: mv.ate };
    if (mv && mv.unleash) return { step: at('unleash'), waiting: true,
      next: 'Unleashed: it eats one of your ' + nf(mv.unleash.pool) + ' Mythic' + (mv.unleash.pool === 1 ? '' : 's') + ' at block ' + nf(mv.unleash.mealAt) + ' (' + nf(mv.unleash.left) + ' block' + (mv.unleash.left === 1 ? '' : 's') + ' to go).' };
    if (mv && mv.on && p.zombie && !p.zombie.end) {
      if (p.feral) return { step: at('unleash'), next: mine ? 'It is feral: Unleash it before it crumbles, and it eats one of your Mythics.' : 'This zombie is feral.' };
      return { step: at('feral'), next: mine ? 'Stop feeding it. Three days unfed and it turns feral, and only then can it be unleashed.' : 'Not feral yet.' };
    }
    return null;
  }

  /* The panel. Compact on a card, with the honest line about what a failed roll costs. */
  function html(w, p, me, b) {
    if (!w || !p || !V.mgOn) return '';
    b = b != null ? b : ((w.tip || 0) + 1);
    if (!V.mgOn(b)) return '';
    var S = state(w, p, me, b); if (!S) return '';
    var seats = MG().SEATS || 21, left = null; try { left = V.mgSeatsLeft ? V.mgSeatsLeft(w) : null; } catch (e) { left = null; }
    var chips = STEPS.map(function (s, i) {
      var cls = S.done || i < S.step ? 'on' : i === S.step ? 'now' : 'off';
      return '<span class="mgod-st ' + cls + '" title="' + esc(s.d) + '">' + (i + 1) + '. ' + esc(s.t) + '</span>';
    }).join('');
    var head = S.done ? '🌕 <b>Mythic God</b>' : '🌕 <b>Road to Mythic God</b> · step ' + (S.step + 1) + ' of ' + STEPS.length;
    var h = '<div class="mgod" data-mgod="' + p.id + '"><p class="mgod-h">' + head + '</p><div class="mgod-steps">' + chips + '</div>' +
      '<p class="mgod-next">' + S.next + '</p>';
    if (S.risk) h += '<p class="mgod-risk">⚠️ ' + S.risk + '</p>';
    if (S.jump) h += '<p class="small"><a href="pet.html?id=' + S.jump + '">Open the violet grave of #' + S.jump + ' ▸</a></p>';
    if (!S.done && !mgReady(w)) h += '<p class="small mgod-wait">Reading the Pantheon from the chain… seats and unleash clocks are not loaded on this page yet.</p>';
    else if (!S.done && left != null) h += '<p class="small mgod-seats">' + nf(left) + ' of ' + seats + ' Pantheon seats still open.</p>';
    return h + '</div>';
  }

  function css() {
    try {
      if (document.getElementById('mgodCss')) return; var s = document.createElement('style'); s.id = 'mgodCss';
      s.textContent = '.mgod{margin:6px 0;padding:7px 8px;border:1px solid #6a4aa0;border-radius:6px;background:#160f24}' +
        '.mgod-h{margin:0 0 5px;font-size:13px;color:#e2c8ff}' +
        '.mgod-steps{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:5px}' +
        '.mgod-st{font-size:10px;padding:2px 5px;border-radius:10px;border:1px solid #4a3a6a;background:#1c1430;color:#9b90b8;white-space:nowrap}' +
        '.mgod-st.on{background:#2a1a46;border-color:#8a4fe0;color:#d9c4ff}' +
        '.mgod-st.now{background:#b46cff;border-color:#e2c8ff;color:#160f24;font-weight:700}' +
        '.mgod-next{margin:0;font-size:13px;color:#f3ecff}' +
        '.mgod-risk{margin:5px 0 0;font-size:12px;color:#ffb4a8;font-weight:600}' +
        '.mgod-seats,.mgod-wait{margin:4px 0 0;color:#b9b0d6}' +
        '@media (max-width:600px){.mgod-st{font-size:9px}}';
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {}
  }
  css();

  window.V2MgRoad = { html: html, state: state, capInfo: capInfo, capLine: capLine, riskLine: riskLine, mgReady: mgReady, STEPS: STEPS, esc: esc, pct: pct };
})();
