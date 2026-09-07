/*
 * MascotFx — SVG overlay effects. DOM-free: frame() returns a list of shape
 * descriptors and the character layer paints them into a fixed pool of nodes.
 * Nothing is created per frame.
 */
(function (g) {
  'use strict';

  var Core = g.MascotCore;
  var Shapes = g.MascotShapes;
  if (!Core || !Shapes) { console.error('mascot-fx: missing deps'); return; }

  var TAU = Core.TAU;
  var clamp = Core.clamp;
  var CX = Shapes.CX;
  var CY = Shapes.CY;

  var COLORS = { gold: '#F5D000', red: '#FF3B3B', cyan: '#00D4FF' };
  var POOL = 18;                 /* alert (4) and burst (12) can overlap */
  var BURST_MS = 900;
  var GRAVITY = 180;

  function colorOf(accent) { return COLORS[accent] || COLORS.gold; }

  function arcPath(cx, cy, r, a0, a1) {
    var x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r;
    var x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
    var large = (a1 - a0) > Math.PI ? 1 : 0;
    function f(v) { return Math.round(v * 100) / 100; }
    return 'M' + f(x0) + ' ' + f(y0) + 'A' + f(r) + ' ' + f(r) + ' 0 ' + large + ' 1 ' + f(x1) + ' ' + f(y1);
  }

  function MascotFx() {
    this.kind = null;
    this.accent = null;
    this.startedAt = 0;
    this.burstAt = -1e9;
    this.burstColor = COLORS.gold;
    this.burstSeeds = [];
    for (var i = 0; i < 12; i++) {
      this.burstSeeds.push({ a: 0, sp: 0, jit: 0 });
    }
  }

  var proto = MascotFx.prototype;

  proto.setKind = function (kind, accent, now) {
    if (kind === this._req && accent === this.accent) return;
    this._req = kind || null;
    this.accent = accent || null;
    /* a burst is instantaneous, so it never becomes the looping kind */
    this.kind = (this._req === 'burst') ? null : this._req;
    this.startedAt = now;
    if (this._req === 'burst') this.burst(now);
  };

  proto.burst = function (now) {
    this.burstAt = now;
    this.burstColor = colorOf(this.accent);
    for (var i = 0; i < this.burstSeeds.length; i++) {
      this.burstSeeds[i].a = (i / 12) * TAU + Math.random() * 0.4 - 0.2;
      this.burstSeeds[i].sp = 90 + Math.random() * 80;
      this.burstSeeds[i].jit = 0.8 + Math.random() * 0.5;
    }
  };

  proto.frame = function (now, tr) {
    var out = [];
    var cx = tr ? tr.cx : CX;
    var cy = tr ? tr.cy : CY;
    var c = colorOf(this.accent);

    switch (this.kind) {
      case 'orbit': this.orbitFrame(now, cx, cy, out, c); break;
      case 'alert': this.alertFrame(now, cx, cy, out, c); break;
      case 'zzz': this.zzzFrame(now, cx, cy, out, c); break;
      case 'arc': this.arcFrame(now, cx, cy, out, c); break;
      case 'gather': this.gatherFrame(now, cx, cy, out, c, tr); break;
      default: break;
    }

    /* a burst is a one-shot that outlives whichever state fired it */
    if (now - this.burstAt < BURST_MS) this.burstFrame(now, tr, out, this.burstColor);
    return out;
  };

  function push(out, d, op, color, fill, width) {
    out.push({ d: d, op: clamp(op, 0, 1), color: color, fill: !!fill, width: width || 1.5 });
  }

  proto.orbitFrame = function (now, cx, cy, out, c) {
    for (var i = 0; i < 3; i++) {
      var a = now * 0.0012 + (i / 3) * TAU;
      var r = 105 + Math.sin(now * 0.002 + i) * 5;
      push(out, Shapes.diamondPath(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.82, 7, 7, a * 40),
           0.55 + 0.25 * Math.sin(now * 0.003 + i), c, false, 1.5);
    }
  };

  proto.alertFrame = function (now, cx, cy, out, c) {
    for (var i = 0; i < 2; i++) {
      var phase = ((now % 1400) / 1400 + i * 0.5) % 1;
      var r = 62 + phase * 46;
      push(out, Shapes.diamondPath(cx, cy, r, r * 0.92, 0), (1 - phase) * 0.5, c, false, 2);
    }
    /* exclamation: stacked diamonds above the head */
    push(out, Shapes.diamondPath(cx, cy - 104, 4.5, 13, 0), 0.55 + 0.45 * Math.sin(now * 0.008), c, true);
    push(out, Shapes.diamondPath(cx, cy - 84, 4, 4, 0), 0.55 + 0.45 * Math.sin(now * 0.008), c, true);
  };

  proto.zzzFrame = function (now, cx, cy, out, c) {
    for (var i = 0; i < 3; i++) {
      var phase = ((now * 0.00045) + i / 3) % 1;
      var s = 4 + phase * 5;
      push(out, Shapes.diamondPath(
               cx + 52 + phase * 16 + Math.sin(phase * TAU) * 4,
               cy - 34 - phase * 66, s, s, phase * 90),
           Math.sin(phase * Math.PI) * 0.55, c, false, 1.5);
    }
  };

  proto.arcFrame = function (now, cx, cy, out, c) {
    var phase = (now % 2500) / 2500;
    var sweep = phase * (TAU * 0.83);
    if (sweep > 0.02) {
      push(out, arcPath(cx, cy, 100, -Math.PI / 2, -Math.PI / 2 + sweep), 0.45, c, false, 2.5);
    }
    var a = -Math.PI / 2 + sweep;
    push(out, Shapes.diamondPath(cx + Math.cos(a) * 100, cy + Math.sin(a) * 100, 5, 5, a * 40), 0.8, c, true);
  };

  proto.gatherFrame = function (now, cx, cy, out, c, tr) {
    var phase = clamp((now - this.startedAt) / 2000, 0, 1);
    var e = Core.ease.inOutCubic(phase);
    var fadeIn = clamp(phase / 0.3, 0, 1);
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * TAU + phase * 1.6;
      var r = 120 - e * 120;
      var s = 6 - e * 3;
      push(out, Shapes.diamondPath(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9, s, s, a * 30),
           fadeIn * (1 - phase * 0.65) * 0.7, c, false, 1.5);
    }
  };

  proto.burstFrame = function (now, tr, out, c) {
    var cx = tr ? tr.cx : CX;
    var cy = tr ? tr.cy : CY;
    var t = (now - this.burstAt) / 1000;
    if (t < 0 || t > BURST_MS / 1000) return;
    var k = 1 - t / (BURST_MS / 1000);
    for (var i = 0; i < this.burstSeeds.length; i++) {
      var sd = this.burstSeeds[i];
      var dist = sd.sp * t;
      var x = cx + Math.cos(sd.a) * dist;
      var y = cy + Math.sin(sd.a) * dist * 0.86 + GRAVITY * t * t;
      var s = clamp(6 * k * sd.jit, 0.4, 8);
      push(out, Shapes.diamondPath(x, y, s, s, t * 260 + i * 12), k, c, true);
    }
  };

  proto.poolSize = function () { return POOL; };

  g.MascotFx = MascotFx;
  g.MascotFx.POOL = POOL;
  g.MascotFx.COLORS = COLORS;
  g.MascotFx.arcPath = arcPath;
})(typeof window !== 'undefined' ? window : globalThis);
