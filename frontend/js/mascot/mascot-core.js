/*
 * MascotCore — spring integrator + math helpers. No DOM, no dependencies.
 * Techniques (spring math, easing set, substep policy) are generic animation
 * primitives; all geometry data lives in mascot-shapes.js and is original.
 */
(function (g) {
  'use strict';

  var TAU = Math.PI * 2;
  var DEG = Math.PI / 180;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function spring(x) { return { x: x, v: 0, t: x }; }

  /* Semi-implicit Euler, unit mass. freq is angular frequency (rad/s). */
  function stepSpring(s, freq, damp, dt) {
    if (!isFinite(dt) || dt <= 0) return;
    if (!isFinite(s.t)) s.t = 0;
    s.v += (-2 * damp * freq * s.v - freq * freq * (s.x - s.t)) * dt;
    s.x += s.v * dt;
    if (!isFinite(s.x) || !isFinite(s.v)) { s.x = s.t; s.v = 0; }
  }

  var SUBSTEP = 1 / 120;

  function substeps(dt) { return Math.max(1, Math.ceil(dt / SUBSTEP)); }

  /* Integrate one spring across a frame using fixed substeps. */
  function advance(s, pair, dt) {
    if (!isFinite(dt) || dt <= 0) return;
    var n = substeps(dt);
    var h = dt / n;
    for (var i = 0; i < n; i++) stepSpring(s, pair[0], pair[1], h);
  }

  function kick(s, dv) { s.v += dv; }

  /* Reduced motion / first paint: land on target with no animation. */
  function snap(s) { s.x = s.t; s.v = 0; }

  function randRange(pair) {
    if (!pair) return 0;
    return pair[0] + Math.random() * (pair[1] - pair[0]);
  }

  function choice(arr) {
    if (!arr || !arr.length) return undefined;
    return arr[(Math.random() * arr.length) | 0];
  }

  var ease = {
    inOutCubic: function (n) { return n < 0.5 ? 4 * n * n * n : 1 - Math.pow(-2 * n + 2, 3) / 2; },
    outCubic: function (n) { return 1 - Math.pow(1 - n, 3); },
    outBack: function (n) { return 1 + 2.70158 * Math.pow(n - 1, 3) + 1.70158 * Math.pow(n - 1, 2); },
    smoothstep: function (n) { return n * n * (3 - 2 * n); }
  };

  var SPRINGS = {
    spin: [5, 0.9],
    x: [3.5, 1],
    y: [4, 1],
    squash: [10, 0.8],
    blink: [26, 1],
    eyeScale: [9, 0.85],
    gazeX: [13, 1],
    gazeY: [13, 1],
    notify: [9, 0.55],
    overlay: [14, 1],
    shape: [10, 1]
  };

  g.MascotCore = {
    TAU: TAU,
    DEG: DEG,
    SUBSTEP: SUBSTEP,
    SPRINGS: SPRINGS,
    ease: ease,
    clamp: clamp,
    lerp: lerp,
    spring: spring,
    stepSpring: stepSpring,
    substeps: substeps,
    advance: advance,
    kick: kick,
    snap: snap,
    randRange: randRange,
    choice: choice
  };
})(typeof window !== 'undefined' ? window : globalThis);
