(async () => { const t0 = Date.now(); while (Date.now() - t0 < 45000 && /Reading/.test((document.getElementById('status') || {}).textContent || '')) await new Promise(r => setTimeout(r, 1000));
  let w = null; try { w = V2Mock.world(); } catch (e) {}
  const S = window.V2Split; let sum = null; try { sum = S && S.boardBytes && S.boardBytes(); } catch (e) {}
  return JSON.stringify({ status: (document.getElementById('status') || {}).textContent, grid: (document.getElementById('tgGrid') || document.getElementById('board') || {}).childElementCount, view: !!(w && w._view), ranked: !!(w && w._ranked), pets: w && w.pets && w.pets.length, deeds: w && w.deeds ? Object.keys(w.deeds).length : -1, gallery: !!window.V2TokenGallery, board: sum, waited: Date.now() - t0 }); })()
