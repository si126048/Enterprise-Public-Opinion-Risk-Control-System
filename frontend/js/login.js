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
      if (btnLogin) {
        btnLogin.classList.remove('loading');
        btnLogin.classList.add('success');
      }

      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', data.user.username);

      setTimeout(function() {
        window.location.href = 'index.html';
      }, 600);
    })
    .catch(function(err) {
      if (btnLogin) btnLogin.classList.remove('loading');
      showError(loginError, err.message || '账号或密码错误');
    });
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
