/* Captain Dan sprite data, shared copy (fire-sales, Oct 22 2026): the SAME palette + 32x32 map as js/v2-shop.js (traced from the CAPTAINDAN token art),
 * plus his full body (trousers + boots) exactly as v2-shop danBody() draws it. Used by the Fire Sale banner on pages without the Rare Room.
 * Keep in sync with js/v2-shop.js if his art changes. Display only. */
(function () {
  var DAN_PAL = {'b': '#064884', 'g': '#ffcb4d', 'h': '#c6846f', 'k': '#141618', 'l': '#9fa2a3', 'o': '#d79b37', 'w': '#e6e9ef'}, DAN_MAP = [
    '................................',
    '........lwwwwwww................',
    '.......wwwwwwwwwwww.............',
    '......wwwwkkkwwwwwwwww..........',
    '.....wwwwkkokkwwwwwwwww.........',
    '......wwwkkkkkwwwwwwwwwww.......',
    '......wwwkoookkwwwwwwwwwwww.....',
    '.......wkkkokkkkkkkwwwwwwwww....',
    '.......oooooogkkkkkkkwwwwwww....',
    '......kkkkkkkkkkoookkkkkwwww....',
    '.....kkkkkkkkkkkkkkkgokkkwww....',
    '.....kkkkkkkkkkkkkkkkkokkw......',
    '.......kkhhhhhhhhhhkkkkkk.......',
    '.........hhhhhhhhhhkkkkkk.......',
    '......llllhhllllhhhkkkkkk.......',
    '......lhhlhhlhhlhhhkkkkkk.......',
    '..........hhhhhhhhhhhhkk........',
    '........hhhhhhhhhhhhhhkk........',
    '........hhhhhhhhhhhhhhkk........',
    '.........kkkhhhhhhhhhhkk........',
    '.........kkkkhhhhhhkhhh.........',
    '.........hhkkhhhhhhkhhh.........',
    '.........hhhhhhhhhkkhhh.........',
    '.........kkkkkkkkkkkhhw.........',
    '.........kkkkkkkkkkhhwwk........',
    '..........kkkkkkkkhwwwkkkk......',
    '..........kkwkbkwwwwwkkkkkk.....',
    '.......ookkkwbbbwwwwkkkkkkooo...',
    '......ookkkkwbbbwwwkkkkkkkkooo..',
    '.....kkkkkkkwbbbwwkkkkokkkkkkkk.',
    '.....kkkkkkkwbbbwwkkkkkkkkkkkkk.',
    '.....kkkkkkkwbbbwwkkkkkkkkkkkkk.'];
  /** draw(ctx, ox, oy, frame): Dan's full body (32 x 44) at ox, oy; frame 1 = bob up 1px (panic hop). */
  function draw(x, ox, oy, f) { var px = function (c, X, Y, w, h) { x.fillStyle = c; x.fillRect(X, Y, w, h); }, bob = f ? 1 : 0, r, q, ch;
    px('#1c2a4a', ox + 10, oy + 31, 6, 9); px('#1c2a4a', ox + 17, oy + 31, 6, 9); px('#ffcb4d', ox + 10, oy + 32, 1, 7); px('#ffcb4d', ox + 22, oy + 32, 1, 7);
    px('#000', ox + 7, oy + 40, 9, 3); px('#000', ox + 17, oy + 40, 8, 3); px('#5a5e66', ox + 8, oy + 40, 3, 1); px('#5a5e66', ox + 18, oy + 40, 3, 1);
    for (r = 0; r < 32; r++) for (q = 0; q < 32; q++) { ch = DAN_MAP[r][q]; if (ch !== '.') px(DAN_PAL[ch], ox + q, oy + r - bob, 1, 1); }
    px('#e8eef4', ox + 7, oy + 15 - bob, 1, 1); px('#e8eef4', ox + 13, oy + 15 - bob, 1, 1); px('#c6846f', ox + 28, oy + 30 - bob, 2, 2); }
  window.DanSprite = { PAL: DAN_PAL, MAP: DAN_MAP, W: 32, H: 44, draw: draw };
})();
