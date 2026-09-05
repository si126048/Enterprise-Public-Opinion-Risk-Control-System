(function () {
  'use strict';

  /* ═══ 悬浮桌宠 · 弹簧物理 + 鼠标跟随 + 眨眼/弹跳 idle ═══ */

  var SIZE = 56;
  var SPRING_K = 0.08;
  var DAMPING = 0.78;
  var IDLE_DRIFT = 0.015;

  function spring(x, target, k, damping) {
    var v = (x.v || 0) + (target - x.x) * k;
    v *= damping;
    x.v = v;
    x.x += v;
    return x.x;
  }

  function Pet() {
    this.x = { x: window.innerWidth - SIZE - 24, v: 0 };
    this.y = { x: window.innerHeight - SIZE - 24, v: 0 };
    this.targetX = this.x.x;
    this.targetY = this.y.x;
    this.mouseX = this.x.x + SIZE / 2;
    this.mouseY = this.y.x + SIZE / 2;
    this.idle = true;
    this.idleTimer = null;
    this.blinkTimer = null;
    this.blinking = false;
    this.bounceV = 0;
    this.bounceY = 0;
    this.squashX = 1;
    this.squashY = 1;
    this.eyeLX = 0;
    this.eyeLY = 0;
    this.eyeRX = 0;
    this.eyeRY = 0;
    this.rotation = 0;
    this.rotV = 0;
    this.alive = true;
    this.dragging = false;
    this.dragOffX = 0;
    this.dragOffY = 0;

    this._build();
    this._bind();
    this._scheduleBlink();
    this._tick();
  }

  Pet.prototype._build = function () {
    var wrap = document.createElement('div');
    wrap.id = 'pet-wrap';
    wrap.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;width:' + SIZE + 'px;height:' + SIZE + 'px;top:0;left:0;';

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 56 56');
    svg.setAttribute('width', SIZE);
    svg.setAttribute('height', SIZE);
    svg.style.cssText = 'overflow:visible;filter:drop-shadow(0 4px 12px rgba(245,208,0,0.15));';

    /* body blob */
    var body = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    body.setAttribute('d', 'M28 4 C40 4 50 14 50 28 C50 42 40 52 28 52 C16 52 6 42 6 28 C6 14 16 4 28 4Z');
    body.setAttribute('fill', '#F5D000');
    body.id = 'pet-body';

    /* left eye white */
    var eyeL = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    eyeL.setAttribute('cx', '20');
    eyeL.setAttribute('cy', '24');
    eyeL.setAttribute('rx', '7');
    eyeL.setAttribute('ry', '8');
    eyeL.setAttribute('fill', '#FFFFFF');
    eyeL.id = 'pet-eye-l';

    /* right eye white */
    var eyeR = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    eyeR.setAttribute('cx', '36');
    eyeR.setAttribute('cy', '24');
    eyeR.setAttribute('rx', '7');
    eyeR.setAttribute('ry', '8');
    eyeR.setAttribute('fill', '#FFFFFF');
    eyeR.id = 'pet-eye-r';

    /* left pupil */
    var pupilL = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    pupilL.setAttribute('cx', '21');
    pupilL.setAttribute('cy', '24');
    pupilL.setAttribute('r', '3.5');
    pupilL.setAttribute('fill', '#1A1A1A');
    pupilL.id = 'pet-pupil-l';

    /* right pupil */
    var pupilR = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    pupilR.setAttribute('cx', '37');
    pupilR.setAttribute('cy', '24');
    pupilR.setAttribute('r', '3.5');
    pupilR.setAttribute('fill', '#1A1A1A');
    pupilR.id = 'pet-pupil-r';

    /* mouth */
    var mouth = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    mouth.setAttribute('d', 'M23 34 Q28 39 33 34');
    mouth.setAttribute('fill', 'none');
    mouth.setAttribute('stroke', '#1A1A1A');
    mouth.setAttribute('stroke-width', '1.5');
    mouth.setAttribute('stroke-linecap', 'round');
    mouth.id = 'pet-mouth';

    /* blush left */
    var blushL = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    blushL.setAttribute('cx', '14');
    blushL.setAttribute('cy', '32');
    blushL.setAttribute('rx', '4');
    blushL.setAttribute('ry', '2.5');
    blushL.setAttribute('fill', 'rgba(255,120,100,0.25)');
    blushL.id = 'pet-blush-l';

    /* blush right */
    var blushR = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    blushR.setAttribute('cx', '42');
    blushR.setAttribute('cy', '32');
    blushR.setAttribute('rx', '4');
    blushR.setAttribute('ry', '2.5');
    blushR.setAttribute('fill', 'rgba(255,120,100,0.25)');
    blushR.id = 'pet-blush-r';

    svg.appendChild(body);
    svg.appendChild(blushL);
    svg.appendChild(blushR);
    svg.appendChild(eyeL);
    svg.appendChild(eyeR);
    svg.appendChild(pupilL);
    svg.appendChild(pupilR);
    svg.appendChild(mouth);
    wrap.appendChild(svg);
    document.body.appendChild(wrap);

    this.wrap = wrap;
    this.svg = svg;
    this.body = body;
    this.eyeL = eyeL;
    this.eyeR = eyeR;
    this.pupilL = pupilL;
    this.pupilR = pupilR;
    this.mouth = mouth;
    this.blushL = blushL;
    this.blushR = blushR;
  };

  Pet.prototype._bind = function () {
    var self = this;

    window.addEventListener('pointermove', function (e) {
      self.mouseX = e.clientX;
      self.mouseY = e.clientY;
      if (self.idle) {
        self.idle = false;
        clearTimeout(self.idleTimer);
      }
      self.targetX = self.mouseX - SIZE / 2;
      self.targetY = self.mouseY - SIZE / 2 - 40;
      self.idleTimer = setTimeout(function () { self._goIdle(); }, 2000);
    }, { passive: true });

    /* click on pet → bounce */
    this.wrap.style.pointerEvents = 'auto';
    this.wrap.style.cursor = 'pointer';
    this.wrap.addEventListener('pointerdown', function (e) {
      e.stopPropagation();
      self.dragging = true;
      self.dragOffX = e.clientX - self.x.x;
      self.dragOffY = e.clientY - self.y.y;
      self._bounce();
    });
    window.addEventListener('pointerup', function () {
      self.dragging = false;
    });
    window.addEventListener('pointermove', function (e) {
      if (self.dragging) {
        self.x.x = e.clientX - self.dragOffX;
        self.y.x = e.clientY - self.dragOffY;
        self.x.v = 0;
        self.y.v = 0;
        self.targetX = self.x.x;
        self.targetY = self.y.y;
      }
    }, { passive: true });
  };

  Pet.prototype._goIdle = function () {
    this.idle = true;
    var margin = 24;
    this.targetX = window.innerWidth - SIZE - margin;
    this.targetY = window.innerHeight - SIZE - margin;
  };

  Pet.prototype._bounce = function () {
    this.bounceV = -8;
    this.squashX = 1.3;
    this.squashY = 0.7;
  };

  Pet.prototype._scheduleBlink = function () {
    var self = this;
    var delay = 2000 + Math.random() * 4000;
    this.blinkTimer = setTimeout(function () {
      self._doBlink();
      self._scheduleBlink();
    }, delay);
  };

  Pet.prototype._doBlink = function () {
    this.blinking = true;
    var self = this;
    setTimeout(function () { self.blinking = false; }, 150);
  };

  Pet.prototype._tick = function () {
    if (!this.alive) return;

    /* spring follow */
    if (!this.dragging) {
      spring(this.x, this.targetX, SPRING_K, DAMPING);
      spring(this.y, this.targetY, SPRING_K, DAMPING);
    }

    /* idle drift */
    if (this.idle && !this.dragging) {
      this.targetX += (Math.random() - 0.5) * IDLE_DRIFT * 60;
      this.targetY += (Math.random() - 0.5) * IDLE_DRIFT * 30;
    }

    /* bounce physics */
    this.bounceV += 0.5; /* gravity */
    this.bounceY += this.bounceV;
    if (this.bounceY > 0) {
      this.bounceY = 0;
      this.bounceV = 0;
    }

    /* squash recovery */
    this.squashX += (1 - this.squashX) * 0.15;
    this.squashY += (1 - this.squashY) * 0.15;

    /* rotation spring toward 0 */
    this.rotV += (0 - this.rotation) * 0.1;
    this.rotV *= 0.7;
    this.rotation += this.rotV;

    /* eye tracking */
    var cx = this.x.x + SIZE / 2;
    var cy = this.y.x + SIZE / 2 + this.bounceY;
    var dx = (this.mouseX - cx) / (window.innerWidth / 2);
    var dy = (this.mouseY - cy) / (window.innerHeight / 2);
    dx = Math.max(-1, Math.min(1, dx));
    dy = Math.max(-1, Math.min(1, dy));
    this.eyeLX += (dx * 3 - this.eyeLX) * 0.12;
    this.eyeLY += (dy * 2 - this.eyeLY) * 0.12;
    this.eyeRX += (dx * 3 - this.eyeRX) * 0.12;
    this.eyeRY += (dy * 2 - this.eyeRY) * 0.12;

    /* render */
    var bx = this.x.x;
    var by = this.y.x + this.bounceY;
    var sx = this.squashX;
    var sy = this.squashY;
    var rot = this.rotation;

    this.wrap.style.transform = 'translate(' + bx.toFixed(1) + 'px,' + by.toFixed(1) + 'px)';
    this.svg.style.transform = 'rotate(' + rot.toFixed(1) + 'deg)';
    this.svg.style.transformOrigin = (SIZE / 2) + 'px ' + (SIZE / 2) + 'px';

    /* body squash */
    this.body.setAttribute('transform',
      'translate(' + (SIZE / 2) + ',' + (SIZE / 2) + ') scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ') translate(' + (-SIZE / 2) + ',' + (-SIZE / 2) + ')');

    /* blink: collapse eye height */
    var eyeH = this.blinking ? 0.5 : 1;
    this.eyeL.setAttribute('ry', (8 * eyeH).toFixed(1));
    this.eyeR.setAttribute('ry', (8 * eyeH).toFixed(1));
    if (this.blinking) {
      this.eyeL.setAttribute('cy', '26');
      this.eyeR.setAttribute('cy', '26');
    } else {
      this.eyeL.setAttribute('cy', '24');
      this.eyeR.setAttribute('cy', '24');
    }

    /* pupils follow */
    this.pupilL.setAttribute('cx', (21 + this.eyeLX).toFixed(1));
    this.pupilL.setAttribute('cy', (24 + this.eyeLY).toFixed(1));
    this.pupilR.setAttribute('cx', (37 + this.eyeRX).toFixed(1));
    this.pupilR.setAttribute('cy', (24 + this.eyeRY).toFixed(1));

    requestAnimationFrame(this._tick.bind(this));
  };

  Pet.prototype.destroy = function () {
    this.alive = false;
    clearTimeout(this.blinkTimer);
    clearTimeout(this.idleTimer);
    if (this.wrap && this.wrap.parentNode) this.wrap.parentNode.removeChild(this.wrap);
  };

  /* ═══ 初始化 ═══ */
  var pet = new Pet();
  window.__pet = pet;
})();
