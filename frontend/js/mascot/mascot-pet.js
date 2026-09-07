/*
 * mascot-pet.js — the always-on floating companion inside the application.
 * Owns exactly one MascotCharacter plus the drag / minimize / badge chrome.
 * The hub page uses MascotCharacter directly and never loads this file.
 */
(function (g) {
  'use strict';

  if (!g.MascotCore || !g.MascotCharacter || !g.MascotStates) {
    return;
  }

  var Core = g.MascotCore;

  var MARGIN = 8;
  var DRAG_SLOP = 6;
  var DRAG_SLOP_SQ = DRAG_SLOP * DRAG_SLOP;
  var MAX_DT = 50;
  var DROWSY_MS = 120000;
  var SLEEP_MS = 240000;
  var IDLE_POLL_MS = 5000;
  var DIM_MS = 2500;
  var HINT_MS = 1800;
  var RESIZE_DEBOUNCE = 150;
  var STORE_KEY = 'mascot_pet_pos';

  /* States that must not be interrupted by the idle monitor. */
  var IDLE_BLOCKED = {
    alerting: 1, working: 1, dragging: 1, bouncing: 1,
    spawning: 1, celebrate: 1, surprised: 1
  };

  var LABELS = {
    spawning: 'BOOT', waking: 'WAKE', idle: 'IDLE', listening: 'LISTEN',
    thinking: 'LOADING', searching: 'SEARCH', working: 'WORKING',
    drowsy: 'DROWSY', sleeping: 'SLEEP', happy: 'READY', excited: 'GO',
    celebrate: 'DONE', proud: 'ALL CLEAR', curious: 'CURIOUS',
    surprised: 'ERROR', suspicious: 'LOW TRUST', alerting: 'RISK',
    notifying: 'ALERT', radar: 'RADAR', progress: 'SYNC',
    dragging: 'DRAG', bouncing: 'LAND'
  };

  /* Long-running states keep their hint pinned until the state ends. */
  var STICKY_STATES = {
    spawning: 1, thinking: 1, searching: 1, working: 1, listening: 1,
    dragging: 1, drowsy: 1, sleeping: 1, alerting: 1, progress: 1
  };

  var host = null, svg = null, hintEl = null, minBtn = null;
  var badge = null, badgeDot = null;
  var character = null;
  var mounted = false, minimized = false, reduced = false;
  var hintSticky = false;

  var posX = null, posY = null;
  var baseLeft = 0, baseTop = 0;
  var pressed = false, moved = false;
  var startX = 0, startY = 0, startDx = 0, startDy = 0;
  var posRaf = 0, posLast = 0;
  var resizeTimer = 0, dimTimer = 0, hintTimer = 0, idleTimer = 0;
  var lastActivity = 0, alertCount = 0;

  function now() { return Date.now(); }

  /* ------------------------------------------------------------ transform */

  function applyTransform() {
    host.style.setProperty('--mx', posX.x.toFixed(1) + 'px');
    host.style.setProperty('--my', posY.x.toFixed(1) + 'px');
  }

  /* The CSS right/bottom anchor is the origin; dragging writes an offset from
     it so the pet stays glued to the corner when the window is resized. */
  function measureBase() {
    if (!host || minimized) return;
    var r = host.getBoundingClientRect();
    if (!r.width) return;
    baseLeft = r.left - posX.x;
    baseTop = r.top - posY.x;
  }

  function clampTarget() {
    var w = host.offsetWidth || 110;
    var h = host.offsetHeight || 110;
    var loX = MARGIN - baseLeft;
    var hiX = Math.max(loX, g.innerWidth - w - MARGIN - baseLeft);
    var loY = MARGIN - baseTop;
    var hiY = Math.max(loY, g.innerHeight - h - MARGIN - baseTop);
    posX.t = Core.clamp(posX.t, loX, hiX);
    posY.t = Core.clamp(posY.t, loY, hiY);
  }

  function persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        dx: Math.round(posX.t), dy: Math.round(posY.t), min: minimized ? 1 : 0
      }));
    } catch (e) { /* private mode */ }
  }

  function restoreSaved() {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { saved = null; }
    if (!saved) return;
    if (typeof saved.dx === 'number' && isFinite(saved.dx)) posX.t = posX.x = saved.dx;
    if (typeof saved.dy === 'number' && isFinite(saved.dy)) posY.t = posY.x = saved.dy;
    minimized = saved.min === 1;
  }

  /* Position springs only run while a drag is in flight or settling, so the
     character stays the sole permanent rAF owner on the page. */
  function startPosLoop() {
    if (posRaf) return;
    posLast = 0;
    posRaf = g.requestAnimationFrame(posTick);
  }

  function posTick(ts) {
    posRaf = 0;
    var dt = posLast ? Math.min(MAX_DT, ts - posLast) : 16;
    posLast = ts;
    Core.advance(posX, Core.SPRINGS.x, dt / 1000);
    Core.advance(posY, Core.SPRINGS.y, dt / 1000);
    applyTransform();

    var settled = !pressed &&
      Math.abs(posX.x - posX.t) < 0.15 && Math.abs(posY.x - posY.t) < 0.15 &&
      Math.abs(posX.v) < 2 && Math.abs(posY.v) < 2;
    if (settled) {
      posX.x = posX.t; posY.x = posY.t;
      applyTransform();
      persist();
      return;
    }
    posRaf = g.requestAnimationFrame(posTick);
  }

  /* ------------------------------------------------------------------ hint */

  function setHint(text, sticky) {
    if (!hintEl) return;
    if (hintTimer) { clearTimeout(hintTimer); hintTimer = 0; }
    hintSticky = !!sticky && !!text;
    if (!text) {
      hintEl.classList.remove('on');
      hintEl.textContent = '';
      return;
    }
    hintEl.textContent = text;
    hintEl.classList.add('on');
    if (hintSticky) return;
    hintTimer = setTimeout(function () {
      hintTimer = 0;
      hintEl.classList.remove('on');
    }, HINT_MS);
  }

  /* Only ever mutates a hint that is already pinned, so transient reactions
     cannot spontaneously pop a label under the cursor. */
  function syncHintToState(name) {
    if (!hintSticky) return;
    if (STICKY_STATES[name]) setHint(LABELS[name] || '', true);
    else setHint('');
  }

  /* ------------------------------------------------------------------- dim */

  function armDim() {
    if (dimTimer) clearTimeout(dimTimer);
    dimTimer = setTimeout(function () {
      dimTimer = 0;
      if (host && !minimized) host.classList.add('dim');
    }, DIM_MS);
  }

  function clearDim() {
    if (dimTimer) { clearTimeout(dimTimer); dimTimer = 0; }
    if (host) host.classList.remove('dim');
  }

  /* ------------------------------------------------------------------ idle */

  function wake() {
    lastActivity = now();
    if (!character || minimized) return;
    var st = character.getState();
    if (st === 'drowsy' || st === 'sleeping') character.setState('waking');
  }

  function checkIdle() {
    if (!character || minimized || (g.document && g.document.hidden)) return;
    var st = character.getState();
    if (IDLE_BLOCKED[st]) return;
    var idle = now() - lastActivity;
    if (idle > SLEEP_MS) {
      if (st !== 'sleeping') { character.setState('sleeping'); setHint(LABELS.sleeping, true); }
    } else if (idle > DROWSY_MS) {
      /* Long hold so the lifecycle timer does not bounce straight back to idle. */
      if (st !== 'drowsy' && st !== 'sleeping') {
        character.setState('drowsy', { holdMs: 20000 });
        setHint(LABELS.drowsy, true);
      }
    }
  }

  /* ------------------------------------------------------------------ drag */

  function onPointerDown(e) {
    if (minimized) return;
    if (e.button != null && e.button !== 0) return;
    if (minBtn && (e.target === minBtn || minBtn.contains(e.target))) return;

    pressed = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    startDx = posX.t;
    startDy = posY.t;
    measureBase();
    clearDim();
    wake();
    try { host.setPointerCapture(e.pointerId); } catch (err) { /* unsupported */ }
  }

  function onPointerMove(e) {
    if (!pressed) return;
    var dx = e.clientX - startX;
    var dy = e.clientY - startY;
    if (!moved) {
      if (dx * dx + dy * dy < DRAG_SLOP_SQ) return;
      moved = true;
      host.classList.add('dragging');
      character.setState('dragging');
      setHint(LABELS.dragging, true);
      character.invalidateRect();
    }
    posX.t = startDx + dx;
    posY.t = startDy + dy;
    clampTarget();
    if (reduced) {
      posX.x = posX.t; posY.x = posY.t;
      applyTransform();
    } else {
      startPosLoop();
    }
    lastActivity = now();
  }

  function onPointerUp(e) {
    if (!pressed) return;
    pressed = false;
    try { host.releasePointerCapture(e.pointerId); } catch (err) { /* unsupported */ }
    host.classList.remove('dragging');

    if (moved) {
      moved = false;
      /* Landing: the bouncing pose supplies the squash, no hop impulse. */
      character.setState('bouncing');
      setHint(LABELS.bouncing);
      persist();
    } else {
      character.setState('curious');
      character.trick('bounce');
      setHint(LABELS.curious);
    }
    character.invalidateRect();
    armDim();
  }

  function onResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeTimer = 0;
      if (!host) return;
      measureBase();
      clampTarget();
      posX.x = posX.t; posY.x = posY.t;
      applyTransform();
      if (character) character.invalidateRect();
    }, RESIZE_DEBOUNCE);
  }

  /* ---------------------------------------------------------------- public */

  function minimize() {
    if (!mounted || minimized) return;
    minimized = true;
    host.classList.add('minimized');
    host.classList.remove('dim');
    if (badge) badge.classList.add('visible');
    if (character) character.pause();
    setHint('');
    persist();
  }

  function restore() {
    if (!mounted || !minimized) return;
    minimized = false;
    host.classList.remove('minimized');
    if (badge) badge.classList.remove('visible');
    measureBase();
    clampTarget();
    applyTransform();
    if (character) {
      character.resume();
      character.invalidateRect();
      character.setState('waking');
    }
    lastActivity = now();
    setHint(LABELS.waking);
    armDim();
    persist();
  }

  function setAlert(count) {
    count = count | 0;
    var rose = count > alertCount;
    alertCount = count;
    if (badgeDot) badgeDot.classList.toggle('on', count > 0);
    if (!rose || count <= 0 || minimized || !character) return;

    var st = character.getState();
    var busy = st === 'working' || st === 'dragging' || st === 'spawning';
    if (busy) {
      character.setState('notifying');
      setHint(LABELS.notifying);
    } else {
      /* Bounded so a persistent high-risk count does not alarm forever. */
      character.setState('alerting', { holdMs: 4000, after: function () { return 'idle'; } });
      setHint(LABELS.alerting);
    }
  }

  function activity(kind) {
    if (!mounted) return;
    lastActivity = now();
    if (minimized || !character) return;
    clearDim();
    armDim();

    switch (kind) {
      case 'page-start':
        character.setState('thinking');
        setHint(LABELS.thinking, true);
        break;
      case 'page-ok':
        character.setState('happy');
        setHint(LABELS.happy);
        break;
      case 'page-fail':
      case 'fail':
        character.setState('surprised');
        setHint(LABELS.surprised);
        break;
      case 'drawer-open':
        host.classList.add('drawer-open-shift');
        character.setState('listening');
        setHint(LABELS.listening, true);
        break;
      case 'drawer-close':
        host.classList.remove('drawer-open-shift');
        character.setState('idle');
        setHint('');
        break;
      case 'search-start':
        character.setState('searching');
        setHint(LABELS.searching, true);
        break;
      case 'work-start':
        character.setState('working');
        setHint(LABELS.working, true);
        break;
      case 'work-ok':
      case 'success':
        character.setState('celebrate');
        character.trick('burst');
        setHint(LABELS.celebrate);
        break;
      case 'risk-clear':
        if (character.getState() !== 'proud') {
          character.setState('proud');
          setHint(LABELS.proud);
        }
        break;
      default:
        break;
    }
  }

  function destroy() {
    if (!mounted) return;
    mounted = false;
    if (posRaf) { g.cancelAnimationFrame(posRaf); posRaf = 0; }
    if (resizeTimer) clearTimeout(resizeTimer);
    if (dimTimer) clearTimeout(dimTimer);
    if (hintTimer) clearTimeout(hintTimer);
    if (idleTimer) clearInterval(idleTimer);
    resizeTimer = dimTimer = hintTimer = idleTimer = 0;

    host.removeEventListener('pointerdown', onPointerDown);
    host.removeEventListener('pointermove', onPointerMove);
    host.removeEventListener('pointerup', onPointerUp);
    host.removeEventListener('pointercancel', onPointerUp);
    host.removeEventListener('pointerenter', onPointerEnter);
    host.removeEventListener('pointerleave', onPointerLeave);
    g.removeEventListener('resize', onResize);
    if (g.document) g.document.removeEventListener('pointerdown', wake, true);

    if (character) { character.destroy(); character = null; }
    host = svg = hintEl = minBtn = badge = badgeDot = null;
  }

  function onPointerEnter() { clearDim(); wake(); }
  function onPointerLeave() { if (!pressed) armDim(); }

  function mount(hostEl) {
    if (mounted) return;
    hostEl = hostEl || (g.document && g.document.getElementById('mascot-pet'));
    if (!hostEl) return;

    svg = hostEl.querySelector('.mascot-pet-svg') || hostEl.querySelector('svg');
    if (!svg) return;

    host = hostEl;
    hintEl = g.document.getElementById('mascot-pet-hint');
    minBtn = g.document.getElementById('mascot-pet-min');
    badge = g.document.getElementById('mascot-badge');
    badgeDot = g.document.getElementById('mascot-badge-dot');
    reduced = !!(g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches);

    posX = Core.spring(0);
    posY = Core.spring(0);
    restoreSaved();

    character = new MascotCharacter(svg, {
      mode: 'pet',
      followPointer: true,
      reducedMotion: reduced,
      onStateChange: syncHintToState
    });

    host.addEventListener('pointerdown', onPointerDown);
    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('pointerup', onPointerUp);
    host.addEventListener('pointercancel', onPointerUp);
    host.addEventListener('pointerenter', onPointerEnter);
    host.addEventListener('pointerleave', onPointerLeave);
    g.addEventListener('resize', onResize);
    if (g.document) g.document.addEventListener('pointerdown', wake, true);

    if (minBtn) minBtn.addEventListener('click', function (e) { e.stopPropagation(); minimize(); });
    if (badge) {
      badge.addEventListener('click', restore);
      badge.setAttribute('role', 'button');
      badge.setAttribute('tabindex', '0');
      badge.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); restore(); }
      });
    }

    mounted = true;
    lastActivity = now();
    measureBase();
    clampTarget();
    posX.x = posX.t; posY.x = posY.t;
    applyTransform();

    if (minimized) {
      host.classList.add('minimized');
      if (badge) badge.classList.add('visible');
      character.pause();
    } else {
      character.setState('spawning');
      armDim();
    }

    idleTimer = setInterval(checkIdle, IDLE_POLL_MS);
  }

  function readout() {
    if (!character) return null;
    var r = character.debugReadout();
    r.minimized = minimized;
    r.dx = Math.round(posX.x);
    r.dy = Math.round(posY.x);
    r.alertCount = alertCount;
    r.dim = !!(host && host.classList.contains('dim'));
    return r;
  }

  g.MascotPet = {
    mount: mount,
    activity: activity,
    setAlert: setAlert,
    minimize: minimize,
    restore: restore,
    destroy: destroy,
    readout: readout
  };

})(typeof window !== 'undefined' ? window : globalThis);
