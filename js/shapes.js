/* shapes.js — 形狀資料庫與幾何變換
 * 形狀以 ASCII 圖樣定義，'#' 代表實心格。
 * 每個形狀會預先展開所有「旋轉 × 鏡像」的不重複姿態（variants）。
 */
(function (global) {
  'use strict';

  // ---------- 基礎幾何 ----------

  function normalize(cells) {
    var minR = Infinity, minC = Infinity, i;
    for (i = 0; i < cells.length; i++) {
      if (cells[i][0] < minR) minR = cells[i][0];
      if (cells[i][1] < minC) minC = cells[i][1];
    }
    var out = cells.map(function (p) { return [p[0] - minR, p[1] - minC]; });
    out.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    return out;
  }

  function cellsKey(cells) {
    return cells.map(function (p) { return p[0] + ',' + p[1]; }).join(';');
  }

  // 順時針旋轉 90°
  function rotateCW(cells) {
    return normalize(cells.map(function (p) { return [p[1], -p[0]]; }));
  }

  // 左右鏡像
  function mirrorH(cells) {
    return normalize(cells.map(function (p) { return [p[0], -p[1]]; }));
  }

  // 依 rot(0~3) 與 flip(0/1) 求出姿態
  function transform(cells, rot, flip) {
    var out = normalize(cells);
    if (flip) out = mirrorH(out);
    for (var i = 0; i < (rot & 3); i++) out = rotateCW(out);
    return out;
  }

  function dims(cells) {
    var maxR = 0, maxC = 0;
    for (var i = 0; i < cells.length; i++) {
      if (cells[i][0] > maxR) maxR = cells[i][0];
      if (cells[i][1] > maxC) maxC = cells[i][1];
    }
    return { rows: maxR + 1, cols: maxC + 1 };
  }

  function parsePattern(pattern) {
    var cells = [];
    for (var r = 0; r < pattern.length; r++) {
      var row = pattern[r];
      for (var c = 0; c < row.length; c++) {
        if (row[c] === '#') cells.push([r, c]);
      }
    }
    return normalize(cells);
  }

  // 展開不重複姿態，同時記住產生它的 (rot, flip)
  function buildVariants(base) {
    var seen = Object.create(null);
    var list = [];
    for (var flip = 0; flip < 2; flip++) {
      for (var rot = 0; rot < 4; rot++) {
        var cells = transform(base, rot, flip);
        var k = cellsKey(cells);
        if (seen[k]) continue;
        seen[k] = true;
        var d = dims(cells);
        list.push({ rot: rot, flip: flip, cells: cells, rows: d.rows, cols: d.cols });
      }
    }
    return list;
  }

  // ---------- 形狀定義 ----------
  // tier 1：入門幾何｜tier 2：四格方塊｜tier 3：五格方塊｜tier 4：不規則大塊

  var DEFS = [
    // --- Tier 1 入門幾何 ---
    { id: 'm1',  tier: 1, name: '單格',   pattern: ['#'] },
    { id: 'd2',  tier: 1, name: '骨牌',   pattern: ['##'] },
    { id: 'i3',  tier: 1, name: '直三',   pattern: ['###'] },
    { id: 'l3',  tier: 1, name: '角三',   pattern: ['#.', '##'] },
    { id: 'o4',  tier: 1, name: '方塊',   pattern: ['##', '##'] },

    // --- Tier 2 四格方塊（tetromino 全套）---
    { id: 't_i', tier: 2, name: '長條',   pattern: ['####'] },
    { id: 't_o', tier: 2, name: '田字',   pattern: ['##', '##'] },
    { id: 't_t', tier: 2, name: '凸字',   pattern: ['###', '.#.'] },
    { id: 't_s', tier: 2, name: 'S 形',   pattern: ['.##', '##.'] },
    { id: 't_z', tier: 2, name: 'Z 形',   pattern: ['##.', '.##'] },
    { id: 't_l', tier: 2, name: 'L 形',   pattern: ['#.', '#.', '##'] },
    { id: 't_j', tier: 2, name: 'J 形',   pattern: ['.#', '.#', '##'] },

    // --- Tier 3 五格方塊（pentomino 十二件）---
    { id: 'p_f', tier: 3, name: 'F 塊',   pattern: ['.##', '##.', '.#.'] },
    { id: 'p_i', tier: 3, name: 'I 塊',   pattern: ['#####'] },
    { id: 'p_l', tier: 3, name: 'L 塊',   pattern: ['#.', '#.', '#.', '##'] },
    { id: 'p_n', tier: 3, name: 'N 塊',   pattern: ['.#', '.#', '##', '#.'] },
    { id: 'p_p', tier: 3, name: 'P 塊',   pattern: ['##', '##', '#.'] },
    { id: 'p_t', tier: 3, name: 'T 塊',   pattern: ['###', '.#.', '.#.'] },
    { id: 'p_u', tier: 3, name: 'U 塊',   pattern: ['#.#', '###'] },
    { id: 'p_v', tier: 3, name: 'V 塊',   pattern: ['#..', '#..', '###'] },
    { id: 'p_w', tier: 3, name: 'W 塊',   pattern: ['#..', '##.', '.##'] },
    { id: 'p_x', tier: 3, name: '十字',   pattern: ['.#.', '###', '.#.'] },
    { id: 'p_y', tier: 3, name: 'Y 塊',   pattern: ['.#', '##', '.#', '.#'] },
    { id: 'p_z', tier: 3, name: 'Z 塊',   pattern: ['##.', '.#.', '.##'] },

    // --- Tier 4 不規則大塊（六格）---
    { id: 'h_bar', tier: 4, name: '長城',  pattern: ['######'] },
    { id: 'h_rec', tier: 4, name: '磚牆',  pattern: ['###', '###'] },
    { id: 'h_ell', tier: 4, name: '長靴',  pattern: ['#...', '#...', '####'] },
    { id: 'h_tee', tier: 4, name: '圖釘',  pattern: ['#####', '..#..'] },
    { id: 'h_ess', tier: 4, name: '閃電',  pattern: ['.###', '###.'] },
    { id: 'h_plu', tier: 4, name: '風車',  pattern: ['.#.', '###', '.#.', '.#.'] },
    { id: 'h_yoo', tier: 4, name: '城門',  pattern: ['#..#', '####'] },
    { id: 'h_wav', tier: 4, name: '波浪',  pattern: ['#..', '##.', '.##', '..#'] },
    { id: 'h_wyy', tier: 4, name: '枝椏',  pattern: ['.#', '##', '.#', '.#', '.#'] },
    { id: 'h_cee', tier: 4, name: '勾玉',  pattern: ['###', '#..', '##.'] }
  ];

  // ---------- 建立形狀物件 ----------

  var GOLDEN = 137.508; // 黃金角，讓相鄰形狀的顏色差異最大

  var SHAPES = {};
  var ALL = DEFS.map(function (def, index) {
    var base = parsePattern(def.pattern);
    var hue = Math.round((index * GOLDEN) % 360);
    var shape = {
      id: def.id,
      name: def.name,
      tier: def.tier,
      size: base.length,
      cells: base,
      variants: buildVariants(base),
      hue: hue,
      sat: 78,
      light: 58
    };
    SHAPES[def.id] = shape;
    return shape;
  });

  function byTier() {
    var tiers = {};
    ALL.forEach(function (s) {
      (tiers[s.tier] = tiers[s.tier] || []).push(s);
    });
    return tiers;
  }
  var TIERS = byTier();

  // 依 tier 編號取形狀池，例如 pool([2]) 或 pool([3, 4])
  function pool(tiers) {
    var out = [];
    tiers.forEach(function (t) {
      (TIERS[t] || []).forEach(function (s) { out.push(s); });
    });
    return out;
  }

  // 取得某形狀在指定 rot/flip 下的姿態（回傳 variants 內的物件）
  function variantOf(shape, rot, flip) {
    var cells = transform(shape.cells, rot, flip);
    var k = cellsKey(cells);
    for (var i = 0; i < shape.variants.length; i++) {
      if (cellsKey(shape.variants[i].cells) === k) return shape.variants[i];
    }
    var d = dims(cells);
    return { rot: rot & 3, flip: flip ? 1 : 0, cells: cells, rows: d.rows, cols: d.cols };
  }

  function colorOf(shape) {
    return {
      base: 'hsl(' + shape.hue + ',' + shape.sat + '%,' + shape.light + '%)',
      light: 'hsl(' + shape.hue + ',' + shape.sat + '%,' + (shape.light + 12) + '%)',
      dark: 'hsl(' + shape.hue + ',' + shape.sat + '%,' + (shape.light - 14) + '%)',
      edge: 'hsl(' + shape.hue + ',' + (shape.sat - 6) + '%,' + (shape.light - 26) + '%)'
    };
  }

  global.BD = global.BD || {};
  global.BD.Shapes = {
    ALL: ALL,
    MAP: SHAPES,
    TIERS: TIERS,
    pool: pool,
    get: function (id) { return SHAPES[id]; },
    transform: transform,
    normalize: normalize,
    rotateCW: rotateCW,
    mirrorH: mirrorH,
    dims: dims,
    cellsKey: cellsKey,
    variantOf: variantOf,
    colorOf: colorOf,
    parsePattern: parsePattern
  };
})(typeof window !== 'undefined' ? window : globalThis);
