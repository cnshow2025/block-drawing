/* levels.js — 世界與關卡資料
 *
 * mask：'#' 可填、'.' 盤外
 * mode：'exact' 精準拼合（必須 100% 填滿）／'score' 填滿率計分
 * pool：本關可用的形狀 id
 * seed：切割生成器的種子，確保每次進關都是同一題
 * swap/extra：計分模式用——抽掉幾塊、再補幾塊隨機形狀
 * stars：計分模式的 1/2/3 星填滿率門檻（%）
 */
(function (global) {
  'use strict';

  var T2 = ['t_i', 't_o', 't_t', 't_s', 't_z', 't_l', 't_j'];
  var T3 = ['p_f', 'p_i', 'p_l', 'p_n', 'p_p', 'p_t', 'p_u', 'p_v', 'p_w', 'p_x', 'p_y', 'p_z'];
  var T4 = ['h_bar', 'h_rec', 'h_ell', 'h_tee', 'h_ess', 'h_plu', 'h_yoo', 'h_wav', 'h_wyy', 'h_cee'];

  var WORLDS = [
    { id: 1, name: '幾何樂園', theme: 'mint',    desc: '從最單純的方形開始，認識拖曳、旋轉與翻轉。' },
    { id: 2, name: '方塊工廠', theme: 'sky',     desc: '七種四格方塊全數登場，鋪滿整片生產線。' },
    { id: 3, name: '洞穴迷宮', theme: 'peach',   desc: '盤面開始出現孔洞與缺口，五格方塊加入戰局。' },
    { id: 4, name: '碎片星河', theme: 'grape',   desc: '十二件五格方塊與不規則外框的硬仗。' },
    { id: 5, name: '繽紛花園', theme: 'rainbow', desc: '造型畫框登場，方塊不見得剛剛好——填越滿分越高。' }
  ];

  var LEVELS = [
    // ===== 世界 1：幾何樂園 =====
    {
      id: '1-1', world: 1, name: '第一塊拼圖', mode: 'exact', pool: ['d2', 'i3', 'l3', 'o4'], seed: 1101,
      tip: '拖曳方塊盤裡的方塊放進畫框，填滿就過關。',
      mask: [
        '####',
        '####',
        '####',
        '####'
      ]
    },
    {
      id: '1-2', world: 1, name: '轉個方向', mode: 'exact', pool: ['d2', 'i3', 'l3', 'o4'], seed: 1202,
      tip: '選取方塊後按「旋轉」，或在電腦上按 R 鍵。',
      mask: [
        '#####',
        '#####',
        '#####',
        '#####'
      ]
    },
    {
      id: '1-3', world: 1, name: '照鏡子', mode: 'exact', pool: ['d2', 'i3', 'l3', 'o4'], seed: 1303,
      tip: '「翻轉」會把方塊左右鏡像，電腦上按 F 鍵。',
      mask: [
        '#####',
        '#####',
        '#####',
        '#####',
        '#####'
      ]
    },
    {
      id: '1-4', world: 1, name: '三格四格', mode: 'exact', pool: ['i3', 'l3', 'o4'], seed: 1404,
      mask: [
        '######',
        '######',
        '######',
        '######',
        '######'
      ]
    },
    {
      id: '1-5', world: 1, name: '正方挑戰', mode: 'exact', pool: ['i3', 'l3', 'o4'], seed: 1505,
      mask: [
        '######',
        '######',
        '######',
        '######',
        '######',
        '######'
      ]
    },
    {
      id: '1-6', world: 1, name: '缺角畫框', mode: 'exact', pool: ['i3', 'l3', 'o4', 't_i'], seed: 1606,
      mask: [
        '.####.',
        '######',
        '######',
        '######',
        '######',
        '.####.'
      ]
    },

    // ===== 世界 2：方塊工廠 =====
    {
      id: '2-1', world: 2, name: '四格上線', mode: 'exact', pool: T2, seed: 2101,
      tip: '從這裡開始，所有方塊都是四格。',
      mask: [
        '####',
        '####',
        '####',
        '####'
      ]
    },
    {
      id: '2-2', world: 2, name: '五道工序', mode: 'exact', pool: T2, seed: 2202,
      mask: [
        '#####',
        '#####',
        '#####',
        '#####'
      ]
    },
    {
      id: '2-3', world: 2, name: '加長產線', mode: 'exact', pool: T2, seed: 2303,
      mask: [
        '######',
        '######',
        '######',
        '######'
      ]
    },
    {
      id: '2-4', world: 2, name: '七格寬', mode: 'exact', pool: T2, seed: 2404,
      mask: [
        '#######',
        '#######',
        '#######',
        '#######'
      ]
    },
    {
      id: '2-5', world: 2, name: '滿載運轉', mode: 'exact', pool: T2, seed: 2505,
      mask: [
        '######',
        '######',
        '######',
        '######',
        '######',
        '######'
      ]
    },
    {
      id: '2-6', world: 2, name: '中央天井', mode: 'exact', pool: T2, seed: 2606,
      mask: [
        '######',
        '######',
        '##..##',
        '##..##',
        '######',
        '######'
      ]
    },

    // ===== 世界 3：洞穴迷宮 =====
    {
      id: '3-1', world: 3, name: '四口天窗', mode: 'exact', pool: T2.concat(T3), seed: 3101,
      tip: '五格方塊加入了，方塊尺寸不再一致。',
      mask: [
        '#######',
        '#.###.#',
        '#######',
        '#######',
        '#.###.#',
        '#######'
      ]
    },
    {
      id: '3-2', world: 3, name: '十字洞窟', mode: 'exact', pool: T2.concat(T3), seed: 3202,
      mask: [
        '#######',
        '#######',
        '###.###',
        '##...##',
        '###.###',
        '#######',
        '#######'
      ]
    },
    {
      id: '3-3', world: 3, name: '缺角長廊', mode: 'exact', pool: T2.concat(T3), seed: 3303,
      mask: [
        '.######.',
        '########',
        '########',
        '########',
        '########',
        '.######.'
      ]
    },
    {
      id: '3-4', world: 3, name: '星點石窟', mode: 'exact', pool: T2.concat(T3), seed: 3404,
      mask: [
        '#######',
        '.#####.',
        '##.#.##',
        '#######',
        '##.#.##',
        '.#####.',
        '#######'
      ]
    },
    {
      id: '3-5', world: 3, name: '大廳', mode: 'score', pool: T2.concat(T3), seed: 3505,
      swap: 2, extra: 2, stars: [72, 83, 92],
      tip: '方塊不再剛剛好——填越滿，星星越多。',
      mask: [
        '########',
        '########',
        '##....##',
        '##....##',
        '##....##',
        '########',
        '########'
      ]
    },
    {
      id: '3-6', world: 3, name: '石柱陣', mode: 'score', pool: T2.concat(T3), seed: 3606,
      swap: 2, extra: 1, stars: [76, 88, 95],
      mask: [
        '########',
        '#.#..#.#',
        '########',
        '#.#..#.#',
        '########',
        '#.#..#.#',
        '########'
      ]
    },

    // ===== 世界 4：碎片星河 =====
    {
      id: '4-1', world: 4, name: '星之十字', mode: 'exact', pool: T3, seed: 4101,
      tip: '從這裡起，全部都是五格方塊。',
      mask: [
        '..##..',
        '..##..',
        '######',
        '######',
        '..##..',
        '..##..'
      ]
    },
    {
      id: '4-2', world: 4, name: '菱形結晶', mode: 'exact', pool: T3, seed: 4202,
      mask: [
        '...#...',
        '..###..',
        '.#####.',
        '#######',
        '.#####.',
        '..###..',
        '...#...'
      ]
    },
    {
      id: '4-3', world: 4, name: '星塵階梯', mode: 'exact', pool: T3, seed: 4303,
      mask: [
        '###....',
        '###....',
        '#####..',
        '#####..',
        '#######',
        '#######'
      ]
    },
    {
      id: '4-4', world: 4, name: '工字星艦', mode: 'score', pool: T3, seed: 4404,
      swap: 2, extra: 3, stars: [63, 73, 83],
      mask: [
        '##...##',
        '##...##',
        '#######',
        '#######',
        '##...##',
        '##...##'
      ]
    },
    {
      id: '4-5', world: 4, name: '巨型星芒', mode: 'score', pool: T3, seed: 4505,
      swap: 2, extra: 2, stars: [80, 90, 95],
      mask: [
        '..####..',
        '..####..',
        '########',
        '########',
        '########',
        '..####..',
        '..####..'
      ]
    },
    {
      id: '4-6', world: 4, name: '環形星門', mode: 'score', pool: T3, seed: 4606,
      swap: 2, extra: 2, stars: [80, 90, 95],
      mask: [
        '..#####..',
        '.#######.',
        '#########',
        '###...###',
        '###...###',
        '.#######.',
        '..#####..'
      ]
    },

    // ===== 世界 5：繽紛花園 =====
    {
      id: '5-1', world: 5, name: '一朵花', mode: 'score', pool: T3.concat(T4), seed: 5101,
      swap: 2, extra: 3, stars: [68, 78, 86],
      tip: '六格的不規則大塊登場了。',
      mask: [
        '.###.###.',
        '#########',
        '#########',
        '.#######.',
        '...###...',
        '....#....',
        '...###...'
      ]
    },
    {
      id: '5-2', world: 5, name: '許願星', mode: 'score', pool: T3.concat(T4), seed: 5202,
      swap: 2, extra: 2, stars: [74, 85, 93],
      mask: [
        '....#....',
        '...###...',
        '#########',
        '.#######.',
        '..#####..',
        '..##.##..',
        '.##...##.'
      ]
    },
    {
      id: '5-3', world: 5, name: '愛心', mode: 'score', pool: T3.concat(T4), seed: 5303,
      swap: 3, extra: 2, stars: [72, 83, 91],
      mask: [
        '.###.###.',
        '#########',
        '#########',
        '#########',
        '.#######.',
        '..#####..',
        '...###...',
        '....#....'
      ]
    },
    {
      id: '5-4', world: 5, name: '貓咪', mode: 'score', pool: T3.concat(T4), seed: 5404,
      swap: 3, extra: 2, stars: [74, 85, 93],
      mask: [
        '##.....##',
        '###...###',
        '#########',
        '#########',
        '#########',
        '.#######.',
        '..#####..'
      ]
    },
    {
      id: '5-5', world: 5, name: '蝴蝶', mode: 'score', pool: T3.concat(T4), seed: 5505,
      swap: 3, extra: 3, stars: [66, 76, 84],
      mask: [
        '##.....##',
        '####.####',
        '#########',
        '####.####',
        '###...###',
        '.##...##.'
      ]
    },
    {
      id: '5-6', world: 5, name: '皇冠', mode: 'score', pool: T3.concat(T4), seed: 5606,
      swap: 3, extra: 3, stars: [72, 82, 90],
      mask: [
        '#.##.##.#',
        '#########',
        '#########',
        '#########',
        '.#######.'
      ]
    }
  ];

  global.BD = global.BD || {};
  global.BD.Levels = {
    WORLDS: WORLDS,
    LIST: LEVELS,
    byId: function (id) {
      for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].id === id) return LEVELS[i];
      return null;
    },
    indexOf: function (id) {
      for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].id === id) return i;
      return -1;
    },
    next: function (id) {
      var i = this.indexOf(id);
      return (i >= 0 && i + 1 < LEVELS.length) ? LEVELS[i + 1] : null;
    },
    inWorld: function (w) {
      return LEVELS.filter(function (l) { return l.world === w; });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
