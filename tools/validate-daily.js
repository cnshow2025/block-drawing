/* 每日挑戰驗證腳本：node tools/validate-daily.js [天數]
 * 模擬接下來 N 天，確認每天的題目都生得出來、門檻合理、也真的填得到三星。
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
['shapes.js', 'generator.js', 'levels.js', 'board.js'].forEach(f => {
  eval(fs.readFileSync(path.join(root, 'js', f), 'utf8'));
});

const { Gen, Levels, Board } = globalThis.BD;
const days = Number(process.argv[2] || 120);

let bad = 0;
const masks = new Set();
const pools = { easy: 0, hard: 0 };
let slowest = 0;
const stars3 = [];

for (let i = 0; i < days; i++) {
  const d = new Date();
  d.setDate(d.getDate() + i);
  const lv = Levels.daily(d);
  const t0 = Date.now();
  let state;
  try {
    state = Board.createGame(lv);
  } catch (err) {
    console.log(`${lv.dateKey} ✗ ${err.message}`);
    bad++;
    continue;
  }
  const ms = Date.now() - t0;
  slowest = Math.max(slowest, ms);
  masks.add(lv.mask.join('|'));
  (lv.pool.length === 19 ? pools : pools)[d.getDay() >= 1 && d.getDay() <= 3 ? 'easy' : 'hard']++;

  const t = lv.stars;
  const ascending = t[0] < t[1] && t[1] <= t[2];
  const reachable = Gen.bestFitFill(
    Gen.parseMask(lv.mask),
    state.pieces.map(p => p.shapeId),
    lv.seed + 7,
    400
  ) * 100;
  stars3.push(t[2]);

  const ok = ascending && reachable >= t[2];
  if (!ok) bad++;
  if (i < 10 || !ok) {
    console.log(
      `${lv.dateKey} ${ok ? '✓' : '✗'} ${lv.name.padEnd(14)} ` +
      `格數=${String(state.mask.playable).padStart(2)} 方塊=${String(state.pieces.length).padStart(2)} ` +
      `門檻=[${t}] 獨立驗算可達=${reachable.toFixed(1)}% (${ms}ms)`
    );
  }
}

console.log(`\n模擬 ${days} 天：用到 ${masks.size} / 16 種畫框，簡單日 ${pools.easy} 天、困難日 ${pools.hard} 天`);
console.log(`三星門檻範圍 ${Math.min(...stars3)}% ~ ${Math.max(...stars3)}%，單題最慢生成 ${slowest}ms`);
console.log(bad ? `\n失敗 ${bad} 天` : '\n每日挑戰驗證通過');
process.exit(bad ? 1 : 0);
