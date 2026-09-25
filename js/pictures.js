/* pictures.js — 用 Canvas 程式畫出拼圖用的圖案
 *
 * 不放任何圖檔：六張圖全部是現畫的，種子固定所以每次都長一樣。
 * 畫布會依棋盤的長寬比產生，圖案才不會被拉變形。
 */
(function (global) {
  'use strict';

  var makeRng = global.BD.Gen.makeRng;

  var PICTURES = [
    { id: 'sunset', name: '黃昏', draw: drawSunset },
    { id: 'waves', name: '海浪', draw: drawWaves },
    { id: 'night', name: '星空', draw: drawNight },
    { id: 'garden', name: '花園', draw: drawGarden },
    { id: 'rainbow', name: '彩虹', draw: drawRainbow },
    { id: 'mosaic', name: '幾何', draw: drawMosaic }
  ];

  var cache = {};

  /**
   * 取得某張圖的 data URL。
   * 依 cols × rows 的比例決定畫布形狀，同一組參數只會畫一次。
   */
  function url(index, cols, rows) {
    var pic = PICTURES[((index % PICTURES.length) + PICTURES.length) % PICTURES.length];
    var w = 640;
    var h = Math.max(120, Math.round(640 * rows / cols));
    var key = pic.id + '@' + w + 'x' + h;
    if (cache[key]) return cache[key];

    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    pic.draw(ctx, w, h, makeRng(0x9e3779b9 ^ index));
    cache[key] = canvas.toDataURL('image/jpeg', 0.88);
    return cache[key];
  }

  function gradient(ctx, w, h, stops) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // ── 黃昏：漸層天空、落日、層疊山稜、海面倒影 ──
  function drawSunset(ctx, w, h, rng) {
    gradient(ctx, w, h, [[0, '#2b2a6b'], [.32, '#9b4a8f'], [.58, '#ef6f5c'], [.78, '#ffb457'], [1, '#ffe08a']]);

    var sunY = h * 0.62, sunR = Math.min(w, h) * 0.13;
    var glow = ctx.createRadialGradient(w * 0.5, sunY, sunR * 0.4, w * 0.5, sunY, sunR * 3);
    glow.addColorStop(0, 'rgba(255,235,170,.95)');
    glow.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff2c4';
    ctx.beginPath();
    ctx.arc(w * 0.5, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();

    [[0.66, '#7c3a6d', 5], [0.74, '#54295a', 7]].forEach(function (layer) {
      ctx.fillStyle = layer[1];
      ctx.beginPath();
      ctx.moveTo(0, h);
      var peaks = layer[2];
      for (var i = 0; i <= peaks; i++) {
        var x = (w * i) / peaks;
        var y = h * layer[0] - Math.abs(Math.sin(i * 1.7 + layer[0] * 9)) * h * 0.13;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    });

    ctx.fillStyle = '#3a1c4a';
    ctx.fillRect(0, h * 0.82, w, h * 0.18);
    ctx.fillStyle = 'rgba(255,220,150,.5)';
    for (var i = 0; i < 26; i++) {
      var ry = h * 0.83 + rng() * h * 0.16;
      var rw = w * (0.05 + rng() * 0.22);
      ctx.fillRect(w * 0.5 - rw / 2 + (rng() - 0.5) * w * 0.25, ry, rw, 2.5);
    }
  }

  // ── 海浪：層疊正弦曲線 ──
  function drawWaves(ctx, w, h, rng) {
    gradient(ctx, w, h, [[0, '#bff0ff'], [.35, '#6fc7f0'], [1, '#1b5e96']]);
    var colors = ['rgba(255,255,255,.35)', '#8ed6f2', '#4aa8d8', '#2b7fb8', '#1d5f92'];
    for (var layer = 0; layer < colors.length; layer++) {
      var baseY = h * (0.26 + layer * 0.16);
      var amp = h * (0.07 - layer * 0.008);
      var freq = 1.6 + layer * 0.55;
      var phase = rng() * Math.PI * 2;
      ctx.fillStyle = colors[layer];
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (var x = 0; x <= w; x += 4) {
        var t = (x / w) * Math.PI * 2 * freq + phase;
        ctx.lineTo(x, baseY + Math.sin(t) * amp + Math.sin(t * 2.3) * amp * 0.35);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,.65)';
    for (var i = 0; i < 60; i++) {
      var r = 1.5 + rng() * 3;
      ctx.beginPath();
      ctx.arc(rng() * w, h * (0.28 + rng() * 0.66), r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── 星空：星點、月亮、銀河 ──
  function drawNight(ctx, w, h, rng) {
    gradient(ctx, w, h, [[0, '#070d2e'], [.5, '#152a5e'], [1, '#2e4f86']]);

    var band = ctx.createLinearGradient(0, h * 0.2, w, h * 0.8);
    band.addColorStop(0, 'rgba(120,150,255,0)');
    band.addColorStop(0.5, 'rgba(170,190,255,.22)');
    band.addColorStop(1, 'rgba(120,150,255,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, w, h);

    for (var i = 0; i < 220; i++) {
      var x = rng() * w, y = rng() * h;
      var r = rng() * 1.9 + 0.4;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + rng() * 0.65).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // 幾顆大星星畫成十字光芒
    for (var j = 0; j < 7; j++) {
      var sx = rng() * w, sy = rng() * h * 0.8, len = 6 + rng() * 10;
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(sx - len, sy); ctx.lineTo(sx + len, sy);
      ctx.moveTo(sx, sy - len); ctx.lineTo(sx, sy + len);
      ctx.stroke();
    }

    var mx = w * 0.76, my = h * 0.2, mr = Math.min(w, h) * 0.1;
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(mx + mr * 0.42, my - mr * 0.28, mr * 0.92, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  // ── 花園：重複的花朵圖樣 ──
  function drawGarden(ctx, w, h, rng) {
    gradient(ctx, w, h, [[0, '#e9f8e2'], [1, '#bde8c8']]);
    var petals = ['#ff8fb1', '#ffc247', '#ff7f6b', '#c78cf0', '#6fd6a8', '#5aa9f5'];
    var step = Math.min(w, h) * 0.2;
    for (var y = step * 0.4; y < h + step; y += step) {
      for (var x = step * 0.4; x < w + step; x += step) {
        var cx = x + (rng() - 0.5) * step * 0.5;
        var cy = y + (rng() - 0.5) * step * 0.5;
        var r = step * (0.18 + rng() * 0.12);
        var color = petals[Math.floor(rng() * petals.length)];
        ctx.fillStyle = color;
        for (var p = 0; p < 6; p++) {
          var a = (Math.PI * 2 * p) / 6 + rng() * 0.2;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * 0.72, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#fff3c4';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ── 彩虹：斜向色帶配柔和圓點 ──
  function drawRainbow(ctx, w, h, rng) {
    var hues = [348, 20, 45, 140, 195, 260, 310];
    var diag = w + h;
    var band = diag / hues.length;
    ctx.save();
    ctx.translate(0, 0);
    for (var i = 0; i < hues.length; i++) {
      ctx.fillStyle = 'hsl(' + hues[i] + ',82%,66%)';
      ctx.beginPath();
      ctx.moveTo(i * band, 0);
      ctx.lineTo((i + 1) * band, 0);
      ctx.lineTo((i + 1) * band - h, h);
      ctx.lineTo(i * band - h, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    for (var j = 0; j < 40; j++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.12 + rng() * 0.28).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(rng() * w, rng() * h, Math.min(w, h) * (0.03 + rng() * 0.09), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── 幾何：三角形拼貼 ──
  function drawMosaic(ctx, w, h, rng) {
    var palette = ['#ff6b8b', '#ffc247', '#42c9a3', '#5aa9f5', '#b98cff', '#ff9f6b', '#2f4b7c', '#ffe6a7'];
    var cols = 8;
    var cw = w / cols;
    var rows = Math.max(4, Math.round(h / cw));
    var ch = h / rows;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var x = c * cw, y = r * ch;
        var flip = rng() < 0.5;
        var a = palette[Math.floor(rng() * palette.length)];
        var b = palette[Math.floor(rng() * palette.length)];
        ctx.fillStyle = a;
        ctx.beginPath();
        if (flip) { ctx.moveTo(x, y); ctx.lineTo(x + cw, y); ctx.lineTo(x, y + ch); }
        else { ctx.moveTo(x, y); ctx.lineTo(x + cw, y); ctx.lineTo(x + cw, y + ch); }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = b;
        ctx.beginPath();
        if (flip) { ctx.moveTo(x + cw, y); ctx.lineTo(x + cw, y + ch); ctx.lineTo(x, y + ch); }
        else { ctx.moveTo(x, y); ctx.lineTo(x + cw, y + ch); ctx.lineTo(x, y + ch); }
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  global.BD = global.BD || {};
  global.BD.Pictures = {
    LIST: PICTURES,
    count: PICTURES.length,
    nameOf: function (index) {
      return PICTURES[((index % PICTURES.length) + PICTURES.length) % PICTURES.length].name;
    },
    url: url
  };
})(typeof window !== 'undefined' ? window : globalThis);
