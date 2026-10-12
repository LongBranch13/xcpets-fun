/*! XCPETS share.js: Share on X, Download GIF, Copy image (PNG), Copy link for one pet. UI only. */
(function (root) {
  'use strict';
  function base() { var c = root.XCPETS_CONFIG || {}; return (c.siteBase || 'https://xcpets.fun').replace(/\/$/, ''); }
  function url(p) { var c = root.XCPETS_CONFIG || {}; return base() + '/pet.html?id=' + p.id + (c.isMainnet === false ? '&network=' + c.network : ''); }
  function text(p) {
    var PC = root.PetCore, a = p.art, sp = a ? (PC.SPECIES.filter(function (s) { return s.id === a.species; })[0] || {}).label : '', tier = a ? PC.TIERS[a.tierIndex].label : '', b = a ? a.baseStats : {};
    var name = p.name || (a && a.defaultName) || ('pet #' + p.id);
    return '🐸 Meet ' + name + ', my ' + tier + ' ' + sp + ' (' + p.stageName + ') on #XCPETS: ' + PC.STAT_KEYS.map(function (k) { return k + ' ' + b[k]; }).join(' · ');
  }
  function toast(msg) { if (root.XcpetsToast) root.XcpetsToast(msg); else alert(msg); }
  function bar(p, frames) {
    var d = document.createElement('div'); d.className = 'sharebar';
    d.innerHTML = '<button class="act" type="button" data-s="x">𝕏 Share on X</button><button class="act" type="button" data-s="gif">⬇️ Download GIF</button><button class="act" type="button" data-s="img">🖼️ Copy image</button><button class="act" type="button" data-s="link">🔗 Copy link</button>';
    d.querySelector('[data-s=x]').onclick = function () { root.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text(p)) + '&url=' + encodeURIComponent(url(p)), '_blank', 'noopener'); };
    d.querySelector('[data-s=gif]').onclick = function () {
      var g = root.XcpetsGif.encode(frames, 32, 32, { scale: 8, delayCs: 28 }), a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([g], { type: 'image/gif' })); a.download = 'xcpets-' + p.id + '.gif'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    };
    d.querySelector('[data-s=img]').onclick = function () {
      var c = document.createElement('canvas'); c.width = c.height = 256; var x = c.getContext('2d'), t = document.createElement('canvas'); t.width = t.height = 32;
      t.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frames[0].data), 32, 32), 0, 0); x.imageSmoothingEnabled = false; x.drawImage(t, 0, 0, 256, 256);
      if (!(navigator.clipboard && root.ClipboardItem)) { toast('This browser can\'t copy images. Use Download GIF instead.'); return; }
      c.toBlob(function (b) { navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]).then(function () { toast('Image copied (PNG). Animated GIFs can\'t go on the clipboard; use Download GIF for the animation.'); }, function () { toast('Copy blocked by the browser. Use Download GIF instead.'); }); }, 'image/png');
    };
    d.querySelector('[data-s=link]').onclick = function () { var u = url(p); (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { toast('Link copied: ' + u); }, function () { prompt('Copy this link:', u); }); };
    return d;
  }
  root.XcpetsShare = { bar: bar, text: text, url: url };
})(typeof self !== 'undefined' ? self : this);
