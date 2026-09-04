// login.js - Login page logic

(function() {
  'use strict';

  var form = document.getElementById('login-form');
  var emailInput = document.getElementById('email');
  var passwordInput = document.getElementById('password');
  var btnLogin = document.getElementById('btn-login');
  var loginError = document.getElementById('login-error');
  var particlesContainer = document.getElementById('particles');

  // Generate particles
  function initParticles() {
    if (!particlesContainer) return;
    for (var i = 0; i < 30; i++) {
      var dot = document.createElement('div');
      dot.className = 'particle-dot';
      dot.style.left = Math.random() * 100 + '%';
      dot.style.top = Math.random() * 100 + '%';
      dot.style.animationDelay = (Math.random() * 8) + 's';
      dot.style.animationDuration = (6 + Math.random() * 6) + 's';
      particlesContainer.appendChild(dot);
    }
  }

  // Ripple effect on button
  function createRipple(e) {
    var btn = e.currentTarget;
    var rect = btn.getBoundingClientRect();
    var ripple = document.createElement('span');
    ripple.className = 'ripple';
    var size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(ripple);
    setTimeout(function() { ripple.remove(); }, 600);
  }

  // Form submit
  function handleSubmit(e) {
    e.preventDefault();

    var email = emailInput.value.trim();
    var password = passwordInput.value.trim();

    // Clear previous errors
    emailInput.classList.remove('error');
    passwordInput.classList.remove('error');
    loginError.classList.remove('visible');

    // Validate
    if (!email) {
      emailInput.classList.add('error');
      emailInput.focus();
      return;
    }
    if (!password) {
      passwordInput.classList.add('error');
      passwordInput.focus();
      return;
    }

    // Show loading
    btnLogin.classList.add('loading');

    // Simulate login (replace with real API call)
    setTimeout(function() {
      // For demo: any email + password "admin123" succeeds
      if (password === 'admin123' || (email && password)) {
        btnLogin.classList.remove('loading');
        btnLogin.classList.add('success');

        setTimeout(function() {
          window.location.href = 'index.html';
        }, 800);
      } else {
        btnLogin.classList.remove('loading');
        emailInput.classList.add('error');
        passwordInput.classList.add('error');
        loginError.classList.add('visible');
      }
    }, 1200);
  }

  // Input focus effects
  function setupInputEffects() {
    var inputs = document.querySelectorAll('.form-input');
    inputs.forEach(function(input) {
      input.addEventListener('focus', function() {
        this.classList.remove('error');
        loginError.classList.remove('visible');
      });
    });
  }

  // Init
  function init() {
    initParticles();
    setupInputEffects();

    if (form) {
      form.addEventListener('submit', handleSubmit);
    }

    if (btnLogin) {
      btnLogin.addEventListener('click', createRipple);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
