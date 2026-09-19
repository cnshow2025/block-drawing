/* storage.js — 進度存檔（localStorage）
 * 記錄每關的星數與最佳填滿率，並據此決定關卡解鎖。
 */
(function (global) {
  'use strict';

  var KEY = 'block-drawing:progress:v1';
  var PREFS = 'block-drawing:prefs:v1';

  function read(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* 無痕模式或容量已滿就安靜略過，不影響遊玩 */
    }
  }

  var progress = read(KEY, {});
  var prefs = read(PREFS, { sound: true });

  function recordOf(levelId) {
    return progress[levelId] || { stars: 0, best: 0, cleared: false };
  }

  function save(levelId, result) {
    var cur = recordOf(levelId);
    var next = {
      stars: Math.max(cur.stars, result.stars),
      best: Math.max(cur.best, Math.round(result.rate * 1000) / 10),
      cleared: cur.cleared || result.cleared
    };
    progress[levelId] = next;
    write(KEY, progress);
    return next;
  }

  function isUnlocked(levelId, list) {
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].id === levelId) { idx = i; break; }
    if (idx <= 0) return true;
    return recordOf(list[idx - 1].id).cleared;
  }

  // 每日挑戰的星星另外算，不灌進主線的收集進度
  function isDailyId(id) { return id.indexOf('daily-') === 0; }

  function totalStars() {
    var n = 0;
    Object.keys(progress).forEach(function (k) {
      if (!isDailyId(k)) n += progress[k].stars || 0;
    });
    return n;
  }

  /** 連續完成每日挑戰的天數；今天還沒完成就從昨天開始往回數 */
  function dailyStreak(today) {
    var keyOf = global.BD.Levels.dateKey;
    var d = today ? new Date(today) : new Date();
    if (!recordOf('daily-' + keyOf(d)).cleared) d.setDate(d.getDate() - 1);
    var n = 0;
    while (recordOf('daily-' + keyOf(d)).cleared) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  function dailyRecord(dateKey) { return recordOf('daily-' + dateKey); }

  /** 每日挑戰的歷史紀錄，新的排前面 */
  function dailyHistory(limit) {
    var out = [];
    Object.keys(progress).forEach(function (k) {
      if (isDailyId(k)) out.push({ date: k.slice(6), record: progress[k] });
    });
    out.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return limit ? out.slice(0, limit) : out;
  }

  function dailyClearedCount() {
    return dailyHistory().filter(function (d) { return d.record.cleared; }).length;
  }

  function getName() { return prefs.name || ''; }
  function setName(value) { setPref('name', String(value || '').trim().slice(0, 16)); }

  function clearAll() {
    progress = {};
    write(KEY, progress);
  }

  function getPref(name) { return prefs[name]; }
  function setPref(name, value) { prefs[name] = value; write(PREFS, prefs); }

  global.BD = global.BD || {};
  global.BD.Storage = {
    recordOf: recordOf,
    save: save,
    isUnlocked: isUnlocked,
    totalStars: totalStars,
    dailyStreak: dailyStreak,
    dailyRecord: dailyRecord,
    dailyHistory: dailyHistory,
    dailyClearedCount: dailyClearedCount,
    getName: getName,
    setName: setName,
    clearAll: clearAll,
    getPref: getPref,
    setPref: setPref
  };
})(typeof window !== 'undefined' ? window : globalThis);
