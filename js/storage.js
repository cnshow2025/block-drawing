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

  function totalStars() {
    var n = 0;
    Object.keys(progress).forEach(function (k) { n += progress[k].stars || 0; });
    return n;
  }

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
    clearAll: clearAll,
    getPref: getPref,
    setPref: setPref
  };
})(typeof window !== 'undefined' ? window : globalThis);
