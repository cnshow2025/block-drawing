/* game.js — 主流程：畫面切換、關卡選單、遊玩、結算與存檔 */
(function (global) {
  'use strict';

  var Shapes = global.BD.Shapes;
  var Levels = global.BD.Levels;
  var Pictures = global.BD.Pictures;
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
    ['screen-title', 'screen-levels', 'screen-stats', 'screen-play'].forEach(function (id) {
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
  function esc(text) {
    return String(text).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  /** 從頭找出第一關還沒過的關卡；全破了就回 null */
  function nextUnclearedLevel() {
    for (var i = 0; i < Levels.LIST.length; i++) {
      if (!Storage.recordOf(Levels.LIST[i].id).cleared) return Levels.LIST[i];
    }
    return null;
  }

  function refreshTitle() {
    var total = Storage.totalStars();
    var max = Levels.LIST.length * 3;
    var streak = Storage.dailyStreak();
    var name = Storage.getName();
    var pending = nextUnclearedLevel();
    var started = pending !== Levels.LIST[0];

    $('title-greeting').textContent = name ? '哈囉，' + name + ' 👋' : '';
    $('btn-continue').hidden = !started;
    $('btn-start').hidden = started;
    $('btn-continue').textContent = pending
      ? '繼續遊戲　' + pending.id
      : '繼續遊戲';

    $('title-progress').textContent = (total > 0
      ? '已收集 ' + total + ' / ' + max + ' 顆星星'
      : '五個世界，三十道關卡')
      + (streak > 0 ? '　🔥 每日挑戰連續 ' + streak + ' 天' : '');
  }

  /** 接著上次打——直接跳到第一關還沒過的關卡 */
  function continueGame() {
    var lv = nextUnclearedLevel();
    if (lv) { startLevel(lv); return; }
    buildLevelSelect();
    show('screen-levels', lastTheme);
    openModal([
      '<h3>全破了！</h3>',
      '<p>三十道關卡都通關了。回關卡選單挑一關重打，把還沒拿到的星星補齊吧。</p>',
      '<div class="modal__actions"><button class="btn btn--primary" data-act="ok">好</button></div>'
    ].join(''), function (card) {
      card.querySelector('[data-act="ok"]').addEventListener('click', closeModal);
    });
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
      var next = nextUnclearedLevel();
      Levels.inWorld(world.id).forEach(function (lv) {
        grid.appendChild(levelCard(lv, next && next.id === lv.id));
      });

      box.appendChild(head);
      box.appendChild(desc);
      box.appendChild(grid);
      host.appendChild(box);
    });
  }

  /** 這一關用的是幾格的方塊——全部關卡都要填滿之後，這才是難度的主要來源 */
  function poolLabel(lv) {
    var sizes = [];
    lv.pool.forEach(function (id) {
      var size = Shapes.get(id).size;
      if (sizes.indexOf(size) < 0) sizes.push(size);
    });
    sizes.sort(function (a, b) { return a - b; });
    return sizes.join('＋') + ' 格';
  }

  function themeColor(theme) {
    return ({
      mint: '#10a37f', sky: '#2b7fd4', peach: '#e8632f',
      grape: '#7b4bd8', rainbow: '#e0409a'
    })[theme] || '#10a37f';
  }

  // 所有關卡隨時都能直接點進去玩；「接著打」只是提示進度到哪，不是限制
  function levelCard(lv, isNext) {
    var rec = Storage.recordOf(lv.id);
    var card = Render.el('button', 'level-card');
    if (rec.cleared) card.classList.add('is-cleared');
    if (isNext) card.classList.add('is-next');

    var id = Render.el('span', 'level-card__id');
    id.textContent = lv.id;
    if (isNext) {
      var badge = Render.el('span', 'level-card__badge');
      badge.textContent = '接著打';
      id.appendChild(badge);
    }
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
    mode.textContent = poolLabel(lv);

    card.appendChild(id);
    card.appendChild(name);
    card.appendChild(stars);
    card.appendChild(mode);
    card.addEventListener('click', function () { startLevel(lv); });
    return card;
  }

  // ── 開始一關 ───────────────────────────────────────────────
  function startLevel(lv) {
    // 若還有拖曳沒結束（例如按了「重來」），先收乾淨再換關，
    // 免得殘留的拖曳指向上一局的方塊。
    Input.cancelAll();
    level = lv;
    try {
      state = Board.createGame(lv);
    } catch (err) {
      alert('這一關生成失敗了：' + err.message);
      return;
    }
    selectedUid = null;
    lastTheme = themeOf(lv);
    state.picture = {
      on: pictureAllowed(lv) && pictureWanted() && state.pieces.some(function (p) { return p.home; }),
      index: Storage.getPref('pictureIndex') || 0
    };

    $('play-name').textContent = lv.name;
    $('play-id').textContent = lv.isDaily ? lv.dateKey : '世界 ' + lv.world + '．關卡 ' + lv.id;
    show('screen-play', lastTheme);

    buildGoal();
    refreshPictureButton();
    layout();
    refreshAll();
    setHint(lv.tip || (lv.mode === 'exact'
      ? '方塊不多不少，用完全部、剛好填滿畫框就過關。'
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

  // ── 圖片拼圖 ───────────────────────────────────────────────
  // 精準拼合的關卡才開放：方塊盤就是切割結果本身，每一塊都查得到自己的
  // 「正確位置」，才有圖可帶。三十關主線全是精準拼合，所以每一關都能切換；
  // 每日挑戰是填滿率計分、方塊不見得剛好，沒有正確位置可言，所以不開放。
  function pictureAllowed(lv) {
    return !!lv && lv.mode === 'exact';
  }

  /** 讀偏好，順便把舊版的三段式設定（off / reveal / jigsaw）收斂成開關 */
  function pictureWanted() {
    var legacy = Storage.getPref('pictureMode');
    if (legacy !== undefined && Storage.getPref('pictureOn') === undefined) {
      var on = legacy === 'jigsaw' || legacy === 'reveal';
      Storage.setPref('pictureOn', on);
      return on;
    }
    return Storage.getPref('pictureOn') === true;
  }

  /**
   * 這塊方塊現在該長什麼樣。
   * 圖片拼圖只有一種：方塊從在方塊盤裡就帶著自己「正確位置」的那片圖，
   * 靠紋路接不接得起來找位置。等放上去才顯示圖對解題毫無幫助，所以不那樣做。
   */
  function skinFor(piece) {
    if (!state || !state.picture || !state.picture.on || !piece.home) return null;
    return {
      url: Pictures.url(state.picture.index, state.cols, state.rows),
      cols: state.cols,
      rows: state.rows,
      home: piece.home,
      rot: piece.rot,
      flip: piece.flip
    };
  }

  function setPicture(on, index) {
    if (!state) return;
    state.picture.on = !!on;
    if (typeof index === 'number') state.picture.index = index;
    Storage.setPref('pictureOn', state.picture.on);
    Storage.setPref('pictureIndex', state.picture.index);
    refreshAll();
    refreshPictureButton();
  }

  function refreshPictureButton() {
    var btn = $('btn-picture');
    btn.hidden = !pictureAllowed(level);
    if (btn.hidden) return;
    var on = state && state.picture.on;
    // 狀態直接寫在按鈕上。先前只放一個圖示，有些裝置會把 emoji 畫成空白方塊，
    // 根本看不出那是可以點的開關。
    $('btn-picture-state').textContent = on ? '開' : '關';
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-label', on
      ? '圖片拼圖已開啟（' + Pictures.nameOf(state.picture.index) + '），點擊可更換或關閉'
      : '圖片拼圖目前關閉，點擊可開啟');
  }

  function showPicturePanel() {
    var cur = state.picture;
    var html = ['<h3>畫面外觀</h3>'];
    html.push('<div class="skin-list">');
    html.push('<button class="skin-opt' + (cur.on ? '' : ' is-on') + '" data-on="0">' +
      '<b>彩色方塊</b><span>原本的樣子，每塊一個顏色。</span></button>');
    html.push('<button class="skin-opt' + (cur.on ? ' is-on' : '') + '" data-on="1">' +
      '<b>圖片拼圖</b><span>每塊方塊從方塊盤裡就帶著自己正確位置的那片圖案，' +
      '靠紋路接不接得起來找位置。</span></button>');
    html.push('</div>');

    html.push('<h4 class="skin-heading">換一張圖</h4>');
    html.push('<div class="pic-list">');
    for (var i = 0; i < Pictures.count; i++) {
      html.push('<button class="pic-opt' + (cur.index === i ? ' is-on' : '') + '" data-pic="' + i + '" ' +
        'style="background-image:url(' + Pictures.thumb(i) + ')">' +
        '<span>' + Pictures.nameOf(i) + '</span></button>');
    }
    html.push('</div>');
    html.push('<div class="modal__actions"><button class="btn btn--primary" data-act="ok">完成</button></div>');

    openModal(html.join(''), function (card) {
      card.querySelectorAll('[data-on]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          setPicture(btn.dataset.on === '1');
          closeModal();
          showPicturePanel();
        });
      });
      card.querySelectorAll('[data-pic]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          setPicture(true, Number(btn.dataset.pic));
          closeModal();
          showPicturePanel();
        });
      });
      card.querySelector('[data-act="ok"]').addEventListener('click', closeModal);
    });
  }

  // ── 版面計算 ───────────────────────────────────────────────
  function layout() {
    if (!state) return;
    var wrap = refs.boardWrap.getBoundingClientRect();
    var byW = (wrap.width - 20) / state.cols;
    var byH = (wrap.height - 20) / state.rows;
    cell = Math.max(14, Math.min(78, Math.floor(Math.min(byW, byH))));
    Render.buildBoard(refs, state, cell);
    Render.syncPlaced(refs, state, cell, skinFor);
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
    }, selectedUid, skinFor);
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
    Render.syncPlaced(refs, state, cell, skinFor);
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
    skinFor: skinFor,

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

  // ── 我的成績 ───────────────────────────────────────────────
  function summarize() {
    var stars = 0, cleared = 0, perfect = 0, fillSum = 0, fillCount = 0;
    Levels.LIST.forEach(function (lv) {
      var rec = Storage.recordOf(lv.id);
      stars += rec.stars;
      if (rec.cleared) cleared++;
      if (rec.stars === 3) perfect++;
      if (rec.best > 0) { fillSum += rec.best; fillCount++; }
    });
    return {
      stars: stars,
      maxStars: Levels.LIST.length * 3,
      cleared: cleared,
      total: Levels.LIST.length,
      perfect: perfect,
      avgFill: fillCount ? fillSum / fillCount : 0,
      streak: Storage.dailyStreak(),
      dailyDone: Storage.dailyClearedCount()
    };
  }

  function tile(label, value, note) {
    return '<div class="tile"><span class="tile__label">' + label + '</span>' +
           '<b class="tile__value">' + value + '</b>' +
           (note ? '<span class="tile__note">' + note + '</span>' : '') + '</div>';
  }

  function buildStats() {
    var sum = summarize();
    var name = Storage.getName();
    var out = [];

    // 整頁只放一個主數字，其餘一律是次級的 stat tile
    out.push('<section class="hero">');
    out.push('<span class="hero__label">' + (name ? esc(name) + '的星星收藏' : '星星收藏') + '</span>');
    out.push('<b class="hero__value">' + sum.stars + '</b>');
    out.push('<span class="hero__unit">/ ' + sum.maxStars + ' 顆星星</span>');
    out.push('</section>');

    out.push('<div class="tiles">');
    out.push(tile('完成關卡', sum.cleared + ' / ' + sum.total,
      sum.cleared === sum.total ? '全部通關' : '還剩 ' + (sum.total - sum.cleared) + ' 關'));
    out.push(tile('三星關卡', sum.perfect + ' / ' + sum.total,
      sum.perfect === sum.total ? '完美' : '還有 ' + (sum.total - sum.perfect) + ' 關可以拚'));
    out.push(tile('平均填滿率', sum.avgFill ? sum.avgFill.toFixed(1) + '%' : '—',
      sum.cleared ? '已挑戰過的關卡' : '還沒有紀錄'));
    out.push(tile('每日挑戰', sum.dailyDone + ' 天',
      sum.streak > 0 ? '🔥 連續 ' + sum.streak + ' 天' : '今天還沒挑戰'));
    out.push('</div>');

    // 每關明細
    out.push('<h3 class="stats-heading">每關明細</h3>');
    Levels.WORLDS.forEach(function (world) {
      out.push('<div class="table-block" style="--w-color:' + themeColor(world.theme) + '">');
      out.push('<h4 class="table-block__title"><span class="world__no">世界 ' + world.id + '</span>' + world.name + '</h4>');
      out.push('<table class="stats-table"><thead><tr>' +
        '<th>關卡</th><th>星等</th><th class="num">最佳填滿率</th><th>狀態</th>' +
        '</tr></thead><tbody>');
      Levels.inWorld(world.id).forEach(function (lv) {
        var rec = Storage.recordOf(lv.id);
        var state = rec.stars === 3 ? '三星達成'
          : rec.cleared ? '已通關'
          : rec.best > 0 ? '挑戰過' : '還沒玩';
        out.push('<tr class="' + (rec.cleared ? 'is-cleared' : '') + '">' +
          '<td><b>' + lv.id + '</b> ' + lv.name + '</td>' +
          '<td class="stars">' + Render.starsHtml(rec.stars) + '</td>' +
          '<td class="num">' + (rec.best > 0 ? rec.best + '%' : '—') + '</td>' +
          '<td class="state state--' + (rec.cleared ? 'done' : rec.best > 0 ? 'open' : 'new') + '">' + state + '</td>' +
          '</tr>');
      });
      out.push('</tbody></table></div>');
    });

    // 每日挑戰歷史
    var history = Storage.dailyHistory(14);
    out.push('<h3 class="stats-heading">每日挑戰紀錄</h3>');
    if (!history.length) {
      out.push('<p class="stats-empty">還沒有挑戰過。每天會換一題，題目由當天日期決定。</p>');
    } else {
      out.push('<div class="table-block" style="--w-color:#e0409a">');
      out.push('<table class="stats-table"><thead><tr>' +
        '<th>日期</th><th>星等</th><th class="num">填滿率</th>' +
        '</tr></thead><tbody>');
      history.forEach(function (row) {
        out.push('<tr class="' + (row.record.cleared ? 'is-cleared' : '') + '">' +
          '<td><b>' + row.date + '</b></td>' +
          '<td class="stars">' + Render.starsHtml(row.record.stars) + '</td>' +
          '<td class="num">' + (row.record.best > 0 ? row.record.best + '%' : '—') + '</td>' +
          '</tr>');
      });
      out.push('</tbody></table></div>');
    }

    $('stats-body').innerHTML = out.join('');
  }

  function askName(first) {
    openModal([
      '<h3>' + (first ? '歡迎來到方塊填色' : '改個名字') + '</h3>',
      '<p>' + (first
        ? '先取個名字吧，成績頁會記住你的紀錄。不填也可以，之後隨時能改。'
        : '想換個名字就改這裡，紀錄不會受影響。') + '</p>',
      '<input class="name-input" id="name-input" maxlength="16" autocomplete="off" ' +
        'placeholder="你的名字" value="' + esc(Storage.getName()) + '">',
      '<div class="modal__actions">',
      '<button class="btn" data-act="skip">' + (first ? '先不用' : '取消') + '</button>',
      '<button class="btn btn--primary" data-act="ok">' + (first ? '開始吧' : '存起來') + '</button>',
      '</div>'
    ].join(''), function (card) {
      var input = card.querySelector('#name-input');
      function save() {
        Storage.setName(input.value);
        closeModal();
        refreshTitle();
        if ($('screen-stats').classList.contains('is-active')) buildStats();
      }
      card.querySelector('[data-act="ok"]').addEventListener('click', save);
      card.querySelector('[data-act="skip"]').addEventListener('click', closeModal);
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); save(); }
      });
      setTimeout(function () { input.focus(); }, 60);
    });
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
      // 提示版每塊都帶著正確位置的圖，但解法往往不只一種——
      // 拼滿了圖案卻沒接上，那是另一種解，值得講一句
      if (result.cleared && state.picture && state.picture.on) {
        lines.push('<p>' + (Board.allAtHome(state)
          ? '🖼 圖案完全對上了，每一塊都在自己的位置。'
          : '🖼 拼滿了，但圖案沒接上——你找到的是另一種解法。') + '</p>');
      }
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
      '<li>三十關都是<b>精準拼合</b>：方塊不多不少，剛好把畫框填滿才過關，不用提示拼完就是三顆星。</li>',
      '<li><b>每日挑戰</b>則是填滿率計分，方塊不見得剛好，填越滿星星越多。</li>',
      '<li>右上角的<b>「圖片」</b>按鈕可以隨時切換<b>圖片拼圖</b>：每塊方塊從方塊盤裡就帶著自己正確位置的那片圖案，靠紋路接不接得起來找位置。預設是關的，想玩才開。</li>',
      '<li>每日挑戰每天換一題，題目由當天日期決定，全世界同一題；連續挑戰會累積天數。</li>',
      '<li>進度存在這台裝置上，關掉再開會從<b>還沒過的那一關</b>接著打；「我的成績」可以看每一關的星數與最佳填滿率。</li>',
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
    function openLevels() {
      buildLevelSelect();
      show('screen-levels', lastTheme);
    }
    $('btn-start').addEventListener('click', openLevels);
    $('btn-levels').addEventListener('click', openLevels);
    $('btn-continue').addEventListener('click', continueGame);
    $('btn-stats').addEventListener('click', function () {
      buildStats();
      show('screen-stats', lastTheme);
    });
    $('btn-stats-back').addEventListener('click', function () {
      refreshTitle();
      show('screen-title', 'mint');
    });
    $('btn-rename').addEventListener('click', function () { askName(false); });
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

    $('btn-picture').addEventListener('click', showPicturePanel);
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
  // 完全沒玩過、也還沒取過名字時，開場問一次
  if (!Storage.getName() && Storage.totalStars() === 0) askName(true);
})(typeof window !== 'undefined' ? window : globalThis);
