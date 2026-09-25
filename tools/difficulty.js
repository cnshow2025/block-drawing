/* 難度量尺：node tools/difficulty.js
 *
 * 精準拼合關卡「難不難」，指的是從玩家拿到的那堆碎片重新拼回去有多難找。
 * 生成器切割時是隨機順序、而且一定會成功，量不出難度；
 * 這裡改成模擬玩家：拿到方塊盤（順序已洗過、方向全歸零），
 * 用最樸素的回溯法從頭解一次，數需要回溯幾個節點。
 * 節點數越多，代表死路越多、越需要想，對人類就越難。
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
['shapes.js', 'generator.js', 'levels.js', 'board.js'].forEach(f => {
  eval(fs.readFileSync(path.join(root, 'js', f), 'utf8'));
});
const { Shapes, Gen, Levels, Board } = globalThis.BD;

/** 從指定的一組方塊把盤面填滿，回傳搜尋節點數（-1 表示超出預算沒解出來） */
function solveEffort(mask, shapeIds, budget) {
  const rows = mask.rows, cols = mask.cols, total = rows * cols;
  const free = new Uint8Array(total);
  let freeCount = 0;
  for (let i = 0; i < total; i++) if (mask.grid[i] === 1) { free[i] = 1; freeCount++; }

  const pieces = shapeIds.map(id => ({ shape: Shapes.get(id), used: false }));
  let nodes = 0;

  function firstFree() {
    for (let i = 0; i < total; i++) if (free[i]) return i;
    return -1;
  }

  function solve(remaining) {
    if (remaining === 0) return true;
    if (++nodes > budget) return null;
    const target = firstFree();
    const tr = (target / cols) | 0, tc = target % cols;

    for (let p = 0; p < pieces.length; p++) {
      if (pieces[p].used) continue;
      // 同形狀的方塊只試一次，避免重複展開一模一樣的分支
      if (pieces.findIndex(q => !q.used && q.shape.id === pieces[p].shape.id) !== p) continue;
      const variants = pieces[p].shape.variants;
      for (let v = 0; v < variants.length; v++) {
        const cells = variants[v].cells;
        for (let k = 0; k < cells.length; k++) {
          const r0 = tr - cells[k][0], c0 = tc - cells[k][1];
          if (r0 < 0 || c0 < 0 || r0 + variants[v].rows > rows || c0 + variants[v].cols > cols) continue;
          let fits = true;
          for (let m = 0; m < cells.length; m++) {
            if (!free[(r0 + cells[m][0]) * cols + (c0 + cells[m][1])]) { fits = false; break; }
          }
          if (!fits) continue;
          for (let m = 0; m < cells.length; m++) free[(r0 + cells[m][0]) * cols + (c0 + cells[m][1])] = 0;
          pieces[p].used = true;
          const res = solve(remaining - cells.length);
          if (res === null) return null;
          if (res) return true;
          pieces[p].used = false;
          for (let m = 0; m < cells.length; m++) free[(r0 + cells[m][0]) * cols + (c0 + cells[m][1])] = 1;
        }
      }
    }
    return false;
  }

  const ok = solve(freeCount);
  return ok === null ? -1 : nodes;
}

const rows = [];
for (const lv of Levels.LIST) {
  if (lv.mode !== 'exact') { rows.push({ id: lv.id, mode: lv.mode }); continue; }
  const state = Board.createGame(lv);
  const ids = state.pieces.map(p => p.shapeId);
  const mask = Gen.parseMask(lv.mask);
  const t0 = Date.now();
  const nodes = solveEffort(mask, ids, 3000000);
  rows.push({
    id: lv.id, name: lv.name, mode: lv.mode,
    cells: state.mask.playable, pieces: ids.length,
    sizes: [...new Set(ids.map(i => Shapes.get(i).size))].sort().join('+'),
    nodes, ms: Date.now() - t0,
  });
}

console.log('關卡   名稱          格數 塊數 尺寸  回溯節點數  耗時');
for (const r of rows) {
  if (r.mode !== 'exact') { console.log(`${r.id}   （${r.mode} 計分關）`); continue; }
  console.log(
    `${r.id}   ${r.name.padEnd(10)} ${String(r.cells).padStart(3)} ${String(r.pieces).padStart(4)}  ${r.sizes.padEnd(5)}` +
    `${r.nodes < 0 ? '  超出預算' : String(r.nodes).padStart(10)}  ${r.ms}ms`
  );
}
const exact = rows.filter(r => r.mode === 'exact' && r.nodes >= 0);
const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(`\n精準關共 ${exact.length} 關，回溯節點中位數 ${med(exact.map(r => r.nodes))}，最高 ${Math.max(...exact.map(r => r.nodes))}`);
