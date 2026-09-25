/* pictures.js — 用 Canvas 程式畫出拼圖用的圖案
 *
 * 不放任何圖檔：六張圖全部是現畫的，種子固定所以每次都長一樣。
 * 畫布會依棋盤的長寬比產生，圖案才不會被拉變形。
 */
(function (global) {
  'use strict';

  var makeRng = global.BD.Gen.makeRng;

  var PICTURES = [
    { id: 'tiles', name: '花磚', draw: drawTiles },
    { id: 'leaves', name: '樹葉', draw: drawLeaves },
    { id: 'scales', name: '魚鱗', draw: drawScales },
    { id: 'fabric', name: '花布', draw: drawFabric },
    { id: 'mosaic', name: '拼貼', draw: drawMosaic },
    { id: 'chart', name: '星雲', draw: drawChart }
  ];

  var cache = {};

  /**
   * 取得某張圖的 data URL。
   * 依 cols × rows 的比例決定畫布形狀，同一組參數只會畫一次。
   */
  function at(index) {
    return PICTURES[((index % PICTURES.length) + PICTURES.length) % PICTURES.length];
  }

  function render(pic, index, w, h, quality) {
    var key = pic.id + '@' + w + 'x' + h;
    if (cache[key]) return cache[key];
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    pic.draw(ctx, w, h, makeRng(0x9e3779b9 ^ (index * 2654435761)));
    cache[key] = canvas.toDataURL('image/jpeg', quality);
    return cache[key];
  }

  function url(index, cols, rows) {
    var w = 720;
    return render(at(index), index, w, Math.max(160, Math.round(w * rows / cols)), 0.82);
  }

  /** 選圖面板用的小縮圖，不必跟棋盤同尺寸 */
  function thumb(index) {
    return render(at(index), index, 240, 180, 0.7);
  }

  /**
   * 大範圍的色彩場。
   *
   * 這是讓圖案「好認」的關鍵。密密麻麻的小花樣只能幫你把相鄰的邊對起來，
   * 卻沒辦法告訴你這塊是從畫面的哪一區來的——每一區都長一樣的話，
   * 拿在手上的碎片還是認不出自己該去哪。
   * 所以所有局部元素的顏色都從這個場取，畫面掃過去色調就會明顯變化。
   */
  /**
   * 大範圍的色彩場——讓圖案「好認」的關鍵。
   *
   * 密密麻麻的小花樣只能幫你把相鄰的邊對起來，卻沒辦法告訴你這塊是從畫面的
   * 哪一區來的；每一區都長一樣的話，拿在手上的碎片還是認不出自己該去哪。
   *
   * 做法是把畫面切成幾個大色塊（像彩繪玻璃），每張圖用自己的一組調色盤，
   * 所以既分得出區域、六張圖也各有各的性格，不會全部變成同一條彩虹。
   * 再疊上由上而下的明度漸層，同一個色塊裡的不同高度也還是分得出來。
   */
  function makeField(hueBase, hueSweep) {
    return function (x, y, w, h) {
      var u = x / w, v = y / h;
      return {
        // 色相沿著寬度掃過一段色域、再隨高度偏一些，明度則由上而下變亮。
        // 兩個方向都單調（不用波紋，波紋會讓不同位置折回同一個色相），
        // 每一格就落在自己獨有的色調座標上，不會跟別格撞色。
        //
        // 掃描範圍刻意不開滿一圈：開滿就六張圖都變成同一條彩虹，各自的性格會不見。
        // 每張圖只掃自己那段色域——樹葉走綠到紅的秋色，魚鱗走青到紫的水色。
        hue: (hueBase + u * hueSweep + v * hueSweep * 0.28 + 720) % 360,
        light: 20 + v * 62,
        sat: 46 + (u * 0.4 + (1 - v) * 0.6) * 36
      };
    };
  }

  // 每張圖的色域起點與掃描寬度
  // 起點色相與掃描寬度（負值表示往色環反方向走）
  var FIELDS = {
    // 掃描寬度是取捨：窄一點各張圖的性格明顯，寬一點碎片才好認。
    // 實測窄到 130 度時有三分之二的格子色調撞在一起，所以拉到 200 度上下。
    tiles:  [175, 205],   // 青 → 藍 → 紫 → 洋紅
    leaves: [140, -200],  // 綠 → 黃 → 橙 → 紅 → 洋紅，秋天的走向
    scales: [215, -195],  // 藍 → 青 → 綠 → 黃，水面到水草
    fabric: [328, 200],   // 粉 → 紅 → 橘 → 黃 → 綠
    mosaic: [0, 330],     // 整圈都用，這就是拼貼的性格
    chart:  [268, 210]    // 紫 → 洋紅 → 紅 → 琥珀 → 金
  };

  function hsl(h, s, l) {
    return 'hsl(' + Math.round(h) + ',' + Math.round(s) + '%,' + Math.round(Math.max(8, Math.min(92, l))) + '%)';
  }

  // 花樣控制在一格左右的大小：畫布寬除以 9 差不多就是一格
  function unit(w) { return w / 9; }

  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  /** 底色先鋪上色彩場，之後的局部元素疊在上面 */
  function washField(ctx, w, h, field, shift) {
    var step = Math.max(6, Math.round(w / 90));
    for (var y = 0; y < h; y += step) {
      for (var x = 0; x < w; x += step) {
        var f = field(x + step / 2, y + step / 2, w, h);
        ctx.fillStyle = hsl(f.hue + (shift || 0), f.sat, f.light);
        ctx.fillRect(x, y, step + 1, step + 1);
      }
    }
  }

  // ── 花磚：整區整區換配色，磁磚花樣負責對邊 ──
  function drawTiles(ctx, w, h, rng) {
    var field = makeField(FIELDS.tiles[0], FIELDS.tiles[1]);
    var u = unit(w) * 0.78;
    var cols = Math.ceil(w / u), rows = Math.ceil(h / u);

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var x = c * u, y = r * u;
        var f = field(x + u / 2, y + u / 2, w, h);
        ctx.fillStyle = hsl(f.hue, f.sat, f.light + (rng() - 0.5) * 8);
        ctx.fillRect(x, y, u, u);

        ctx.save();
        ctx.translate(x + u / 2, y + u / 2);
        ctx.rotate(Math.floor(rng() * 4) * Math.PI / 2);
        ctx.fillStyle = hsl(f.hue + 175, 52, f.light > 50 ? f.light - 30 : f.light + 30);
        var kind = Math.floor(rng() * 4);
        if (kind === 0) {
          for (var p = 0; p < 8; p++) {
            var a = (Math.PI * 2 * p) / 8;
            ctx.beginPath();
            ctx.ellipse(Math.cos(a) * u * 0.2, Math.sin(a) * u * 0.2, u * 0.1, u * 0.048, a, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (kind === 1) {
          ctx.beginPath();
          for (var q = 0; q < 4; q++) {
            var b = (Math.PI * 2 * q) / 4;
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(b) * u * 0.42, Math.sin(b) * u * 0.42);
            ctx.lineTo(Math.cos(b + 0.55) * u * 0.3, Math.sin(b + 0.55) * u * 0.3);
          }
          ctx.fill();
        } else if (kind === 2) {
          ctx.beginPath();
          ctx.arc(0, 0, u * 0.24, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = hsl(f.hue, f.sat, f.light);
          ctx.beginPath();
          ctx.arc(0, 0, u * 0.14, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-u * 0.21, -u * 0.21, u * 0.42, u * 0.42);
        }
        ctx.restore();

        ctx.strokeStyle = 'rgba(20,28,38,.13)';
        ctx.lineWidth = Math.max(1, u * 0.022);
        ctx.strokeRect(x + 0.5, y + 0.5, u, u);
      }
    }
  }

  // ── 樹葉：葉子變少變大，顏色跟著色彩場從青綠走到金橘 ──
  function drawLeaves(ctx, w, h, rng) {
    var field = makeField(FIELDS.leaves[0], FIELDS.leaves[1]);
    washField(ctx, w, h, field);

    var u = unit(w);
    var count = Math.round((w * h) / (u * u) * 2.6);
    for (var i = 0; i < count; i++) {
      var x = rng() * w, y = rng() * h;
      var f = field(x, y, w, h);
      var len = u * (0.42 + rng() * 0.5);
      var wid = len * (0.5 + rng() * 0.28);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rng() * Math.PI * 2);
      ctx.fillStyle = hsl(f.hue + (rng() - 0.5) * 22, f.sat + (rng() - 0.5) * 18, f.light + (rng() - 0.5) * 16);
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.quadraticCurveTo(0, -wid, len, 0);
      ctx.quadraticCurveTo(0, wid, -len, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(14,38,26,.5)';
      ctx.lineWidth = Math.max(1, len * 0.045);
      ctx.beginPath();
      ctx.moveTo(-len * 0.85, 0);
      ctx.lineTo(len * 0.85, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── 魚鱗：色相橫掃整個色環，一排排走過去顏色明顯不同 ──
  function drawScales(ctx, w, h, rng) {
    var field = makeField(FIELDS.scales[0], FIELDS.scales[1]);
    washField(ctx, w, h, field);
    var u = unit(w) * 0.66;
    var rows = Math.ceil(h / (u * 0.6)) + 2;
    for (var r = 0; r < rows; r++) {
      var y = r * u * 0.6;
      var offset = (r % 2) * u * 0.5;
      for (var x = -u; x < w + u; x += u) {
        var cx = x + offset;
        var f = field(cx, y, w, h);
        ctx.fillStyle = hsl(f.hue + (rng() - 0.5) * 16, f.sat, f.light + (rng() - 0.5) * 12);
        ctx.beginPath();
        ctx.arc(cx, y, u * 0.56, 0, Math.PI);
        ctx.fill();
        ctx.strokeStyle = 'rgba(8,22,34,.42)';
        ctx.lineWidth = Math.max(1, u * 0.055);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.16)';
        ctx.beginPath();
        ctx.arc(cx, y + u * 0.16, u * 0.26, 0, Math.PI);
        ctx.fill();
      }
    }
  }

  // ── 花布：花變大變少，底色與花色都跟著色彩場走 ──
  function drawFabric(ctx, w, h, rng) {
    var field = makeField(FIELDS.fabric[0], FIELDS.fabric[1]);
    washField(ctx, w, h, field);
    var u = unit(w);

    // 條紋沿線一段一段取樣：整條用同一個顏色的話，垂直方向的差異會被抹平
    var seg = Math.max(8, u * 0.5);
    for (var sx = 0; sx < w + h; sx += u * 0.4) {
      for (var t = 0; t < h; t += seg) {
        var px = sx - t, py = t;
        if (px < -u || px > w + u) continue;
        var fs = field(Math.max(0, Math.min(w, px)), py, w, h);
        ctx.strokeStyle = 'hsla(' + Math.round(fs.hue + 30) + ',' + Math.round(fs.sat) + '%,' +
          Math.round(fs.light + 14) + '%,.55)';
        ctx.lineWidth = u * 0.2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - seg, py + seg);
        ctx.stroke();
      }
    }

    var count = Math.round((w * h) / (u * u) * 1.05);
    for (var i = 0; i < count; i++) {
      var x = rng() * w, y = rng() * h;
      var f = field(x, y, w, h);
      var r = u * (0.15 + rng() * 0.16);
      var n = 5 + Math.floor(rng() * 3);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rng() * Math.PI);
      ctx.fillStyle = hsl(f.hue + 150 + (rng() - 0.5) * 30, 74, f.light > 50 ? 28 : 76);
      for (var p = 0; p < n; p++) {
        var a = (Math.PI * 2 * p) / n;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * r, Math.sin(a) * r, r * 0.82, r * 0.56, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = hsl(f.hue + 55, 80, f.light > 50 ? f.light - 26 : f.light + 26);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ── 拼貼：三角形變大，顏色以色彩場為主、局部再跳色 ──
  function drawMosaic(ctx, w, h, rng) {
    var field = makeField(FIELDS.mosaic[0], FIELDS.mosaic[1]);
    var u = unit(w) * 0.66;
    var cols = Math.ceil(w / u), rows = Math.ceil(h / u);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var x = c * u, y = r * u, flip = rng() < 0.5;
        var f = field(x + u / 2, y + u / 2, w, h);
        [0, 1].forEach(function (half) {
          ctx.fillStyle = hsl(f.hue + (half ? 20 : -20) + (rng() - 0.5) * 18, f.sat + rng() * 14,
                              f.light + (half ? 8 : -7) + (rng() - 0.5) * 10);
          ctx.beginPath();
          if (half === 0) {
            ctx.moveTo(x, y);
            ctx.lineTo(x + u, y);
            flip ? ctx.lineTo(x, y + u) : ctx.lineTo(x + u, y + u);
          } else {
            flip ? ctx.moveTo(x + u, y) : ctx.moveTo(x, y);
            ctx.lineTo(x + u, y + u);
            ctx.lineTo(x, y + u);
          }
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.26)';
          ctx.lineWidth = 1.4;
          ctx.stroke();
        });
      }
    }
  }

  // ── 星雲：原本的星圖整片都一樣暗，改成大片彩色星雲主導畫面 ──
  function drawChart(ctx, w, h, rng) {
    var field = makeField(FIELDS.chart[0], FIELDS.chart[1]);
    washField(ctx, w, h, field);
    ctx.fillStyle = 'rgba(10,12,32,.1)';
    ctx.fillRect(0, 0, w, h);

    var u = unit(w);
    for (var n = 0; n < 12; n++) {
      var nx = rng() * w, ny = rng() * h, nr = u * (1.1 + rng() * 1.6);
      var f = field(nx, ny, w, h);
      var g = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
      g.addColorStop(0, 'hsla(' + Math.round(f.hue + (rng() - 0.5) * 40) + ',88%,' + Math.round(f.light + 16) + '%,.8)');
      g.addColorStop(1, 'hsla(' + Math.round(f.hue) + ',70%,20%,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(nx, ny, nr, 0, Math.PI * 2);
      ctx.fill();
    }

    var count = Math.round((w * h) / (u * u) * 2.6);
    for (var i = 0; i < count; i++) {
      var sx = rng() * w, sy = rng() * h, sr = 0.9 + rng() * 3.2;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.45 + rng() * 0.55).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
      if (rng() < 0.07) {
        ctx.strokeStyle = 'rgba(255,255,255,.7)';
        ctx.lineWidth = 1.2;
        var len = sr * 4;
        ctx.beginPath();
        ctx.moveTo(sx - len, sy); ctx.lineTo(sx + len, sy);
        ctx.moveTo(sx, sy - len); ctx.lineTo(sx, sy + len);
        ctx.stroke();
      }
    }
  }

  function gradient(ctx, w, h, stops) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  global.BD = global.BD || {};
  global.BD.Pictures = {
    LIST: PICTURES,
    count: PICTURES.length,
    nameOf: function (index) { return at(index).name; },
    url: url,
    thumb: thumb
  };
})(typeof window !== 'undefined' ? window : globalThis);
