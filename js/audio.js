/* audio.js — 用 WebAudio 即時合成音效，不需要任何音檔 */
(function (global) {
  'use strict';

  var ctx = null;
  var enabled = true;

  function ensure() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }

  function tone(freq, start, duration, type, gain) {
    var ac = ensure();
    if (!ac) return;
    var osc = ac.createOscillator();
    var amp = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ac.currentTime + start);
    amp.gain.setValueAtTime(0, ac.currentTime + start);
    amp.gain.linearRampToValueAtTime(gain === undefined ? 0.16 : gain, ac.currentTime + start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + duration);
    osc.connect(amp).connect(ac.destination);
    osc.start(ac.currentTime + start);
    osc.stop(ac.currentTime + start + duration + 0.02);
  }

  function play(name) {
    if (!enabled) return;
    var ac = ensure();
    if (!ac) return;
    if (ac.state === 'suspended') ac.resume();

    switch (name) {
      case 'pick':    tone(520, 0, 0.09, 'triangle', 0.10); break;
      case 'place':   tone(392, 0, 0.10, 'triangle', 0.16); tone(587, 0.045, 0.12, 'sine', 0.10); break;
      case 'invalid': tone(150, 0, 0.14, 'sawtooth', 0.08); break;
      case 'undo':    tone(330, 0, 0.09, 'sine', 0.10); tone(262, 0.05, 0.10, 'sine', 0.08); break;
      case 'hint':    tone(784, 0, 0.09, 'sine', 0.10); tone(1047, 0.06, 0.12, 'sine', 0.08); break;
      case 'star':    tone(880, 0, 0.12, 'sine', 0.12); break;
      case 'win':
        [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.09, 0.28, 'triangle', 0.14); });
        break;
      case 'fail':    tone(330, 0, 0.16, 'sine', 0.10); tone(247, 0.12, 0.26, 'sine', 0.10); break;
    }
  }

  function setEnabled(v) { enabled = !!v; }
  function isEnabled() { return enabled; }

  global.BD = global.BD || {};
  global.BD.Audio = { play: play, setEnabled: setEnabled, isEnabled: isEnabled };
})(typeof window !== 'undefined' ? window : globalThis);
