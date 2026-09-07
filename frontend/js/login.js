// login.js - Login page logic with account login and register

(function() {
  'use strict';

  var tabs = document.querySelectorAll('.login-tab');
  var formAccount = document.getElementById('login-form-account');
  var formRegister = document.getElementById('login-form-register');
  var formTitle = document.getElementById('form-title');

  var emailInput = document.getElementById('email');
  var passwordInput = document.getElementById('password');
  var btnLogin = document.getElementById('btn-login');
  var loginError = document.getElementById('login-error');

  var regUsernameInput = document.getElementById('reg-username');
  var regPasswordInput = document.getElementById('reg-password');
  var regPasswordConfirmInput = document.getElementById('reg-password-confirm');
  var btnRegister = document.getElementById('btn-register');
  var registerError = document.getElementById('register-error');
  var registerSuccess = document.getElementById('register-success');

  // Tab switching
  function initTabs() {
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        var target = this.getAttribute('data-tab');
        tabs.forEach(function(t) { t.classList.remove('active'); });
        this.classList.add('active');

        if (target === 'account') {
          formAccount.style.display = 'flex';
          formRegister.style.display = 'none';
          formTitle.textContent = '账号登录';
        } else if (target === 'register') {
          formAccount.style.display = 'none';
          formRegister.style.display = 'flex';
          formTitle.textContent = '注册账号';
        }

        hideErrors();
      });
    });
  }

  function hideErrors() {
    if (loginError) loginError.classList.remove('visible');
    if (registerError) registerError.classList.remove('visible');
    if (registerSuccess) registerSuccess.classList.remove('visible');
  }

  function showError(el, msg) {
    if (el) {
      el.textContent = msg;
      el.classList.add('visible');
    }
  }

  // Login form submit
  function handleSubmit(e) {
    e.preventDefault();
    hideErrors();

    var username = emailInput.value.trim();
    var password = passwordInput.value.trim();

    if (!username) {
      emailInput.focus();
      return;
    }
    if (!password) {
      passwordInput.focus();
      return;
    }

    if (btnLogin) btnLogin.classList.add('loading');

    if (window.__DEMO_MODE) {
      onLoginSuccess({ token: 'demo-token', user: { username: username } });
      return;
    }

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    })
    .then(function(res) {
      return res.json().then(function(data) {
        if (!res.ok) throw new Error(data.detail || '登录失败');
        return data;
      });
    })
    .then(function(data) {
      onLoginSuccess(data);
    })
    .catch(function(err) {
      if (btnLogin) btnLogin.classList.remove('loading');
      showError(loginError, err.message || '账号或密码错误');
    });
  }

  function onLoginSuccess(data) {
    if (btnLogin) {
      btnLogin.classList.remove('loading');
      btnLogin.classList.add('success');
    }

    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_user', (data.user && data.user.username) || '');

    var overlay = document.createElement('div');
    overlay.className = 'system-log-overlay';
    overlay.innerHTML =
      '<div class="sl-hud">' +
        '<div class="sl-watermark">舆情风控<span>OPINION RISK CONTROL SYSTEM</span></div>' +
        '<div class="sl-diamond-bg"></div>' +
        '<div class="sl-scanline"></div>' +
        '<div class="sl-hazard sl-hazard-t"></div><div class="sl-hazard sl-hazard-b"></div>' +
        '<div class="sl-corner sl-corner-tl"></div><div class="sl-corner sl-corner-tr"></div>' +
        '<div class="sl-corner sl-corner-bl"></div><div class="sl-corner sl-corner-br"></div>' +
        '<div class="sl-tag sl-tag-tl">STATUS MONITOR</div>' +
      '</div>' +
      '<div class="system-log-container">' +
        '<div class="system-log-header"><span class="sl-title"><i class="sl-diamond"></i>SYSTEM LOG</span><span class="system-log-pct" id="system-log-pct">0%</span></div>' +
        '<div class="system-log-content" id="system-log-content"></div>' +
        '<div class="system-log-progress"><span class="slp-label">SYSTEM INITIALIZING</span><span class="slp-bar" id="system-log-bar"></span><span class="slp-clock" id="sl-clock">--:--:--</span></div>' +
      '</div>';
    document.body.appendChild(overlay);

    var logLines = [
      { text: '> 建立安全通道...', status: 'OK', pct: 4 },
      { text: '> 验证身份令牌...', status: 'OK', pct: 9 },
      { text: '> 系统初始化中... 12%', pct: 12 },
      { text: '> 加载核心模块 kernel.sys...', status: 'OK', pct: 18 },
      { text: '> 加载核心模块 auth.sys...', status: 'OK', pct: 24 },
      { text: '> 加载核心模块 monitor.sys...', status: 'OK', pct: 31 },
      { text: '> 正在探测硬件_ 37%', pct: 37 },
      { text: '> 内存校验 4096MB...', status: 'PASS', pct: 44 },
      { text: '> 挂载数据卷 /data/opinion...', status: 'OK', pct: 52 },
      { text: '> 同步舆情索引... 58%', pct: 58 },
      { text: '> 同步舆情索引... 66%', pct: 66 },
      { text: '> 正在加载用户数据_ 73%', pct: 73 },
      { text: '> 初始化风控引擎 risk-engine v2.4...', status: 'OK', pct: 81 },
      { text: '> 校准信度分析模型... 88%', pct: 88 },
      { text: '> 渲染界面组件 ui-kit... 94%', pct: 94 },
      { text: '> 系统就绪, 正在进入系统_', pct: 100 },
    ];

    var logContent = document.getElementById('system-log-content');
    var pctEl = document.getElementById('system-log-pct');
    var barEl = document.getElementById('system-log-bar');
    var clockEl = document.getElementById('sl-clock');
    var STEP = 150;
    var BAR_LEN = 36;
    var shownPct = 0;

    function renderBar(pct) {
      var filled = Math.round(pct / 100 * BAR_LEN);
      barEl.innerHTML = '<span class="slp-dim">[</span>' +
        '<span class="slp-fill">' + new Array(filled + 1).join('/') + '</span>' +
        '<span class="slp-dim">' + new Array(BAR_LEN - filled + 1).join(' ') + ']</span>';
    }

    function animatePct(to) {
      var from = shownPct;
      shownPct = to;
      var start = null;
      function tick(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / 400, 1);
        pctEl.textContent = Math.round(from + (to - from) * p) + '%';
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    function tickClock() {
      var d = new Date();
      function pad(n) { return n < 10 ? '0' + n : '' + n; }
      clockEl.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }
    tickClock();
    var clockTimer = setInterval(tickClock, 1000);
    renderBar(0);

    logLines.forEach(function(line, i) {
      setTimeout(function() {
        var lineEl = document.createElement('div');
        lineEl.className = 'system-log-line';
        var textEl = document.createElement('span');
        textEl.className = 'log-text';
        textEl.textContent = line.text;
        lineEl.appendChild(textEl);
        if (line.status) {
          var stEl = document.createElement('span');
          stEl.className = 'log-status' + (line.status === 'PASS' ? ' pass' : '');
          stEl.textContent = line.status;
          lineEl.appendChild(stEl);
        }
        logContent.appendChild(lineEl);
        logContent.scrollTop = logContent.scrollHeight;
        animatePct(line.pct);
        renderBar(line.pct);
      }, i * STEP);
    });

    setTimeout(function() {
      clearInterval(clockTimer);
      overlay.classList.add('fade-out');
      setTimeout(function() {
        window.location.href = 'hub.html';
      }, 400);
    }, logLines.length * STEP + 500);
  }

  // Register form submit
  function handleRegister(e) {
    e.preventDefault();
    hideErrors();

    var username = regUsernameInput.value.trim();
    var password = regPasswordInput.value.trim();
    var passwordConfirm = regPasswordConfirmInput.value.trim();

    if (!username) {
      regUsernameInput.focus();
      return;
    }
    if (username.length < 3) {
      showError(registerError, '用户名至少 3 个字符');
      return;
    }
    if (!password) {
      regPasswordInput.focus();
      return;
    }
    if (password.length < 6) {
      showError(registerError, '密码至少 6 个字符');
      return;
    }
    if (password !== passwordConfirm) {
      showError(registerError, '两次输入的密码不一致');
      return;
    }

    if (btnRegister) btnRegister.classList.add('loading');

    fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password, email: '' })
    })
    .then(function(res) {
      return res.json().then(function(data) {
        if (!res.ok) throw new Error(data.detail || '注册失败');
        return data;
      });
    })
    .then(function(data) {
      if (btnRegister) {
        btnRegister.classList.remove('loading');
        btnRegister.classList.add('success');
      }

      if (registerSuccess) registerSuccess.classList.add('visible');

      // Clear form
      regUsernameInput.value = '';
      regPasswordInput.value = '';
      regPasswordConfirmInput.value = '';

      // Switch to login tab after 1.5s
      setTimeout(function() {
        var accountTab = document.querySelector('[data-tab="account"]');
        if (accountTab) accountTab.click();
      }, 1500);
    })
    .catch(function(err) {
      if (btnRegister) btnRegister.classList.remove('loading');
      showError(registerError, err.message || '注册失败');
    });
  }

  // Input focus effects
  function setupInputEffects() {
    var inputs = document.querySelectorAll('.form-input');
    inputs.forEach(function(input) {
      input.addEventListener('focus', function() {
        hideErrors();
      });
    });
  }

  // Init
  function init() {
    initTabs();
    setupInputEffects();

    if (formAccount) {
      formAccount.addEventListener('submit', handleSubmit);
    }
    if (formRegister) {
      formRegister.addEventListener('submit', handleRegister);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
