/* generator.js — 種子亂數 + 反向切割關卡生成器
 *
 * 核心想法：與其「出題後再想辦法解」，不如「先把空盤面完整切成碎片」。
 * 切出來的碎片就是玩家手上的方塊盤，因此精準拼合模式必定有解。
 * 切割用固定種子驅動，同一關每次進入都完全一樣。
 */
(function (global) {
  'use strict';

  var Shapes = global.BD.Shapes;

  // ---------- 種子亂數（mulberry32）----------
  function makeRng(seed) {
    var a = seed >>> 0;
    function rng() {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    rng.int = function (n) { return Math.floor(rng() * n); };
    rng.shuffle = function (arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = rng.int(i + 1);
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    };
    rng.pick = function (arr) { return arr[rng.int(arr.length)]; };
    return rng;
  }

  // ---------- 盤面遮罩 ----------
  // pattern：字串陣列，'#' 可填、'.' 盤外、'X' 固定障礙（不可填，但會畫成石塊）
  function parseMask(pattern) {
    var rows = pattern.length;
    var cols = 0;
    pattern.forEach(function (row) { if (row.length > cols) cols = row.length; });
    var grid = new Int8Array(rows * cols); // 1=可填, 0=盤外, 2=障礙
    var playable = 0;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var ch = pattern[r][c] || '.';
        if (ch === '#') { grid[r * cols + c] = 1; playable++; }
        else if (ch === 'X' || ch === 'x') { grid[r * cols + c] = 2; }
        else { grid[r * cols + c] = 0; }
      }
    }
    return { rows: rows, cols: cols, grid: grid, playable: playable };
  }

  // ---------- 可行尺寸表（剪枝用）----------
  // 一塊連通空白區若要被完全填滿，其格數必須能由形狀池的尺寸組合而成。
  function reachableSizes(sizes, maxN) {
    var ok = new Uint8Array(maxN + 1);
    ok[0] = 1;
    for (var n = 1; n <= maxN; n++) {
      for (var i = 0; i < sizes.length; i++) {
        var s = sizes[i];
        if (s <= n && ok[n - s]) { ok[n] = 1; break; }
      }
    }
    return ok;
  }

  // ---------- 反向切割 ----------
  /**
   * 把 mask 的可填區完整切成 pool 中的形狀。
   * 回傳 [{ shapeId, rot, flip, r, c, cells }]，失敗回傳 null。
   */
  function partition(mask, pool, rng, options) {
    options = options || {};
    var budget = options.budget || 400000;
    var rows = mask.rows, cols = mask.cols, total = rows * cols;

    // free[i] = true 表示該格仍待填
    var free = new Uint8Array(total);
    var freeCount = 0;
    for (var i = 0; i < total; i++) {
      if (mask.grid[i] === 1) { free[i] = 1; freeCount++; }
    }

    var sizes = [];
    var minSize = Infinity;
    pool.forEach(function (s) {
      if (sizes.indexOf(s.size) < 0) sizes.push(s.size);
      if (s.size < minSize) minSize = s.size;
    });
    var sizeOk = reachableSizes(sizes, freeCount);
    if (!sizeOk[freeCount]) return null;

    // 預先攤平所有 (形狀, 姿態) 組合
    var placements = [];
    pool.forEach(function (shape) {
      shape.variants.forEach(function (v) {
        placements.push({ shape: shape, variant: v });
      });
    });

    var stack = new Int32Array(total); // 連通區塊走訪用
    var mark = new Int32Array(total);
    var markToken = 0;

    // 剪枝：每塊連通空白區的格數都必須是可行尺寸
    function regionsOk() {
      markToken++;
      for (var idx = 0; idx < total; idx++) {
        if (!free[idx] || mark[idx] === markToken) continue;
        var top = 0, size = 0;
        stack[top++] = idx;
        mark[idx] = markToken;
        while (top > 0) {
          var cur = stack[--top];
          size++;
          var cr = (cur / cols) | 0, cc = cur % cols;
          if (cr > 0)        { var up = cur - cols; if (free[up] && mark[up] !== markToken) { mark[up] = markToken; stack[top++] = up; } }
          if (cr < rows - 1) { var dn = cur + cols; if (free[dn] && mark[dn] !== markToken) { mark[dn] = markToken; stack[top++] = dn; } }
          if (cc > 0)        { var lf = cur - 1;    if (free[lf] && mark[lf] !== markToken) { mark[lf] = markToken; stack[top++] = lf; } }
          if (cc < cols - 1) { var rt = cur + 1;    if (free[rt] && mark[rt] !== markToken) { mark[rt] = markToken; stack[top++] = rt; } }
        }
        if (size < minSize || !sizeOk[size]) return false;
      }
      return true;
    }

    var result = [];
    var nodes = 0;
    var aborted = false;

    function firstFree() {
      for (var idx = 0; idx < total; idx++) if (free[idx]) return idx;
      return -1;
    }

    function solve(remaining) {
      if (remaining === 0) return true;
      if (++nodes > budget) { aborted = true; return false; }

      var target = firstFree();
      var tr = (target / cols) | 0, tc = target % cols;

      // 蒐集所有「能蓋住 target」的擺法
      var candidates = [];
      for (var p = 0; p < placements.length; p++) {
        var pl = placements[p];
        var cells = pl.variant.cells;
        for (var k = 0; k < cells.length; k++) {
          var r0 = tr - cells[k][0];
          var c0 = tc - cells[k][1];
          if (r0 < 0 || c0 < 0) continue;
          if (r0 + pl.variant.rows > rows || c0 + pl.variant.cols > cols) continue;
          var fits = true;
          for (var m = 0; m < cells.length; m++) {
            var idx2 = (r0 + cells[m][0]) * cols + (c0 + cells[m][1]);
            if (!free[idx2]) { fits = false; break; }
          }
          if (fits) candidates.push({ pl: pl, r: r0, c: c0 });
        }
      }
      if (!candidates.length) return false;
      rng.shuffle(candidates);

      for (var ci = 0; ci < candidates.length; ci++) {
        var cand = candidates[ci];
        var cc2 = cand.pl.variant.cells;
        var j;
        for (j = 0; j < cc2.length; j++) {
          free[(cand.r + cc2[j][0]) * cols + (cand.c + cc2[j][1])] = 0;
        }
        if (regionsOk()) {
          result.push({
            shapeId: cand.pl.shape.id,
            rot: cand.pl.variant.rot,
            flip: cand.pl.variant.flip,
            r: cand.r,
            c: cand.c,
            cells: cc2
          });
          if (solve(remaining - cc2.length)) return true;
          result.pop();
        }
        for (j = 0; j < cc2.length; j++) {
          free[(cand.r + cc2[j][0]) * cols + (cand.c + cc2[j][1])] = 1;
        }
        if (aborted) return false;
      }
      return false;
    }

    return solve(freeCount) ? result : null;
  }

  /**
   * 反覆嘗試不同種子，直到切割成功。
   */
  function partitionWithRetry(mask, pool, seed, tries) {
    tries = tries || 60;
    for (var i = 0; i < tries; i++) {
      var rng = makeRng(seed + i * 7919);
      var res = partition(mask, pool, rng);
      if (res) return { pieces: res, seed: seed + i * 7919 };
    }
    return null;
  }

  /**
   * 由完美切割結果生出方塊盤。
   * 精準模式：原封不動。
   * 計分模式：抽掉 swap 塊、補進 swap + extra 塊隨機形狀，使完美填滿幾乎不可能。
   */
  function buildPalette(pieces, poolList, rng, opts) {
    opts = opts || {};
    var ids = pieces.map(function (p) { return p.shapeId; });
    var swap = opts.swap || 0;
    var extra = opts.extra || 0;

    if (swap > 0) {
      var order = rng.shuffle(ids.map(function (_, i) { return i; }));
      var drop = order.slice(0, Math.min(swap, ids.length));
      drop.sort(function (a, b) { return b - a; });
      drop.forEach(function (i) { ids.splice(i, 1); });
      for (var k = 0; k < swap + extra; k++) {
        ids.push(rng.pick(poolList).id);
      }
    } else if (extra > 0) {
      for (var e = 0; e < extra; e++) ids.push(rng.pick(poolList).id);
    }

    return rng.shuffle(ids);
  }

  /**
   * 估算「這組方塊最多能填多少」——驗證關卡門檻用，也給提示功能參考。
   *
   * 做法：多輪隨機重啟的「最佳貼合」貪心。
   * 每一輪把方塊排出一個順序（大塊優先、略帶隨機），
   * 再逐塊挑出貼合度最高的位置——貼合度＝該塊有多少邊緊靠牆面或既有方塊。
   * 貼牆放置能大幅減少碎洞，實測比純隨機貪心高出十幾個百分點。
   */
  function bestFitFill(mask, shapeIds, seed, rounds, wantPlan) {
    rounds = rounds || 60;
    var rows = mask.rows, cols = mask.cols, total = rows * cols;
    var playable = 0;
    for (var i0 = 0; i0 < total; i0++) if (mask.grid[i0] === 1) playable++;

    var best = 0, bestPlan = null;

    for (var round = 0; round < rounds; round++) {
      var rng = makeRng(seed + round * 104729);
      var free = new Uint8Array(total);
      for (var i = 0; i < total; i++) free[i] = mask.grid[i] === 1 ? 1 : 0;

      // 大塊優先，並加一點隨機擾動讓每輪走不同路線
      var order = shapeIds.map(function (id, idx) {
        return { id: id, idx: idx, key: Shapes.get(id).size + rng() * (round === 0 ? 0 : 3) };
      });
      order.sort(function (a, b) { return b.key - a.key; });

      var filled = 0;
      var plan = [];

      for (var s = 0; s < order.length; s++) {
        var shape = Shapes.get(order[s].id);
        var pick = null, pickScore = -1;

        for (var vi = 0; vi < shape.variants.length; vi++) {
          var v = shape.variants[vi];
          for (var r = 0; r + v.rows <= rows; r++) {
            for (var c = 0; c + v.cols <= cols; c++) {
              var ok = true, score = 0, m;
              for (m = 0; m < v.cells.length; m++) {
                if (!free[(r + v.cells[m][0]) * cols + (c + v.cells[m][1])]) { ok = false; break; }
              }
              if (!ok) continue;
              // 貼合度：四周每有一個「非空白」鄰居就加一分
              for (m = 0; m < v.cells.length; m++) {
                var cr = r + v.cells[m][0], cc = c + v.cells[m][1];
                score += edgeScore(free, mask, rows, cols, cr - 1, cc);
                score += edgeScore(free, mask, rows, cols, cr + 1, cc);
                score += edgeScore(free, mask, rows, cols, cr, cc - 1);
                score += edgeScore(free, mask, rows, cols, cr, cc + 1);
              }
              // 同分時偏好靠左上，讓填法有一致的推進方向
              var tie = score * 1000 - (r * cols + c);
              if (tie > pickScore) { pickScore = tie; pick = { v: v, r: r, c: c }; }
            }
          }
        }

        if (pick) {
          for (var q = 0; q < pick.v.cells.length; q++) {
            free[(pick.r + pick.v.cells[q][0]) * cols + (pick.c + pick.v.cells[q][1])] = 0;
          }
          filled += shape.size;
          if (wantPlan) {
            plan.push({ paletteIndex: order[s].idx, shapeId: shape.id, rot: pick.v.rot, flip: pick.v.flip, r: pick.r, c: pick.c });
          }
        }
      }

      var rate = playable ? filled / playable : 0;
      if (rate > best) { best = rate; bestPlan = plan; }
      if (best >= 1) break;
    }

    return wantPlan ? { rate: best, plan: bestPlan } : best;
  }

  // 鄰格是否「靠得住」：盤外、障礙或已被佔用都算，空白不算
  function edgeScore(free, mask, rows, cols, r, c) {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return 1;
    var idx = r * cols + c;
    if (mask.grid[idx] !== 1) return 1;
    return free[idx] ? 0 : 1;
  }

  global.BD.Gen = {
    makeRng: makeRng,
    parseMask: parseMask,
    partition: partition,
    partitionWithRetry: partitionWithRetry,
    buildPalette: buildPalette,
    bestFitFill: bestFitFill
  };
})(typeof window !== 'undefined' ? window : globalThis);
