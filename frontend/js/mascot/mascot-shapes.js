/*
 * MascotShapes — 100% original geometry for the project's own mascot.
 *
 * The animation TECHNIQUES used across this engine (spring integration, blink
 * keyframe queues, pointer-gaze normalization, eye playlist tables) are generic
 * and were studied from public references. No vertex data, path data, palette or
 * character design from any third-party repository is reproduced here: the body
 * silhouette is generated parametrically from this project's own double-diamond
 * brand motif, and every eye shape below is hand-authored in this file.
 */
(function (g) {
  'use strict';

  var Core = g.MascotCore;
  if (!Core) { console.error('mascot-shapes: MascotCore missing'); return; }
  var clamp = Core.clamp;
  var TAU = Core.TAU;
  var DEG = Core.DEG;

  var VIEW = 256;
  var CX = 128;
  var CY = 132;
  var N = 28;          /* body polygon vertex count */
  var V = 20;          /* resampled eye vertex count */

  /*
   * Superellipse-ish blend between a square (m=0) and a perfect diamond (m=1),
   * expressed in polar form so a single N-gon can morph between both.
   */
  function radiusAt(theta, R, m) {
    var c = Math.abs(Math.cos(theta));
    var s = Math.abs(Math.sin(theta));
    var denom = (1 - m) * Math.max(c, s) + m * (c + s);
    return R / Math.max(denom, 1e-4);
  }

  var PRESETS = {
    blob: { R: 78, m: 0.82, ry: 1.00 },
    sentinel: { R: 78, m: 0.95, ry: 1.18 },
    cushion: { R: 80, m: 0.60, ry: 0.78 }
  };

  function preset(name) { return PRESETS[name] || PRESETS.blob; }

  /*
   * opt = { t, squash, roll, turn, elong, dy, R, m, ry }
   * R / m / ry override the preset so the caller can drive them from springs.
   */
  function bodyTransform(sh, opt) {
    var p = preset(sh);
    opt = opt || {};
    var squash = opt.squash || 0;
    var elong = opt.elong == null ? 1 : opt.elong;
    var yaw = Math.cos(clamp(opt.turn || 0, -25, 25) * DEG); /* fake yaw: horizontal compression */
    var bob = Math.sin((opt.t || 0) * 0.0011) * 3;
    return {
      R: opt.R == null ? p.R : opt.R,
      m: opt.m == null ? p.m : opt.m,
      ry: opt.ry == null ? p.ry : opt.ry,
      cx: CX,
      cy: CY + (opt.dy || 0) + bob,
      sx: (1 + squash * 0.35) * yaw,
      sy: (1 - squash * 0.45) * (opt.ry == null ? p.ry : opt.ry) * elong,
      roll: (opt.roll || 0) * DEG,
      bob: bob
    };
  }

  function bodyVertices(sh, opt) {
    opt = opt || {};
    var tr = bodyTransform(sh, opt);
    var t = opt.t || 0;
    var cos = Math.cos(tr.roll);
    var sin = Math.sin(tr.roll);
    var pts = [];
    for (var i = 0; i < N; i++) {
      var th = (i / N) * TAU - Math.PI / 2;
      var r = radiusAt(th, tr.R, tr.m);
      r *= 1 + 0.020 * Math.sin(t * 0.0016 + th * 2)
             + 0.012 * Math.sin(t * 0.0009 - th * 3);   /* organic breathing */
      var lx = r * Math.cos(th) * tr.sx;
      var ly = r * Math.sin(th) * tr.sy;
      pts.push([tr.cx + lx * cos - ly * sin, tr.cy + lx * sin + ly * cos]);
    }
    return pts;
  }

  /* Map a local offset (eye anchor etc.) through the body's squash/stretch/roll. */
  function anchorPoint(tr, ax, ay) {
    var lx = ax * tr.sx;
    var ly = ay * tr.sy;
    var cos = Math.cos(tr.roll);
    var sin = Math.sin(tr.roll);
    return [tr.cx + lx * cos - ly * sin, tr.cy + lx * sin + ly * cos];
  }

  /* Catmull-Rom -> cubic Bezier over a closed loop. tension 1 = textbook. */
  function smoothClosedPath(pts, tension) {
    var tau = tension == null ? 1 : tension;
    var n = pts.length;
    if (n < 3) return polyPath(pts);
    function at(i) { return pts[((i % n) + n) % n]; }
    function f(v) { return Math.round(v * 100) / 100; }
    var d = 'M' + f(pts[0][0]) + ' ' + f(pts[0][1]);
    for (var i = 0; i < n; i++) {
      var p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      var c1x = p1[0] + (p2[0] - p0[0]) / 6 * tau;
      var c1y = p1[1] + (p2[1] - p0[1]) / 6 * tau;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6 * tau;
      var c2y = p2[1] - (p3[1] - p1[1]) / 6 * tau;
      d += 'C' + f(c1x) + ' ' + f(c1y) + ',' + f(c2x) + ' ' + f(c2y) + ',' + f(p2[0]) + ' ' + f(p2[1]);
    }
    return d + 'Z';
  }

  function polyPath(pts) {
    var d = '';
    for (var i = 0; i < pts.length; i++) {
      d += (i ? 'L' : 'M') + (Math.round(pts[i][0] * 100) / 100) + ' ' + (Math.round(pts[i][1] * 100) / 100);
    }
    return d + 'Z';
  }

  function centroid(pts) {
    var x = 0, y = 0;
    for (var i = 0; i < pts.length; i++) { x += pts[i][0]; y += pts[i][1]; }
    return [x / pts.length, y / pts.length];
  }

  /* Rotate the vertex list so it starts at the topmost point -> stable morph pairs. */
  function alignTop(pts) {
    var best = 0;
    for (var i = 1; i < pts.length; i++) if (pts[i][1] < pts[best][1]) best = i;
    return pts.slice(best).concat(pts.slice(0, best));
  }

  /* Resample a closed polygon to exactly `count` evenly spaced vertices. */
  function resamplePoly(pts, count) {
    var n = pts.length;
    if (n < 2) return pts.slice();
    var segs = [];
    var total = 0;
    for (var i = 0; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      var dx = b[0] - a[0], dy = b[1] - a[1];
      var len = Math.sqrt(dx * dx + dy * dy);
      segs.push(len);
      total += len;
    }
    var out = [];
    var step = total / count;
    var si = 0;
    var walked = 0;
    for (var k = 0; k < count; k++) {
      var target = k * step;
      while (si < n - 1 && walked + segs[si] < target) { walked += segs[si]; si++; }
      var a2 = pts[si], b2 = pts[(si + 1) % n];
      var segLen = segs[si] || 1e-6;
      var f = clamp((target - walked) / segLen, 0, 1);
      out.push([a2[0] + (b2[0] - a2[0]) * f, a2[1] + (b2[1] - a2[1]) * f]);
    }
    return out;
  }

  /* Requires equal lengths (resamplePoly guarantees this). */
  function lerpPoly(a, b, t) {
    var n = Math.min(a.length, b.length);
    var out = [];
    for (var i = 0; i < n; i++) {
      out.push([a[i][0] + (b[i][0] - a[i][0]) * t, a[i][1] + (b[i][1] - a[i][1]) * t]);
    }
    return out;
  }

  /* Brand rhombus used for the inner core, shards and fx particles. */
  function diamondPath(cx, cy, rx, ry, rotDeg) {
    var a = (rotDeg || 0) * DEG;
    var cos = Math.cos(a), sin = Math.sin(a);
    var corners = [[0, -ry], [rx, 0], [0, ry], [-rx, 0]];
    var pts = [];
    for (var i = 0; i < 4; i++) {
      var x = corners[i][0], y = corners[i][1];
      pts.push([cx + x * cos - y * sin, cy + x * sin + y * cos]);
    }
    return polyPath(pts);
  }

  /* Inner core ring: 0.45x inset diamond, counter-rotating against the body roll. */
  function corePath(tr, t) {
    var r = tr.R * 0.45 * (1 + 0.03 * Math.sin(t * 0.0013));
    return diamondPath(tr.cx, tr.cy, r * tr.sx, r * tr.sy, -(tr.roll / DEG) * 0.5);
  }

  /* Two satellite shards, anchored top-left / top-right, floating outside the body. */
  var SHARD_THETA = [-135 * DEG, -45 * DEG];
  var SHARD_R = 92;
  var SHARD_SIZE = 10;

  function shardPaths(tr, t, spinDeg) {
    var cos = Math.cos(tr.roll);
    var sin = Math.sin(tr.roll);
    var out = [];
    for (var i = 0; i < 2; i++) {
      var th = SHARD_THETA[i];
      var rad = SHARD_R + Math.sin(t * 0.0018 + i * 2.1) * 4;
      var lx = Math.cos(th) * rad * tr.sx;
      var ly = Math.sin(th) * rad * tr.sy;
      out.push(diamondPath(
        tr.cx + lx * cos - ly * sin,
        tr.cy + lx * sin + ly * cos,
        SHARD_SIZE, SHARD_SIZE, (spinDeg || 0) + i * 18
      ));
    }
    return out;
  }

  function shadowAttrs(height, squash) {
    var lift = clamp(height, 0, 120);
    var k = 1 - lift / 200;
    return {
      cx: CX,
      cy: 224,
      rx: 54 * k * (1 + squash * 0.3),
      ry: 9 * k,
      opacity: 0.28 * k
    };
  }

  /* ------------------------------------------------------------------ eyes */
  /* Hand-authored in a local box of [-12..12] x [-11..11], centered on origin. */

  function starPoints(spikes, rOut, rIn) {
    var pts = [];
    for (var i = 0; i < spikes * 2; i++) {
      var th = (i / (spikes * 2)) * TAU - Math.PI / 2;
      var r = i % 2 === 0 ? rOut : rIn;
      pts.push([r * Math.cos(th), r * Math.sin(th)]);
    }
    return pts;
  }

  function scalePts(pts, k) {
    var out = [];
    for (var i = 0; i < pts.length; i++) out.push([pts[i][0] * k, pts[i][1] * k]);
    return out;
  }

  var IDLE_BOX = [[-6, -11], [6, -11], [9, -8], [9, 8], [6, 11], [-6, 11], [-9, 8], [-9, -8]];

  var EYES = [
    { name: 'idle', pts: IDLE_BOX },
    { name: 'happy', pts: [[-10, 5], [-5, -6], [0, -9], [5, -6], [10, 5], [6, 5], [3, -2], [0, -4], [-3, -2], [-6, 5]] },
    { name: 'excited', pts: starPoints(8, 12, 5) },
    { name: 'curious', pts: scalePts(IDLE_BOX, 1.18) },
    { name: 'suspicious', pts: [[-10, 3], [-6, 0], [6, 0], [10, 3], [6, 6], [-6, 6]] },
    { name: 'angry', pts: [[-10, -2], [10, -7], [10, 4], [6, 6], [-6, 6], [-10, 4]] },
    { name: 'sad', pts: [[-10, -5], [-5, 6], [0, 9], [5, 6], [10, -5], [6, -5], [3, 2], [0, 4], [-3, 2], [-6, -5]] },
    { name: 'wink', pts: [[-10, 1], [-4, -1.5], [4, -1.5], [10, 1], [4, 2.5], [-4, 2.5]] },
    { name: 'celebrate', pts: [[-10, 6], [0, -8], [10, 6], [5, 6], [0, -2], [-5, 6]] },
    { name: 'sleepy', pts: [[-9, -2], [-4, -4], [4, -4], [9, -2], [7, 9], [-7, 9]] },
    { name: 'searching', pts: [[0, -11], [10, 0], [0, 11], [-10, 0]] }
  ];

  var EYES20 = (function () {
    var out = [];
    for (var i = 0; i < EYES.length; i++) out.push(resamplePoly(alignTop(EYES[i].pts), V));
    return out;
  })();

  /* Eye anchors relative to the body centre. */
  var EYE_ANCHORS = [[-34, -12], [34, -12]];
  var EYE_GAP = EYE_ANCHORS[1][0] - EYE_ANCHORS[0][0];

  g.MascotShapes = {
    VIEW: VIEW,
    CX: CX,
    CY: CY,
    N: N,
    V: V,
    PRESETS: PRESETS,
    preset: preset,
    radiusAt: radiusAt,
    bodyTransform: bodyTransform,
    bodyVertices: bodyVertices,
    anchorPoint: anchorPoint,
    smoothClosedPath: smoothClosedPath,
    polyPath: polyPath,
    centroid: centroid,
    alignTop: alignTop,
    resamplePoly: resamplePoly,
    lerpPoly: lerpPoly,
    diamondPath: diamondPath,
    corePath: corePath,
    shardPaths: shardPaths,
    shadowAttrs: shadowAttrs,
    EYES: EYES,
    EYES20: EYES20,
    EYE_ANCHORS: EYE_ANCHORS,
    EYE_GAP: EYE_GAP
  };
})(typeof window !== 'undefined' ? window : globalThis);
