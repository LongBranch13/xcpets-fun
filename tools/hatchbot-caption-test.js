#!/usr/bin/env node
/* HatchBot picture captions keep their line breaks (Nov 26 2026). No network, sends nothing.
 *   node tools/hatchbot-caption-test.js
 * FormData turned every \n in the caption into \r\n, so a custom pet emoji after a line break sat one UTF-16 unit off its
 * entity and Telegram refused the whole picture ("entity ... ends in a middle of a UTF-16 symbol"). The Legendary Mix post lost
 * its picture that way. This parses the body announce.js really sends and checks the caption comes back byte for byte, and
 * that every emoji entity of every prepared update series lands on its emoji in that caption. */
const fs = require('fs'), path = require('path');
const A = require('../hatchbot/announce.js');
const fails = []; const ok = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) fails.push(name); };
const PACK = {}; JSON.parse(fs.readFileSync(path.join(__dirname, '../hatchbot/stickers/pets.json'), 'utf8')).pets.forEach(p => { if (p.look === 'no') PACK[p.species] = p.emoji[0]; });
/* the same offsets announce.js emo() gives when custom emoji are on */
function withEntities(t) { let out = '', last = 0, m; const ent = [], re = /\{([a-z]+)\}/g;
  while ((m = re.exec(t))) { const ch = PACK[m[1]]; if (!ch) continue; out += t.slice(last, m.index); last = re.lastIndex; ent.push({ offset: out.length, length: ch.length, ch }); out += ch; }
  return { text: out + t.slice(last), ent }; }
(async () => {
  const dir = path.join(__dirname, '../hatchbot/updates'); let n = 0;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    for (const x of (JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).posts || [])) {
      if (!x || !x.text) continue; n++;
      const { text, ent } = withEntities(x.text);
      const fb = A.formBody({ chat_id: '-1', caption: text, caption_entities: JSON.stringify(ent.map(e => ({ type: 'custom_emoji', offset: e.offset, length: e.length, custom_emoji_id: '1' }))) }, 'photo', Buffer.from([137, 80, 78, 71, 13, 10]), 'p.png');
      const fd = await new Response(fb.body, { headers: { 'content-type': fb.type } }).formData();
      const cap = fd.get('caption'), sent = JSON.parse(fd.get('caption_entities'));
      ok(f + ' post ' + n + ': caption arrives unchanged', cap === text);
      ok(f + ' post ' + n + ': every emoji entity lands on its emoji', sent.every((e, i) => cap.slice(e.offset, e.offset + e.length) === ent[i].ch));
      const file = Buffer.from(await fd.get('photo').arrayBuffer());
      ok(f + ' post ' + n + ': picture bytes unchanged', file.equals(Buffer.from([137, 80, 78, 71, 13, 10])));
    }
  }
  ok('checked some prepared posts', n > 0);
  if (fails.length) { console.log(fails.length + ' FAILED'); process.exit(1); }
  console.log('all passed');
})().catch(e => { console.error(e); process.exit(1); });
