(async () => { const t0 = Date.now(); while (Date.now() - t0 < 45000 && /Reading|Getting/.test((document.getElementById('status') || {}).textContent || '')) await new Promise(r => setTimeout(r, 500));
  const rs = performance.getEntriesByType('resource').filter(e => /rank\.json|99900|summary\.json/.test(e.name)).map(e => e.name.split('/').slice(-2).join('/').split('?')[0] + ' start ' + Math.round(e.startTime) + ' dur ' + Math.round(e.duration));
  let w = null; try { w = V2Mock.world(); } catch (e) {}
  return JSON.stringify({ status: (document.getElementById('status') || {}).textContent, ranked: !!(w && w._ranked), pets: w && w.pets && w.pets.length, pod: document.querySelectorAll('#rkPod .rkp').length, tiles: document.querySelectorAll('.tg-tile').length, res: rs }); })()
