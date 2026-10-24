/* v2-community.js (cast-cold-storage, owner Oct 24 2026 1:05 + 1:06 AM CT). Display only: reads the replayed world, never changes it.
 * ONE community pet list. Each entry names the replay record that marks its Cold Storage (w[rec] = { block, ... }, set by V2Rules.replay).
 * A future community pet = one more line here (id, no, names, rec, sprite id + Cold Storage loadout). Everything else follows from the replay:
 *   - the home page cast (index.html #cast) shows every community pet in Cold Storage as a cast row (Legendary tab) and a Mythic card;
 *   - [data-cp] text on rules.html, how-it-works.html, pets.html and the front page, and the v2-intuitive help pop-ups, name the current
 *     community pet, who is in Cold Storage, which pet the 1 in 777 egg hatches, and the halving count / next halving.
 * Pages without a replay (rules, how-it-works, pets) read the same state from api/meta.json "community" (built by tools/api-feed.js from the
 * same replay). If neither is there, the HTML's own text stays as the fallback. */
(function () {
  'use strict';
  var PETS = [
    { id: 'nakamoto', no: 1, name: 'Nakamoto', short: 'Nakamoto', plural: 'Nakamotos', rec: null, egg: false },
    { id: 'wizard', no: 2, name: 'Bitcoin Wizard', short: 'Wizard', plural: 'Bitcoin Wizards', the: 'the ', rec: 'wizardMythic', sp: 'wizard', loadout: ['wizard-hat', 'sig-wizard-staff', 'sig-wizard-sign'], egg: true },
    { id: 'kek', no: 3, name: 'Lord Kek', short: 'Lord Kek', plural: 'Lord Keks', rec: 'kekMythic', sp: 'kek', loadout: ['kek-card'], egg: true },
    { id: 'funtrump', no: 4, name: 'FUNTRUMP', short: 'FUNTRUMP', plural: 'FUNTRUMPs', rec: 'funtrumpMythic', sp: 'funtrump', loadout: [], egg: true }
  ];
  function byId(id) { return PETS.filter(function (p) { return p.id === id; })[0] || null; }
  function pub(p, extra) { return p ? Object.assign({ id: p.id, no: p.no, name: p.name, short: p.short, plural: p.plural, the: p.the || '' }, extra || {}) : null; }
  /** state(w): plain JSON (safe for api/meta.json). */
  function state(w) {
    if (!w || !w.community) return null; var c = w.community, V = window.V2Rules, tip = w.tip || 0, cold = [];
    PETS.forEach(function (p) { var r = p.rec ? w[p.rec] : (c.returned ? { block: c.returnBlock } : null); if (r && r.block != null) cold.push(pub(p, { block: r.block })); });
    var isCold = function (id) { return cold.some(function (x) { return x.id === id; }); };
    var cur = c.current && !isCold(c.current) ? byId(c.current) : null;
    var eggs = cold.filter(function (x) { return byId(x.id).egg; }), egg = eggs[eggs.length - 1] || null, prevEgg = eggs[eggs.length - 2] || null;
    var last = cold[cold.length - 1] || null, nextNo = cur ? cur.no : (last ? last.no + 1 : 1);
    var hs = []; try { hs = (V && V.halvingBlocks ? V.halvingBlocks(w) : []) || []; } catch (e) { hs = []; }
    var done = hs.filter(function (b) { return b <= tip + 1; }).length, next = hs.filter(function (b) { return b > tip + 1; })[0] || null;
    return { tip: tip, current: pub(cur), nextNo: nextNo, cold: cold, egg: egg, prevEgg: prevEgg, last: last, halvings: hs, halvingsDone: done, nextHalving: next };
  }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function up(t) { return t ? t[0].toUpperCase() + t.slice(1) : ''; }
  function poss(n) { return n + "'s"; }
  function curName(s) { return s.current ? s.current.name : 'community pet #' + s.nextNo; }
  /* One builder per [data-cp] key. Same wording as the hand-written text, with the names taken from the state. Return null = keep the HTML. */
  var T = {
    'cur': function (s) { return s.current ? s.current.name : null; },
    'cur-plain': function (s) { return curName(s); },
    'cur-title': function (s) { return 'The community pet: ' + (s.current ? s.current.name : '#' + s.nextNo + ' coming soon'); },
    'took-place': function (s) { var l = s.last; if (!s.current || !l || l.id === 'nakamoto') return null;
      return 'He took ' + l.the + poss(l.name) + ' place when ' + l.the + l.short + ' reached Mythic and went to Cold Storage.'; },
    'took-place-short': function (s) { var l = s.last; if (!s.current || !l || l.id === 'nakamoto') return null; return 'He took ' + l.the + poss(l.name) + ' place when ' + l.the + l.short + ' reached Mythic.'; },
    'egg-now': function (s) { return s.egg ? 'The 1 in 777 egg is now a ' + s.egg.name + ' egg.' : null; },
    'egg-next': function (s) { if (!s.egg) return null; var n = s.current;
      return n ? 'When ' + n.name + ' reaches Mythic and goes to Cold Storage, ' + s.egg.short + ' eggs stop and that 1 in 777 egg becomes a ' + n.name + ' egg.'
        : s.egg.short + ' eggs keep coming from that 1 in 777 egg until the next community pet reaches Mythic.'; },
    'egg-then': function (s) { if (!s.egg) return null; var n = s.current, h = 'Player ' + s.egg.plural + ' come from the 1 in 777 egg' + (s.egg.id === 'wizard' ? '' : ' since ' + s.egg.name + ' went to Cold Storage (block ' + fmt(s.egg.block) + ')') + '.';
      return n ? h + ' When ' + n.name + ' reaches Mythic, that egg hatches ' + n.plural + ' instead, and player ' + n.plural + ' can breed.' : h; },
    'cold-who': function (s) { var l = s.cold.filter(function (x) { return x.no >= 2; }); if (!l.length) return null;
      var t = l.map(function (x) { return up(x.the) + x.name + ' reached Mythic at block ' + fmt(x.block); }).join('; ');
      return t + (s.current ? '; ' + s.current.name + ' took ' + (l.length > 1 ? 'that' : 'his') + ' place and is the community pet now.' : '. Community pet #' + s.nextNo + ' is coming soon.'); },
    'halving-count': function (s) { if (!s.halvings.length) return null;
      return 'Halvings so far: ' + s.halvingsDone + (s.nextHalving ? '. Next halving at block ' + fmt(s.nextHalving) + '.' : s.current ? '. The next one comes 6 blocks after ' + s.current.name + ' goes to Cold Storage.' : '.'); },
    'help-egg': function (s) { return s.egg ? '1 in 777 eggs is ' + (s.egg.the ? 'a ' : 'a ') + s.egg.name + '.' : null; },
    'help-cold': function (s) { if (!s.egg) return null; var old = s.cold.filter(function (x) { return x.no >= 2 && x.id !== s.egg.id; });
      return 'Nakamoto (#1) is no longer hatched. ' + old.map(function (x) { return x.short + ' (#' + x.no + ') eggs stopped. '; }).join('') + up(s.egg.the) + s.egg.name + ' (#' + s.egg.no + ') now comes from the 1 in 777 hatch roll.'; }
  };
  /* per-pet status lines on the Pet Guide (data-cp="pet:<id>") */
  function petLine(s, id) { var p = byId(id); if (!p || !s) return null; var cold = s.cold.filter(function (x) { return x.id === id; })[0];
    if (s.egg && s.egg.id === id) return 'In Cold Storage since block ' + fmt(cold.block) + '. The 1 in 777 egg is now a ' + p.name + ' egg that anyone can hatch, at any tier. There is no other way to get one.';
    if (cold && p.egg) return 'In Cold Storage since block ' + fmt(cold.block) + '. ' + p.short + ' eggs stopped when ' + (PETS[p.no] ? PETS[p.no].name : 'the next pet') + ' reached Mythic.';
    if (s.current && s.current.id === id) return 'The community pet now' + (s.last && s.last.no >= 2 ? ', in ' + s.last.the + poss(s.last.name) + ' place' : '') + '. Not hatched yet. When he reaches Mythic and goes to Cold Storage, the 1 in 777 egg becomes a ' + p.name + ' egg that anyone can hatch, at any tier. There is no other way to get one.';
    return null; }
  function apply(s, root) { if (!s) return; (root || document).querySelectorAll('[data-cp]').forEach(function (el) { var k = el.getAttribute('data-cp'), t = null;
      try { t = /^pet:/.test(k) ? petLine(s, k.slice(4)) : T[k] ? T[k](s) : null; } catch (e) { t = null; }
      if (t != null && el.textContent !== t) el.textContent = t; });
    if (document.body) document.body.setAttribute('data-cp-current', s.current ? s.current.id : 'none'); }
  var last = null;
  function set(s) { last = s; apply(s); }
  function fromWorld(w) { var s = state(w); set(s); return s; }
  /* no replay on this page: read the hourly feed (same replay); quiet on failure, the HTML text stays */
  function fromFeed() { if (!window.fetch || window.V2Mock) return; fetch('api/meta.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (m) { if (m && m.community && !last) set(m.community); }).catch(function () { }); }
  window.V2Community = { PETS: PETS, byId: byId, state: state, apply: apply, set: set, fromWorld: fromWorld, current: function () { return last; }, text: T, petLine: petLine };
  if (typeof document !== 'undefined' && document.addEventListener && document.querySelector) { var go = function () { if (!document.body || document.body.getAttribute('data-v2page')) return; fromFeed(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go(); }
})();
