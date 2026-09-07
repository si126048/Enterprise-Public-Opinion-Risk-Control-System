/*
 * MascotBody — owns every spring that moves the silhouette, and turns them into
 * SVG path data. One instance per character; no DOM access here.
 */
(function (g) {
  'use strict';

  var Core = g.MascotCore;
  var Shapes = g.MascotShapes;
  var States = g.MascotStates;
  if (!Core || !Shapes || !States) { console.error('mascot-body: missing deps'); return; }

  var S = Core.SPRINGS;
  var RELEASE_MS = 190;   /* stretch phase of a bounce before the landing pose takes over */

  function MascotBody() {
    var p = Shapes.PRESETS.blob;
    this.morph = 'blob';
    this.R = Core.spring(p.R);
    this.m = Core.spring(p.m);
    this.ry = Core.spring(p.ry);
    this.turn = Core.spring(0);
    this.roll = Core.spring(0);
    this.squash = Core.spring(0);
    this.elong = Core.spring(1);
    this.dy = Core.spring(0);
    this.spin = Core.spring(0);
    this.hop = Core.spring(0);
    this._releaseAt = 0;
  }

  var proto = MascotBody.prototype;

  /* A completed 360 trick would otherwise grow the target without bound. */
  function normalizeSpin(s) {
    while (s.t >= 360 && Math.abs(s.x - s.t) < 0.5) { s.t -= 360; s.x -= 360; }
  }

  proto.step = function (dt, def, now) {
    def = def || States.def('idle');
    var pose = def.pose || {};
    var morph = def.morph || 'blob';
    var p = Shapes.preset(morph);
    this.morph = morph;

    this.R.t = p.R;
    this.m.t = p.m;
    this.ry.t = p.ry;
    this.turn.t = pose.turn || 0;
    this.roll.t = pose.roll || 0;
    this.elong.t = pose.elong == null ? 1 : pose.elong;
    this.dy.t = pose.dy || 0;
    this.hop.t = 0;

    if (this._releaseAt) {
      if (now >= this._releaseAt) {
        this._releaseAt = 0;
        this.squash.t = pose.squash || 0;
      }
      /* else: hold the stretch target set by bounce() */
    } else {
      this.squash.t = pose.squash || 0;
    }

    Core.advance(this.R, S.shape, dt);
    Core.advance(this.m, S.shape, dt);
    Core.advance(this.ry, S.shape, dt);
    Core.advance(this.turn, S.x, dt);
    Core.advance(this.roll, S.spin, dt);
    Core.advance(this.squash, S.squash, dt);
    Core.advance(this.elong, S.squash, dt);
    Core.advance(this.dy, S.y, dt);
    Core.advance(this.hop, S.y, dt);
    Core.advance(this.spin, S.spin, dt);
    normalizeSpin(this.spin);

    /* Subtle breathing: a slow sine that modulates squash and elong targets
       so the silhouette rises and falls even at rest. */
    var breathPhase = (now || 0) * 0.0018;
    var breathAmp = 0.015;
    this.squash.t += Math.sin(breathPhase) * breathAmp;
    this.elong.t += Math.cos(breathPhase) * breathAmp * 0.8;
  };

  /* Reduced motion / first paint: land every spring on its target. */
  proto.settle = function (def, now) {
    this.step(0, def, now);
    Core.snap(this.R); Core.snap(this.m); Core.snap(this.ry);
    Core.snap(this.turn); Core.snap(this.roll); Core.snap(this.squash);
    Core.snap(this.elong); Core.snap(this.dy); Core.snap(this.hop);
    this._releaseAt = 0;
  };

  proto.spinTrick = function () { this.spin.t += 360; };

  proto.bounce = function (power, now) {
    Core.kick(this.hop, -(power || 380));
    this.squash.t = -0.26;                      /* stretch anticipation */
    this._releaseAt = (now || 0) + RELEASE_MS;
  };

  proto.frame = function (now) {
    var rollDeg = this.roll.x + this.spin.x;
    var opt = {
      t: now,
      squash: this.squash.x,
      roll: rollDeg,
      turn: this.turn.x,
      elong: this.elong.x,
      dy: this.dy.x + this.hop.x,
      R: this.R.x,
      m: this.m.x,
      ry: this.ry.x
    };
    var tr = Shapes.bodyTransform(this.morph, opt);
    var height = -this.hop.x;
    return {
      tr: tr,
      main: Shapes.smoothClosedPath(Shapes.bodyVertices(this.morph, opt)),
      core: Shapes.corePath(tr, now),
      dot: { cx: tr.cx, cy: tr.cy, r: 5 },
      shards: Shapes.shardPaths(tr, now, this.spin.x),
      shadow: Shapes.shadowAttrs(height, this.squash.x),
      height: height
    };
  };

  g.MascotBody = MascotBody;
})(typeof window !== 'undefined' ? window : globalThis);
