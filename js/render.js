/* render.js — 把遊戲狀態畫成 DOM
 * 棋盤用 CSS Grid 排出格子，方塊則是絕對定位的小方格集合，
 * 這樣拖曳、放置動畫與提示閃爍都能直接套 CSS。
 */
(function (global) {
  'use strict';

  var Shapes = global.BD.Shapes;
  var Board = global.BD.Board;

  var GAP = 2; // 方格之間留白，讓積木看起來是一顆顆的

  function el(tag, cls) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    return node;
  }

  /**
   * 建出一塊方塊的 DOM（不含定位，由呼叫端決定放哪）。
   * 給了 skin 就是圖片拼圖：方塊從在方塊盤裡就帶著自己正確位置的那片圖，
   * 靠紋路接不接得起來判斷位置。沒給就是原本的彩色方塊。
   */
  function pieceEl(shape, cells, cellPx, skin) {
    if (skin && skin.home) return jigsawPieceEl(shape, cellPx, skin);

    var d = Shapes.dims(cells);
    var color = Shapes.colorOf(shape);
    var node = el('div', 'piece');
    node.style.width = d.cols * cellPx + 'px';
    node.style.height = d.rows * cellPx + 'px';
    node.style.setProperty('--c-base', color.base);
    node.style.setProperty('--c-light', color.light);
    node.style.setProperty('--c-dark', color.dark);

    for (var i = 0; i < cells.length; i++) {
      var box = el('div', 'cellbox');
      box.style.left = cells[i][1] * cellPx + GAP / 2 + 'px';
      box.style.top = cells[i][0] * cellPx + GAP / 2 + 'px';
      box.style.width = cellPx - GAP + 'px';
      box.style.height = cellPx - GAP + 'px';
      node.appendChild(box);
    }
    return node;
  }

  /** 把整張圖裡對應這一格的那一小塊貼上去 */
  function paintSlice(box, skin, r, c, cellPx) {
    box.classList.add('cellbox--pic');
    box.style.backgroundImage = 'url(' + skin.url + ')';
    // 縮放與定位必須用同一個格子大小。方塊盤的格子比棋盤小，
    // 若沿用棋盤的像素尺寸，每一塊都會顯示到圖片左上角的同一小塊。
    box.style.backgroundSize = (skin.cols * cellPx) + 'px ' + (skin.rows * cellPx) + 'px';
    box.style.backgroundRepeat = 'no-repeat';
    box.style.backgroundPosition =
      (-(c * cellPx + GAP / 2)) + 'px ' + (-(r * cellPx + GAP / 2)) + 'px';
  }

  /**
   * 圖片拼圖的一塊。
   * 先照「正確位置」的姿態把圖貼好，再用一次 CSS transform 把整塊轉到玩家
   * 目前的方向——圖案自然跟著轉，不必逐格去算旋轉後該對到哪一片。
   */
  function jigsawPieceEl(shape, cellPx, skin) {
    var home = skin.home;
    var homeCells = Shapes.transform(shape.cells, home.rot, home.flip);
    var hd = Shapes.dims(homeCells);
    var cd = Shapes.dims(Shapes.transform(shape.cells, skin.rot, skin.flip));

    var inner = el('div', 'piece-pic');
    inner.style.width = hd.cols * cellPx + 'px';
    inner.style.height = hd.rows * cellPx + 'px';
    for (var i = 0; i < homeCells.length; i++) {
      var box = el('div', 'cellbox');
      box.style.left = homeCells[i][1] * cellPx + GAP / 2 + 'px';
      box.style.top = homeCells[i][0] * cellPx + GAP / 2 + 'px';
      box.style.width = cellPx - GAP + 'px';
      box.style.height = cellPx - GAP + 'px';
      paintSlice(box, skin, home.r + homeCells[i][0], home.c + homeCells[i][1], cellPx);
      inner.appendChild(box);
    }

    // 從正確姿態轉到目前姿態所需的相對變換。
    // 姿態是「先鏡像再轉」的組合，翻轉狀態一樣時只差旋轉；不一樣時
    // 鏡像會把旋轉方向反過來，所以角度變成兩者相加。
    var delta = (skin.flip === home.flip)
      ? { rot: (skin.rot - home.rot + 4) & 3, flip: 0 }
      : { rot: (skin.rot + home.rot) & 3, flip: 1 };
    inner.style.transform = 'translate(-50%, -50%) rotate(' + (delta.rot * 90) + 'deg)' +
      (delta.flip ? ' scaleX(-1)' : '');

    var wrap = el('div', 'piece');
    wrap.style.width = cd.cols * cellPx + 'px';
    wrap.style.height = cd.rows * cellPx + 'px';
    wrap.appendChild(inner);
    return wrap;
  }

  /** 畫出棋盤底層格子 */
  function buildBoard(refs, state, cellPx) {
    var slots = refs.slots;
    slots.textContent = '';
    slots.style.gridTemplateColumns = 'repeat(' + state.cols + ', ' + cellPx + 'px)';
    slots.style.gridTemplateRows = 'repeat(' + state.rows + ', ' + cellPx + 'px)';

    for (var r = 0; r < state.rows; r++) {
      for (var c = 0; c < state.cols; c++) {
        var slot = el('div', 'slot');
        if (state.cells[r * state.cols + c] === Board.VOID) slot.classList.add('is-void');
        slots.appendChild(slot);
      }
    }
    refs.board.style.width = state.cols * cellPx + 16 + 'px';
    refs.board.style.height = state.rows * cellPx + 16 + 'px';
    refs.pieces.style.width = state.cols * cellPx + 'px';
    refs.pieces.style.height = state.rows * cellPx + 'px';
  }

  /** 依狀態重畫所有「已放上棋盤」的方塊 */
  function syncPlaced(refs, state, cellPx, skinFor) {
    refs.pieces.textContent = '';
    state.pieces.forEach(function (piece) {
      if (!piece.placed) return;
      var cells = Board.cellsOf(piece);
      var node = pieceEl(Board.shapeOf(piece), cells, cellPx, skinFor && skinFor(piece));
      node.style.left = piece.c * cellPx + 'px';
      node.style.top = piece.r * cellPx + 'px';
      node.dataset.uid = piece.uid;
      refs.pieces.appendChild(node);
    });
  }

  /** 拖曳時的落點預覽 */
  function showGhost(refs, cells, r, c, valid, cellPx) {
    refs.ghost.textContent = '';
    refs.ghost.style.width = refs.pieces.style.width;
    refs.ghost.style.height = refs.pieces.style.height;
    for (var i = 0; i < cells.length; i++) {
      var g = el('div', 'ghost-cell ' + (valid ? 'ok' : 'no'));
      g.style.left = (c + cells[i][1]) * cellPx + GAP / 2 + 'px';
      g.style.top = (r + cells[i][0]) * cellPx + GAP / 2 + 'px';
      g.style.width = cellPx - GAP + 'px';
      g.style.height = cellPx - GAP + 'px';
      refs.ghost.appendChild(g);
    }
  }

  function clearGhost(refs) { refs.ghost.textContent = ''; }

  /** 方塊盤 */
  function buildTray(refs, state, trayCell, onPointerDown, selectedUid, skinFor) {
    var tray = refs.tray;
    tray.textContent = '';
    var rest = Board.remaining(state);

    if (!rest.length) {
      var note = el('div', 'tray-empty');
      note.textContent = '方塊都放完了';
      tray.appendChild(note);
      return;
    }

    rest.forEach(function (piece) {
      var cells = Board.cellsOf(piece);
      var slot = el('div', 'tray-slot');
      slot.dataset.uid = piece.uid;
      if (piece.uid === selectedUid) slot.classList.add('is-selected');
      slot.appendChild(pieceEl(Board.shapeOf(piece), cells, trayCell, skinFor && skinFor(piece)));
      slot.addEventListener('pointerdown', function (ev) { onPointerDown(ev, piece, slot); });
      tray.appendChild(slot);
    });
  }

  /** 星星字串，用於關卡卡片與結算畫面 */
  function starsHtml(n, total) {
    total = total || 3;
    var out = '';
    for (var i = 0; i < total; i++) {
      out += i < n ? '<i>★</i>' : '<i class="off">★</i>';
    }
    return out;
  }

  /** 慶祝彩帶 */
  function confetti(host, originX, originY, count) {
    count = count || 46;
    var palette = ['#ff6b8b', '#ffc247', '#42c9a3', '#5aa9f5', '#b98cff', '#ff9f6b'];
    for (var i = 0; i < count; i++) {
      var bit = el('i');
      var angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      var dist = 90 + Math.random() * 230;
      bit.style.left = originX + 'px';
      bit.style.top = originY + 'px';
      bit.style.background = palette[i % palette.length];
      bit.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      bit.style.setProperty('--dy', Math.sin(angle) * dist + 180 + 'px');
      bit.style.setProperty('--rot', Math.round(Math.random() * 900 - 450) + 'deg');
      bit.style.animationDelay = (Math.random() * 0.18).toFixed(2) + 's';
      host.appendChild(bit);
      setTimeout(function (node) { return function () { node.remove(); }; }(bit), 1900);
    }
  }

  global.BD = global.BD || {};
  global.BD.Render = {
    GAP: GAP,
    el: el,
    pieceEl: pieceEl,
    paintSlice: paintSlice,
    buildBoard: buildBoard,
    syncPlaced: syncPlaced,
    showGhost: showGhost,
    clearGhost: clearGhost,
    buildTray: buildTray,
    starsHtml: starsHtml,
    confetti: confetti
  };
})(typeof window !== 'undefined' ? window : globalThis);
