  /* Captain Dan, traced from the CAPTAINDAN token art (xcp.fun/full/CAPTAINDAN, 226 px pixel art) downsampled to 32x32 with the token's own colours; '.' = transparent. Faces left like the token. */
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
  function dan(x, ox, oy, t) { var blink = !reduced() && Math.floor(t / 2200) % 6 === 0;
    for (var r = 0; r < 32; r++) for (var q = 0; q < 32; q++) { var ch = DAN_MAP[r][q]; if (ch !== '.') px(x, DAN_PAL[ch], ox + q, oy + r, 1, 1); }
    px(x, blink ? DAN_PAL.l : '#e8eef4', ox + 7, oy + 15, 1, 1); px(x, blink ? DAN_PAL.l : '#e8eef4', ox + 13, oy + 15, 1, 1); /* lens glints on the left (gaze left); blink */
    px(x, '#c6846f', ox + 5, oy + 30, 2, 2); /* left hand resting */
    var wf = waving(t) ? Math.floor((S.waveUntil - t) / 300) % 2 : -1; /* triggered wave: raise, wave a few times, lower back to rest */
    if (wf < 0) px(x, '#c6846f', ox + 28, oy + 30, 2, 2); /* right hand resting at his side, mirrors the left */
    else if (wf) { px(x, '#141618', ox + 29, oy + 18, 3, 10); px(x, '#c6846f', ox + 29, oy + 15, 3, 3); } else { px(x, '#141618', ox + 29, oy + 21, 3, 7); px(x, '#c6846f', ox + 31, oy + 18, 3, 3); } }
