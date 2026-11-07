/* download-clips-1107 (owner Nov 7 2026 10:07 AM CT [pt3077u] "What if we make everything downloadable" -> "Yees"): UI only, no rule change.
 * V2Clip records the site's own canvas animations (fight replays, hunt results, hatch / breed / Mythic scenes, Live Feed shared events) into a
 * video file IN THE PLAYER'S BROWSER: canvas.captureStream + the page's WebAudio blips into MediaRecorder. MP4 where the browser can, WebM
 * otherwise. No server, no upload, $0. Captions go in a band UNDER the scene, never over a face or body.
 * Reusable: a headless HatchBot can call V2Clip.record({source: canvas, caption, until}) and V2Clip.toBase64(result.blob) later. */
(function (root) {
  'use strict';
  /* H.264 MP4 first (AAC where the browser has it: Safari, Chrome on Mac/Windows; Opus on Linux Chrome), then WebM, then any MP4 (older Safari) */
  var TYPES = ['video/mp4;codecs="avc1.42E01E,mp4a.40.2"', 'video/mp4;codecs=avc1,mp4a', 'video/mp4;codecs=avc1.42E01E,opus', 'video/mp4;codecs=avc1,opus', 'video/mp4;codecs=avc1', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  var TAPS = typeof WeakMap === 'function' ? new WeakMap() : null, API;
  /* ---- audio tap: every sound the page sends to its speakers is also sent to a MediaStream we can record (adds a parallel connection only) */
  function tapOf(ctx) { if (!TAPS || !ctx || typeof ctx.createMediaStreamDestination !== 'function') return null; var t = TAPS.get(ctx); if (!t) { try { t = ctx.createMediaStreamDestination(); TAPS.set(ctx, t); } catch (e) { t = null; } } return t; }
  (function patch() { var N = root.AudioNode && root.AudioNode.prototype, D = root.AudioDestinationNode; if (!N || !D || N.connect.__clip) return; var orig = N.connect;
    N.connect = function (dest) { var r = orig.apply(this, arguments); try { if (dest instanceof D) { var t = tapOf(this.context); if (t) orig.call(this, t); } } catch (e) { } return r; }; N.connect.__clip = 1; })();
  function supported() { return !!(root.MediaRecorder && root.HTMLCanvasElement && HTMLCanvasElement.prototype.captureStream); }
  function pickType() { if (!root.MediaRecorder) return ''; for (var i = 0; i < TYPES.length; i++) try { if (MediaRecorder.isTypeSupported(TYPES[i])) return TYPES[i]; } catch (e) { } return ''; }
  function audioCtx() { try { if (root.V2Sfx && V2Sfx.ctx) return V2Sfx.ctx(); } catch (e) { } return null; }
  /* caption band: 2 lines max, under the scene */
  function wrap(g, s, max) { var w = String(s || '').split(/\s+/), L = [], cur = ''; w.forEach(function (q) { var t = cur ? cur + ' ' + q : q; if (g.measureText(t).width > max && cur) { L.push(cur); cur = q; } else cur = t; }); if (cur) L.push(cur); return L.slice(0, 2); }
  /** record({source, caption, until, maxMs, minMs, tailMs, width, fps, start}) -> Promise<{blob, mime, ext, ms}>
   * source: the animation canvas (kept up to date by the page). until(): true when the animation has ended. start(): called once the recorder runs. */
  function record(o) { o = o || {}; return new Promise(function (resolve, reject) {
    if (!supported()) return reject(new Error('This browser cannot record video'));
    var src = o.source; if (!src || !src.width) return reject(new Error('Nothing to record'));
    var OW = Math.max(320, Math.min(1280, o.width || 720)), sh = Math.round(OW * src.height / src.width), BAND = o.caption === false ? 0 : Math.round(OW * 0.13);
    OW -= OW % 2; sh -= sh % 2; BAND -= BAND % 2;
    var out = document.createElement('canvas'); out.width = OW; out.height = sh + BAND; var g = out.getContext('2d'); g.imageSmoothingEnabled = false;
    var fs = Math.max(10, Math.round(OW / 44)), cap = function () { return typeof o.caption === 'function' ? o.caption() : (o.caption || ''); };
    function paint() { g.fillStyle = '#0b0a1f'; g.fillRect(0, 0, OW, out.height); try { g.drawImage(src, 0, 0, OW, sh); } catch (e) { }
      if (!BAND) return; g.fillStyle = '#120d22'; g.fillRect(0, sh, OW, BAND); g.fillStyle = '#E8B33A'; g.fillRect(0, sh, OW, 3);
      g.font = fs + 'px "Press Start 2P", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; var L = wrap(g, cap(), OW - 24), lh = fs * 1.5, y0 = sh + 3 + (BAND - 3 - fs * 0.9) / 2 - (L.length - 1) * lh / 2;
      L.forEach(function (s, i) { g.fillStyle = '#000'; g.fillText(s, OW / 2 + 2, y0 + i * lh + 2); g.fillStyle = '#fff6c8'; g.fillText(s, OW / 2, y0 + i * lh); });
      g.font = Math.round(fs * 0.7) + 'px "Press Start 2P", monospace'; g.textAlign = 'right'; g.fillStyle = '#E8B33A'; g.fillText('xcpets.fun', OW - 8, out.height - fs * 0.6); g.textAlign = 'left'; }
    paint(); var fps = o.fps || 30, vs = out.captureStream(fps), tracks = vs.getVideoTracks().slice(), ac = audioCtx(), tap = tapOf(ac);
    if (tap) { try { if (ac.state === 'suspended') ac.resume(); } catch (e) { } tracks = tracks.concat(tap.stream.getAudioTracks()); }
    var mime = pickType(), rec; try { rec = new MediaRecorder(new MediaStream(tracks), mime ? { mimeType: mime, videoBitsPerSecond: 2500000 } : undefined); } catch (e) { return reject(e); }
    var parts = [], t0 = 0, raf = 0, iv = 0, stopping = false, maxMs = o.maxMs || 90000, minMs = o.minMs || 1500, tail = o.tailMs == null ? 600 : o.tailMs, endAt = 0;
    rec.ondataavailable = function (e) { if (e.data && e.data.size) parts.push(e.data); };
    rec.onerror = function (e) { cleanup(); reject(e.error || new Error('Recording failed')); };
    rec.onstop = function () { cleanup(); var type = (rec.mimeType || mime || 'video/webm').split(';')[0], blob = new Blob(parts, { type: type }); resolve({ blob: blob, mime: rec.mimeType || type, ext: /mp4/.test(type) ? 'mp4' : 'webm', ms: Date.now() - t0, audio: !!tap }); };
    function cleanup() { cancelAnimationFrame(raf); clearInterval(iv); API.recording = false; tracks.forEach(function (t) { if (t.kind === 'video') try { t.stop(); } catch (e) { } }); }
    function tick() { paint(); var now = Date.now(), done = false; try { done = o.until ? !!o.until() : false; } catch (e) { done = true; }
      if (!stopping && ((done && now - t0 >= minMs) || now - t0 >= maxMs)) { stopping = true; endAt = now + tail; }
      if (stopping && now >= endAt && rec.state === 'recording') { rec.stop(); return; } }
    function loop() { tick(); if (rec.state === 'recording') raf = requestAnimationFrame(loop); }
    API.recording = true; rec.start(250); t0 = Date.now(); raf = requestAnimationFrame(loop); iv = setInterval(function () { if (rec.state === 'recording') tick(); }, 1000 / fps); /* rAF pauses in background tabs; the timer keeps frames coming */
    if (o.start) try { o.start(); } catch (e) { } }); }
  function fileName(base, ext) { return 'xcpets-' + String(base || 'clip').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) + '.' + ext; }
  /** save(result, base): phones get the share sheet (Save Video) when they support sharing files; everything else downloads the file */
  function save(r, base) { var name = fileName(base, r.ext), touch = root.matchMedia && matchMedia('(pointer:coarse)').matches;
    try { var file = new File([r.blob], name, { type: r.blob.type }); if (touch && navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: 'XCPETS clip' }).then(function () { return name; }, function () { return dl(r.blob, name); }); } catch (e) { }
    return Promise.resolve(dl(r.blob, name)); }
  function dl(blob, name) { var u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; a.rel = 'noopener'; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); URL.revokeObjectURL(u); }, 60000); API.lastFile = name; return name; }
  function toBase64(blob) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1] || ''); }; r.onerror = rej; r.readAsDataURL(blob); }); }
  /* ---- the 8-bit button ---- */
  function css() { if (document.getElementById('clipCss')) return; var s = document.createElement('style'); s.id = 'clipCss';
    s.textContent = '.clip-btn{font-family:"Press Start 2P",monospace;font-size:10px;line-height:1;padding:9px 10px;min-height:34px;background:#1b1530;color:#ffe68a;border:3px solid #000;box-shadow:3px 3px 0 #E8B33A;cursor:pointer;display:inline-flex;align-items:center;gap:6px;image-rendering:pixelated}' +
      '.clip-btn:active{transform:translate(3px,3px);box-shadow:none}.clip-btn[disabled]{opacity:.75;cursor:progress}.clip-btn.clip-rec{color:#fff;background:#c8102e}.clip-row{display:flex;justify-content:center;gap:8px;margin:6px 0}' +
      '.clip-badge{font-family:"Press Start 2P",monospace;font-size:10px;color:#fff;background:#c8102e;border:3px solid #000;padding:6px 8px}';
    document.head.appendChild(s); }
  /** button(run, opt): <button>⬇️ Download</button>; run() -> Promise<{blob, ext}> (the recording); opt.name = file name base */
  function button(run, opt) { opt = opt || {}; css(); var b = document.createElement('button'); b.type = 'button'; b.className = 'clip-btn'; b.setAttribute('data-clip', '1');
    var idle = '⬇️ Download'; b.textContent = idle; b.title = 'Save this animation as a video (made on your device)';
    if (!supported()) { b.disabled = true; b.title = 'This browser cannot record video'; b.textContent = '⬇️ Not on this browser'; }
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (b.disabled || API.recording) return; b.disabled = true; b.classList.add('clip-rec'); b.textContent = '⏺ Recording…';
      Promise.resolve().then(run).then(function (r) { b.textContent = '💾 Saving…'; return save(r, typeof opt.name === 'function' ? opt.name() : opt.name); })
        .then(function () { b.classList.remove('clip-rec'); b.textContent = '✅ Saved'; setTimeout(function () { b.textContent = idle; b.disabled = false; }, 2500); },
          function (err) { b.classList.remove('clip-rec'); b.textContent = '⚠️ Try again'; b.title = String(err && err.message || err); b.disabled = false; if (root.console) console.warn('[clip]', err); }); });
    ['pointerdown', 'mousedown', 'keydown'].forEach(function (k) { b.addEventListener(k, function (e) { e.stopPropagation(); }); });
    return b; }
  /** offer(ov, canvas, replay, caption, name): put a Download button in an animation overlay (life / cemetery scenes). replay(done) starts the same
   * animation again and returns its {canvas}; the new copy is recorded from frame 0 and gets a ⏺ REC badge instead of a button. */
  function offer(ov, c, replay, caption, name) { try { if (!ov || !c) return; css(); var row = document.createElement('div'); row.className = 'clip-row';
      if (API.recording) { var bd = document.createElement('span'); bd.className = 'clip-badge'; bd.textContent = '⏺ REC'; row.appendChild(bd); ov.insertBefore(row, c.nextSibling); return; }
      row.appendChild(button(function () { return new Promise(function (res, rej) { var ended = false, r; API.recording = true; /* the replay's overlay shows ⏺ REC */
        try { r = replay(function () { ended = true; }); } catch (e) { API.recording = false; return rej(e); } API.recording = false;
        if (!r || !r.canvas) return rej(new Error('Nothing to record'));
        record({ source: r.canvas, caption: caption, until: function () { return ended; }, tailMs: 200 }).then(res, rej); }); }, { name: name }));
      ov.insertBefore(row, c.nextSibling); } catch (e) { if (root.console) console.warn('[clip] offer', e); } }
  /** arena(f): record the X Circus Kekimus replay of fight f from the walk-out to the victory lap (with the 8-bit hit sounds) */
  function arena(f, caption) { var A = root.V2ArenaScene, S = A && A._state && A._state(); if (!A || !S || !S.c) return Promise.reject(new Error('No arena here'));
    var started = false; return record({ source: S.c, caption: caption || function () { return S.annNow || ('Fight ' + f.id); }, maxMs: 120000,
      start: function () { A.sequence(f, { restart: true }); started = true; }, until: function () { var m = A._state().mode; return started && (m === 'idle' || m === 'result'); } }); }
  function arenaButton(getFight) { return button(function () { var f = getFight(); if (!f) return Promise.reject(new Error('No fight to save')); return arena(f, function () { var S = root.V2ArenaScene._state(); return 'Fight ' + f.id + ' · #' + (f.showA || f.a) + ' vs #' + (f.showB || f.b) + (S.mode === 'lap' || S.mode === 'win' || S.mode === 'result' ? ' · winner #' + f.winner : ''); }); },
    { name: function () { var f = getFight(); return 'fight-' + (f ? f.id : ''); } }); }
  API = root.V2Clip = { supported: supported, type: pickType, record: record, save: save, toBase64: toBase64, button: button, offer: offer, arena: arena, arenaButton: arenaButton, fileName: fileName, recording: false, lastFile: null };
})(typeof window !== 'undefined' ? window : this);
