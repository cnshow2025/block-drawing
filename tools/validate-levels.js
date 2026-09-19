/* 關卡驗證腳本：node tools/validate-levels.js
 * 確認每一關都能被完整切割（精準模式必定有解），
 * 並以貪心法估算計分模式實際可達的最高填滿率，用來校準星等門檻。
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
['shapes.js', 'generator.js', 'levels.js'].forEach(f => {
  eval(fs.readFileSync(path.join(root, 'js', f), 'utf8'));
});

const { Shapes, Gen, Levels } = globalThis.BD;
let bad = 0;

for (const lv of Levels.LIST) {
  const mask = Gen.parseMask(lv.mask);
  const pool = lv.pool.map(id => Shapes.get(id));
  const missing = lv.pool.filter(id => !Shapes.get(id));
  if (missing.length) { console.log(`${lv.id} ✗ 未知形狀 ${missing}`); bad++; continue; }

  const widths = new Set(lv.mask.map(r => r.length));
  const t0 = Date.now();
  const res = Gen.partitionWithRetry(mask, pool, lv.seed, 40);
  const ms = Date.now() - t0;

  if (!res) {
    console.log(`${lv.id} ✗ 無法切割  格數=${mask.playable} 尺寸=${mask.rows}x${mask.cols} 池=${[...new Set(pool.map(s=>s.size))]}  (${ms}ms)`);
    bad++;
    continue;
  }

  let note = '';
  if (lv.mode === 'score') {
    const rng = Gen.makeRng(res.seed ^ 0x5bf03635);
    const ids = Gen.buildPalette(res.pieces, pool, rng, { swap: lv.swap || 0, extra: lv.extra || 0 });
    const best = Gen.bestFitFill(mask, ids, res.seed, 80);
    const pct = best * 100;
    const suggest = [Math.round(pct * 0.78 / 5) * 5, Math.round(pct * 0.90 / 5) * 5, Math.floor(pct / 5) * 5];
    note = `  可達=${pct.toFixed(1)}%  方塊數=${ids.length}  建議門檻=[${suggest}]`;
    if (lv.stars && pct < lv.stars[2]) note += '  ⚠ 三星門檻偏高';
  }
  const widthWarn = widths.size > 1 ? `  ⚠ 列寬不一致 ${[...widths]}` : '';
  console.log(`${lv.id} ✓ ${mask.rows}x${mask.cols} 格數=${mask.playable} 塊數=${res.pieces.length} seed=${res.seed} (${ms}ms)${note}${widthWarn}`);
}

console.log(bad ? `\n失敗 ${bad} 關` : '\n全部關卡驗證通過');
process.exit(bad ? 1 : 0);
