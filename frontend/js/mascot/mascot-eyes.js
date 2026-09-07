/*
 * MascotEyes — blink keyframe queue, wink, playlist morphing, pointer gaze and
 * organic micro-drift. Eyes are authored centered on the origin, so the per-frame
 * transform is just translate+scale; there is no centroid dance.
 */
(function (g) {
  'use strict';

  var Core = g.MascotCore;
  var Shapes = g.MascotShapes;
  var States = g.MascotStates;
  if (!Core || !Shapes || !States) { console.error('mascot-eyes: missing deps'); return; }

  var clamp = Core.clamp;
  var S = Core.SPRINGS;
  var EYES20 = Shapes.EYES20;
  var ANCHORS = Shapes.EYE_ANCHORS;
  var ANGRY = 5;
  var WINK_MS = 320;
  var DOUBLE_BLINK_P = 0.14;
  var WINK_P = 0.18;
  var YAW_HIDE_DEG = 75;    /* past this roll the face has turned away */

  function queueBlink(q, now) {
    q.push({ at: now, v: 0.05 }, { at: now + 70, v: 0.05 },
           { at: now + 150, v: 1.08 }, { at: now + 300, v: 1 });
    if (Math.random() < DOUBLE_BLINK_P) {
      q.push({ at: now + 370, v: 0.05 }, { at: now + 480, v: 1 });
    }
  }

  function consumeBlink(q, now) {
    var key = null;
    while (q.length && now >= q[0].at) key = q.shift().v;
    return key;
  }

  function winkLid(base, now, winkAt, winkEye, i) {
    var lid = Math.max(base, 0.04);
    if (i === winkEye && now < winkAt + WINK_MS) {
      var xr = (now - winkAt) / WINK_MS;
      var f = xr < 0.42 ? 1 - xr / 0.42 : (xr - 0.42) / 0.58;
      lid = Math.max(lid * clamp(f, 0, 1), 0.04);
    }
    return lid;
  }

  function pickFromPlaylist(def) {
    var pl = def.playlist;
    if (!pl || !pl.length) return 0;
    return pl[(Math.random() * pl.length) | 0];
  }

  function MascotEyes() {
    this.idxA = 0;
    this.idxB = 0;
    this.morph = Core.spring(1);
    this.gazeX = Core.spring(0);
    this.gazeY = Core.spring(0);
    this.lid = 1;
    this.blinkQ = [];
    this.nextBlinkAt = Infinity;
    this.holdUntil = 0;
    this.winkAt = -1e9;
    this.winkEye = 0;
    this.sweepSign = 1;
    this.stateName = 'idle';
  }

  var proto = MascotEyes.prototype;

  function scheduleBlink(self, def, now) {
    self.nextBlinkAt = def.blink ? now + Core.randRange(def.blink) : Infinity;
  }

  /* Called on setState: jump straight to the first beat of the new playlist. */
  proto.enter = function (name, def, now, opts) {
    opts = opts || {};
    this.stateName = name;
    if (opts.resetEyes !== false) {
      this.idxA = def.playlist[0] || 0;
      this.idxB = this.idxA;
      this.morph.x = 1; this.morph.v = 0; this.morph.t = 1;
    }
    this.holdUntil = now + Core.randRange(def.hold);
    this.blinkQ.length = 0;
    this.lid = 1;
    this.winkAt = -1e9;
    scheduleBlink(this, def, now);
  };

  /* Reduced motion: land the morph and gaze springs, no blinking. */
  proto.settle = function (def, now) {
    this.enter(this.stateName, def, now);
    Core.snap(this.morph);
    Core.snap(this.gazeX);
    Core.snap(this.gazeY);
    this.nextBlinkAt = Infinity;
  };

  /*
   * pointer is already in SVG units (character layer maps and dead-zones it),
   * or null when the pointer is outside the host.
   */
  proto.step = function (dt, name, def, now, pointer, opts) {
    opts = opts || {};

    if (now >= this.holdUntil) {
      this.idxA = this.idxB;
      this.idxB = pickFromPlaylist(def);
      this.morph.x = 0; this.morph.v = 0; this.morph.t = 1;
      this.holdUntil = now + Core.randRange(def.hold);
      this.sweepSign = -this.sweepSign;
      if (States.WINK[name] && Math.random() < WINK_P) {
        this.winkAt = now;
        this.winkEye = Math.random() < 0.5 ? 0 : 1;
      }
    }

    if (now >= this.nextBlinkAt) {
      queueBlink(this.blinkQ, now);
      scheduleBlink(this, def, now);
    }
    var key = consumeBlink(this.blinkQ, now);
    if (key !== null) this.lid = key;

    var tx = 0, ty = 0;
    if (def.gaze) { tx = def.gaze[0]; ty = def.gaze[1]; }
    else if (def.gazeSweep) { tx = def.gazeSweep * this.sweepSign * 0.55; }
    else if (pointer && opts.followPointer !== false) { tx = pointer.x; ty = pointer.y; }
    this.gazeX.t = tx;
    this.gazeY.t = ty;

    Core.advance(this.morph, S.eyeScale, dt);
    Core.advance(this.gazeX, S.gazeX, dt);
    Core.advance(this.gazeY, S.gazeY, dt);
  };

  proto.frame = function (now, tr, opts) {
    opts = opts || {};
    var raw = clamp(this.morph.x, 0, 1);
    var t = Core.ease.smoothstep(raw);
    var d = Shapes.polyPath(Shapes.lerpPoly(EYES20[this.idxA], EYES20[this.idxB], t));
    var pulse = 1 + 0.07 * Math.sin(raw * Math.PI);

    /* Roll is the face turning in-plane: compress the eyes, then hide them. */
    var nr = ((tr.roll / Core.DEG) % 360 + 540) % 360 - 180;
    var yawK = Math.max(Math.cos(nr * Core.DEG), 0);
    var visible = Math.abs(nr) < YAW_HIDE_DEG && yawK > 0.02;

    var mirrored = (t < 0.5 ? this.idxA : this.idxB) === ANGRY;
    var scale = (opts.eyeScale == null ? 1 : opts.eyeScale) * pulse;
    var gap = opts.gap == null ? 1 : opts.gap;
    var inhX = 0.5 + 0.5 * tr.sx;
    var inhY = 0.5 + 0.5 * (tr.sy / tr.ry);

    var out = [];
    for (var i = 0; i < 2; i++) {
      var driftX = Math.sin(now * 0.00042 + i) * 1.8 + Math.sin(now * 0.001 + i * 2) * 0.7;
      var driftY = Math.sin(now * 0.00058 + i) * 1.2;
      var anchor = Shapes.anchorPoint(tr, ANCHORS[i][0] * gap, ANCHORS[i][1]);
      var lid = winkLid(this.lid, now, this.winkAt, this.winkEye, i);

      var sx = scale * yawK * inhX;
      var sy = scale * lid * inhY;
      if (mirrored && i === 1) sx = -sx;
      if (sx < 0) sx = Math.min(sx, -0.02); else sx = Math.max(sx, 0.02);
      sy = clamp(sy, 0.02, 2.4);

      out.push({
        d: d,
        x: anchor[0] + driftX + this.gazeX.x,
        y: anchor[1] + driftY + this.gazeY.x,
        sx: sx,
        sy: sy,
        visible: visible
      });
    }
    return out;
  };

  g.MascotEyes = MascotEyes;
  g.MascotEyes.internals = {
    queueBlink: queueBlink,
    consumeBlink: consumeBlink,
    winkLid: winkLid,
    pickFromPlaylist: pickFromPlaylist
  };
})(typeof window !== 'undefined' ? window : globalThis);
