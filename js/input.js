/* input.js — 拖曳、旋轉、翻轉的互動處理
 * 統一走 Pointer Events，滑鼠與觸控同一套邏輯。
 * 手指按住時方塊會往上抬一點，避免被自己的手遮住。
 */
(function (global) {
  'use strict';

  var Shapes = global.BD.Shapes;
  var Board = global.BD.Board;
  var Render = global.BD.Render;

  var MOVE_THRESHOLD = 5; // 位移未超過這個距離就當作「點選」而不是「拖曳」

  var ctx = null;
  var drag = null;

  function init(context) { ctx = context; }

  function cellPx() { return ctx.getCellPx(); }

  function lift() {
    return drag && drag.pointerType === 'touch' ? cellPx() * 1.35 + 14 : 0;
  }

  /** 從方塊盤或棋盤上按下方塊 */
  function begin(ev, piece, sourceEl, fromBoard) {
    if (drag || ev.button === 2) return;
    ev.preventDefault();

    var rect = sourceEl ? sourceEl.getBoundingClientRect() : null;
    drag = {
      pointerId: ev.pointerId,
      pointerType: ev.pointerType || 'mouse',
      piece: piece,
      sourceEl: sourceEl,
      fromBoard: !!fromBoard,
      startX: ev.clientX,
      startY: ev.clientY,
      lastX: ev.clientX,
      lastY: ev.clientY,
      // 從棋盤拿起時保留原本的抓取相對位置，從方塊盤拿起則置中
      grabX: fromBoard && rect ? ev.clientX - rect.left : null,
      grabY: fromBoard && rect ? ev.clientY - rect.top : null,
      moved: false,
      layer: null
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  }

  function makeLayer() {
    var piece = drag.piece;
    var cells = Board.cellsOf(piece);
    var node = Render.pieceEl(Board.shapeOf(piece), cells, cellPx());
    node.classList.add('drag-layer');
    document.body.appendChild(node);
    drag.layer = node;

    var d = Shapes.dims(cells);
    if (drag.grabX === null) {
      drag.grabX = (d.cols * cellPx()) / 2;
      drag.grabY = (d.rows * cellPx()) / 2;
    }

    if (drag.fromBoard) {
      Board.unplace(ctx.getState(), piece);
      ctx.afterPickup(piece);
    } else if (drag.sourceEl) {
      drag.sourceEl.classList.add('is-dragging');
    }
    ctx.audio.play('pick');
  }

  function onMove(ev) {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    ev.preventDefault();
    drag.lastX = ev.clientX;
    drag.lastY = ev.clientY;

    if (!drag.moved) {
      if (Math.abs(ev.clientX - drag.startX) < MOVE_THRESHOLD &&
          Math.abs(ev.clientY - drag.startY) < MOVE_THRESHOLD) return;
      drag.moved = true;
      makeLayer();
    }
    paint();
  }

  /** 把拖曳層移到手指／游標處，並算出落點預覽 */
  function paint() {
    if (!drag || !drag.layer) return;
    var x = drag.lastX - drag.grabX;
    var y = drag.lastY - drag.grabY - lift();
    drag.layer.style.left = x + 'px';
    drag.layer.style.top = y + 'px';

    var target = anchorAt(x, y);
    if (target) {
      var cells = Board.cellsOf(drag.piece);
      var ok = Board.canPlace(ctx.getState(), drag.piece, target.r, target.c, cells);
      Render.showGhost(ctx.refs, cells, target.r, target.c, ok, cellPx());
      drag.layer.classList.toggle('is-blocked', !ok);
      drag.target = ok ? target : null;
    } else {
      Render.clearGhost(ctx.refs);
      drag.layer.classList.remove('is-blocked');
      drag.target = null;
    }
  }

  /** 把畫面座標換算成棋盤格座標 */
  function anchorAt(x, y) {
    var origin = ctx.refs.pieces.getBoundingClientRect();
    var cp = cellPx();
    var relX = x - origin.left;
    var relY = y - origin.top;
    // 離棋盤太遠就不顯示預覽
    if (relX < -cp * 1.5 || relY < -cp * 1.5) return null;
    if (relX > origin.width + cp * 1.5 || relY > origin.height + cp * 1.5) return null;
    return { r: Math.round(relY / cp), c: Math.round(relX / cp) };
  }

  function onUp(ev) {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    detach();

    if (!drag.moved) {
      // 只是點一下：選取這塊方塊，方便用旋轉／翻轉按鈕調整
      var piece = drag.piece;
      drag = null;
      ctx.onSelect(piece);
      return;
    }

    var placedOk = false;
    if (drag.target) {
      placedOk = Board.place(ctx.getState(), drag.piece, drag.target.r, drag.target.c);
    }
    finishDrag(placedOk);
  }

  function onCancel(ev) {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    detach();
    if (!drag.moved) { drag = null; return; }
    finishDrag(false);
  }

  function finishDrag(placedOk) {
    var piece = drag.piece;
    var wasFromBoard = drag.fromBoard;
    if (drag.layer) drag.layer.remove();
    if (drag.sourceEl) drag.sourceEl.classList.remove('is-dragging');
    Render.clearGhost(ctx.refs);
    var target = drag.target;
    drag = null;

    if (placedOk) {
      ctx.audio.play('place');
      ctx.afterPlace(piece, target, wasFromBoard);
    } else {
      if (!wasFromBoard) ctx.audio.play('invalid');
      ctx.afterReturn(piece, wasFromBoard);
    }
  }

  function detach() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
  }

  /** 拖曳中即時旋轉／翻轉：轉完重新置中在游標下 */
  function transformDragging(kind) {
    if (!drag || !drag.moved) return false;
    var piece = drag.piece;
    if (kind === 'flip') piece.flip = piece.flip ? 0 : 1;
    else piece.rot = (piece.rot + 1) & 3;

    var cells = Board.cellsOf(piece);
    var fresh = Render.pieceEl(Board.shapeOf(piece), cells, cellPx());
    fresh.classList.add('drag-layer');
    drag.layer.replaceWith(fresh);
    drag.layer = fresh;

    var d = Shapes.dims(cells);
    drag.grabX = (d.cols * cellPx()) / 2;
    drag.grabY = (d.rows * cellPx()) / 2;
    paint();
    return true;
  }

  function isDragging() { return !!(drag && drag.moved); }

  function cancelAll() {
    if (!drag) return;
    detach();
    if (drag.layer) drag.layer.remove();
    if (drag.sourceEl) drag.sourceEl.classList.remove('is-dragging');
    Render.clearGhost(ctx.refs);
    drag = null;
  }

  global.BD = global.BD || {};
  global.BD.Input = {
    init: init,
    begin: begin,
    transformDragging: transformDragging,
    isDragging: isDragging,
    cancelAll: cancelAll
  };
})(typeof window !== 'undefined' ? window : globalThis);
