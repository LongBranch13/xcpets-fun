/* XCPETS sfx.js — 8-bit motifs synthesized with WebAudio (no audio files, no licensing). Muted by default; toggle saved in localStorage. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.Sfx = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // [freq Hz, duration s, wave] per note; 0 = rest. One personality motif per species.
  var MOTIFS = {
    pepe: [[220, .12, 'square'], [165, .18, 'square'], [0, .05], [196, .25, 'square']],          // smug croak
    wojak: [[523, .2, 'triangle'], [466, .2, 'triangle'], [392, .25, 'triangle'], [330, .45, 'triangle']], // sad descending
    chud: [[110, .15, 'sawtooth'], [110, .15, 'sawtooth'], [147, .3, 'sawtooth']],               // stomping
    bobo: [[392, .1, 'square'], [349, .1, 'square'], [294, .1, 'square'], [196, .4, 'square']],   // bear dump
    mumu: [[262, .15, 'square'], [330, .15, 'square'], [392, .15, 'square'], [523, .3, 'square']], // bull pump
    snibby: [[1200, .03, 'square'], [0, .05], [900, .03, 'square'], [0, .05], [1200, .03, 'square'], [0, .05], [900, .03, 'square']], // click-clack
    dodo: [[330, .1, 'triangle'], [0, .05], [330, .1, 'triangle'], [247, .4, 'triangle']],        // extinct honk
    kevin: [[392, .12, 'square'], [392, .12, 'square'], [0, .1], [262, .35, 'square']],           // dumb boop
    peepo: [[659, .08, 'triangle'], [784, .08, 'triangle'], [988, .2, 'triangle']],               // happy peep
    sarutobi: [[880, .06, 'sawtooth'], [1175, .06, 'sawtooth'], [1568, .25, 'sawtooth']],         // zoom
    doge: [[700, .08, 'sine'], [1050, .25, 'sine'], [0, .05], [1400, .12, 'sine']],               // wow chirp
    lenny: [[330, .2, 'triangle'], [415, .1, 'triangle'], [330, .3, 'triangle']],                 // ( ͡° ͜ʖ ͡°)
    nakamoto: [[523, .15, 'square'], [659, .15, 'square'], [784, .15, 'square'], [1047, .4, 'square']]
  };
  var EVOLVE = [[262, .08, 'square'], [330, .08, 'square'], [392, .08, 'square'], [523, .08, 'square'], [659, .08, 'square'], [784, .08, 'square'], [1047, .4, 'square']];
  var KEY = 'xcpets-sfx-on', ctx = null;
  function on(store) { try { return (store || localStorage).getItem(KEY) === '1'; } catch (e) { return false; } }
  function set(v, store) { try { (store || localStorage).setItem(KEY, v ? '1' : '0'); } catch (e) { /* ignore */ } }
  function play(notes) {
    if (!on() || typeof AudioContext === 'undefined') return false;
    ctx = ctx || new AudioContext(); var t = ctx.currentTime + 0.02;
    notes.forEach(function (n) {
      if (n[0]) { var o = ctx.createOscillator(), g = ctx.createGain(); o.type = n[2] || 'square'; o.frequency.value = n[0];
        g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + n[1]); o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + n[1]); }
      t += n[1];
    });
    return true;
  }
  return { MOTIFS: MOTIFS, EVOLVE: EVOLVE, on: on, set: set, hatch: function (species) { return play(MOTIFS[species] || MOTIFS.pepe); }, evolve: function (species) { return play((MOTIFS[species] || []).concat(EVOLVE)); } };
});
