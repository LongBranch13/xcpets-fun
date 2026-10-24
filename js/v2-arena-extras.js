/* XCPETS X Circus Kekimus extras (DRAFT 2026-10-19, owner 7:34-7:39 PM CT; battle-arena, NOT LIVE). Off-chain UI only: no rule, burn or replay change.
 * V2Rivals: head-to-head per pet pair from replayed fights (rivalry = 2+ fights between the same pair). V2Announcer: boxing-style calls built
 * from the fight's own data (names, species, stats, hits, crits, comeback, winner). Lines are static in this file: MEME lines (from
 * /workspace/xcpets/memes captions, site meme copy and species blurbs) are used when they fit the moment, FRESH lines otherwise; no repeats
 * within a fight; the pick is seeded by the fight id so a replay gets the same commentary. Optional voice = the browser's speechSynthesis
 * (🔊 Announcer toggle, off by default, saved in localStorage). quickMatch(): fair opponent (closest power, random among the top 3). */
(function () {
  'use strict';
  /* ---- rivalries ---- */
  function pairKey(a, b) { return a < b ? a + ':' + b : b + ':' + a; }
  function rivals(w) { var R = {}; (w.fights || []).filter(function (f) { return f.status === 'done'; }).sort(function (a, b) { return a.acceptBlock - b.acceptBlock || a.id - b.id; }).forEach(function (f) {
      var k = pairKey(f.a, f.b), r = R[k] = R[k] || { lo: Math.min(f.a, f.b), hi: Math.max(f.a, f.b), wins: {}, n: 0, streak: { id: null, n: 0 }, last: null, fights: [] };
      r.n++; r.wins[f.winner] = (r.wins[f.winner] || 0) + 1; r.streak = r.streak.id === f.winner ? { id: f.winner, n: r.streak.n + 1 } : { id: f.winner, n: 1 }; r.last = f; r.fights.push(f.id); });
    return R; }
  function rivalsOf(w, id, R) { R = R || rivals(w); return Object.keys(R).map(function (k) { return R[k]; }).filter(function (r) { return r.n >= 2 && (r.lo === id || r.hi === id); })
      .map(function (r) { var o = r.lo === id ? r.hi : r.lo; return { opp: o, w: r.wins[id] || 0, l: r.wins[o] || 0, streak: r.streak, last: r.last, n: r.n }; }).sort(function (a, b) { return b.n - a.n || b.last.acceptBlock - a.last.acceptBlock; }); }
  /** rivalryFor(w, f): the pair's record from fights up to and including f (null unless 2+). */
  function rivalryFor(w, f) { var L = (w.fights || []).filter(function (x) { return x.status === 'done' && pairKey(x.a, x.b) === pairKey(f.a, f.b) && (x.acceptBlock < f.acceptBlock || (x.acceptBlock === f.acceptBlock && x.id <= f.id)); });
    if (L.length < 2) return null; var wa = L.filter(function (x) { return x.winner === f.a; }).length; return { n: L.length, wa: wa, wb: L.length - wa }; }
  function streakText(r) { return r.streak.n >= 2 ? '#' + r.streak.id + ' won ' + r.streak.n + ' in a row' : '#' + r.streak.id + ' won the last one'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /** strip(w, id, href(fightId)) -> HTML 'Rivals' strip (short copy) */
  function strip(w, id, href) { var L = rivalsOf(w, id); if (!L.length) return '';
    return '<div class="rv-strip"><b class="rv-h">⚔️ Rivals</b>' + L.slice(0, 6).map(function (r) { var o = w.byId[r.opp];
      return '<div class="rv"><a class="rv-chip" href="pet.html?id=' + r.opp + '">#' + r.opp + ' ' + esc(o ? String(o.name).slice(0, 10) : '') + '</a><span class="rv-wl">' + r.w + '-' + r.l + '</span><span class="rv-st">' + esc(streakText(r)) + '</span><a class="q rv-rp" href="' + href(r.last.id) + '" data-rvrp="' + r.last.id + '">▶ last fight</a></div>'; }).join('') + '</div>'; }

  /* ---- announcer ---- */
  var SP = { pepe: 'Pepe', wojak: 'Wojak', chud: 'Chud', peepo: 'Peepo', doge: 'Doge', bobo: 'Bobo', mumu: 'Mumu', sarutobi: 'Sarutobi', lenny: 'Lenny', snibby: 'Snibby', kevin: 'Kevin', dodo: 'Dodo', nakamoto: 'Nakamoto' };
  /* MEME: lines from the XCPETS meme set (species-2026-10-19 captions + site meme copy + species blurbs), lightly cut for captions. {X} = that pet's name */
  var MEME = {
    pepe: ['{X} thinks he is the main character. Tonight he might be.', 'Feels-Good Tee on. Feels-bad night for somebody.', 'Lily cup. Scepter. Zero humility.'],
    wojak: ['{X}: fed daily, still sad.', 'Not one Wojak slept last night. It shows.', 'Day 6 unfed? Honestly looks about the same.'],
    chud: ['The glasses are not a slot. They are {X}.', 'Glasses never come off. Neither do the gloves.', 'Ban hammer equipped. The chat is a safe space now.'],
    peepo: ['Peepo is NOT Pepe. {X} needs you to know.', 'Happy Monday, sad Tuesday, angry fight night.', 'Peeking from the blanket fort!'],
    doge: ['Such neckerchief. Very not on head. Wow.', 'Much ouch. Very right eye.', 'Fetch stick: Doge only.'],
    bobo: ['{X} has never once been Common. He brings it up at dinner.', 'Smug since Uncommon.', 'Lost a battle? Still smug about it.'],
    mumu: ['Nose ring day! {X} stampedes in.', 'Mumus stampede to breakfast. Tonight, to battle.'],
    sarutobi: ['The Counterparty monkey has not sat still since.', 'Banana stays Legendary.', 'Somersault cloud incoming!'],
    lenny: ['Monocle goes on the eye. Fists go on the face.', 'Raised brow. Lowered expectations.'],
    snibby: ['{X} enters the chat... sideways.', 'Pinch first. Ask later.', 'Walked sideways into Rare.'],
    kevin: ['Hello my name is KEVIN. They are all KEVIN.', 'Name tag: KEVIN only.'],
    dodo: ['The black swan nobody saw coming!', 'Legendary only. One eye.', 'Black eye on the one eye he has!'],
    nakamoto: ['No new ones. Ever. Do the math.', 'Cold-wallet boots laced up.'],
    loser: { doge: 'Much ouch. Very right eye.', dodo: 'Black eye on the one eye he has!', bobo: 'Lost a battle? Still smug about it.', snibby: 'Pinch first. Ask later.', wojak: 'Honestly looks about the same.' },
    any: { crit: ['Ban hammer moment!'], win: ['690 to fight, loser pays in gear!', 'Buried in full kit, no regrets... but not tonight.'], lose: ['Somebody is paying in gear!'] } };
  /* FRESH: written in the same voice. {A}/{B} red/blue corner, {X} actor, {Y} target, {D} damage, {S} species, {W}/{L} winner/loser, {R} rounds */
  var FRESH = {
    intro: ['In the red corner... weighing in at {PA} power... {A} the {SA}!', 'And in the blue corner... {B} the {SB}! OH YEAH!', 'Welcome, brother, to X CIRCUS KEKIMUS! All XCP becomes spectacle!', 'Ladies, gents and degens... it is TIME... {A} versus {B}!', 'Tale of the tape: {PA} power against {PB} power, and somebody is going DOWN!', 'The crowd is on its feet! The sand is hot! The gear is on the line!'],
    hit: ['{X} lands one for {D}!', 'Clean shot! {D} off {Y}.', '{X} with the jab. {D}!', 'Oof. {Y} felt that.', '{X} cooks {Y} for {D}.', 'That is a {D}-point receipt!', '{Y} is checking the mempool for help.', 'Right on the beak!', '{X} says gm with a {D}!'],
    crit: ['CRITICAL! {X} hits for {D}!', 'BIG ONE! {D} and the crowd goes wild!', 'Crit! {Y} sees block hashes!', 'WOW. {X} found the weak spot. {D}!', 'That one was minted on chain! {D}!'],
    miss: ['Whiff! {Y} dodges!', '{X} swings at air.', 'Missed! {Y} is too zoomy.', 'Nothing! {Y} moonwalks out of it.', 'Air ball from {X}!'],
    comeback: ['{X} is not dead yet! COMEBACK!', 'From the ropes, {X} fights back!', 'Down bad, now up good! {X}!'],
    close: ['Both on fumes! Anyone\u2019s fight!', 'This is a coin flip with fists!'],
    win: ['ONE! TWO! THREE! {W} WINS in {R} rounds!', 'Here is your winner... {W}!', '{W} takes it, brother! {L} pays in gear!', 'LIGHTS OUT! {W} by knockout! What a match!', 'BAH GAWD! {W} is up only tonight!'],
    lose: ['{L} gets the black eye! Somebody call the medic!', '{L} will be back, folks. Probably.', 'Rough night for {L}. NGMI... this time!'],
    upset: ['UPSET! UPSET! {W} was not supposed to win this!', 'BAH GAWD, THE UNDERDOG! {W} SHOCKS the Circus!', 'Nobody saw that coming! {W} pulls off the UPSET!'],
    streak3: ['That is THREE in a row for {W}!', '{W} makes it three straight! The belt comes out of the case!'],
    streak5: ['FIVE STRAIGHT! {W} is UNSTOPPABLE! Somebody stop this pet!', '{N} IN A ROW! {W} is a WRECKING MACHINE, brother!'],
    streakN: ['{N} in a row for {W}! The champ rolls on!'],
    snapped: ['The streak is SNAPPED! {L}\u2019s {N}-win run is OVER!', '{L}\u2019s belt goes BACK TO THE CASE!'],
    sponsor: ['Tonight\u2019s sand brought to you by {SP}!', 'This bout is presented by {SP}! What a night!', 'Brought to you by our friends at {SP}, brother!'],
    holder: ['Defending a {N}-win streak... {X}, and the gold is on the line!'],
    filler: ['The crowd chants: KE-KI-MUS!', 'Somebody throws a corn cob into the arena.', 'Popcorn sales are up only.', '{X} looks hungry for gear.', 'Ref checks the replay hash. Legit.', 'Not financial advice. Just fists.'] };
  function rng(seed) { var s = (seed * 2654435761) >>> 0 || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function fill(t, v) { return t.replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; }); }
  /** script(f, w) -> [{ at: 'intro'|turnIndex|'end', text, src: 'meme'|'fresh' }] (deterministic per fight id) */
  function script(f, w) { var A = w.byId[f.showA || f.a] || { name: '#' + f.a, species: '' }, B = w.byId[f.showB || f.b] || { name: '#' + f.b, species: '' }, R = rng(f.id || 1), used = {}, out = [];
    var spn = function (p) { return SP[p.species] || (/^hyb/.test(p.species) && window.V2Rules ? V2Rules.hybridName(p.species) : 'pet'); }, pw = function (p) { var s = p.stats || {}, t = 0; for (var k in s) t += +s[k] || 0; return t; };
    var base = { A: A.name, B: B.name, SA: spn(A), SB: spn(B), PA: pw(A), PB: pw(B), W: (w.byId[f.winner] || {}).name || '#' + f.winner, L: (w.byId[f.loser] || {}).name || '#' + f.loser, R: (f.turns || []).length };
    function pick(list, src, v) { var c = list.filter(function (t) { return !used[t]; }); if (!c.length) return null; var t = c[Math.floor(R() * c.length)]; used[t] = 1; return { text: fill(t, Object.assign({}, base, v || {})), src: src }; }
    function meme(p, extra) { var L = (MEME[p.species] || []).filter(function (t) { return !/black eye|lost a battle|ouch|pinch first|looks about the same/i.test(t); }).concat(extra || []); return L.length ? pick(L, 'meme', { X: p.name }) : null; }
    function say(at, x) { if (x) { x.at = at; out.push(x); } }
    var FUN = window.V2ArenaFun ? V2ArenaFun.info(w, f) : null, spn0 = window.V2Sponsor && V2Sponsor.sponsorAt ? V2Sponsor.sponsorAt(f.acceptBlock || f.block) : null; /* read-only: the fixed pseudo-sponsor of that chain day, read aloud */
    if (spn0) say('intro', pick(FRESH.sponsor, 'fresh', { SP: spn0 }));
    /* arena modes (Oct 22 2026): mode intros + calls, same wrestling-caller voice */
    var nm = function (id) { return (w.byId[id] || {}).name || '#' + id; };
    if (f.mode === 'sd') { say('intro', pick(['SUDDEN DEATH! ONE HIT. THAT\u2019S ALL IT TAKES!', 'No health bars tonight, folks. One clean shot and it\u2019s OVER!'], 'fresh')); if (f.coin) say('end', pick(['Nobody lands a thing! THE CROWD DECIDES!'], 'fresh')); else say('end', pick(['ONE BLOW! {W} ends it in ONE BLOW!', 'Blink and you missed it! {W} WINS!'], 'fresh')); }
    if (f.mode === 'tt') { say('intro', pick(['TAG TEAM ACTION! ' + nm(f.a) + ' and ' + nm(f.a2) + ' versus ' + nm(f.b) + ' and ' + nm(f.b2) + '!'], 'fresh'));
      (f.bouts || []).slice(0, -1).forEach(function (bt, i) { var nx = f.bouts[i + 1], inn = nx.a === bt.winner ? nx.b : nx.a; say('intro', pick(['TAG! ' + nm(inn) + ' is IN!', nm(bt.loser) + ' is DOWN! ' + nm(inn) + ' tags in!'], 'fresh')); });
      var lb = (f.bouts || [])[f.bouts.length - 1]; if (lb && (lb.a === f.bouts[0].winner || lb.b === f.bouts[0].winner) && f.bouts.length > 1) say('intro', pick(['{W} is running on fumes!'.replace('{W}', nm(f.bouts[0].winner))], 'fresh'));
      say('end', pick(['LAST PET STANDING! ' + nm(f.winners[0]) + ' and ' + nm(f.winners[1]) + ' take it!'], 'fresh')); }
    say('intro', pick([FRESH.intro[0]], 'fresh')); say('intro', meme(A) || pick(FRESH.intro.slice(2), 'fresh')); say('intro', pick([FRESH.intro[1]], 'fresh')); say('intro', meme(B) || pick(FRESH.intro.slice(2), 'fresh'));
    var T = f.turns || [], low = { a: false, b: false }, maxA = f.maxA || 1, maxB = f.maxB || 1, sinceLast = 9;
    T.forEach(function (t, i) { var X = t.by === 'a' ? A : B, Y = t.by === 'a' ? B : A, v = { X: X.name, Y: Y.name, D: t.dmg }, ln = null;
      var hpX = t.by === 'a' ? t.hpA / maxA : t.hpB / maxB; if (t.hpA / maxA < 0.3) low.a = true; if (t.hpB / maxB < 0.3) low.b = true;
      if (t.crit) ln = (R() < 0.4 ? pick(MEME.any.crit, 'meme', v) : null) || (X.species === 'chud' && R() < 0.5 ? meme(X) : null) || pick(FRESH.crit, 'fresh', v);
      else if (t.dodge) ln = (Y.species === 'snibby' || Y.species === 'sarutobi') && R() < 0.6 ? meme(Y) : pick(FRESH.miss, 'fresh', v);
      else if (low[t.by] && hpX < 0.3 && !t._cb && i > 1 && f.winner === X.id && R() < 0.8) { ln = pick(FRESH.comeback, 'fresh', v); low[t.by] = false; }
      else if (t.hpA / maxA < 0.25 && t.hpB / maxB < 0.25 && R() < 0.6) ln = pick(FRESH.close, 'fresh', v);
      else if (sinceLast >= 2 || R() < 0.45) ln = R() < 0.15 ? pick(FRESH.filler, 'fresh', v) : pick(FRESH.hit, 'fresh', v);
      if (ln) { say(i, ln); sinceLast = 0; } else sinceLast++; });
    var Wp = w.byId[f.winner] || A, Lp = w.byId[f.loser] || B;
    if (FUN && FUN.upset) say('end', pick(FRESH.upset, 'fresh'));
    say('end', pick(FRESH.win, 'fresh'));
    if (FUN) { var ns = FUN.winStreak; if (ns >= 5) say('end', pick(FRESH.streak5, 'fresh', { N: ns })); else if (ns === 3) say('end', pick(FRESH.streak3, 'fresh', { N: ns })); else if (ns > 3) say('end', pick(FRESH.streakN, 'fresh', { N: ns }));
      if (FUN.beltBack) say('end', pick(FRESH.snapped, 'fresh', { N: FUN.lostStreak })); } say('end', (R() < 0.5 ? meme(Wp) : null) || pick(MEME.any.win, 'meme')); say('end', (MEME.loser[Lp.species] ? pick([MEME.loser[Lp.species]], 'meme', { X: Lp.name }) : null) || pick(FRESH.lose, 'fresh'));
    return out; }
  var KEY = 'xcpets-announcer-voice';
  function voiceOn() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function setVoice(on) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { } if (!on && window.speechSynthesis) speechSynthesis.cancel(); }
  /* announcer-fix (Oct 21 2026): faster voice, a better voice when the browser has one, and no backlog. Before: rate 1.12 with every line queued, so the
   * voice fell further behind the fight each round. Now rate 1.35; if a line is still waiting in the browser queue when a new one arrives, the stale
   * one is dropped (cancel) so the voice stays on the current moment; end lines (winner calls) are queued, never dropped for each other. */
  var VOICE_PREF = [/natural/i, /^Google US English$/i, /^Google UK English Male$/i, /Microsoft (Guy|Davis|Andrew|Christopher|Eric)/i, /^(Daniel|Alex|Aaron|Fred)\b/i, /Google/i, /Microsoft/i];
  var voicePick = null;
  function chooseVoice() { if (voicePick) return voicePick; var L = []; try { L = (speechSynthesis.getVoices() || []).filter(function (v) { return /^en(-|_|$)/i.test(v.lang || ''); }); } catch (e) { }
    for (var i = 0; i < VOICE_PREF.length && !voicePick; i++) voicePick = L.filter(function (v) { return VOICE_PREF[i].test(v.name); })[0] || null; return voicePick || L[0] || null; }
  if (typeof window !== 'undefined' && window.speechSynthesis && speechSynthesis.addEventListener) try { speechSynthesis.addEventListener('voiceschanged', function () { voicePick = null; }); } catch (e) { }
  var RATE = 1.35, PITCH = 0.85, inEnd = false;
  function reset() { inEnd = false; if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) { } }
  function speak(text, o) { if (!voiceOn() || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return; o = o || {};
    try { if (!(o.end && inEnd) && speechSynthesis.pending) speechSynthesis.cancel(); if (o.end) inEnd = true;
      var u = new SpeechSynthesisUtterance(text), v = chooseVoice(); if (v) { u.voice = v; u.lang = v.lang; } u.rate = RATE; u.pitch = PITCH; speechSynthesis.speak(u); } catch (e) { } }

  /* ---- quick match ---- */
  /** quickMatch(w, mine, others, tip) -> { a, b } | null: power closest to yours, random among the 3 closest; never your own, never a pet that battled today */
  function quickMatch(w, mine, others, tip, selA, rnd) { var V = window.V2Rules, d = V.day(tip), pw = function (p) { var s = p.stats || {}, t = 0; for (var k in s) t += +s[k] || 0; return t; };
    var free = function (p) { return !(p.fightDays && p.fightDays[d]); }; var A = mine.filter(function (p) { return free(p) && (!selA || String(p.id) === String(selA)); })[0] || mine.filter(free)[0]; if (!A) return null;
    var L = others.filter(function (p) { return free(p) && p.owner !== A.owner; }).sort(function (x, y) { return Math.abs(pw(x) - pw(A)) - Math.abs(pw(y) - pw(A)) || x.id - y.id; }).slice(0, 3);
    if (!L.length) return null; return { a: A, b: L[Math.floor((rnd || Math.random)() * L.length)], top: L }; }

  var CSS = '.rv-strip{margin:8px 0;padding:6px 8px;border:2px solid #000;background:#2a1530;box-shadow:3px 3px 0 #000}.rv-h{font-family:"Press Start 2P",monospace;font-size:10px;color:#ff5d5d}' +
    '.rv{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:4px;font-size:13px}.rv-chip{padding:2px 6px;background:#ffd166;color:#140f24;border:2px solid #000;text-decoration:none;font-weight:bold}.rv-wl{font-family:"Press Start 2P",monospace;font-size:10px;color:#3ddc84}.rv-st{color:#9fe8ff}' +
    '.ar-ann{display:inline-flex;align-items:center;gap:4px}.ar-qm{margin-left:4px}';
  if (typeof document !== 'undefined' && !document.getElementById('rvCss')) { var s = document.createElement('style'); s.id = 'rvCss'; s.textContent = CSS; (document.head || document.documentElement).appendChild(s); }
  /* rival replay links: on play.html play in the arena sand (closing the pet detail first); elsewhere they go to play.html#replay-N */
  if (typeof document !== 'undefined') document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('[data-rvrp]'); if (!a || !window.V2ArenaScene || !document.getElementById('arScene') || !document.getElementById('arScene').getClientRects().length || !window.V2UI) return; /* species-ranks-split: arena hidden on play.html -> the link goes to fight.html */
    var f = V2UI.world().fights[a.dataset.rvrp - 1]; if (!f) return; e.preventDefault(); var dc = document.getElementById('dClose'); if (dc && document.getElementById('detail') && document.getElementById('detail').classList.contains('on')) dc.click(); V2ArenaScene.sequence(f); });
  window.V2Rivals = { rivals: rivals, rivalsOf: rivalsOf, rivalryFor: rivalryFor, strip: strip, streakText: streakText };
  window.V2Announcer = { script: script, voiceOn: voiceOn, setVoice: setVoice, speak: speak, reset: reset, chooseVoice: chooseVoice, MEME: MEME, FRESH: FRESH };
  window.V2QuickMatch = quickMatch;
})();
