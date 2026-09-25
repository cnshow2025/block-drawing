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
    { id: 'chart', name: '星圖', draw: drawChart }
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

  // 圖案的細節要夠密，一小塊方塊切出來才看得出自己是哪一塊。
  // 這裡統一把「花樣」控制在一格左右的大小：畫布寬除以 9 差不多就是一格。
  function unit(w) { return w / 9; }

  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  // ── 花磚：每塊磁磚自己一個配色與花樣 ──
  function drawTiles(ctx, w, h, rng) {
    var u = unit(w) * 0.62;
    var cols = Math.ceil(w / u), rows = Math.ceil(h / u);
    var grounds = ['#1b6f8c', '#2b8fa8', '#d9532f', '#e8913a', '#f0d7a8', '#186056', '#8c3f6b', '#c9d6c1'];
    var inks = ['#fdf4dd', '#0f3b46', '#f6c65b', '#2a1a3d'];

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var x = c * u, y = r * u;
        var g = pick(rng, grounds), ink = pick(rng, inks);
        ctx.fillStyle = g;
        ctx.fillRect(x, y, u, u);

        ctx.save();
        ctx.translate(x + u / 2, y + u / 2);
        ctx.rotate(Math.floor(rng() * 4) * Math.PI / 2);
        ctx.fillStyle = ink;
        var kind = Math.floor(rng() * 4);
        if (kind === 0) {
          for (var p = 0; p < 8; p++) {
            ctx.beginPath();
            var a = (Math.PI * 2 * p) / 8;
            ctx.ellipse(Math.cos(a) * u * 0.22, Math.sin(a) * u * 0.22, u * 0.11, u * 0.05, a, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (kind === 1) {
          ctx.beginPath();
          for (var q = 0; q < 4; q++) {
            var b = (Math.PI * 2 * q) / 4;
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(b) * u * 0.42, Math.sin(b) * u * 0.42);
            ctx.lineTo(Math.cos(b + 0.5) * u * 0.3, Math.sin(b + 0.5) * u * 0.3);
          }
          ctx.fill();
        } else if (kind === 2) {
          ctx.beginPath();
          ctx.arc(0, 0, u * 0.26, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(0, 0, u * 0.13, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-u * 0.24, -u * 0.24, u * 0.48, u * 0.48);
        }
        ctx.restore();

        ctx.strokeStyle = 'rgba(20,30,40,.35)';
        ctx.lineWidth = Math.max(1, u * 0.035);
        ctx.strokeRect(x + 0.5, y + 0.5, u, u);
      }
    }
  }

  // ── 樹葉：大量重疊的葉片，每片角度與顏色都不同 ──
  function drawLeaves(ctx, w, h, rng) {
    gradient(ctx, w, h, [[0, '#14432c'], [1, '#0a2b1d']]);
    var u = unit(w);
    var greens = ['#2f7d4f', '#46a35f', '#6cc072', '#a8d46a', '#d9d16a', '#e0a84c', '#c2722f', '#1f6340'];
    var count = Math.round((w * h) / (u * u) * 9);
    for (var i = 0; i < count; i++) {
      var x = rng() * w, y = rng() * h;
      var len = u * (0.26 + rng() * 0.4);
      var wid = len * (0.32 + rng() * 0.22);
      var ang = rng() * Math.PI * 2;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = pick(rng, greens);
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.quadraticCurveTo(0, -wid, len, 0);
      ctx.quadraticCurveTo(0, wid, -len, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(12,40,25,.45)';
      ctx.lineWidth = Math.max(0.8, len * 0.06);
      ctx.beginPath();
      ctx.moveTo(-len * 0.85, 0);
      ctx.lineTo(len * 0.85, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── 魚鱗：一排排交錯的鱗片，色相隨位置流動並加上抖動 ──
  function drawScales(ctx, w, h, rng) {
    gradient(ctx, w, h, [[0, '#0d3b5c'], [1, '#08283f']]);
    var u = unit(w) * 0.5;
    var rows = Math.ceil(h / (u * 0.62)) + 2;
    for (var r = 0; r < rows; r++) {
      var y = r * u * 0.62;
      var offset = (r % 2) * u * 0.5;
      for (var x = -u; x < w + u; x += u) {
        var cx = x + offset, cy = y;
        var hue = 185 + Math.sin((cx / w) * 4) * 40 + Math.sin((cy / h) * 5) * 30 + (rng() - 0.5) * 26;
        var light = 42 + (rng() - 0.5) * 24 + ((cy / h) * -10);
        ctx.fillStyle = 'hsl(' + hue.toFixed(0) + ',' + (55 + rng() * 25).toFixed(0) + '%,' + light.toFixed(0) + '%)';
        ctx.beginPath();
        ctx.arc(cx, cy, u * 0.56, 0, Math.PI);
        ctx.fill();
        ctx.strokeStyle = 'rgba(6,24,38,.5)';
        ctx.lineWidth = Math.max(1, u * 0.06);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,' + (0.06 + rng() * 0.18).toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(cx, cy + u * 0.16, u * 0.26, 0, Math.PI);
        ctx.fill();
      }
    }
  }

  // ── 花布：條紋底加上密集的小花 ──
  function drawFabric(ctx, w, h, rng) {
    var u = unit(w);
    ctx.fillStyle = '#fdf2e3';
    ctx.fillRect(0, 0, w, h);
    for (var sx = 0; sx < w + h; sx += u * 0.34) {
      ctx.strokeStyle = sx % (u * 0.68) < u * 0.34 ? 'rgba(210,150,120,.30)' : 'rgba(120,170,190,.24)';
      ctx.lineWidth = u * 0.14;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx - h, h);
      ctx.stroke();
    }
    var petals = ['#e8556d', '#f2913f', '#f5c84b', '#5fb083', '#4f92c9', '#a776c9', '#d4699c'];
    var count = Math.round((w * h) / (u * u) * 4.5);
    for (var i = 0; i < count; i++) {
      var x = rng() * w, y = rng() * h;
      var r = u * (0.08 + rng() * 0.1);
      var color = pick(rng, petals);
      var n = 5 + Math.floor(rng() * 2);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rng() * Math.PI);
      ctx.fillStyle = color;
      for (var p = 0; p < n; p++) {
        var a = (Math.PI * 2 * p) / n;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * r, Math.sin(a) * r, r * 0.8, r * 0.55, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = rng() < 0.5 ? '#fff0b8' : '#fffdf2';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ── 拼貼：密集的三角形，每片獨立配色並描邊 ──
  function drawMosaic(ctx, w, h, rng) {
    var palette = ['#ff6b8b', '#ffc247', '#42c9a3', '#5aa9f5', '#b98cff', '#ff9f6b',
                   '#2f4b7c', '#ffe6a7', '#1f8a70', '#e0409a', '#6b4bd8', '#f75c3c'];
    var u = unit(w) * 0.5;
    var cols = Math.ceil(w / u), rows = Math.ceil(h / u);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var x = c * u, y = r * u, flip = rng() < 0.5;
        [0, 1].forEach(function (half) {
          ctx.fillStyle = pick(rng, palette);
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
          ctx.strokeStyle = 'rgba(255,255,255,.22)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        });
      }
    }
  }

  // ── 星圖：星座連線加上星雲，每一區的星形都不一樣 ──
  function drawChart(ctx, w, h, rng) {
    gradient(ctx, w, h, [[0, '#0a1230'], [.55, '#132a54'], [1, '#0d1c3c']]);
    var u = unit(w);

    var nebula = ['#5b3fa8', '#2f6fa8', '#a8437a', '#2f8a86'];
    for (var n = 0; n < 14; n++) {
      var nx = rng() * w, ny = rng() * h, nr = u * (0.5 + rng() * 1.1);
      var g = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
      g.addColorStop(0, pick(rng, nebula) + 'aa');
      g.addColorStop(1, 'rgba(10,18,48,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(nx, ny, nr, 0, Math.PI * 2);
      ctx.fill();
    }

    var stars = [];
    var count = Math.round((w * h) / (u * u) * 7);
    for (var i = 0; i < count; i++) {
      stars.push({ x: rng() * w, y: rng() * h, r: 0.7 + rng() * 2.8 });
    }
    // 星座連線：挑幾顆星，把鄰近的接起來
    ctx.strokeStyle = 'rgba(160,200,255,.45)';
    ctx.lineWidth = 1.1;
    for (var k = 0; k < Math.round(count / 9); k++) {
      var s = stars[Math.floor(rng() * stars.length)];
      var chain = 2 + Math.floor(rng() * 3);
      var cur = s;
      ctx.beginPath();
      ctx.moveTo(cur.x, cur.y);
      for (var j = 0; j < chain; j++) {
        var best = null, bestD = Infinity;
        for (var m = 0; m < stars.length; m++) {
          var t = stars[m];
          if (t === cur) continue;
          var d = (t.x - cur.x) * (t.x - cur.x) + (t.y - cur.y) * (t.y - cur.y);
          if (d < bestD && d > (u * 0.2) * (u * 0.2) && d < (u * 1.3) * (u * 1.3)) { bestD = d; best = t; }
        }
        if (!best) break;
        ctx.lineTo(best.x, best.y);
        best.big = true;
        cur.big = true;
        cur = best;
      }
      ctx.stroke();
    }
    stars.forEach(function (st) {
      ctx.fillStyle = st.big ? '#ffffff' : 'rgba(220,235,255,' + (0.4 + rng() * 0.5).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.big ? st.r * 1.5 : st.r, 0, Math.PI * 2);
      ctx.fill();
    });
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
