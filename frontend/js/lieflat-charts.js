/* ═══════════════════════════════════════════════════════════════
   Lieflat Charts — Lupi Editorial / Lupi Basics renderers
   Responsive: each chart draws in the container's real pixel box
   (viewBox = clientWidth × clientHeight, 1:1, fills the card).
   Templates (structure source of truth):
     L10 Radial Patchwork   — lupi-gallery.html  "4 · radial patchwork"
     B1  Rung Bars          — basics-gallery.html "B1 · rung bars"
     L14 Hundred Field      — lupi-gallery.html  "14 · hundred field"
     L17 Calendar Heat      — lupi-gallery.html  "L17 · calendar heat"
     F2  Hairline Line      — basics-gallery.html "B2 · hairline line"
     F5  Tick Rows          — basics-gallery.html "C1 · tick rows"
     F8  Plumb Scatter      — basics-gallery.html "C4 · plumb scatter"
     F11 Tick Gauge         — basics-gallery.html "C7 · tick gauge"
   Color: project palette — neutral white/gray ink (明度即数据) +
   brand yellow #F5D000 as the single hero accent + red #FF3B3B
   reserved for the low-credibility / risk semantic.
   Interaction: app-styled floating tooltip + hover highlight +
   click-to-replay + ResizeObserver re-render.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ── project-aligned dark tokens ── */
  var INK = '#FFFFFF';        // text-primary
  var MUTED = '#B0B0B0';      // text-secondary
  var FAINT = '#7A7A7A';      // footnote / axis
  var GRID = '#2A2A2A';       // hairline grid
  var GRIDSOFT = '#333333';
  var SILENT = '#3A3A3A';
  var L = ['#FFFFFF', '#E4E4E4', '#C6C6C6', '#A6A6A6', '#8F8E88', '#6A6963', '#4A4944'];
  var HERO = '#F5D000';       // brand yellow — peaks / primary highlight
  var RISK = '#FF3B3B';       // danger red — low credibility / flagged
  var HALO = '#1E1E1E';       // card bg, for paint-order halos

  var D2R = Math.PI / 180;
  function pol(cx, cy, r, deg) { return [cx + r * Math.cos(deg * D2R), cy + r * Math.sin(deg * D2R)]; }
  function sect(cx, cy, r0, r1, a0, a1) {
    var big = a1 - a0 > 180 ? 1 : 0;
    var xa = cx + r1 * Math.cos(a0 * D2R), ya = cy + r1 * Math.sin(a0 * D2R);
    var xb = cx + r1 * Math.cos(a1 * D2R), yb = cy + r1 * Math.sin(a1 * D2R);
    var xc = cx + r0 * Math.cos(a1 * D2R), yc = cy + r0 * Math.sin(a1 * D2R);
    var xd = cx + r0 * Math.cos(a0 * D2R), yd = cy + r0 * Math.sin(a0 * D2R);
    return 'M' + xa + ' ' + ya + ' A' + r1 + ' ' + r1 + ' 0 ' + big + ' 1 ' + xb + ' ' + yb +
           ' L' + xc + ' ' + yc + ' A' + r0 + ' ' + r0 + ' 0 ' + big + ' 0 ' + xd + ' ' + yd + ' Z';
  }
  function rnd(i, k) { return Math.abs(((i * 73856093) ^ (k * 19349663)) % 1000) / 1000; }
  function maxOf(arr) { return Math.max.apply(null, arr.concat([1])); }

  var NS = 'http://www.w3.org/2000/svg';
  function el(p, t, a) {
    var n = document.createElementNS(NS, t);
    for (var k in a) n.setAttribute(k, a[k]);
    p.appendChild(n);
    return n;
  }
  function txt(p, a, s) { var n = el(p, 'text', a); n.textContent = s; return n; }

  /* ── tooltip + hover infra ── */
  var tipEl = null, tipBound = false;
  function ensureTip() {
    if (tipBound) return;
    tipBound = true;
    tipEl = document.createElement('div');
    tipEl.className = 'lf-tooltip';
    document.body.appendChild(tipEl);
    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest && e.target.closest('[data-tip]');
      if (t) { tipEl.textContent = t.getAttribute('data-tip'); tipEl.classList.add('show'); posTip(e); }
    });
    document.addEventListener('mousemove', function (e) {
      if (tipEl && tipEl.classList.contains('show')) {
        if (!(e.target.closest && e.target.closest('[data-tip]'))) tipEl.classList.remove('show');
        else posTip(e);
      }
    });
    document.addEventListener('mouseout', function (e) {
      var t = e.target.closest && e.target.closest('[data-tip]');
      if (t) {
        var r = e.relatedTarget;
        if (!(r && r.closest && r.closest('[data-tip]') === t)) tipEl.classList.remove('show');
      }
    });
  }
  function posTip(e) {
    var x = e.clientX + 14, y = e.clientY + 16;
    var w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    if (x + w > global.innerWidth - 10) x = e.clientX - w - 14;
    if (y + h > global.innerHeight - 10) y = e.clientY - h - 14;
    tipEl.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  }
  /* replaces native <title>: mark element interactive + carry tip text */
  function tip(n, s) {
    ensureTip();
    n.setAttribute('data-tip', s);
    var c = n.getAttribute('class');
    n.setAttribute('class', (c ? c + ' ' : '') + 'lf-hit');
  }

  var styleInjected = false;
  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    var st = document.createElement('style');
    st.textContent =
      'svg.lf-svg{display:block;width:100%;height:100%;overflow:visible}' +
      'svg.lf-svg text{font-family:Inter,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}' +
      '.lf-pop{transform-box:fill-box;transform-origin:center;animation:lfPop .5s cubic-bezier(.2,.7,.3,1.3) both}' +
      '@keyframes lfPop{from{transform:scale(0)}to{transform:none}}' +
      '.lf-fade{animation:lfFade .9s ease both}' +
      '@keyframes lfFade{from{opacity:0}}' +
      '.lf-draw{stroke-dasharray:1;stroke-dashoffset:1;animation:lfDraw 1s cubic-bezier(.4,0,.2,1) both}' +
      '@keyframes lfDraw{to{stroke-dashoffset:0}}' +
      /* hover highlight — yellow ring on shapes, yellow fill on text */
      '.lf-hit{cursor:pointer;transition:opacity .15s ease}' +
      'svg.lf-svg circle.lf-hit:hover,svg.lf-svg path.lf-hit:hover,svg.lf-svg rect.lf-hit:hover{stroke:' + HERO + ';stroke-width:1.8}' +
      'svg.lf-svg line.lf-hit:hover{stroke:' + HERO + ';stroke-width:2;opacity:1}' +
      'svg.lf-svg text.lf-hit:hover{fill:' + HERO + '}' +
      /* app-styled floating tooltip */
      '.lf-tooltip{position:fixed;top:0;left:0;z-index:9999;pointer-events:none;opacity:0;' +
        'transition:opacity .12s ease;background:' + HALO + ';border:1px solid rgba(245,208,0,.28);' +
        'border-radius:9px;padding:7px 12px;font:600 12px/1.45 Inter,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;' +
        'color:' + INK + ';box-shadow:0 8px 26px rgba(0,0,0,.55);max-width:280px}' +
      '.lf-tooltip.show{opacity:1}' +
      '@media (prefers-reduced-motion:reduce){.lf-pop,.lf-fade{animation:none}' +
      '.lf-draw{animation:none;stroke-dasharray:none;stroke-dashoffset:0}}';
    document.head.appendChild(st);
  }

  function measure(c) {
    var w = c.clientWidth || (c.parentNode && c.parentNode.clientWidth) || 420;
    var h = c.clientHeight || 300;
    return { W: Math.max(220, Math.round(w)), H: Math.max(170, Math.round(h)) };
  }
  function rootSvg(container, W, H) {
    injectStyle();
    container.innerHTML = '';
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    s.setAttribute('class', 'lf-svg');
    s.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    container.appendChild(s);
    return s;
  }
  function replayable(container, render) {
    container.style.cursor = 'pointer';
    container.onclick = function () { render(); };
    if (container._lfRO) { try { container._lfRO.disconnect(); } catch (e) { } }
    if (global.ResizeObserver) {
      var first = true, t;
      container._lfRO = new ResizeObserver(function () {
        if (first) { first = false; return; }
        clearTimeout(t); t = setTimeout(render, 160);
      });
      container._lfRO.observe(container);
    }
  }
  function halo(a, delay) {
    a.style = 'paint-order:stroke;stroke:' + HALO + ';stroke-width:3.5px;' + (a.style || '') +
      (delay != null ? 'animation-delay:' + delay + 's;' : '');
    return a;
  }
  function unitFor(max, cap) {
    if (max <= cap) return 1;
    var p = Math.pow(10, Math.floor(Math.log(max / cap) / Math.LN10));
    var m = [1, 2, 5, 10, 20];
    for (var i = 0; i < m.length; i++) {
      if (max / (m[i] * p) <= cap) return m[i] * p;
    }
    return 100 * p;
  }
  function mdLabel(d) { return String(d).slice(5); }

  var echartsInstances = [];

  /* ════ F2 · hairline line ════ */
  function hairlineArea(container, data) {
    if (!container || !data || !data.dates || !data.dates.length) return;
    function render() {
      var dates = data.dates.slice(-14);
      var total = (data.total || []).slice(-14);
      var neg = (data.negative || data.low_credibility || []).slice(-14);
      var N = dates.length;
      var m = measure(container), W = m.W, H = m.H;
      var s = rootSvg(container, W, H);
      var ml = 46, mr = 28, mt = 28, mb = 46;
      var base = H - mb, topY = mt;
      var x = function (d) { return N > 1 ? ml + d * (W - ml - mr) / (N - 1) : W / 2; };
      var maxV = maxOf(total);
      var map = function (v) { return base - (v / maxV) * (base - topY); };
      for (var d = 0; d < N; d++) {
        el(s, 'line', { x1: x(d), y1: base, x2: x(d), y2: base - 9, stroke: GRIDSOFT, 'stroke-width': .7, 'class': 'lf-fade', style: 'animation-delay:' + (d * .02) + 's' });
      }
      el(s, 'line', { x1: ml - 8, y1: base, x2: W - mr + 8, y2: base, stroke: GRID, 'stroke-width': 1, 'class': 'lf-fade' });
      var top = [];
      var order = total.map(function (v, i) { return i; }).sort(function (a, b) { return total[b] - total[a]; });
      for (var o = 0; o < order.length; o++) {
        var cand = order[o], ok = true;
        for (var t = 0; t < top.length; t++) if (Math.abs(top[t] - cand) < 4) ok = false;
        if (ok) top.push(cand);
        if (top.length === 2) break;
      }
      if (neg.length === N && neg.some(function (v) { return v > 0; })) {
        var npts = neg.map(function (v, i) { return x(i) + ' ' + map(v); }).join(' L ');
        el(s, 'path', { d: 'M' + npts, fill: 'none', stroke: RISK, 'stroke-width': 1.1, opacity: .8, pathLength: 1, 'class': 'lf-draw', style: 'animation-delay:.3s;animation-duration:1.2s' });
      }
      var pts = total.map(function (v, i) { return x(i) + ' ' + map(v); }).join(' L ');
      el(s, 'path', { d: 'M' + pts, fill: 'none', stroke: INK, 'stroke-width': 1.4, pathLength: 1, 'class': 'lf-draw', style: 'animation-duration:1.2s' });
      total.forEach(function (v, i) {
        var dt = new Date(dates[i] + 'T00:00:00');
        var weekend = dt.getDay() === 0 || dt.getDay() === 6;
        var big = top.indexOf(i) >= 0;
        var dot = el(s, 'circle', { cx: x(i), cy: map(v), r: big ? 5 : 3, fill: weekend ? HALO : INK, stroke: weekend ? INK : 'none', 'stroke-width': weekend ? 1.2 : 0, 'class': 'lf-pop', style: 'animation-delay:' + (.2 + i * .05) + 's' });
        tip(dot, dates[i] + ' — ' + v + ' 条' + (neg[i] != null ? ' · 低信度 ' + neg[i] : ''));
        if (big) txt(s, halo({ x: x(i), y: map(v) - 13, 'font-size': 13, 'font-weight': 800, fill: HERO, 'text-anchor': 'middle', 'class': 'lf-fade' }, 1 + i * .01), v);
      });
      [[0, dates[0]], [Math.floor((N - 1) / 2), dates[Math.floor((N - 1) / 2)]], [N - 1, dates[N - 1]]].forEach(function (p) {
        txt(s, { x: x(p[0]), y: base + 22, 'font-size': 10.5, 'font-weight': 600, fill: MUTED, 'text-anchor': 'middle', 'letter-spacing': '.08em', 'class': 'lf-fade' }, mdLabel(p[1]));
      });
      txt(s, { x: W / 2, y: H - 12, 'font-size': 10, 'font-weight': 600, fill: FAINT, 'text-anchor': 'middle', 'letter-spacing': '.1em', 'class': 'lf-fade', style: 'animation-delay:1.1s' },
        neg.length ? '1 点 = 1 天 · 空心 = 周末 · 红线 = 低信度量' : '1 点 = 1 天 · 空心 = 周末');
    }
    render(); replayable(container, render);
  }

  /* ════ L10 · radial patchwork ════ */
  function radialPatchwork(container, records) {
    if (!container || !records || !records.length) return;
    function render() {
      var recs = records.slice(0, 120);
      var m = measure(container), W = m.W, H = m.H;
      var s = rootSvg(container, W, H);
      var CX = W / 2, CY = (H - 22) / 2;
      var R = Math.min(W * 0.40, (H - 46) * 0.46);
      for (var h = 0; h < 96; h++) {
        var a = -90 + h * 3.75;
        var p1 = pol(CX, CY, R, a), p2 = pol(CX, CY, R + (h % 4 === 0 ? 9 : 5), a);
        el(s, 'line', { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], stroke: h % 4 === 0 ? FAINT : SILENT, 'stroke-width': h % 4 === 0 ? 1.1 : .6, 'class': 'lf-fade', style: 'animation-delay:' + (h * .006) + 's' });
      }
      [0, 6, 12, 18].forEach(function (hh) {
        var p = pol(CX, CY, R + 22, -90 + hh * 15);
        txt(s, { x: p[0], y: p[1] + 4, 'font-size': 11, 'font-weight': 700, fill: MUTED, 'text-anchor': 'middle', 'class': 'lf-fade' }, String(hh).padStart(2, '0'));
      });
      var maxReach = maxOf(recs.map(function (r) { return r.reach || 0; }));
      var r0 = R * 0.14;
      var wedges = recs.map(function (r, i) {
        var a0 = -90 + r.hour * 15;
        var sw = 10 + rnd(i + 1, 4) * 34;
        var r1 = R * 0.30 + ((r.reach || 0) / maxReach) * R * 0.66;
        return [a0, sw, r1, r, i];
      });
      wedges.forEach(function (w) {
        var node = el(s, 'path', { d: sect(CX, CY, r0, w[2], w[0], w[0] + w[1]), fill: INK, 'fill-opacity': .07 + rnd(w[4] + 1, 6) * .10, 'class': 'lf-fade', style: 'animation-delay:' + (.2 + w[4] * .022) + 's' });
        tip(node, (w[3].label || ('record #' + (w[4] + 1))) + ' — ' + String(Math.floor(w[3].hour)).padStart(2, '0') + ':' + String(Math.floor(w[3].hour % 1 * 60)).padStart(2, '0') + ' · 互动 ' + Math.round(w[3].reach || 0));
      });
      var flagged = wedges.filter(function (w) { return w[3].flagged; }).slice(0, 10);
      flagged.forEach(function (w, k) {
        var node = el(s, 'path', { d: sect(CX, CY, r0, w[2], w[0], w[0] + w[1]), fill: 'none', stroke: RISK, 'stroke-width': 1.4, 'class': 'lf-fade', style: 'animation-delay:' + (1.2 + k * .15) + 's' });
        tip(node, (w[3].label || ('record #' + (w[4] + 1))) + ' — 低信度记录');
      });
      el(s, 'circle', { cx: CX, cy: CY, r: 4, fill: HERO, 'class': 'lf-pop', style: 'animation-delay:1.3s' });
      txt(s, { x: W / 2, y: H - 8, 'font-size': 10, 'font-weight': 600, fill: FAINT, 'text-anchor': 'middle', 'letter-spacing': '.1em', 'class': 'lf-fade', style: 'animation-delay:1.4s' },
        '1 扇 = 1 条舆情 · 角度 = 发布时刻 · 半径 = 互动量 · 红描边 = 低信度');
    }
    render(); replayable(container, render);
  }

  /* ════ L14 · hundred field ════ */
  function hundredField(container, data) {
    if (!container || !data || !data.length) return;
    function render() {
      var rows = data.slice().sort(function (a, b) { return b.value - a.value; });
      if (rows.length > 5) {
        var head = rows.slice(0, 4);
        var tail = rows.slice(4).reduce(function (s, d) { return s + d.value; }, 0);
        rows = head.concat([{ name: '其他', value: tail }]);
      }
      var total = rows.reduce(function (s, d) { return s + d.value; }, 0) || 1;
      var segs = rows.map(function (d) { return { name: d.name, v: Math.round(d.value / total * 100) }; });
      var sum = segs.reduce(function (s, d) { return s + d.v; }, 0);
      var eaten = 100 - sum;
      var m = measure(container), W = m.W, H = m.H;
      var s = rootSvg(container, W, H);
      var n = segs.length;
      var CX = W / 2, CY = (H - 26) / 2;
      var orbit = Math.min(W * 0.30, (H - 60) * 0.40);
      var clusterR = n === 1 ? Math.min(W, H) * 0.30 : orbit * (n === 2 ? 0.62 : 0.52);
      var POS = segs.map(function (_, i) {
        if (n === 1) return [CX, CY];
        return pol(CX, CY, orbit, -90 + i * 360 / n);
      });
      for (var i = 0; i < n; i++) {
        var b = (i + 1) % n;
        if (n > 2 || i === 0) {
          el(s, 'line', { x1: POS[i][0], y1: POS[i][1], x2: POS[b][0], y2: POS[b][1], stroke: GRID, 'stroke-width': .8, 'stroke-dasharray': '3 6', 'class': 'lf-fade', style: 'animation-delay:' + (.9 + i * .1) + 's' });
        }
      }
      var step = (clusterR - 6) / 10;
      segs.forEach(function (seg, ci) {
        var cx = POS[ci][0], cy = POS[ci][1], edge = 0;
        var shade = ci === 0 ? HERO : L[Math.min(ci, 4)];
        for (var k = 0; k < seg.v; k++) {
          var a = k * 137.508 + ci * 55;
          var rr = 5 + Math.sqrt(k) * step + rnd(k + 1, ci + 2) * 3;
          edge = Math.max(edge, rr);
          var p = pol(cx, cy, rr, a);
          if (k % 5 === 0) el(s, 'line', { x1: cx, y1: cy, x2: p[0], y2: p[1], stroke: SILENT, 'stroke-width': .7, 'class': 'lf-fade', style: 'animation-delay:' + (ci * .14 + k * .012) + 's' });
          var dot = el(s, 'circle', { cx: p[0], cy: p[1], r: 2.2 + rnd(k + 2, ci + 3) * 2.2, fill: shade, opacity: .92, 'class': 'lf-pop', style: 'animation-delay:' + (ci * .14 + k * .012) + 's' });
          tip(dot, seg.name + ' — 每 100 条中的 ' + (k + 1) + ' 条');
        }
        el(s, 'circle', { cx: cx, cy: cy, r: 3.2, fill: INK, 'class': 'lf-pop', style: 'animation-delay:' + (ci * .14) + 's' });
        txt(s, halo({ x: cx, y: cy + edge + 17, 'font-size': 12, 'font-weight': 800, fill: ci === 0 ? HERO : INK, 'text-anchor': 'middle', 'letter-spacing': '.06em', 'class': 'lf-fade' }, .5 + ci * .12), seg.name + ' · ' + seg.v + '%');
      });
      txt(s, { x: W / 2, y: H - 8, 'font-size': 10, 'font-weight': 600, fill: FAINT, 'text-anchor': 'middle', 'letter-spacing': '.1em', 'class': 'lf-fade', style: 'animation-delay:1.3s' },
        '1 点 = 1%' + (eaten ? ' · 另外 ' + eaten + '% 被四舍五入吃掉' : ''));
    }
    render(); replayable(container, render);
  }

  /* ════ L17 · calendar heat ════ */
  function heatCalendar(container, data) {
    if (!container || !data || !data.dates || !data.dates.length) return;
    function render() {
      var dates = data.dates, values = data.values;
      var first = new Date(dates[0] + 'T00:00:00');
      var offset = (first.getDay() + 6) % 7;
      var weeks = Math.ceil((offset + dates.length) / 7);
      var m = measure(container), W = m.W, H = m.H;
      var s = rootSvg(container, W, H);

      var max = maxOf(values);
      var total = values.reduce(function (a, b) { return a + (b || 0); }, 0);
      var quiet = values.filter(function (v) { return !v; }).length;

      /* layout — grid stretches to fill width; legend panel absorbs the right */
      var X0 = 58, Y0 = 56, mb = 46, rightPad = 26;
      var legendW = W >= 700 ? Math.min(280, Math.round(W * 0.18)) : 0;
      var gap = legendW ? 46 : 0;
      var gridAvail = W - X0 - rightPad - legendW - gap;
      var PY = (H - Y0 - mb) / 7;
      var PX = gridAvail / weeks;
      if (PX > PY * 2.6) PX = PY * 2.6;          // taste cap on horizontal stretch
      var gridW = weeks * PX;
      var compW = gridW + gap + legendW;
      var startX = Math.max(X0, (W - compW) / 2); // center the whole composition
      var cap = Math.min(PX, PY) * 0.42;
      var k = (cap - 1.6) / Math.sqrt(max);

      function cxOf(w) { return startX + w * PX + PX / 2; }
      function cyOf(d) { return Y0 + d * PY + PY / 2; }
      function rad(t) { return t ? Math.min(1.6 + Math.sqrt(t) * k, cap) : 1.6; }

      /* furniture — faint alternating week bands tile the grid, killing the void */
      for (var w = 0; w < weeks; w++) {
        if (w % 2 === 0) el(s, 'rect', { x: startX + w * PX + 1.5, y: Y0 - 5, width: Math.max(PX - 3, 2), height: 7 * PY + 10, rx: 7, fill: '#FFFFFF', 'fill-opacity': .025, 'class': 'lf-fade', style: 'animation-delay:' + (w * .04) + 's' });
      }

      /* month labels centered over each month's first week */
      var lastMon = -1;
      dates.forEach(function (ds, i) {
        var w = Math.floor((offset + i) / 7), d = (offset + i) % 7;
        var mo = parseInt(ds.slice(5, 7), 10);
        if (d === 0 && mo !== lastMon) {
          lastMon = mo;
          txt(s, { x: cxOf(w), y: Y0 - 20, 'font-size': 11.5, 'font-weight': 800, fill: MUTED, 'text-anchor': 'middle', 'letter-spacing': '.06em', 'class': 'lf-fade', style: 'animation-delay:' + (w * .03) + 's' }, mo + '月');
        }
      });

      /* weekday labels */
      [['MON', 0], ['WED', 2], ['FRI', 4], ['SUN', 6]].forEach(function (p, kk) {
        txt(s, { x: startX - 14, y: cyOf(p[1]) + 4, 'font-size': 10.5, 'font-weight': 700, fill: MUTED, 'text-anchor': 'end', 'letter-spacing': '.06em', 'class': 'lf-fade', style: 'animation-delay:' + (kk * .04) + 's' }, p[0]);
      });

      /* day dots — one dot = one day, area = volume */
      var peakW = 0, peakD = 0;
      dates.forEach(function (ds, i) {
        var w = Math.floor((offset + i) / 7), d = (offset + i) % 7;
        var t = values[i] || 0;
        if (t >= max) { peakW = w; peakD = d; }
        var x = cxOf(w), y = cyOf(d);
        var delay = w * .05 + d * .012;
        if (!t) { el(s, 'circle', { cx: x, cy: y, r: 1.6, fill: SILENT, 'class': 'lf-pop', style: 'animation-delay:' + delay + 's' }); return; }
        var dot = el(s, 'circle', { cx: x, cy: y, r: rad(t), fill: t > max * .66 ? HERO : (t > max * .33 ? INK : L[4]), 'class': 'lf-pop', style: 'animation-delay:' + delay + 's' });
        tip(dot, ds + ' — ' + t + ' 条');
      });

      /* peak-day ring + callout */
      var px = cxOf(peakW), py = cyOf(peakD), pr = rad(max);
      el(s, 'circle', { cx: px, cy: py, r: pr + 6, fill: 'none', stroke: HERO, 'stroke-width': 1.3, 'stroke-dasharray': '3 4', 'class': 'lf-fade', style: 'animation-delay:1s' });
      var labX = px + pr + 14, anchor = 'start';
      if (labX + 96 > startX + gridW) { labX = px - pr - 14; anchor = 'end'; }
      txt(s, { x: labX, y: py + 4, 'font-size': 11.5, 'font-weight': 700, fill: HERO, 'text-anchor': anchor, 'class': 'lf-fade', style: 'animation-delay:1.1s' }, '峰值 ' + max + ' 条');

      /* legend panel — size/color scale + totals */
      if (legendW) {
        var lx = startX + gridW + gap;
        var panelH = 7 * PY + 44;
        el(s, 'rect', { x: lx - 20, y: Y0 - 30, width: legendW, height: panelH, rx: 13, fill: '#FFFFFF', 'fill-opacity': .022, 'class': 'lf-fade' });
        txt(s, { x: lx, y: Y0 - 8, 'font-size': 11, 'font-weight': 800, fill: INK, 'letter-spacing': '.12em', 'class': 'lf-fade' }, '图例');
        [['峰值日', HERO, 13], ['中量', INK, 9.5], ['低量', L[4], 6], ['静默日', SILENT, 2]].forEach(function (r, i) {
          var yy = Y0 + 26 + i * 32;
          el(s, 'circle', { cx: lx + 14, cy: yy, r: r[2], fill: r[1], 'class': 'lf-pop', style: 'animation-delay:' + (1 + i * .08) + 's' });
          txt(s, { x: lx + 38, y: yy + 4, 'font-size': 11.5, fill: MUTED, 'class': 'lf-fade', style: 'animation-delay:' + (1 + i * .08) + 's' }, r[0]);
        });
        txt(s, { x: lx, y: Y0 + 26 + 4 * 32 + 6, 'font-size': 10.5, 'font-weight': 600, fill: FAINT, 'letter-spacing': '.04em', 'class': 'lf-fade', style: 'animation-delay:1.4s' },
          '共 ' + total + ' 条 · 静默 ' + quiet + ' 天');
      }

      txt(s, { x: W / 2, y: H - 12, 'font-size': 10, 'font-weight': 600, fill: FAINT, 'text-anchor': 'middle', 'letter-spacing': '.1em', 'class': 'lf-fade', style: 'animation-delay:1.2s' },
        '1 点 = 1 天 · 点面积 = 当日舆情量 · 小点 = 静默日');
    }
    render(); replayable(container, render);
  }

  /* ════ F5 · tick rows ════ */
  function tickRows(container, data, options) {
    if (!container || !data || !data.length) return;
    var opts = options || {};
    function render() {
      var rows = data.slice().sort(function (a, b) { return b.value - a.value; });
      var m = measure(container), W = m.W, H = m.H;
      var s = rootSvg(container, W, H);
      var X0 = opts.labelWidth || Math.min(150, W * 0.32), mr = 70;
      var rowH = (H - 64) / rows.length;
      var maxV = maxOf(rows.map(function (d) { return d.value; }));
      var avail = W - X0 - mr;
      var unit = unitFor(maxV, Math.max(8, Math.floor(avail / 10)));
      var maxTicks = Math.max(1, Math.round(maxV / unit));
      var PX = avail / maxTicks;
      rows.forEach(function (row, i) {
        var y = 34 + i * rowH;
        var v = Math.round(row.value / unit);
        txt(s, { x: X0 - 12, y: y + 4, 'font-size': 11.5, 'font-weight': 700, fill: MUTED, 'text-anchor': 'end', 'letter-spacing': '.04em', 'class': 'lf-fade', style: 'animation-delay:' + (i * .08) + 's' }, row.name);
        el(s, 'line', { x1: X0, y1: y + 11, x2: X0 + Math.max(v, 1) * PX + 5, y2: y + 11, stroke: GRID, 'stroke-width': .7, 'class': 'lf-fade', style: 'animation-delay:' + (i * .08) + 's' });
        for (var k = 0; k < v; k++) {
          var x = X0 + k * PX + PX / 2, hh = 11 + rnd(k + 1, i + 2) * 7;
          el(s, 'line', { x1: x, y1: y + 11, x2: x, y2: y + 11 - hh, stroke: INK, 'stroke-width': 1.1, opacity: .55 + rnd(k + 3, i + 5) * .45, 'class': 'lf-fade', style: 'animation-delay:' + (i * .08 + k * .012) + 's' });
          if (k % 5 === 4) el(s, 'circle', { cx: x, cy: y + 16, r: 1.1, fill: FAINT, 'class': 'lf-fade', style: 'animation-delay:' + (i * .08 + k * .012) + 's' });
        }
        var lab = txt(s, { x: X0 + v * PX + 14, y: y + 6, 'font-size': 15, 'font-weight': 800, fill: i === 0 ? HERO : INK, 'class': 'lf-fade', style: 'animation-delay:' + (.4 + i * .08) + 's' }, row.value);
        tip(lab, row.name + ' — ' + row.value);
      });
      txt(s, { x: W / 2, y: H - 12, 'font-size': 10, 'font-weight': 600, fill: FAINT, 'text-anchor': 'middle', 'letter-spacing': '.1em', 'class': 'lf-fade', style: 'animation-delay:.9s' },
        '1 刻 = ' + unit + ' · 每第 5 刻标点');
    }
    render(); replayable(container, render);
  }

  /* ════ B1 · rung bars ════ */
  function rungBars(container, data) {
    if (!container || !data || !data.length) return;
    function render() {
      var m = measure(container), W = m.W, H = m.H;
      var s = rootSvg(container, W, H);
      var n = data.length;
      var base = H - 50, topPad = 34;
      var maxV = maxOf(data.map(function (d) { return d.value; }));
      var unit = unitFor(maxV, Math.max(6, Math.floor((base - topPad) / 8)));
      var maxRungs = Math.max(1, Math.round(maxV / unit));
      var step = (base - topPad) / maxRungs;
      var span = W - 110;
      var stepX = n > 1 ? span / (n - 1) : 0;
      var x0 = function (i) { return n > 1 ? 55 + i * stepX : W / 2; };
      var HW = Math.min(stepX * 0.30, 22, Math.max(8, stepX * 0.30));
      data.forEach(function (row, i) {
        var x = x0(i);
        var v = Math.round(row.value / unit);
        for (var k = 0; k < v; k++) {
          var y = base - k * step, w = HW - 2 + rnd(k + 1, i + 2) * 4;
          el(s, 'line', { x1: x - w, y1: y, x2: x + w, y2: y, stroke: INK, 'stroke-width': 1.3, opacity: .5 + rnd(k + 2, i + 4) * .5, 'class': 'lf-fade', style: 'animation-delay:' + (i * .08 + k * .012) + 's' });
          if (k % 5 === 4) el(s, 'circle', { cx: x + HW + 6, cy: y, r: 1.1, fill: FAINT, 'class': 'lf-fade', style: 'animation-delay:' + (i * .08 + k * .012) + 's' });
        }
        var topY = base - Math.max(v - 1, 0) * step;
        var num = txt(s, { x: x, y: topY - 13, 'font-size': 15, 'font-weight': 800, fill: HERO, 'text-anchor': 'middle', 'class': 'lf-fade', style: 'animation-delay:' + (.4 + i * .08) + 's' }, row.value);
        tip(num, row.name + ' — ' + row.value);
        txt(s, { x: x, y: base + 22, 'font-size': 11, 'font-weight': 700, fill: MUTED, 'text-anchor': 'middle', 'letter-spacing': '.04em', 'class': 'lf-fade', style: 'animation-delay:' + (i * .08) + 's' }, row.name);
      });
      el(s, 'line', { x1: 34, y1: base + 5, x2: W - 34, y2: base + 5, stroke: GRID, 'stroke-width': 1, 'class': 'lf-fade' });
      txt(s, { x: W / 2, y: H - 12, 'font-size': 10, 'font-weight': 600, fill: FAINT, 'text-anchor': 'middle', 'letter-spacing': '.1em', 'class': 'lf-fade', style: 'animation-delay:.9s' },
        '1 横档 = ' + unit + ' · 每第 5 档标点');
    }
    render(); replayable(container, render);
  }

  /* ════ F8 · plumb scatter ════ */
  function scatterPlot(container, data, options) {
    if (!container || !data || !data.length) return;
    var opts = options || {};
    function render() {
      var m = measure(container), W = m.W, H = m.H;
      var s = rootSvg(container, W, H);
      var X0 = 56, X1 = W - 30, base = H - 48, topPad = 30;
      var maxY = maxOf(data.map(function (d) { return d.y; }));
      var mapX = function (p) { return X0 + (p / 100) * (X1 - X0); };
      var mapY = function (v) { return base - (v / maxY) * (base - topPad); };
      for (var g = 0; g <= 20; g++) {
        var gx = X0 + g / 20 * (X1 - X0);
        el(s, 'line', { x1: gx, y1: base, x2: gx, y2: base - (g % 5 === 0 ? 9 : 5), stroke: GRIDSOFT, 'stroke-width': .7, 'class': 'lf-fade', style: 'animation-delay:' + (g * .01) + 's' });
      }
      el(s, 'line', { x1: X0 - 8, y1: base, x2: X1 + 8, y2: base, stroke: GRID, 'stroke-width': 1, 'class': 'lf-fade' });
      txt(s, { x: X0, y: base + 20, 'font-size': 10.5, 'font-weight': 600, fill: FAINT, 'class': 'lf-fade' }, '低');
      txt(s, { x: X1, y: base + 20, 'font-size': 10.5, 'font-weight': 600, fill: FAINT, 'text-anchor': 'end', 'class': 'lf-fade' }, '高');
      var hi = data[0], lo = data[0];
      data.forEach(function (d) { if (d.y > hi.y) hi = d; if (d.y < lo.y) lo = d; });
      data.forEach(function (d, i) {
        var x = mapX(d.x), y = mapY(d.y);
        var hero = d === hi || d === lo;
        el(s, 'line', { x1: x, y1: base, x2: x, y2: y, stroke: L[4], 'stroke-width': .6, opacity: .55, 'class': 'lf-fade', style: 'animation-delay:' + (.2 + i * .05) + 's' });
        var dot = el(s, 'circle', { cx: x, cy: y, r: hero ? 5.5 : 3.2, fill: hero ? HERO : L[3], 'class': 'lf-pop', style: 'animation-delay:' + (.25 + i * .05) + 's' });
        tip(dot, (d.label || '') + ' — ' + (opts.xName || 'x') + ' ' + Math.round(d.x) + ' · ' + (opts.yName || 'y') + ' ' + Math.round(d.y));
        if (hero) txt(s, halo({ x: x, y: y - 12, 'font-size': 12, 'font-weight': 800, fill: INK, 'text-anchor': 'middle', 'class': 'lf-fade' }, .8), (d.label || '') + ' · ' + Math.round(d.y));
      });
      txt(s, { x: 22, y: mapY(maxY * .9), 'font-size': 10.5, 'font-weight': 600, fill: FAINT, transform: 'rotate(-90 22 ' + mapY(maxY * .9) + ')', 'text-anchor': 'end', 'letter-spacing': '.06em', 'class': 'lf-fade' }, (opts.yName || 'Y') + ' ↑');
      txt(s, { x: W / 2, y: H - 12, 'font-size': 10, 'font-weight': 600, fill: FAINT, 'text-anchor': 'middle', 'letter-spacing': '.1em', 'class': 'lf-fade', style: 'animation-delay:1s' },
        '每点垂一条铅垂线 · 在底线读横轴');
    }
    render(); replayable(container, render);
  }

  /* ════ F11 · tick gauge ════ */
  function tickGauge(container, value, options) {
    if (!container) return;
    var opts = options || {};
    function render() {
      var m = measure(container), W = m.W, H = m.H;
      var s = rootSvg(container, W, H);
      var cx = W / 2, cy = H * 0.60;
      var R0 = Math.min(W * 0.34, (H - 56) * 0.46);
      var A0 = -195, SW = 210;
      var goal = Math.max(0, Math.min(100, Math.round(value)));
      var beadColor = opts.color || HERO;
      for (var k = 0; k < 100; k++) {
        var a = A0 + k / 100 * SW, inked = k < goal;
        var len = inked ? R0 * 0.13 + rnd(k + 1, 3) * R0 * 0.05 : R0 * 0.05 + rnd(k + 1, 7) * R0 * 0.02;
        var p1 = pol(cx, cy, R0, a), p2 = pol(cx, cy, R0 + len, a);
        el(s, 'line', { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], stroke: inked ? INK : GRIDSOFT, 'stroke-width': inked ? 1.3 : .7, 'class': 'lf-fade', style: 'animation-delay:' + (k * .012) + 's' });
      }
      [25, 50, 75, 100].forEach(function (mm) {
        var a = A0 + mm / 100 * SW;
        var dp = pol(cx, cy, R0 - 8, a), tp = pol(cx, cy, R0 - 22, a);
        el(s, 'circle', { cx: dp[0], cy: dp[1], r: 1.4, fill: L[4], 'class': 'lf-fade', style: 'animation-delay:.8s' });
        txt(s, { x: tp[0], y: tp[1] + 4, 'font-size': 10, 'font-weight': 600, fill: FAINT, 'text-anchor': 'middle', 'class': 'lf-fade', style: 'animation-delay:.85s' }, mm);
      });
      var aT = A0 + goal / 100 * SW, ep = pol(cx, cy, R0 + R0 * 0.20, aT);
      el(s, 'circle', { cx: ep[0], cy: ep[1], r: 3.4, fill: beadColor, 'class': 'lf-pop', style: 'animation-delay:1.1s' });
      var num = txt(s, { x: cx, y: cy - 2, 'font-size': Math.max(26, R0 * 0.42), 'font-weight': 800, fill: INK, 'text-anchor': 'middle', 'class': 'lf-fade', style: 'animation-delay:1s' }, goal + '%');
      tip(num, (opts.label || 'value') + ' — ' + goal + '%');
      txt(s, { x: cx, y: cy + 20, 'font-size': 11, 'font-weight': 600, fill: MUTED, 'text-anchor': 'middle', 'letter-spacing': '.08em', 'class': 'lf-fade', style: 'animation-delay:1.05s' },
        opts.label ? opts.label + ' · 还差 ' + (100 - goal) + ' 格' : '还差 ' + (100 - goal) + ' 格');
      txt(s, { x: W / 2, y: H - 10, 'font-size': 10, 'font-weight': 600, fill: FAINT, 'text-anchor': 'middle', 'letter-spacing': '.1em', 'class': 'lf-fade', style: 'animation-delay:1.2s' },
        '1 格 = 1% · 上墨 = 已完成');
    }
    render(); replayable(container, render);
  }

  /* ════ radar — ECharts native + project dark skin (skill: never rebuild radar) ════ */
  function sentimentRadar(container, data) {
    if (!container || !global.echarts || !data) return;
    var inst = global.echarts.getInstanceByDom(container) || global.echarts.init(container);
    if (echartsInstances.indexOf(inst) < 0) echartsInstances.push(inst);
    inst.clear();
    inst.setOption({
      animationDuration: 900,
      animationEasing: 'cubicOut',
      tooltip: {
        backgroundColor: HALO, borderColor: 'rgba(245,208,0,.28)', borderWidth: 1, padding: [8, 12],
        textStyle: { color: INK, fontFamily: 'Inter', fontSize: 12 },
        extraCssText: 'box-shadow:0 8px 26px rgba(0,0,0,.55);border-radius:9px;'
      },
      radar: {
        indicator: data.indicators,
        radius: '66%',
        center: ['50%', '54%'],
        axisName: { color: MUTED, fontSize: 12, fontWeight: 600 },
        splitLine: { lineStyle: { color: GRID } },
        axisLine: { lineStyle: { color: GRID } },
        splitArea: { areaStyle: { color: ['transparent'] } }
      },
      series: [{
        type: 'radar',
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: HERO, width: 1.6 },
        itemStyle: { color: HERO },
        areaStyle: { color: 'rgba(245, 208, 0, 0.12)' },
        data: data.series.map(function (sr) { return { value: sr.values, name: sr.name }; })
      }]
    });
    if (container._lfRadarRO) { try { container._lfRadarRO.disconnect(); } catch (e) { } }
    if (global.ResizeObserver) {
      var t; container._lfRadarRO = new ResizeObserver(function () { clearTimeout(t); t = setTimeout(function () { inst.resize(); }, 140); });
      container._lfRadarRO.observe(container);
    }
  }

  function disposeChart(elDom) {
    if (!elDom) return;
    if (elDom._lfRO) { try { elDom._lfRO.disconnect(); } catch (e) { } elDom._lfRO = null; }
    if (elDom._lfRadarRO) { try { elDom._lfRadarRO.disconnect(); } catch (e) { } elDom._lfRadarRO = null; }
    if (global.echarts) {
      var inst = global.echarts.getInstanceByDom(elDom);
      if (inst) { inst.dispose(); echartsInstances = echartsInstances.filter(function (x) { return x !== inst; }); }
    }
    elDom.innerHTML = '';
  }
  function disposeAll() {
    echartsInstances.forEach(function (inst) { try { inst.dispose(); } catch (e) { } });
    echartsInstances = [];
    document.querySelectorAll('svg.lf-svg').forEach(function (n) {
      if (n.parentNode) {
        if (n.parentNode._lfRO) { try { n.parentNode._lfRO.disconnect(); } catch (e) { } n.parentNode._lfRO = null; }
        if (n.parentNode._lfRadarRO) { try { n.parentNode._lfRadarRO.disconnect(); } catch (e) { } n.parentNode._lfRadarRO = null; }
        n.parentNode.innerHTML = '';
      }
    });
  }
  function resizeAll() {
    echartsInstances.forEach(function (inst) { try { inst.resize(); } catch (e) { } });
  }

  global.LieflatCharts = {
    hairlineArea: hairlineArea,
    radialPatchwork: radialPatchwork,
    hundredField: hundredField,
    heatCalendar: heatCalendar,
    tickRows: tickRows,
    rungBars: rungBars,
    scatterPlot: scatterPlot,
    tickGauge: tickGauge,
    sentimentRadar: sentimentRadar,
    disposeAll: disposeAll,
    disposeChart: disposeChart,
    resizeAll: resizeAll
  };
})(typeof window !== 'undefined' ? window : globalThis);
