// login.js - Login page logic with tab switching

(function() {
  'use strict';

  var tabs = document.querySelectorAll('.login-tab');
  var formAccount = document.getElementById('login-form-account');
  var formCode = document.getElementById('login-form-code');
  var emailInput = document.getElementById('email');
  var passwordInput = document.getElementById('password');
  var btnLogin = document.getElementById('btn-login');
  var loginError = document.getElementById('login-error');
  var btnSendCode = document.getElementById('btn-send-code');

  // Tab switching
  function initTabs() {
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        var target = this.getAttribute('data-tab');
        tabs.forEach(function(t) { t.classList.remove('active'); });
        this.classList.add('active');

        if (target === 'account') {
          formAccount.style.display = 'flex';
          formCode.style.display = 'none';
        } else {
          formAccount.style.display = 'none';
          formCode.style.display = 'flex';
        }

        if (loginError) loginError.classList.remove('visible');
      });
    });
  }

  // Send verification code (simulated)
  function initSendCode() {
    if (!btnSendCode) return;
    btnSendCode.addEventListener('click', function() {
      var phoneInput = document.getElementById('phone');
      if (!phoneInput || !phoneInput.value.trim()) {
        phoneInput.focus();
        return;
      }

      var btn = this;
      var countdown = 60;
      btn.disabled = true;
      btn.textContent = countdown + 's';

      var timer = setInterval(function() {
        countdown--;
        btn.textContent = countdown + 's';
        if (countdown <= 0) {
          clearInterval(timer);
          btn.disabled = false;
          btn.textContent = '获取验证码';
        }
      }, 1000);
    });
  }

  // Form submit
  function handleSubmit(e) {
    e.preventDefault();

    var email = emailInput.value.trim();
    var password = passwordInput.value.trim();

    if (loginError) loginError.classList.remove('visible');

    if (!email) {
      emailInput.focus();
      return;
    }
    if (!password) {
      passwordInput.focus();
      return;
    }

    if (btnLogin) btnLogin.classList.add('loading');

    setTimeout(function() {
      if (password === 'admin123' || (email && password)) {
        if (btnLogin) {
          btnLogin.classList.remove('loading');
          btnLogin.classList.add('success');
        }

        localStorage.setItem('auth_token', 'demo_token_' + Date.now());
        localStorage.setItem('auth_user', email);

        setTimeout(function() {
          window.location.href = 'index.html';
        }, 800);
      } else {
        if (btnLogin) btnLogin.classList.remove('loading');
        if (loginError) loginError.classList.add('visible');
      }
    }, 1200);
  }

  // Code form submit
  function handleCodeSubmit(e) {
    e.preventDefault();
    localStorage.setItem('auth_token', 'demo_token_' + Date.now());
    localStorage.setItem('auth_user', document.getElementById('phone').value);
    window.location.href = 'index.html';
  }

  // Input focus effects
  function setupInputEffects() {
    var inputs = document.querySelectorAll('.form-input');
    inputs.forEach(function(input) {
      input.addEventListener('focus', function() {
        if (loginError) loginError.classList.remove('visible');
      });
    });
  }

  // Init
  function init() {
    initTabs();
    initSendCode();
    setupInputEffects();

    if (formAccount) {
      formAccount.addEventListener('submit', handleSubmit);
    }
    if (formCode) {
      formCode.addEventListener('submit', handleCodeSubmit);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
