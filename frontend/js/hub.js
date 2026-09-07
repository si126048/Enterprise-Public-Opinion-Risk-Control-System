/*
 * hub.js — the entry hall between the login transition and the application.
 * Self-contained: this page does not load app.js, so fetch / count-up / reveal
 * are implemented locally rather than reused.
 */
(function () {
  'use strict';

  if (!localStorage.getItem('auth_token')) {
    window.location.replace('login.html');
    return;
  }

  var COMPANY = 'mihoyo';
  var ONBOARD_DELAY = 2000;
  var ONBOARD_BEATS = 6;

  var hubMascot = null;
  var onboardDelay = 0;
  var onboardTimer = 0;
  var onboardN = 0;
  var dataReady = false;
  var loadReaction = 'ok';
  var riskAlert = 0;
  var leaving = false;
  var stageHidden = false;
  var lastHoverCard = null;
  var scrollQueued = false;

  var nums = {};
  var revealed = {};
  var revealPending = [];
  var revealIO = null;

  var reducedMotion = !!(window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function $(id) { return document.getElementById(id); }

  function hubFetch(url) {
    if (window.__DEMO_MODE) {
      return window.__demoFetch(url).then(function (res) {
        if (!res.ok) throw new Error(url + ' -> ' + res.status);
        return res.json();
      });
    }
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error(url + ' -> ' + res.status);
      return res.json();
    });
  }

  /* ---------------------------------------------------------------- numbers */

  function fmt(v, d) { return d ? v.toFixed(d) : String(Math.round(v)); }

  function countUp(el, to, decimals) {
    var from = parseFloat(el.getAttribute('data-v'));
    if (!isFinite(from)) from = 0;
    to = Number(to) || 0;
    el.setAttribute('data-v', String(to));
    if (reducedMotion || from === to) { el.textContent = fmt(to, decimals); return; }
    var start = null;
    function tick(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / 700, 1);
      el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - p, 3)), decimals);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function setNum(page, value, decimals) {
    nums[page] = { value: value, decimals: decimals || 0 };
    if (revealed[page]) paintNum(page);
  }

  function paintNum(page) {
    var rec = nums[page];
    var el = $('hub-num-' + page);
    if (rec && el) countUp(el, rec.value, rec.decimals);
  }

  function setChip(id, value) {
    var el = $(id);
    if (el) el.textContent = String(value);
  }

  function markRisk(n) {
    riskAlert = n;
    setChip('hub-chip-risk', n);
    if (n > 0) {
      var w = $('hub-chip-risk-wrap');
      if (w) w.classList.add('is-danger');
    }
  }

  /* --------------------------------------------------------------- mascot */

  function initMascot() {
    var svg = $('hub-mascot');
    if (!svg || typeof window.MascotCharacter !== 'function') return;

    hubMascot = new MascotCharacter(svg, { mode: 'hub', followPointer: true });
    hubMascot.setState('spawning');
    window.__hubMascot = hubMascot;

    svg.style.cursor = 'pointer';
    svg.addEventListener('click', function () {
      if (!hubMascot || onboardingActive()) return;
      minervaShow(mPick(M_CLICK));
      hubMascot.setState('curious');
      hubMascot.trick('bounce');
    });

    onboardDelay = setTimeout(function () {
      onboardDelay = 0;
      if (!hubMascot || leaving) return;
      onboardTimer = setInterval(function () {
        onboardN++;
        if (onboardN > ONBOARD_BEATS) { finishOnboarding(); return; }
        hubMascot.setState(window.MascotStates.onboardingState(onboardN));
      }, window.MascotStates.ONBOARDING_MS);
    }, ONBOARD_DELAY);
  }

  function stopOnboarding() {
    if (onboardDelay) { clearTimeout(onboardDelay); onboardDelay = 0; }
    if (onboardTimer) { clearInterval(onboardTimer); onboardTimer = 0; }
  }

  function onboardingActive() { return !!(onboardDelay || onboardTimer); }

  function finishOnboarding() {
    stopOnboarding();
    if (!hubMascot || leaving) return;
    /* requests still in flight: hold on the scan ring until they land */
    if (!dataReady) { hubMascot.setState('progress'); return; }
    applyReaction(loadReaction);
  }

  function reactToLoad(kind) {
    loadReaction = kind;
    if (onboardingActive()) return;      /* the entrance show owns the mascot */
    applyReaction(kind);
    if (kind === 'fail') {
      minervaShow(mPick(M_LOAD_FAIL));
    } else if (riskAlert > 0) {
      minervaShow(mFill(mPick(M_RISK_HIGH), riskAlert));
    } else if (kind === 'partial') {
      minervaShow(mPick(M_LOAD_PARTIAL));
    } else if (riskAlert === 0 && dataReady) {
      minervaShow(mPick(M_RISK_CLEAR));
    } else {
      minervaShow(mPick(M_LOAD_OK));
    }
  }

  function applyReaction(kind) {
    if (!hubMascot) return;
    if (kind === 'fail') { hubMascot.setState('surprised'); return; }
    if (riskAlert > 0) {
      hubMascot.setState('alerting', { holdMs: 4000, after: function () { return 'idle'; } });
      return;
    }
    hubMascot.setState(kind === 'partial' ? 'curious' : 'happy');
  }

  /* --------------------------------------------------------------- MINERVA */

  var mText = null, mCursor = null, mEl = null;
  var mQueue = [];
  var mTyping = false;
  var mTypeTimer = 0;

  var M_GREETING = [
    '系统启动完成。欢迎回来，操作者。',
    'MINERVA 已就绪。今日态势总体平稳。',
    '初始化完毕。所有模块在线，待命中。',
    '情报链路畅通。随时可以开始工作。',
    '数据管线校准完毕，采集源全部在线。'
  ];

  var M_CLICK = [
    '随时待命，操作者。',
    '系统运行正常，暂无异常。',
    '需要我为您分析当前态势吗？',
    '所有采集源在线，数据同步中。',
    '如需详细报告，请进入对应模块。',
    '已为您标记高风险条目。',
    '信度评分引擎运行正常。',
    '今日信息密度偏高，建议关注热点趋势。',
    '情感分析模型已完成今日第一轮校准。',
    '操作者，注意休息。系统会持续监控。',
    '当前无待处理告警。',
    '数据刷新周期：每 15 分钟一次。',
    '如需导出报告，请进入内容分析模块。',
    '风险雷达灵敏度已调至最高。',
    '所有嵌入点响应正常，延迟 < 50ms。'
  ];

  var M_RISK_HIGH = [
    '检测到 {n} 条高风险舆情，建议立即关注。',
    '风险信号聚集：{n} 条高信度负面条目。操作者，是否需要展开分析？',
    '预警：{n} 条内容触发了风险阈值。'
  ];

  var M_RISK_CLEAR = [
    '当前态势平稳，未检测到显著风险。',
    '全域扫描完毕，风险指标均在安全区间。',
    '今日暂无高信度负面事件。'
  ];

  var M_LOAD_OK = [
    '全部模块就绪。当前态势平稳。',
    '数据同步完成，各模块运行正常。',
    '加载完毕。系统状态良好。'
  ];

  var M_LOAD_PARTIAL = [
    '数据同步完成，部分模块待确认。',
    '部分数据源响应偏慢，已启用缓存兜底。',
    '加载完成。建议稍后刷新确认完整性。'
  ];

  var M_LOAD_FAIL = [
    '部分模块响应异常，已启用降级方案。',
    '数据链路出现中断，正在尝试重连。',
    '加载失败。操作者，请检查网络连接。'
  ];

  function mPick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function mFill(template, n) { return template.replace('{n}', n); }

  function minervaInit() {
    mEl = $('hub-minerva');
    mText = $('hub-minerva-text');
    mCursor = $('hub-minerva-cursor');
    if (!mEl || !mText) return;

    mEl.addEventListener('click', function () {
      if (mTyping) return;
      minervaShow(mPick(M_CLICK));
      if (hubMascot && !onboardingActive()) {
        hubMascot.setState('happy');
        hubMascot.trick('bounce');
      }
    });
  }

  function minervaShow(text) {
    if (!mText) return;
    mQueue.push(text);
    if (!mTyping) mDrain();
  }

  function mDrain() {
    if (!mQueue.length) { mTyping = false; return; }
    mTyping = true;
    var text = mQueue.shift();
    mText.textContent = '';
    var idx = 0;
    if (mTypeTimer) clearInterval(mTypeTimer);
    mTypeTimer = setInterval(function () {
      if (idx < text.length) {
        mText.textContent += text.charAt(idx);
        idx++;
      } else {
        clearInterval(mTypeTimer);
        mTypeTimer = 0;
        setTimeout(function () { mDrain(); }, 2800);
      }
    }, 38);
  }

  function minervaGreet() {
    minervaShow(mPick(M_GREETING));
  }

  /* ----------------------------------------------------------------- data */

  function loadAll() {
    var jobs = [];

    /* one response feeds three modules plus two of the three status chips */
    jobs.push(hubFetch('/api/stats/overview?company_id=' + COMPANY).then(function (d) {
      var trend = (d.trend_data && d.trend_data.total) || [];
      setNum('dashboard', trend.length ? trend[trend.length - 1] : 0);
      setNum('content', d.total_count || 0);
      setNum('topics', d.topic_distribution ? Object.keys(d.topic_distribution).length : 0);
      setChip('hub-chip-total', d.total_count || 0);
      markRisk(d.high_risk_count || 0);
    }));

    jobs.push(hubFetch('/api/risk/events?company_id=' + COMPANY).then(function (d) {
      var evs = d.events || [];
      var active = 0, high = 0;
      for (var i = 0; i < evs.length; i++) {
        var st = String(evs[i].status || '').toLowerCase();
        if (st !== 'closed' && st !== 'resolved' && st !== 'done') active++;
        var lv = String(evs[i].risk_level || evs[i].severity || '').toLowerCase();
        if (lv === 'high') high++;
      }
      setNum('risk-events', active);
      if (high > riskAlert) markRisk(high);
    }));

    jobs.push(hubFetch('/api/discovery/candidates').then(function (d) {
      var pending = (d.stats && d.stats.pending) || 0;
      setNum('review', pending);
      setChip('hub-chip-pending', pending);
    }));

    jobs.push(hubFetch('/api/credibility/overview?company_id=' + COMPANY).then(function (d) {
      setNum('credibility', (d.avg_score || 0) * 100, 1);
    }));

    jobs.push(hubFetch('/api/crawler/crawlers').then(function (d) {
      setNum('source-ledger', (d && d.length) || 0);
    }));

    jobs.push(hubFetch('/api/routing/status').then(function (d) {
      setNum('search', d.analyzed || 0);
    }));

    return Promise.all(jobs.map(function (p) {
      return p.then(function () { return true; }).catch(function (err) {
        console.warn('hub:', err.message);
        return false;
      });
    })).then(function (flags) {
      var ok = 0;
      for (var i = 0; i < flags.length; i++) if (flags[i]) ok++;
      dataReady = true;
      reactToLoad(ok === 0 ? 'fail' : (ok < flags.length ? 'partial' : 'ok'));
    });
  }

  /* --------------------------------------------------------------- reveal */

  function revealItem(el) {
    el.classList.add('revealed');
    if (revealIO) revealIO.unobserve(el);
    var at = revealPending.indexOf(el);
    if (at !== -1) revealPending.splice(at, 1);
    var page = el.getAttribute('data-page');
    if (page) { revealed[page] = true; paintNum(page); }
  }

  /* An instant jump can carry a card from below the fold to above it with no
   * sampled frame in between, so the observer never reports it and the card
   * keeps opacity 0 forever. Sweep for those. Reads are batched ahead of the
   * class writes so this costs one forced layout, not one per card. */
  function revealPassed() {
    if (!revealPending.length) return;
    var passed = [];
    for (var i = 0; i < revealPending.length; i++) {
      if (revealPending[i].getBoundingClientRect().bottom <= 0) passed.push(revealPending[i]);
    }
    for (var j = 0; j < passed.length; j++) revealItem(passed[j]);
  }

  function initReveal() {
    var items = document.querySelectorAll('.hub-reveal');
    var i;
    for (i = 0; i < items.length; i++) revealPending.push(items[i]);
    if (!('IntersectionObserver' in window)) {
      for (i = 0; i < items.length; i++) revealItem(items[i]);
      return;
    }
    revealIO = new IntersectionObserver(function (entries) {
      for (var k = 0; k < entries.length; k++) {
        var e = entries[k];
        if (e.isIntersecting || e.boundingClientRect.bottom <= 0) revealItem(e.target);
      }
    }, { threshold: 0.15 });
    for (i = 0; i < items.length; i++) revealIO.observe(items[i]);
    revealPassed();
  }

  /* ---------------------------------------------------------------- scroll */

  function applyScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    var vh = window.innerHeight || 800;

    revealPassed();

    if (!leaving && !reducedMotion) {
      var stage = $('hub-stage');
      if (stage) {
        if (y < vh * 1.2) {
          stage.style.transform = 'translateY(' + (y * 0.25).toFixed(1) + 'px)';
          stage.style.opacity = String(Math.max(0, 1 - y / 600));
        } else {
          stage.style.transform = '';
          stage.style.opacity = '';
        }
      }
    }

    var hidden = y > vh * 0.55;
    if (hidden !== stageHidden) {
      stageHidden = hidden;
      if (!hubMascot || leaving || onboardingActive()) return;
      hubMascot.setState(hidden ? 'listening' : 'idle');
    }
  }

  function initScroll() {
    window.addEventListener('scroll', function () {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(function () { scrollQueued = false; applyScroll(); });
    }, { passive: true });
    applyScroll();
  }

  function scrollToModules() {
    var el = $('hub-modules');
    if (!el) return;
    var y = el.getBoundingClientRect().top + (window.pageYOffset || 0) - 16;
    if (reducedMotion) window.scrollTo(0, y);
    else window.scrollTo({ top: y, behavior: 'smooth' });
  }

  /* ------------------------------------------------------------------ nav */

  function ancestorWithClass(node, cls) {
    while (node && node !== document.body) {
      if (node.nodeType === 1 && (' ' + node.className + ' ').indexOf(' ' + cls + ' ') > -1) return node;
      node = node.parentNode;
    }
    return null;
  }

  function enter(page) {
    if (leaving) return;
    leaving = true;
    try { sessionStorage.setItem('app_pending_page', page); } catch (e) { /* private mode */ }
    stopOnboarding();
    if (hubMascot) { hubMascot.setState('excited'); hubMascot.trick('spin'); }

    var stage = $('hub-stage');
    if (stage) { stage.style.transform = ''; stage.style.opacity = ''; }
    document.body.classList.add('hub-leaving');
    setTimeout(function () { window.location.href = 'index.html'; }, 420);
  }

  function initNav() {
    var grid = $('hub-module-grid');
    var enterBtn = $('hub-enter');

    if (grid) {
      grid.addEventListener('click', function (e) {
        var card = ancestorWithClass(e.target, 'hub-module');
        if (!card) return;
        e.preventDefault();
        enter(card.getAttribute('data-page') || 'dashboard');
      });
      grid.addEventListener('mouseover', function (e) {
        var card = ancestorWithClass(e.target, 'hub-module');
        if (!card || card === lastHoverCard || leaving) return;
        lastHoverCard = card;
        if (hubMascot && !onboardingActive()) hubMascot.setState('curious');
      });
      grid.addEventListener('mouseleave', function () { lastHoverCard = null; });
    }

    if (enterBtn) {
      enterBtn.addEventListener('click', function () {
        enter(enterBtn.getAttribute('data-page') || 'dashboard');
      });
    }

    var sw = $('hub-switch');
    if (sw) {
      sw.addEventListener('click', function () {
        stopOnboarding();
        try {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
        } catch (e) { /* ignore */ }
        window.location.href = 'login.html';
      });
    }

    document.addEventListener('keydown', function (e) {
      if (leaving || e.key !== 'ArrowDown') return;
      var stage = $('hub-stage');
      if (!stage) return;
      var r = stage.getBoundingClientRect();
      if (r.top >= window.innerHeight * 0.5 || r.bottom <= 0) return;
      e.preventDefault();
      scrollToModules();
    });
  }

  /* ---------------------------------------------------------------- clock */

  function initClock() {
    var el = $('hub-clock');
    if (!el) return;
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function tick() {
      var d = new Date();
      el.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ----------------------------------------------------------------- boot */

  function boot() {
    initClock();
    initMascot();
    initReveal();
    initNav();
    initScroll();
    loadAll();
    minervaInit();
    setTimeout(minervaGreet, 2800);

    window.addEventListener('pagehide', function () {
      stopOnboarding();
      if (hubMascot) { hubMascot.destroy(); hubMascot = null; }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
