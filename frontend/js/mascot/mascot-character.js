/*
 * MascotCharacter — the facade. Builds the SVG once, owns the single rAF loop,
 * drives body / eyes / fx, and maps the pointer into gaze space.
 *
 * new MascotCharacter(svgEl, { mode:'hub'|'pet', followPointer:true,
 *                              reducedMotion:false, onStateChange:fn })
 */
(function (g) {
  'use strict';

  var Core = g.MascotCore;
  var Shapes = g.MascotShapes;
  var States = g.MascotStates;
  var MascotBody = g.MascotBody;
  var MascotEyes = g.MascotEyes;
  var MascotFx = g.MascotFx;
  if (!Core || !Shapes || !States || !MascotBody || !MascotEyes || !MascotFx) {
    console.error('mascot-character: missing deps');
    return;
  }

  var NS = 'http://www.w3.org/2000/svg';
  var clamp = Core.clamp;
  var GAZE_SPAN = { hub: [22, 14], pet: [16, 10] };
  var POINTER_DEADZONE = 0.6;
  var MAX_DT = 50;             /* ms; a backgrounded tab must not teleport springs */

  function prefersReducedMotion() {
    return !!(g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function mk(name, attrs) {
    var n = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    return n;
  }

  function MascotCharacter(svg, opts) {
    opts = opts || {};
    if (!svg) throw new Error('MascotCharacter: svg element required');

    this.svg = svg;
    this.mode = opts.mode === 'pet' ? 'pet' : 'hub';
    this.followPointer = opts.followPointer !== false;
    this.scrollInvalidates = opts.scrollInvalidates !== false;
    this.reducedMotion = opts.reducedMotion != null ? !!opts.reducedMotion : prefersReducedMotion();
    this.onStateChange = typeof opts.onStateChange === 'function' ? opts.onStateChange : null;
    this.eyeScale = opts.eyeScale == null ? 1 : opts.eyeScale;
    this.eyeGap = opts.eyeGap == null ? 1 : opts.eyeGap;
    this.gazeSpan = GAZE_SPAN[this.mode];

    this.body = new MascotBody();
    this.eyes = new MascotEyes();
    this.fx = new MascotFx();

    this.state = 'idle';
    this.stateUntil = Infinity;
    this._after = null;
    this._coreDanger = false;

    this.raf = 0;
    this.last = 0;
    this.frames = 0;
    this.paused = false;
    this._userPaused = false;
    this._autoPaused = false;
    this.destroyed = false;

    this.pointerRaw = null;
    this.rect = null;
    this._rectDirty = true;

    this._build(opts);
    this._bind();

    // rAF is withheld indefinitely in a background tab, so without this the SVG
    // stays empty and the mascot reads as missing rather than merely still.
    this._settle();
    this._paint(0);
    if (this.reducedMotion) this.stateUntil = Infinity;
    else this._start();
  }

  var proto = MascotCharacter.prototype;

  /* ------------------------------------------------------------------- DOM */

  proto._build = function (opts) {
    var svg = this.svg;
    svg.setAttribute('viewBox', '0 0 ' + Shapes.VIEW + ' ' + Shapes.VIEW);
    svg.style.overflow = 'visible';
    if (opts.sizePx) { svg.style.width = opts.sizePx + 'px'; svg.style.height = opts.sizePx + 'px'; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    this.nShadow = mk('ellipse', { 'class': 'mc-shadow', cx: Shapes.CX, cy: 224, rx: 54, ry: 9 });
    this.nShadow.style.fill = 'rgba(0,0,0,0.45)';

    this.nBody = mk('path', { 'class': 'mc-body' });
    this.nBody.style.fill = 'var(--mascot-fg, #F5D000)';

    this.nCore = mk('path', { 'class': 'mc-core' });
    this.nCore.style.fill = 'none';
    this.nCore.style.stroke = 'var(--mascot-line, rgba(10,10,10,0.35))';
    this.nCore.style.strokeWidth = '2';

    this.nDot = mk('circle', { 'class': 'mc-dot', r: 5 });
    this.nDot.style.fill = 'var(--mascot-bg, #0A0A0A)';

    this.nShards = [mk('path', { 'class': 'mc-shard mc-shard-l' }), mk('path', { 'class': 'mc-shard mc-shard-r' })];
    for (var i = 0; i < 2; i++) {
      this.nShards[i].style.fill = 'var(--mascot-fg, #F5D000)';
      this.nShards[i].style.stroke = 'var(--mascot-line, rgba(10,10,10,0.35))';
      this.nShards[i].style.strokeWidth = '1.5';
    }

    this.nFx = [];
    this.nFxGroup = mk('g', { 'class': 'mc-fx' });
    this.nFxGroup.style.pointerEvents = 'none';
    for (i = 0; i < MascotFx.POOL; i++) {
      var p = mk('path', { 'class': 'mc-fx-node' });
      p.style.display = 'none';
      p.style.fill = 'none';
      p._sig = '';
      this.nFx.push(p);
      this.nFxGroup.appendChild(p);
    }

    this.nEyes = [mk('path', { 'class': 'mc-eye mc-eye-l' }), mk('path', { 'class': 'mc-eye mc-eye-r' })];
    this.nEyeGroup = mk('g', { 'class': 'mc-eyes' });
    for (i = 0; i < 2; i++) {
      this.nEyes[i].style.fill = 'var(--mascot-bg, #0A0A0A)';
      this.nEyeGroup.appendChild(this.nEyes[i]);
    }

    svg.appendChild(this.nShadow);
    svg.appendChild(this.nBody);
    svg.appendChild(this.nCore);
    svg.appendChild(this.nDot);
    svg.appendChild(this.nShards[0]);
    svg.appendChild(this.nShards[1]);
    svg.appendChild(this.nFxGroup);
    svg.appendChild(this.nEyeGroup);
  };

  proto.setColors = function (c) {
    c = c || {};
    var s = this.svg.style;
    if (c.fg) s.setProperty('--mascot-fg', c.fg);
    if (c.bg) s.setProperty('--mascot-bg', c.bg);
    if (c.line) s.setProperty('--mascot-line', c.line);
    if (c.danger) s.setProperty('--mascot-danger', c.danger);
  };

  /* ---------------------------------------------------------------- loop */

  proto._bind = function () {
    var self = this;
    this._tick = function (ts) { self._onFrame(ts); };
    this._onMove = function (e) { self.pointerRaw = { x: e.clientX, y: e.clientY }; };
    this._onLeave = function () { self.pointerRaw = null; };
    this._onResize = function () { self._rectDirty = true; };
    this._onScroll = function () { if (self.scrollInvalidates) self._rectDirty = true; };
    this._onVisibility = function () { self._applyVisibility(); };

    g.addEventListener('pointermove', this._onMove, { passive: true });
    if (g.document && g.document.documentElement) {
      g.document.documentElement.addEventListener('pointerleave', this._onLeave);
    }
    g.addEventListener('resize', this._onResize);
    g.addEventListener('scroll', this._onScroll, { passive: true });
    if (g.document) g.document.addEventListener('visibilitychange', this._onVisibility);
  };

  proto._start = function () {
    if (this.destroyed || this.raf) return;
    this.last = 0;
    this.raf = g.requestAnimationFrame(this._tick);
  };

  proto._halt = function () {
    if (this.raf) { g.cancelAnimationFrame(this.raf); this.raf = 0; }
    this.last = 0;
  };

  proto._onFrame = function (ts) {
    if (this.destroyed) return;
    this.raf = g.requestAnimationFrame(this._tick);
    if (this.paused) { this.last = ts; return; }
    var dt = this.last ? Math.min(MAX_DT, ts - this.last) : 16;
    this.last = ts;
    this._step(dt / 1000, ts);
    this._paint(ts);
    this.frames++;
  };

  proto._step = function (dt, now) {
    if (now >= this.stateUntil) {
      var after = this._after;
      this._after = null;
      var next = after ? (after() || States.nextState(this.state)) : States.nextState(this.state);
      if (next && next !== this.state) this.setState(next);
      else this.stateUntil = now + States.randomDuration(this.state);
    }
    var def = States.def(this.state);
    this.body.step(dt, def, now);
    this.fx.setKind(def.fx, def.accent, now);
    this.eyes.step(dt, this.state, def, now, this._pointerSvg());
  };

  /* ---------------------------------------------------------------- paint */

  proto._paint = function (now) {
    var f = this.body.frame(now);

    this.nBody.setAttribute('d', f.main);
    this.nCore.setAttribute('d', f.core);

    var danger = States.def(this.state).accent === 'red';
    if (danger !== this._coreDanger) {
      this._coreDanger = danger;
      this.nCore.style.stroke = danger
        ? 'var(--mascot-danger, #FF3B3B)'
        : 'var(--mascot-line, rgba(10,10,10,0.35))';
    }

    this.nDot.setAttribute('cx', f.dot.cx.toFixed(2));
    this.nDot.setAttribute('cy', f.dot.cy.toFixed(2));
    this.nDot.setAttribute('r', f.dot.r);
    this.nShards[0].setAttribute('d', f.shards[0]);
    this.nShards[1].setAttribute('d', f.shards[1]);

    var sh = f.shadow;
    this.nShadow.setAttribute('cx', sh.cx);
    this.nShadow.setAttribute('cy', sh.cy);
    this.nShadow.setAttribute('rx', sh.rx.toFixed(2));
    this.nShadow.setAttribute('ry', sh.ry.toFixed(2));
    this.nShadow.setAttribute('opacity', sh.opacity.toFixed(3));

    this._paintFx(f, now);
    this._paintEyes(f, now);
  };

  proto._paintFx = function (f, now) {
    var parts = this.reducedMotion ? [] : this.fx.frame(now, f.tr);
    for (var i = 0; i < this.nFx.length; i++) {
      var n = this.nFx[i];
      var p = parts[i];
      if (!p) {
        if (n.style.display !== 'none') n.style.display = 'none';
        continue;
      }
      n.setAttribute('d', p.d);
      n.setAttribute('opacity', p.op.toFixed(2));
      var sig = p.color + (p.fill ? 'F' : 'S') + p.width;
      if (n._sig !== sig) {
        n._sig = sig;
        n.style.stroke = p.fill ? 'none' : p.color;
        n.style.fill = p.fill ? p.color : 'none';
        n.style.strokeWidth = p.width;
      }
      if (n.style.display === 'none') n.style.display = '';
    }
  };

  proto._paintEyes = function (f, now) {
    var t = this.reducedMotion ? 0 : now;
    var ef = this.eyes.frame(t, f.tr, { eyeScale: this.eyeScale, gap: this.eyeGap });
    for (var i = 0; i < 2; i++) {
      var e = ef[i];
      this.nEyes[i].setAttribute('d', e.d);
      this.nEyes[i].setAttribute('transform',
        'translate(' + e.x.toFixed(2) + ' ' + e.y.toFixed(2) + ') scale(' +
        e.sx.toFixed(4) + ' ' + e.sy.toFixed(4) + ')');
      var vis = this.reducedMotion ? true : e.visible;
      this.nEyes[i].style.display = vis ? '' : 'none';
    }
  };

  proto._settle = function () {
    var def = States.def(this.state);
    this.body.settle(def, 0);
    this.eyes.settle(def, 0);
  };

  /* Reduced motion: one static frame, springs snapped, no fx or micro-drift. */
  proto._renderStatic = function () {
    this._settle();
    this.stateUntil = Infinity;
    this._paint(0);
  };

  /* ----------------------------------------------------------------- api */

  proto.setState = function (name, opts) {
    if (!States.has(name)) {
      console.warn('mascot: unknown state "' + name + '"');
      return;
    }
    opts = opts || {};
    var changed = name !== this.state;
    this.state = name;
    var def = States.def(name);
    var now = this._now();

    this.stateUntil = now + (opts.holdMs != null ? opts.holdMs : States.randomDuration(name));
    this._after = typeof opts.after === 'function' ? opts.after : null;

    if (changed && States.V_T[name]) Core.kick(this.body.squash, -5);
    this.eyes.enter(name, def, this.reducedMotion ? 0 : now, opts);
    this.fx.setKind(def.fx, def.accent, now);
    if (changed && this.onStateChange) this.onStateChange(name);
    if (this.reducedMotion) this._renderStatic();
    else if (this.paused || !this.raf) this._paint(now);
  };

  proto.getState = function () { return this.state; };

  proto.trick = function (kind) {
    var now = this._now();
    if (kind === 'spin') this.body.spinTrick();
    else if (kind === 'bounce') this.body.bounce(380, now);
    else if (kind === 'burst') this.fx.burst(now);
    if (this.reducedMotion) this._renderStatic();
  };

  proto.setFollowPointer = function (on) {
    this.followPointer = !!on;
    if (!on) this.pointerRaw = null;
  };

  /* Call after anything moves the host element (drag, layout change). */
  proto.invalidateRect = function () { this._rectDirty = true; };

  proto.pause = function () {
    this._userPaused = true;
    this.paused = true;
    this._halt();
  };

  proto.resume = function () {
    if (this.destroyed) return;
    this._userPaused = false;
    this.paused = false;
    if (this.reducedMotion) return;
    this._start();
  };

  /* Tab visibility is a separate pause cause and must not clear a user pause. */
  proto._applyVisibility = function () {
    var hidden = !!(g.document && g.document.hidden);
    if (hidden) {
      this._autoPaused = true;
      this.paused = true;
      this._halt();
    } else if (this._autoPaused) {
      this._autoPaused = false;
      this.paused = this._userPaused;
      if (!this.paused && !this.reducedMotion) this._start();
    }
  };

  proto.destroy = function () {
    if (this.destroyed) return;
    this.destroyed = true;
    this._halt();
    g.removeEventListener('pointermove', this._onMove);
    g.removeEventListener('resize', this._onResize);
    g.removeEventListener('scroll', this._onScroll);
    if (g.document && g.document.documentElement) {
      g.document.documentElement.removeEventListener('pointerleave', this._onLeave);
      g.document.removeEventListener('visibilitychange', this._onVisibility);
    }
  };

  proto.debugReadout = function () {
    return {
      state: this.state,
      eyeIdx: this.eyes.idxB,
      eyeName: (Shapes.EYES[this.eyes.idxB] || {}).name,
      roll: Math.round(this.body.roll.x + this.body.spin.x),
      squash: Math.round(this.body.squash.x * 100) / 100,
      morph: this.body.morph,
      fx: this.fx.kind || (this.fx._req === 'burst' ? 'burst' : null),
      frames: this.frames,
      paused: this.paused,
      reducedMotion: this.reducedMotion
    };
  };

  proto._now = function () {
    return (g.performance && g.performance.now) ? g.performance.now() : Date.now();
  };

  /* Pointer -> SVG gaze units. The rect is cached; this never forces layout. */
  proto._pointerSvg = function () {
    if (!this.followPointer || !this.pointerRaw) return null;
    if (this._rectDirty) {
      this.rect = this.svg.getBoundingClientRect();
      this._rectDirty = false;
    }
    var r = this.rect;
    if (!r || !r.width || !r.height) return null;
    var nx = clamp((this.pointerRaw.x - (r.left + r.width / 2)) / r.width,
                   -POINTER_DEADZONE, POINTER_DEADZONE);
    var ny = clamp((this.pointerRaw.y - (r.top + r.height / 2)) / r.height,
                   -POINTER_DEADZONE, POINTER_DEADZONE);
    return {
      x: (nx / POINTER_DEADZONE) * this.gazeSpan[0],
      y: (ny / POINTER_DEADZONE) * this.gazeSpan[1]
    };
  };

  g.MascotCharacter = MascotCharacter;
})(typeof window !== 'undefined' ? window : globalThis);
