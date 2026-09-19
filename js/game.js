/* game.js — 主流程：畫面切換、關卡選單、遊玩、結算與存檔 */
(function (global) {
  'use strict';

  var Shapes = global.BD.Shapes;
  var Levels = global.BD.Levels;
  var Board = global.BD.Board;
  var Storage = global.BD.Storage;
  var Audio = global.BD.Audio;
  var Render = global.BD.Render;
  var Input = global.BD.Input;

  var $ = function (id) { return document.getElementById(id); };

  var refs = {
    board: $('board'),
    boardWrap: $('board-wrap'),
    slots: $('board-slots'),
    pieces: $('board-pieces'),
    ghost: $('board-ghost'),
    tray: $('tray'),
    fx: $('fx'),
    modal: $('modal'),
    modalCard: $('modal-card'),
    hintLine: $('hint-line')
  };

  var state = null;
  var level = null;
  var cell = 34;
  var trayCell = 20;
  var selectedUid = null;
  var lastTheme = 'mint';

  // ── 畫面切換 ───────────────────────────────────────────────
  function show(screenId, theme) {
    ['screen-title', 'screen-levels', 'screen-play'].forEach(function (id) {
      $(id).classList.toggle('is-active', id === screenId);
    });
    if (theme) document.body.dataset.theme = theme;
  }

  function worldOf(lv) {
    return Levels.WORLDS.filter(function (w) { return w.id === lv.world; })[0];
  }

  function themeOf(lv) {
    if (lv.theme) return lv.theme;
    var w = worldOf(lv);
    return w ? w.theme : 'mint';
  }

  // ── 每日挑戰 ───────────────────────────────────────────────
  function buildDailyCard() {
    var today = Levels.dateKey();
    var rec = Storage.dailyRecord(today);
    var streak = Storage.dailyStreak();
    var card = $('daily-card');

    card.innerHTML = [
      '<span class="daily-card__tag">每日挑戰</span>',
      '<b class="daily-card__date">' + today + '</b>',
      '<span class="daily-card__state">',
      rec.cleared
        ? '今天已完成 ' + Render.starsHtml(rec.stars) + ' <em>' + rec.best + '%</em>'
        : '今天還沒挑戰，點我開始',
      '</span>',
      streak > 0 ? '<span class="daily-card__streak">🔥 連續 ' + streak + ' 天</span>' : ''
    ].join('');
  }

  function startDaily() {
    startLevel(Levels.daily());
  }

  // ── 標題頁 ─────────────────────────────────────────────────
  function refreshTitle() {
    var total = Storage.totalStars();
    var max = Levels.LIST.length * 3;
    var streak = Storage.dailyStreak();
    $('title-progress').textContent = (total > 0
      ? '已收集 ' + total + ' / ' + max + ' 顆星星'
      : '五個世界，三十道關卡')
      + (streak > 0 ? '　🔥 每日挑戰連續 ' + streak + ' 天' : '');
  }

  // ── 關卡選單 ───────────────────────────────────────────────
  function buildLevelSelect() {
    var host = $('world-list');
    host.textContent = '';
    $('star-total').textContent = '★ ' + Storage.totalStars();
    buildDailyCard();

    Levels.WORLDS.forEach(function (world) {
      var box = Render.el('div', 'world');
      box.style.setProperty('--w-color', themeColor(world.theme));

      var head = Render.el('div', 'world__head');
      var no = Render.el('span', 'world__no');
      no.textContent = '世界 ' + world.id;
      var name = Render.el('h3', 'world__name');
      name.textContent = world.name;
      head.appendChild(no);
      head.appendChild(name);

      var desc = Render.el('p', 'world__desc');
      desc.textContent = world.desc;

      var grid = Render.el('div', 'level-grid');
      Levels.inWorld(world.id).forEach(function (lv) {
        grid.appendChild(levelCard(lv));
      });

      box.appendChild(head);
      box.appendChild(desc);
      box.appendChild(grid);
      host.appendChild(box);
    });
  }

  function themeColor(theme) {
    return ({
      mint: '#10a37f', sky: '#2b7fd4', peach: '#e8632f',
      grape: '#7b4bd8', rainbow: '#e0409a'
    })[theme] || '#10a37f';
  }

  function levelCard(lv) {
    var rec = Storage.recordOf(lv.id);
    var unlocked = Storage.isUnlocked(lv.id, Levels.LIST);
    var card = Render.el('button', 'level-card');
    card.disabled = !unlocked;

    var id = Render.el('span', 'level-card__id');
    id.textContent = unlocked ? lv.id : '🔒 ' + lv.id;
    var name = Render.el('b', 'level-card__name');
    name.textContent = lv.name;

    var stars = Render.el('div', 'level-card__stars');
    stars.innerHTML = Render.starsHtml(rec.stars);
    if (rec.best > 0) {
      var best = Render.el('span', 'level-card__best');
      best.textContent = rec.best + '%';
      stars.appendChild(best);
    }

    var mode = Render.el('span', 'level-card__mode');
    mode.textContent = lv.mode === 'exact' ? '精準拼合' : '填滿計分';

    card.appendChild(id);
    card.appendChild(name);
    card.appendChild(stars);
    card.appendChild(mode);
    card.addEventListener('click', function () { startLevel(lv); });
    return card;
  }

  // ── 開始一關 ───────────────────────────────────────────────
  function startLevel(lv) {
    level = lv;
    try {
      state = Board.createGame(lv);
    } catch (err) {
      alert('這一關生成失敗了：' + err.message);
      return;
    }
    selectedUid = null;
    lastTheme = themeOf(lv);

    $('play-name').textContent = lv.name;
    $('play-id').textContent = lv.isDaily ? lv.dateKey : '世界 ' + lv.world + '．關卡 ' + lv.id;
    show('screen-play', lastTheme);

    buildGoal();
    layout();
    refreshAll();
    setHint(lv.tip || (lv.mode === 'exact'
      ? '用完所有方塊、把畫框完全填滿就過關。'
      : '方塊不見得剛好——填得越滿，星星越多。'));
  }

  function buildGoal() {
    var marks = $('meter-marks');
    marks.textContent = '';
    if (level.mode === 'exact') {
      $('stat-goal').textContent = '目標：完全填滿';
    } else {
      var t = level.stars || [70, 85, 95];
      $('stat-goal').textContent = '星等門檻 ' + t[0] + ' / ' + t[1] + ' / ' + t[2] + '%';
      t.forEach(function (v) {
        var i = Render.el('i');
        i.style.left = v + '%';
        marks.appendChild(i);
      });
    }
  }

  // ── 版面計算 ───────────────────────────────────────────────
  function layout() {
    if (!state) return;
    var wrap = refs.boardWrap.getBoundingClientRect();
    var byW = (wrap.width - 20) / state.cols;
    var byH = (wrap.height - 20) / state.rows;
    cell = Math.max(14, Math.min(78, Math.floor(Math.min(byW, byH))));
    Render.buildBoard(refs, state, cell);
    Render.syncPlaced(refs, state, cell);
    bindPlacedPieces();
    fitTray();
  }

  /** 找出能讓所有剩餘方塊一次排進方塊盤的最大格子尺寸，避免使用者還要捲動 */
  function fitTray() {
    var rest = Board.remaining(state);
    var innerW = refs.tray.clientWidth - 22;
    var innerH = refs.tray.clientHeight - 22;
    if (!rest.length || innerW <= 0 || innerH <= 0) { trayCell = 18; return renderTray(); }

    var sizes = rest.map(function (p) { return Shapes.dims(Board.cellsOf(p)); });

    function packedHeight(tc) {
      var x = 0, rowH = 0, total = 0;
      for (var i = 0; i < sizes.length; i++) {
        var w = sizes[i].cols * tc + 16;
        var h = sizes[i].rows * tc + 16;
        if (w > innerW) return Infinity;
        if (x > 0 && x + 10 + w > innerW) { total += rowH + 10; x = w; rowH = h; }
        else { x += (x > 0 ? 10 : 0) + w; rowH = Math.max(rowH, h); }
      }
      return total + rowH;
    }

    trayCell = 12;
    for (var tc = 40; tc >= 12; tc--) {
      if (packedHeight(tc) <= innerH) { trayCell = tc; break; }
    }
    renderTray();
  }

  function renderTray() {
    Render.buildTray(refs, state, trayCell, function (ev, piece, slotEl) {
      Input.begin(ev, piece, slotEl, false);
    }, selectedUid);
  }

  function bindPlacedPieces() {
    Array.prototype.forEach.call(refs.pieces.children, function (node) {
      var uid = Number(node.dataset.uid);
      var piece = state.pieces.filter(function (p) { return p.uid === uid; })[0];
      if (!piece) return;
      node.classList.toggle('is-selected', uid === selectedUid);
      node.addEventListener('pointerdown', function (ev) {
        Input.begin(ev, piece, node, true);
      });
    });
  }

  // ── 狀態更新 ───────────────────────────────────────────────
  function refreshAll() {
    Render.syncPlaced(refs, state, cell);
    bindPlacedPieces();
    fitTray();
    refreshStats();
  }

  function refreshStats() {
    var rate = Board.fillRate(state);
    var pct = Math.round(rate * 1000) / 10;
    $('meter-fill').style.width = (rate * 100) + '%';
    $('stat-fill').textContent = (Number.isInteger(pct) ? pct : pct.toFixed(1)) + '%';
    $('stat-left').textContent = '剩 ' + Board.remaining(state).length + ' 塊';

    $('btn-undo').disabled = state.history.length === 0;
    $('btn-hint').disabled = Board.remaining(state).length === 0;
    $('btn-finish').disabled = level.mode === 'exact' && !Board.isComplete(state);
  }

  function setHint(text) { refs.hintLine.textContent = text || ''; }

  // ── 拖曳回呼 ───────────────────────────────────────────────
  var handlers = {
    refs: refs,
    audio: Audio,
    getState: function () { return state; },
    getCellPx: function () { return cell; },

    onSelect: function (piece) { tapPiece(piece); },

    afterPickup: function (piece) {
      state.history.push({ type: 'pickup', uid: piece.uid, r: piece.r, c: piece.c, rot: piece.rot, flip: piece.flip });
      refreshAll();
    },

    afterPlace: function (piece, target, wasFromBoard) {
      var last = state.history[state.history.length - 1];
      if (wasFromBoard && last && last.type === 'pickup' && last.uid === piece.uid) {
        state.history.pop();
        state.history.push({ type: 'move', uid: piece.uid, r: last.r, c: last.c, rot: last.rot, flip: last.flip });
      } else {
        state.history.push({ type: 'place', uid: piece.uid });
      }
      selectedUid = null;
      refreshAll();
      checkProgress();
    },

    afterReturn: function (piece, wasFromBoard) {
      selectedUid = piece.uid;
      refreshAll();
      if (!wasFromBoard) setHint('那裡放不下，換個位置或轉個方向試試。');
    }
  };

  // ── 過關判定 ───────────────────────────────────────────────
  function checkProgress() {
    if (Board.isComplete(state)) { finish(); return; }
    if (level.mode === 'score' && !Board.hasAnyMove(state)) {
      setHint('沒有方塊放得下了，來看看成績吧。');
      finish();
      return;
    }
    if (level.mode === 'exact' && !Board.hasAnyMove(state)) {
      setHint('卡住了！用「復原」退回幾步，或按「重來」重新開始。');
    } else {
      setHint('');
    }
  }

  function finish() {
    var result = Board.evaluate(state);
    var saved = Storage.save(level.id, result);
    if (result.cleared) {
      Audio.play('win');
      var rect = refs.board.getBoundingClientRect();
      Render.confetti(refs.fx, rect.left + rect.width / 2, rect.top + rect.height / 2);
    } else {
      Audio.play('fail');
    }
    setTimeout(function () { showResult(result, saved); }, 260);
  }

  // ── 彈窗 ───────────────────────────────────────────────────
  function openModal(html, wire) {
    refs.modalCard.innerHTML = html;
    refs.modal.classList.add('is-open');
    if (wire) wire(refs.modalCard);
  }

  function closeModal() { refs.modal.classList.remove('is-open'); }

  function showResult(result, saved) {
    var pct = Math.round(result.rate * 1000) / 10;
    var next = Levels.next(level.id);
    var title = result.cleared
      ? (result.stars === 3 ? '完美！' : '過關！')
      : '再挑戰一次';

    var lines = [];
    lines.push('<h3>' + title + '</h3>');
    lines.push('<div class="modal__stars">' + Render.starsHtml(result.stars) + '</div>');
    lines.push('<div class="modal__rate">' + pct + '%</div>');
    if (level.mode === 'exact') {
      lines.push('<p>' + (result.cleared
        ? '使用提示 ' + state.hintsUsed + ' 次。不用提示就能拼完可拿三顆星。'
        : '這一關要完全填滿才算過關。') + '</p>');
    } else {
      var t = level.stars || [70, 85, 95];
      lines.push('<p>星等門檻：' + t[0] + '% / ' + t[1] + '% / ' + t[2] + '%'
        + (state.hintsUsed ? '<br>使用提示 ' + state.hintsUsed + ' 次（星等會扣減）' : '') + '</p>');
    }
    lines.push('<p>' + (level.isDaily ? '今日最佳紀錄' : '本關最佳紀錄') + '：' + saved.best + '%　★ ' + saved.stars + '</p>');
    if (level.isDaily) {
      var streak = Storage.dailyStreak();
      lines.push('<p>' + (streak > 0
        ? '🔥 已經連續挑戰 ' + streak + ' 天，明天會換一題新的。'
        : '明天會換一題新的，記得回來。') + '</p>');
    }

    lines.push('<div class="modal__actions">');
    lines.push('<button class="btn" data-act="retry">再玩一次</button>');
    lines.push('<button class="btn" data-act="levels">關卡選單</button>');
    if (result.cleared && next && !level.isDaily) {
      lines.push('<button class="btn btn--primary" data-act="next">下一關</button>');
    }
    lines.push('</div>');

    openModal(lines.join(''), function (card) {
      card.querySelector('[data-act="retry"]').addEventListener('click', function () {
        closeModal();
        startLevel(level.isDaily ? Levels.daily() : level);
      });
      card.querySelector('[data-act="levels"]').addEventListener('click', function () {
        closeModal(); buildLevelSelect(); show('screen-levels', lastTheme);
      });
      var nextBtn = card.querySelector('[data-act="next"]');
      if (nextBtn) nextBtn.addEventListener('click', function () { closeModal(); startLevel(next); });
    });
  }

  function showHowTo() {
    openModal([
      '<h3>怎麼玩</h3>',
      '<ul>',
      '<li><b>拖曳</b>方塊到畫框裡，會自動吸附到格線上。</li>',
      '<li>放下前會出現<b>落點預覽</b>：綠色代表可以放，紅色代表卡到東西。</li>',
      '<li>點一下方塊<b>選取</b>，<b>再點一下就轉 90°</b>，連續點就一直轉；也可以按「旋轉」「翻轉」按鈕。</li>',
      '<li>已經放進畫框的方塊同樣可以點著轉——除非旁邊空間不夠，那就得先把它拖開。</li>',
      '<li>放錯了可以把方塊<b>從畫框裡拖回來</b>，或按「復原」。</li>',
      '<li><b>精準拼合</b>關卡必須完全填滿；<b>填滿計分</b>關卡則是填越滿星星越多。</li>',
      '<li><b>每日挑戰</b>每天換一題，題目由當天日期決定，全世界同一題；連續挑戰會累積天數。</li>',
      '<li>電腦鍵盤：<b>R</b> 旋轉、<b>F</b> 翻轉、<b>Ctrl+Z</b> 復原。</li>',
      '</ul>',
      '<div class="modal__actions"><button class="btn btn--primary" data-act="ok">知道了</button></div>'
    ].join(''), function (card) {
      card.querySelector('[data-act="ok"]').addEventListener('click', closeModal);
    });
  }

  function confirmReset() {
    openModal([
      '<h3>清除進度</h3>',
      '<p>所有關卡的星星與最佳紀錄都會被刪除，而且無法復原。確定嗎？</p>',
      '<div class="modal__actions">',
      '<button class="btn" data-act="cancel">取消</button>',
      '<button class="btn btn--primary" data-act="yes">確定清除</button>',
      '</div>'
    ].join(''), function (card) {
      card.querySelector('[data-act="cancel"]').addEventListener('click', closeModal);
      card.querySelector('[data-act="yes"]').addEventListener('click', function () {
        Storage.clearAll();
        closeModal();
        buildLevelSelect();
        refreshTitle();
      });
    });
  }

  // ── 工具列動作 ─────────────────────────────────────────────
  function pieceByUid(uid) {
    for (var i = 0; i < state.pieces.length; i++) {
      if (state.pieces[i].uid === uid) return state.pieces[i];
    }
    return null;
  }

  function paintSelection() {
    renderTray();
    Array.prototype.forEach.call(refs.pieces.children, function (node) {
      node.classList.toggle('is-selected', Number(node.dataset.uid) === selectedUid);
    });
  }

  /** 點一下方塊：第一下選取，之後每點一下就轉 90° */
  function tapPiece(piece) {
    if (selectedUid === piece.uid) { transformPiece(piece, 'rotate'); return; }
    selectedUid = piece.uid;
    paintSelection();
    setHint(piece.placed
      ? '已選取畫框上的方塊，再點一下就原地旋轉 90°。'
      : '已選取方塊，再點一下就旋轉 90°。');
  }

  /** 旋轉／翻轉一塊方塊。已放上畫框的就原地轉，轉不動時維持原樣並說明原因。 */
  function transformPiece(piece, kind) {
    var before = Shapes.cellsKey(Board.cellsOf(piece));
    var ok = piece.placed ? transformPlaced(piece, kind) : transformInTray(piece, kind);
    if (ok && Shapes.cellsKey(Board.cellsOf(piece)) === before) {
      setHint('這塊方塊每個方向都長得一樣，轉了看不出差別。');
    }
    return ok;
  }

  function transformInTray(piece, kind) {
    if (kind === 'flip') piece.flip = piece.flip ? 0 : 1;
    else piece.rot = (piece.rot + 1) & 3;
    Audio.play('pick');
    fitTray();
    paintSelection();
    setHint('');
    return true;
  }

  /**
   * 原地旋轉／翻轉畫框上的方塊。
   * 以方塊自己的中心為軸轉；轉完若壓到別的方塊，就往外找兩格內的空位挪一下，
   * 真的塞不下就轉不動，維持原狀並提示玩家先把它拖走。
   */
  function transformPlaced(piece, kind) {
    var from = { r: piece.r, c: piece.c, rot: piece.rot, flip: piece.flip };
    var d = Shapes.dims(Board.cellsOf(piece));
    var centerR = piece.r + d.rows / 2;
    var centerC = piece.c + d.cols / 2;

    Board.unplace(state, piece);
    if (kind === 'flip') piece.flip = piece.flip ? 0 : 1;
    else piece.rot = (piece.rot + 1) & 3;

    var nd = Shapes.dims(Board.cellsOf(piece));
    var baseR = Math.round(centerR - nd.rows / 2);
    var baseC = Math.round(centerC - nd.cols / 2);

    var spot = null;
    for (var radius = 0; radius <= 2 && !spot; radius++) {
      for (var dr = -radius; dr <= radius && !spot; dr++) {
        for (var dc = -radius; dc <= radius && !spot; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
          if (Board.canPlace(state, piece, baseR + dr, baseC + dc)) {
            spot = { r: baseR + dr, c: baseC + dc };
          }
        }
      }
    }

    if (!spot) {
      piece.rot = from.rot;
      piece.flip = from.flip;
      Board.place(state, piece, from.r, from.c);
      Audio.play('invalid');
      setHint('旁邊沒空間，這塊在這裡轉不動——先把它拖到別的地方吧。');
      return false;
    }

    Board.place(state, piece, spot.r, spot.c);
    state.history.push({ type: 'move', uid: piece.uid, r: from.r, c: from.c, rot: from.rot, flip: from.flip });
    Audio.play('pick');
    refreshAll();
    setHint('');
    return true;
  }

  function transformSelected(kind) {
    if (Input.transformDragging(kind)) return;
    if (!selectedUid) { setHint('先點一下方塊選取，再按旋轉或翻轉。'); return; }
    var piece = pieceByUid(selectedUid);
    if (piece) transformPiece(piece, kind);
  }

  function undo() {
    var entry = state.history.pop();
    if (!entry) return;
    var piece = state.pieces.filter(function (p) { return p.uid === entry.uid; })[0];
    if (!piece) return;

    if (entry.type === 'place') {
      Board.unplace(state, piece);
    } else if (entry.type === 'pickup' || entry.type === 'move') {
      if (piece.placed) Board.unplace(state, piece);
      piece.rot = entry.rot;
      piece.flip = entry.flip;
      Board.place(state, piece, entry.r, entry.c);
    }
    Audio.play('undo');
    selectedUid = null;
    refreshAll();
    setHint('');
  }

  function useHint() {
    var hint = Board.findHint(state);
    if (!hint) { setHint('這裡已經沒有方塊放得下了。'); return; }
    var piece = hint.piece;
    piece.rot = hint.rot;
    piece.flip = hint.flip;
    if (!Board.place(state, piece, hint.r, hint.c)) { setHint('提示失效了，再試一次。'); return; }

    state.hintsUsed++;
    state.history.push({ type: 'place', uid: piece.uid });
    Audio.play('hint');
    selectedUid = null;
    refreshAll();
    setHint('提示幫你放了一塊（會影響星等）。');

    var node = refs.pieces.querySelector('[data-uid="' + piece.uid + '"]');
    if (node) node.classList.add('is-hinted');
    checkProgress();
  }

  function restart() {
    if (!level) return;
    startLevel(level.isDaily ? Levels.daily() : level);
  }

  // ── 事件綁定 ───────────────────────────────────────────────
  function bind() {
    $('btn-start').addEventListener('click', function () {
      buildLevelSelect();
      show('screen-levels', lastTheme);
    });
    $('btn-daily').addEventListener('click', startDaily);
    $('daily-card').addEventListener('click', startDaily);
    $('btn-howto').addEventListener('click', showHowTo);
    $('btn-levels-back').addEventListener('click', function () {
      refreshTitle();
      show('screen-title', 'mint');
    });
    $('btn-reset-progress').addEventListener('click', confirmReset);
    $('btn-play-back').addEventListener('click', function () {
      Input.cancelAll();
      buildLevelSelect();
      show('screen-levels', lastTheme);
    });

    $('btn-rotate').addEventListener('click', function () { transformSelected('rotate'); });
    $('btn-flip').addEventListener('click', function () { transformSelected('flip'); });
    $('btn-undo').addEventListener('click', undo);
    $('btn-hint').addEventListener('click', useHint);
    $('btn-restart').addEventListener('click', restart);
    $('btn-finish').addEventListener('click', finish);

    var soundBtn = $('btn-sound');
    function paintSound() {
      var on = Audio.isEnabled();
      soundBtn.textContent = on ? '🔊' : '🔇';
      soundBtn.setAttribute('aria-label', on ? '關閉音效' : '開啟音效');
    }
    Audio.setEnabled(Storage.getPref('sound') !== false);
    paintSound();
    soundBtn.addEventListener('click', function () {
      Audio.setEnabled(!Audio.isEnabled());
      Storage.setPref('sound', Audio.isEnabled());
      paintSound();
      Audio.play('pick');
    });

    refs.modal.addEventListener('click', function (ev) {
      if (ev.target === refs.modal) closeModal();
    });

    window.addEventListener('keydown', function (ev) {
      if (!$('screen-play').classList.contains('is-active')) {
        if (ev.key === 'Escape') closeModal();
        return;
      }
      var k = ev.key.toLowerCase();
      if (k === 'r') { ev.preventDefault(); transformSelected('rotate'); }
      else if (k === 'f') { ev.preventDefault(); transformSelected('flip'); }
      else if (k === 'z' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); undo(); }
      else if (ev.key === 'Escape') { Input.cancelAll(); closeModal(); }
    });

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if ($('screen-play').classList.contains('is-active')) layout();
      }, 120);
    });

    // 避免拖曳時觸發瀏覽器的長按選單／文字選取
    document.addEventListener('contextmenu', function (ev) {
      if (ev.target.closest('.tray-slot, .board, .drag-layer')) ev.preventDefault();
    });
    document.addEventListener('dragstart', function (ev) { ev.preventDefault(); });
  }

  // ── 啟動 ───────────────────────────────────────────────────
  Input.init(handlers);
  bind();
  refreshTitle();
})(typeof window !== 'undefined' ? window : globalThis);
