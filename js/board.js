/* board.js — 棋盤模型：關卡組裝、放置驗證、填滿率計算
 * 這一層完全不碰 DOM，方便單獨驗證與重播。
 */
(function (global) {
  'use strict';

  var Shapes = global.BD.Shapes;
  var Gen = global.BD.Gen;

  var VOID = -1, EMPTY = 0;

  /**
   * 依關卡資料組出一局遊戲狀態。
   * 精準模式：方塊盤就是切割結果本身，必定拼得完。
   * 計分模式：抽換掉幾塊，讓完美填滿幾乎不可能，改以填滿率論高下。
   */
  function createGame(level) {
    var mask = Gen.parseMask(level.mask);
    var pool = level.pool.map(function (id) { return Shapes.get(id); });

    var built = Gen.partitionWithRetry(mask, pool, level.seed, 60);
    if (!built) throw new Error('關卡 ' + level.id + ' 無法生成');

    var rng = Gen.makeRng(built.seed ^ 0x5bf03635);
    var ids;
    if (level.mode === 'score') {
      ids = Gen.buildPalette(built.pieces, pool, rng, { swap: level.swap || 0, extra: level.extra || 0 });
    } else {
      ids = rng.shuffle(built.pieces.map(function (p) { return p.shapeId; }));
    }

    // 每日挑戰沒有人工校準過的門檻，就地跑一次最佳貼合估出今天實際能填到幾 %，
    // 再照比例訂三道星等門檻——難的日子門檻自動變低，不會變成無解的苦差事。
    if (level.autoStars && !level.stars) {
      // 用第 90 百分位而不是最高分：最高分可能是兩百次重啟裡的一次僥倖，
      // 訂成門檻對真人太苛。第 90 百分位代表「打得不錯的一局」，跨種子也穩定。
      var ceiling = Gen.fillCeiling(mask, ids, built.seed, 200).p90 * 100;
      // 一律無條件捨去：四捨五入會把門檻推到估出來的可達值之上，
      // 那 0.4 個百分點的差距就足以讓三星變成拿不到。
      level.stars = [
        Math.max(40, Math.floor(ceiling * 0.76)),
        Math.max(50, Math.floor(ceiling * 0.88)),
        Math.min(95, Math.max(60, Math.floor(ceiling)))
      ];
    }

    var total = mask.rows * mask.cols;
    var cells = new Int32Array(total);
    for (var i = 0; i < total; i++) cells[i] = mask.grid[i] === 1 ? EMPTY : VOID;

    var pieces = ids.map(function (id, idx) {
      return { uid: idx + 1, shapeId: id, rot: 0, flip: 0, placed: false, r: 0, c: 0 };
    });

    return {
      level: level,
      mask: mask,
      rows: mask.rows,
      cols: mask.cols,
      cells: cells,
      pieces: pieces,
      solution: built.pieces,
      history: [],
      hintsUsed: 0,
      startedAt: Date.now()
    };
  }

  function shapeOf(piece) { return Shapes.get(piece.shapeId); }

  // 方塊在目前 rot/flip 下的格子座標
  function cellsOf(piece) {
    return Shapes.transform(shapeOf(piece).cells, piece.rot, piece.flip);
  }

  function boundsOf(piece) {
    return Shapes.dims(cellsOf(piece));
  }

  function canPlace(state, piece, r, c, cells) {
    cells = cells || cellsOf(piece);
    for (var i = 0; i < cells.length; i++) {
      var rr = r + cells[i][0], cc = c + cells[i][1];
      if (rr < 0 || cc < 0 || rr >= state.rows || cc >= state.cols) return false;
      if (state.cells[rr * state.cols + cc] !== EMPTY) return false;
    }
    return true;
  }

  function place(state, piece, r, c) {
    var cells = cellsOf(piece);
    if (!canPlace(state, piece, r, c, cells)) return false;
    for (var i = 0; i < cells.length; i++) {
      state.cells[(r + cells[i][0]) * state.cols + (c + cells[i][1])] = piece.uid;
    }
    piece.placed = true;
    piece.r = r;
    piece.c = c;
    return true;
  }

  function unplace(state, piece) {
    if (!piece.placed) return false;
    var cells = cellsOf(piece);
    for (var i = 0; i < cells.length; i++) {
      state.cells[(piece.r + cells[i][0]) * state.cols + (piece.c + cells[i][1])] = EMPTY;
    }
    piece.placed = false;
    return true;
  }

  function filledCount(state) {
    var n = 0;
    for (var i = 0; i < state.cells.length; i++) if (state.cells[i] > 0) n++;
    return n;
  }

  function fillRate(state) {
    return state.mask.playable ? filledCount(state) / state.mask.playable : 0;
  }

  function isComplete(state) {
    return filledCount(state) === state.mask.playable;
  }

  function remaining(state) {
    return state.pieces.filter(function (p) { return !p.placed; });
  }

  function reset(state) {
    for (var i = 0; i < state.cells.length; i++) {
      if (state.cells[i] > 0) state.cells[i] = EMPTY;
    }
    state.pieces.forEach(function (p) { p.placed = false; p.rot = 0; p.flip = 0; });
    state.history.length = 0;
  }

  /**
   * 星等計算。
   * 精準模式：看用掉幾次提示（0 次三星、1 次兩星、其餘一星）。
   * 計分模式：看填滿率是否跨過關卡設定的三道門檻。
   */
  function evaluate(state) {
    var rate = fillRate(state);
    var pct = rate * 100;
    if (state.level.mode === 'exact') {
      if (!isComplete(state)) return { cleared: false, stars: 0, rate: rate };
      var stars = state.hintsUsed === 0 ? 3 : (state.hintsUsed === 1 ? 2 : 1);
      return { cleared: true, stars: stars, rate: rate };
    }
    var t = state.level.stars || [70, 85, 95];
    var s = 0;
    if (pct >= t[0]) s = 1;
    if (pct >= t[1]) s = 2;
    if (pct >= t[2]) s = 3;
    if (s > 0 && state.hintsUsed > 0) s = Math.max(1, s - (state.hintsUsed > 1 ? 2 : 1));
    return { cleared: pct >= t[0], stars: s, rate: rate };
  }

  // 計分模式還能不能再放？沒有任何剩餘方塊放得下時就算結束
  function hasAnyMove(state) {
    var rest = remaining(state);
    for (var i = 0; i < rest.length; i++) {
      var shape = shapeOf(rest[i]);
      for (var v = 0; v < shape.variants.length; v++) {
        var vv = shape.variants[v];
        for (var r = 0; r + vv.rows <= state.rows; r++) {
          for (var c = 0; c + vv.cols <= state.cols; c++) {
            var ok = true;
            for (var m = 0; m < vv.cells.length; m++) {
              if (state.cells[(r + vv.cells[m][0]) * state.cols + (c + vv.cells[m][1])] !== EMPTY) { ok = false; break; }
            }
            if (ok) return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * 提示：找出一步好棋。
   * 精準模式直接查生成時的解答；計分模式改用最佳貼合法現算。
   */
  function findHint(state) {
    var i, j;

    if (state.level.mode === 'exact') {
      var unplacedByShape = {};
      state.pieces.forEach(function (p) {
        if (!p.placed) unplacedByShape[p.shapeId] = (unplacedByShape[p.shapeId] || []).concat(p);
      });
      for (i = 0; i < state.solution.length; i++) {
        var sol = state.solution[i];
        var bucket = unplacedByShape[sol.shapeId];
        if (!bucket || !bucket.length) continue;
        var free = true;
        for (j = 0; j < sol.cells.length; j++) {
          if (state.cells[(sol.r + sol.cells[j][0]) * state.cols + (sol.c + sol.cells[j][1])] !== EMPTY) { free = false; break; }
        }
        if (!free) continue;
        return { piece: bucket[0], rot: sol.rot, flip: sol.flip, r: sol.r, c: sol.c };
      }
    }

    // 以目前盤面為起點，用最佳貼合法找一步
    var liveMask = {
      rows: state.rows, cols: state.cols,
      grid: new Int8Array(state.cells.length),
      playable: 0
    };
    for (i = 0; i < state.cells.length; i++) {
      if (state.cells[i] === EMPTY) { liveMask.grid[i] = 1; liveMask.playable++; }
    }
    var rest = remaining(state);
    if (!rest.length || !liveMask.playable) return null;

    var result = Gen.bestFitFill(liveMask, rest.map(function (p) { return p.shapeId; }), state.level.seed + state.hintsUsed, 12, true);
    if (!result.plan || !result.plan.length) return null;
    var step = result.plan[0];
    var piece = rest[step.paletteIndex] || rest.find(function (p) { return p.shapeId === step.shapeId; });
    if (!piece) return null;
    return { piece: piece, rot: step.rot, flip: step.flip, r: step.r, c: step.c };
  }

  global.BD.Board = {
    VOID: VOID,
    EMPTY: EMPTY,
    createGame: createGame,
    shapeOf: shapeOf,
    cellsOf: cellsOf,
    boundsOf: boundsOf,
    canPlace: canPlace,
    place: place,
    unplace: unplace,
    fillRate: fillRate,
    filledCount: filledCount,
    isComplete: isComplete,
    remaining: remaining,
    reset: reset,
    evaluate: evaluate,
    hasAnyMove: hasAnyMove,
    findHint: findHint
  };
})(typeof window !== 'undefined' ? window : globalThis);
