/* mypets-zombie-filter (owner Oct 30 2026, "we will need to be able to search my pets for particular zombies"). Display only, no rule change.
 * Zombie filters for My Pets (All zombies / Hungry / Feral / Crumbling soon), zombie words for the Find box and the 'Zombie time left' sort.
 * Every number comes from the engine's zombie view, V2Rules.cemView (o.zombie, o.feral, o.hungerLeft, o.crumbleIn): nothing here is read by replay.
 *  - Hungry = it can eat a zombie meal now: the cemetery loop is on, you own it, and you have a living pet it is allowed to eat (cemOfferWhy).
 *  - Feral = the engine's feral flag (anyone can hunt it).
 *  - Crumbling soon = turns to dust within SOON blocks (one chain day, about 24 hours).
 *  - Sort 'ztime': zombies first, least time left first (feral ones by blocks to dust, the others by blocks to feral), then the other pets by number.
 * Pure; tested in tools/mypets-zombie-filter-test.js. */
(function (root) {
  'use strict';
  var SOON = 144;
  var KINDS = [['all', '🧟', 'All zombies', 'every risen zombie you own'], ['hungry', '🍖', 'Hungry', 'can eat a zombie meal now'],
    ['feral', '👁️', 'Feral', 'feral now: anyone can hunt it'], ['soon', '⏳', 'Crumbling soon', 'turns to dust within about a day']];
  function V() { return root.V2Rules || {}; }
  function isZ(p) { return !!(p && p.zombie && !p.zombie.end); }
  /* memo per replay world: zombie views per block, and 'do I have a pet a zombie may eat' per block + wallet (one O(n) pass per render) */
  var VM = typeof WeakMap !== 'undefined' ? new WeakMap() : null, MM = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function slot(M, w, key) { if (!M || !w || typeof w !== 'object') return { key: key, v: new Map() }; var m = M.get(w); if (!m || m.key !== key) { m = { key: key, v: new Map() }; M.set(w, m); } return m; }
  /** view(w, p, b): the engine's zombie view (cemView) or null when p is not a risen zombie. */
  function view(w, p, b) { if (!isZ(p)) return null; var m = slot(VM, w, String(b)), o = m.v.get(p); if (o !== undefined) return o;
    o = null; try { var v = V(); if (v.cemView) { var x = v.cemView(w, p, b); if (x && x.zombie) o = x; } } catch (e) { o = null; } m.v.set(p, o); return o; }
  /** hasMeal(w, me, b): do I own a living pet a zombie may eat at block b? (the same check the zombie meal picker uses) */
  function hasMeal(w, me, b) { var m = slot(MM, w, b + '|' + me); if (m.v.has('ok')) return m.v.get('ok'); var v = V(), ok = false;
    if (me && v.cemOfferWhy && w && w.pets) { var ps = Array.isArray(w.pets) ? w.pets : Object.keys(w.pets).map(function (k) { return w.pets[k]; });
      for (var i = 0; i < ps.length && !ok; i++) { var a = ps[i]; if (a && a.owner === me && !a.dead && !a.released && !isZ(a) && !v.cemOfferWhy(w, a, me, b)) ok = true; } }
    m.v.set('ok', ok); return ok; }
  /** info(w, p, b, me): { feral, hungerLeft, crumbleIn, left, hungry, soon } for a zombie, null for any other pet. */
  function info(w, p, b, me) { var o = view(w, p, b); if (!o) return null; var v = V(), on = !!(v.cemOn && v.cemOn(b));
    var hungry = on && !!me && p.owner === me && hasMeal(w, me, b);
    return { feral: !!o.feral, hungerLeft: o.hungerLeft, crumbleIn: o.crumbleIn, left: o.feral ? o.crumbleIn : o.hungerLeft, hungry: hungry, soon: o.crumbleIn <= SOON }; }
  /** match(kind, w, p, b, me): does pet p pass the zombie filter kind ('' or null = no filter)? */
  function match(kind, w, p, b, me) { if (!kind) return true; var z = info(w, p, b, me); if (!z) return false;
    return kind === 'all' ? true : kind === 'hungry' ? z.hungry : kind === 'feral' ? z.feral : kind === 'soon' ? z.soon : true; }
  /** counts(w, pets, b, me): how many of these pets each filter keeps. */
  function counts(w, pets, b, me) { var c = { all: 0, hungry: 0, feral: 0, soon: 0 };
    (pets || []).forEach(function (p) { var z = info(w, p, b, me); if (!z) return; c.all++; if (z.hungry) c.hungry++; if (z.feral) c.feral++; if (z.soon) c.soon++; }); return c; }
  /** comparator(w, b): zombies first, least time left before dust first (= feral first, then fewest blocks to feral), ties and other pets by pet number. */
  function comparator(w, b) { return function (a, c) { var x = view(w, a, b), y = view(w, c, b);
    if (x && !y) return -1; if (y && !x) return 1; if (x && y) return (x.crumbleIn - y.crumbleIn) || a.id - c.id; return a.id - c.id; }; }
  /** words(w, p, b, me): extra Find-box words for a zombie card ('zombie', 'risen', 'feral', 'hungry', 'crumbling', 'dust soon'). */
  function words(w, p, b, me) { var z = info(w, p, b, me); if (!z) return []; var o = ['zombie', 'zombies', 'risen', 'undead'];
    if (z.feral) o.push('feral'); if (z.hungry) o.push('hungry', 'zombie meal'); if (z.soon) o.push('crumbling', 'crumble', 'dust soon'); return o; }
  function span(bl) { var m = Math.round(bl * 10), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + (m % 60) + 'm' : (m % 60) + 'm'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  /** rowHtml(c, on, shown): the filter row under the search (same .q pill buttons and .chip counts as 'Never fed only'). */
  function rowHtml(c, on, shown) { var h = '<span class="small zbf-lbl">🧟 Zombies</span>';
    KINDS.forEach(function (k) { var act = on === k[0];
      h += '<button type="button" class="q zbf-btn' + (act ? ' on' : '') + '" data-zf="' + k[0] + '" aria-pressed="' + act + '" title="' + esc(k[3]) + (act ? ' · tap again to show all pets' : '') + '"' + (!c[k[0]] && !act ? ' data-zero="1"' : '') + '>' +
        k[1] + ' ' + (act ? '✓ ' : '') + esc(k[2]) + ' <span class="chip">' + c[k[0]] + '</span></button>'; });
    h += ' <span class="small muted zbf-note">' + (on ? 'showing ' + shown + ' zombie' + (shown === 1 ? '' : 's') + ' · tap again to show all pets' : 'optional filters, off: all pets are listed') + '</span>';
    return h; }
  var CSS = '#pets .zbfilter .zbf-lbl{font-family:"Press Start 2P",monospace;font-size:10px;color:#9be08a;white-space:nowrap}' +
    '#pets .zbfilter .zbf-btn[data-zero]{opacity:.55}#pets .zbfilter .zbf-btn.on{border-color:#9be08a;box-shadow:0 0 0 2px #2c4a26 inset}' +
    '@media (max-width:640px){#pets .zbfilter{gap:6px!important}#pets .zbfilter .zbf-lbl{flex-basis:100%}#pets .zbfilter .zbf-note{flex-basis:100%}}';
  function css() { if (typeof document === 'undefined' || document.getElementById('zbfCss')) return; var st = document.createElement('style'); st.id = 'zbfCss'; st.textContent = CSS; document.head.appendChild(st); }
  var K = 'xcpets-zbf';
  function load() { try { var v = sessionStorage.getItem(K) || ''; return /^(all|hungry|feral|soon)$/.test(v) ? v : ''; } catch (e) { return ''; } }
  function save(v) { try { if (v) sessionStorage.setItem(K, v); else sessionStorage.removeItem(K); } catch (e) { } }
  var api = { SOON: SOON, KINDS: KINDS, isZ: isZ, view: view, info: info, hasMeal: hasMeal, match: match, counts: counts, comparator: comparator, words: words, span: span, rowHtml: rowHtml, css: css, load: load, save: save };
  root.V2ZombieFilter = api; if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
