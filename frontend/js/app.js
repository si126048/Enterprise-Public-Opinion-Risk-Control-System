// app.js - Main application logic

// ========== Utility functions ==========
function fetchApi(endpoint, options) {
  options = options || {};
  var url = endpoint;
  if (url.charAt(0) !== '/' && url.indexOf('http') !== 0) {
    url = '/api/' + url;
  }
  return fetch(url, options)
    .then(function(res) {
      if (!res.ok) {
        throw new Error('HTTP ' + res.status + ': ' + res.statusText);
      }
      var contentType = res.headers.get('content-type') || '';
      if (contentType.indexOf('json') !== -1) {
        return res.json();
      }
      return res.text();
    });
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  var h = String(d.getHours()).padStart(2, '0');
  var min = String(d.getMinutes()).padStart(2, '0');
  return y + '-' + m + '-' + day + ' ' + h + ':' + min;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  var date = new Date(dateStr);
  var now = new Date();
  var diff = (now - date) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
  return date.toLocaleDateString('zh-CN');
}

function credibilityBadge(credibility) {
  var cls = 'badge badge-' + (credibility || 'uncertain');
  var labels = { high: '高可信', low: '低可信', medium: '中可信', uncertain: '不确定' };
  return '<span class="' + cls + '">' + (labels[credibility] || credibility || '-') + '</span>';
}

function riskBadge(risk) {
  var cls = 'badge badge-' + (risk || 'uncertain');
  var labels = { low: '低', medium: '中', high: '高', uncertain: '不确定' };
  return '<span class="' + cls + '">' + (labels[risk] || risk || '-') + '</span>';
}

function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function formatNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString('zh-CN');
}

function debounce(fn, ms) {
  var timer = null;
  return function() {
    var args = arguments;
    var ctx = this;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(ctx, args); }, ms);
  };
}

function whenLieflatReady(fn, retries) {
  if (typeof LieflatCharts !== 'undefined') { fn(); return; }
  retries = retries != null ? retries : 20;
  if (retries <= 0) return;
  setTimeout(function() { whenLieflatReady(fn, retries - 1); }, 250);
}

// ========== App Core ==========
(function() {
  'use strict';

  var currentPage = 'dashboard';
  var sidebar = document.getElementById('sidebar');
  var sidebarOverlay = document.getElementById('sidebar-overlay');
  var hamburger = document.getElementById('hamburger');
  var contentArea = document.getElementById('content-area');
  var companySelector = document.getElementById('company-selector');
  var companyDropdown = document.getElementById('company-dropdown');
  var drawerOverlay = document.getElementById('drawer-overlay');
  var drawer = document.getElementById('drawer');
  var drawerClose = document.getElementById('drawer-close');
  var globalSearch = document.getElementById('global-search');

  function init() {
    setupNavigation();
    setupSidebar();
    setupCompanySelector();
    setupDrawer();
    setupKeyboardShortcuts();
    loadPage('dashboard');
  }

  // ---- Navigation ----
  function setupNavigation() {
    var navItems = document.querySelectorAll('.nav-item[data-page]');
    navItems.forEach(function(item) {
      item.addEventListener('click', function() {
        var page = this.getAttribute('data-page');
        if (page) navigateTo(page);
      });
    });
  }

  function navigateTo(page) {
    if (page === currentPage) return;
    var navItems = document.querySelectorAll('.nav-item[data-page]');
    navItems.forEach(function(item) {
      item.classList.toggle('active', item.getAttribute('data-page') === page);
    });
    if (window.innerWidth <= 1023) closeSidebar();
    loadPage(page);
  }

  function loadPage(page) {
    currentPage = page;
    contentArea.innerHTML = '<div class="page-container"><div class="skeleton" style="height: 200px;"></div></div>';

    fetch('pages/' + page + '.html?v=4')
      .then(function(r) {
        if (!r.ok) throw new Error('Page not found');
        return r.text();
      })
      .then(function(html) {
        contentArea.innerHTML = '<div class="page-container">' + html + '</div>';
        initPageScripts(page);
      })
      .catch(function() {
        contentArea.innerHTML = '<div class="page-container"><div class="empty-state"><div class="empty-state-icon">📄</div><div class="empty-state-text">页面加载失败</div><button class="btn btn-primary" onclick="location.reload()">重试</button></div></div>';
      });
  }

  function initPageScripts(page) {
    var inits = {
      'dashboard': loadDashboardData,
      'content': loadContentList,
      'topics': loadTopics,
      'risk-events': loadRiskEvents,
      'search': initSearchPage,
      'review': loadReviewCandidates,
      'source-ledger': loadSourceLedger
    };
    if (inits[page]) inits[page]();
  }

  // ---- Sidebar ----
  function setupSidebar() {
    if (hamburger) hamburger.addEventListener('click', toggleSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
  }

  function toggleSidebar() {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  }

  function openSidebar() {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('active');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
  }

  // ---- Company Selector ----
  function setupCompanySelector() {
    if (!companySelector) return;
    companySelector.addEventListener('click', function(e) {
      e.stopPropagation();
      companyDropdown.classList.toggle('open');
    });
    document.addEventListener('click', function() {
      companyDropdown.classList.remove('open');
    });
    var items = companyDropdown.querySelectorAll('.company-dropdown-item');
    items.forEach(function(item) {
      item.addEventListener('click', function() {
        items.forEach(function(i) { i.classList.remove('active'); });
        this.classList.add('active');
        companySelector.querySelector('span:first-child').textContent = this.textContent;
        companyDropdown.classList.remove('open');
      });
    });
  }

  // ---- Drawer ----
  function setupDrawer() {
    if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);
    if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  }

  window.openDrawer = function(title, content) {
    document.getElementById('drawer-title').textContent = title;
    document.getElementById('drawer-body').innerHTML = content;
    drawerOverlay.classList.add('active');
    drawer.classList.add('active');
  };

  function closeDrawer() {
    drawerOverlay.classList.remove('active');
    drawer.classList.remove('active');
  }

  // ---- Keyboard shortcuts ----
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (globalSearch) globalSearch.focus();
      }
      if (e.key === 'Escape') {
        closeDrawer();
        closeSidebar();
      }
    });
  }

  // ========== Dashboard ==========
  function loadDashboardData() {
    Promise.all([
      fetchApi('/api/stats/overview?company_id=mihoyo'),
      fetchApi('/api/routing/status'),
      fetchApi('/api/risk/events?company_id=mihoyo&limit=5')
    ])
      .then(function(results) {
        var stats = results[0];
        var routingStatus = results[1];
        var events = results[2];
        renderDashboardStats(stats);
        renderDashboardCharts(stats, routingStatus);
        renderDashboardTimeline(events.events || []);
      })
      .catch(function(err) { console.error('Dashboard error:', err); });
  }

  function renderDashboardStats(stats) {
    var container = document.getElementById('stats-cards');
    if (!container || !stats) return;

    var cards = [
      { label: '总舆情', value: formatNumber(stats.total_count), trend: '+12%', up: true },
      { label: '低信度比例', value: ((stats.low_credibility_rate || 0) * 100).toFixed(1) + '%', trend: '-3%', up: false },
      { label: '高风险事件', value: stats.high_risk_count || 0, trend: '+2', up: true },
      { label: '社区热度', value: formatNumber(Math.round(stats.community_heat_score || 0)), trend: '+8%', up: true }
    ];

    container.innerHTML = cards.map(function(c, i) {
      return '<div class="stat-card card-stagger" style="animation-delay:' + (i * 0.05) + 's">' +
        '<div class="stat-label">' + c.label + '</div>' +
        '<div class="stat-value">' + c.value + '</div>' +
        '<div class="stat-trend ' + (c.up ? 'up' : 'down') + '">' +
          '<span>' + (c.up ? '↑' : '↓') + '</span><span>' + c.trend + '</span>' +
        '</div></div>';
    }).join('');
  }

  function renderDashboardCharts(stats, routingStatus) {
    whenLieflatReady(function() {
    var trendEl = document.getElementById('chart-trend');
    if (trendEl && stats && stats.trend_data) {
      LieflatCharts.hairlineArea(trendEl, stats.trend_data);
    }

    var topicEl = document.getElementById('chart-topic-rank');
    if (topicEl && routingStatus && routingStatus.topic_distribution) {
      var topics = routingStatus.topic_distribution.slice(0, 8);
      LieflatCharts.tickRows(topicEl, topics.map(function (t) {
        return { name: t.name, value: t.count };
      }));
    }

    var platformEl = document.getElementById('chart-platform');
    if (platformEl && stats && stats.platform_distribution) {
      var pd = stats.platform_distribution;
      var platformAlias = {
        'bilibili': 'B站',
        'xiaheihe': '小黑盒',
        'xiaoheihe': '小黑盒',
        'taptap': 'TapTap',
      };
      var merged = {};
      Object.keys(pd).forEach(function (k) {
        var name = platformAlias[k.toLowerCase()] || k;
        merged[name] = (merged[name] || 0) + pd[k];
      });
      var pdArr = Object.keys(merged).map(function (k) { return { name: k, value: merged[k] }; });
      var pdTotal = pdArr.reduce(function (s, d) { return s + d.value; }, 0);
      LieflatCharts.tickDonut(platformEl, pdArr, {
        centerLabel: { value: formatNumber(pdTotal), unit: '总计' },
      });
    }

    var productEl = document.getElementById('chart-product');
    if (productEl && stats && stats.product_distribution) {
      var pr = stats.product_distribution;
      var prArr = Object.keys(pr).map(function (k) { return { name: k, value: pr[k] }; });
      var prTotal = prArr.reduce(function (s, d) { return s + d.value; }, 0);
      LieflatCharts.tickDonut(productEl, prArr, {
        centerLabel: { value: formatNumber(prTotal), unit: '总计' },
      });
    }
    });
  }

  function renderDashboardTimeline(events) {
    var container = document.getElementById('recent-events');
    if (!container) return;
    if (!events.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">当前无活跃风险事件</div></div>';
      return;
    }
    container.innerHTML = '<div class="timeline">' + events.slice(0, 5).map(function(ev) {
      var cls = ev.severity === 'high' ? 'danger' : (ev.severity === 'medium' ? 'warning' : '');
      return '<div class="timeline-item ' + cls + '">' +
        '<div class="timeline-time">' + formatTime(ev.created_at) + '</div>' +
        '<div class="timeline-title">' + escapeHtml(ev.title) + '</div>' +
        '<div class="timeline-desc">' + escapeHtml(ev.description || '') + '</div></div>';
    }).join('') + '</div>';
  }

  // ========== Content ==========
  function loadContentList() {
    fetchApi('/api/content?company_id=mihoyo&page_size=20')
      .then(function(data) { renderContentList(data.items || []); })
      .catch(function(err) { console.error('Content error:', err); });
  }

  function renderContentList(opinions) {
    var container = document.getElementById('content-list');
    if (!container) return;
    if (!opinions.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📄</div><div class="empty-state-text">暂无数据</div></div>';
      return;
    }
    container.innerHTML = opinions.map(function(op, i) {
      var credClass = 'badge-' + (op.credibility || 'uncertain');
      var credLabels = { high: '高可信', low: '低可信', medium: '中可信', uncertain: '不确定' };
      return '<div class="content-card card-stagger" style="animation-delay:' + (i * 0.03) + 's" onclick="showContentDetail(' + op.id + ')">' +
        '<div class="content-card-header">' +
          '<span class="badge badge-primary">' + escapeHtml(op.product || '未知') + '</span>' +
          '<span class="badge ' + credClass + '">' + (credLabels[op.credibility] || '-') + '</span>' +
        '</div>' +
        '<div class="content-card-body">' + escapeHtml((op.content || '').substring(0, 120)) + '</div>' +
        '<div class="content-card-footer">' +
          '<span>👍 ' + (op.likes || 0) + '</span>' +
          '<span>💬 ' + (op.comments || 0) + '</span>' +
          '<span>' + formatTime(op.created_at) + '</span>' +
        '</div></div>';
    }).join('');
  }

  window.showContentDetail = function(id) {
    fetchApi('/api/opinions/' + id)
      .then(function(data) {
        openDrawer('舆情详情',
          '<div style="line-height:1.8"><p style="margin-bottom:16px">' + escapeHtml(data.content) + '</p>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">' +
            '<div><span style="color:var(--color-text-muted)">产品：</span>' + escapeHtml(data.product || '-') + '</div>' +
            '<div><span style="color:var(--color-text-muted)">平台：</span>' + escapeHtml(data.platform || '-') + '</div>' +
            '<div><span style="color:var(--color-text-muted)">点赞：</span>' + (data.likes || 0) + '</div>' +
            '<div><span style="color:var(--color-text-muted)">评论：</span>' + (data.comments || 0) + '</div>' +
          '</div></div>');
      });
  };

  // ========== Topics ==========
  function loadTopics() {
    fetchApi('/api/routing/topics')
      .then(function(data) {
        var topics = data.topics || data || [];
        renderTopics(topics);
        renderTopicChart(topics);
      })
      .catch(function(err) { console.error('Topics error:', err); });
  }

  function renderTopicChart(topics) {
    if (!topics.length) return;
    whenLieflatReady(function() {
      var distEl = document.getElementById('chart-topic-dist');
      if (!distEl) return;
      LieflatCharts.tickRows(distEl, topics.map(function (t) {
        return { name: t.name, value: t.sample_count || t.content_count || 0 };
      }), { labelWidth: 120 });
    });
  }

  function renderTopics(topics) {
    var container = document.getElementById('topics-grid');
    if (!container) return;
    if (!topics.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏷️</div><div class="empty-state-text">暂无风险主题</div></div>';
      return;
    }
    container.innerHTML = topics.map(function(t, i) {
      return '<div class="topic-card card-stagger" style="animation-delay:' + (i * 0.05) + 's" onclick="showTopicDetail(' + t.id + ')">' +
        '<div class="topic-card-name">' + escapeHtml(t.name) + '</div>' +
        '<div class="topic-card-desc">' + escapeHtml(t.description || '') + '</div>' +
        '<div class="topic-card-meta">' +
          '<span>样本: ' + (t.sample_count || 0) + '</span>' +
          '<span class="badge badge-outline">中风险</span>' +
        '</div></div>';
    }).join('');
  }

  window.showTopicDetail = function(id) {
    fetchApi('/api/topics/' + id)
      .then(function(data) {
        openDrawer('主题详情: ' + data.name,
          '<div style="line-height:1.8">' +
          '<p style="margin-bottom:16px;color:var(--color-text-secondary)">' + escapeHtml(data.description || '暂无描述') + '</p>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">' +
            '<div><span style="color:var(--color-text-muted)">样本数：</span>' + (data.sample_count || 0) + '</div>' +
            '<div><span style="color:var(--color-text-muted)">创建：</span>' + (data.created_at || '').split('T')[0] + '</div>' +
          '</div></div>');
      });
  };

  // ========== Risk Events ==========
  function loadRiskEvents() {
    fetchApi('/api/risk/events?company_id=mihoyo')
      .then(function(data) { renderRiskEvents(data.events || []); })
      .catch(function(err) { console.error('Risk events error:', err); });
  }

  function renderRiskEvents(events) {
    var container = document.getElementById('risk-events-list');
    if (!container) return;
    if (!events.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">当前无活跃风险事件</div></div>';
      return;
    }
    container.innerHTML = '<div class="timeline">' + events.map(function(ev, i) {
      var cls = ev.severity === 'high' ? 'danger' : (ev.severity === 'medium' ? 'warning' : '');
      var statusBadge = ev.status === 'active'
        ? '<span class="badge badge-danger status-active">进行中</span>'
        : '<span class="badge badge-outline">已解决</span>';
      return '<div class="timeline-item ' + cls + ' card-stagger" style="animation-delay:' + (i * 0.05) + 's" onclick="showEventDetail(' + ev.id + ')">' +
        '<div class="timeline-time">' + formatTime(ev.created_at) + ' ' + statusBadge + '</div>' +
        '<div class="timeline-title">' + escapeHtml(ev.title) + '</div>' +
        '<div class="timeline-desc">' + escapeHtml(ev.description || '') + '</div></div>';
    }).join('') + '</div>';

    whenLieflatReady(function() { renderRiskCharts(events); });
  }

  function renderRiskCharts(events) {
    var levelData = { critical: 0, high: 0, medium: 0, low: 0 };
    var statusData = { active: 0, resolved: 0 };
    events.forEach(function (ev) {
      var lvl = ev.severity || ev.risk_level || 'medium';
      if (levelData[lvl] != null) levelData[lvl]++;
      else levelData.medium++;
      if (ev.status === 'active') statusData.active++;
      else statusData.resolved++;
    });

    var levelEl = document.getElementById('chart-risk-level');
    if (levelEl) LieflatCharts.rungBars(levelEl, [
      { name: '严重', value: levelData.critical },
      { name: '高', value: levelData.high },
      { name: '中', value: levelData.medium },
      { name: '低', value: levelData.low },
    ].filter(function (d) { return d.value > 0; }));

    var statusEl = document.getElementById('chart-risk-status');
    if (statusEl) LieflatCharts.tickDonut(statusEl, [
      { name: '进行中', value: statusData.active },
      { name: '已解决', value: statusData.resolved },
    ].filter(function (d) { return d.value > 0; }), {
      centerLabel: { value: events.length, unit: '事件' },
      colors: ['#F87171', '#34D399'],
    });
  }

  window.showEventDetail = function(id) {
    fetchApi('/api/risk/events/' + id)
      .then(function(data) {
        openDrawer('事件详情: ' + data.title,
          '<div style="line-height:1.8">' +
          '<p style="margin-bottom:16px;color:var(--color-text-secondary)">' + escapeHtml(data.description || '') + '</p>' +
          '<h4 style="font-size:14px;margin-bottom:8px">风控建议</h4>' +
          '<div style="padding:12px;background:rgba(59,130,246,0.08);border-radius:8px;font-size:13px;color:var(--color-text-secondary)">' +
            escapeHtml(data.recommendation || '暂无建议') +
          '</div></div>');
      });
  };

  // ========== Search ==========
  function initSearchPage() {
    var input = document.getElementById('search-input');
    if (input) {
      input.addEventListener('input', debounce(function() {
        performSearch(input.value);
      }, 300));
    }
  }

  function performSearch(query) {
    var container = document.getElementById('search-results');
    if (!container) return;
    if (!query.trim()) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">输入关键词开始搜索</div></div>';
      return;
    }
    container.innerHTML = '<div class="skeleton" style="height:100px"></div>';
    fetchApi('/api/search?company_id=mihoyo&q=' + encodeURIComponent(query))
      .then(function(data) { renderSearchResults(data.results || []); })
      .catch(function() {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-text">搜索失败</div></div>';
      });
  }

  function renderSearchResults(results) {
    var container = document.getElementById('search-results');
    if (!container) return;
    if (!results.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">未找到相关内容</div></div>';
      return;
    }
    container.innerHTML = results.map(function(r, i) {
      return '<div class="content-card card-stagger" style="animation-delay:' + (i * 0.03) + 's">' +
        '<div class="content-card-header"><span class="badge badge-primary">' + escapeHtml(r.type || '舆情') + '</span></div>' +
        '<div class="content-card-body">' + escapeHtml(r.content || r.title || '') + '</div></div>';
    }).join('');
  }

  // ========== Review ==========
  function loadReviewCandidates() {
    fetchApi('/api/review/candidates?company_id=mihoyo')
      .then(function(data) { renderReviewCandidates(data.candidates || []); })
      .catch(function(err) { console.error('Review error:', err); });
  }

  function renderReviewCandidates(candidates) {
    var container = document.getElementById('review-list');
    if (!container) return;
    if (!candidates.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">暂无待审核内容</div></div>';
      return;
    }
    container.innerHTML = candidates.map(function(c, i) {
      return '<div class="content-card card-stagger" style="animation-delay:' + (i * 0.03) + 's">' +
        '<div class="content-card-header"><span class="badge badge-warning">待审核</span></div>' +
        '<div class="content-card-body">' + escapeHtml(c.content || '') + '</div>' +
        '<div class="content-card-footer">' +
          '<button class="btn btn-sm btn-primary" onclick="approveCandidate(' + c.id + ')">通过</button>' +
          '<button class="btn btn-sm btn-secondary" onclick="rejectCandidate(' + c.id + ')">拒绝</button>' +
        '</div></div>';
    }).join('');
  }

  window.approveCandidate = function(id) {
    fetch('/api/review/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate_id: id }) })
      .then(function() { loadReviewCandidates(); });
  };

  window.rejectCandidate = function(id) {
    fetch('/api/review/reject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate_id: id }) })
      .then(function() { loadReviewCandidates(); });
  };

  // ========== Source Ledger ==========
  function loadSourceLedger() {
    fetchApi('/api/sources?company_id=mihoyo')
      .then(function(data) { renderSourceLedger(data.sources || []); })
      .catch(function(err) { console.error('Sources error:', err); });
  }

  function renderSourceLedger(sources) {
    var container = document.getElementById('source-table');
    if (!container) return;
    if (!sources.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">暂无数据来源</div></div>';
      return;
    }
    var html = '<table class="data-table"><thead><tr><th>来源名称</th><th>类型</th><th>状态</th><th>更新时间</th></tr></thead><tbody>';
    sources.forEach(function(s) {
      var badge = s.status === 'active' ? '<span class="badge badge-success">正常</span>' : '<span class="badge badge-outline">停用</span>';
      html += '<tr><td>' + escapeHtml(s.name) + '</td><td>' + escapeHtml(s.type || '-') + '</td><td>' + badge + '</td><td>' + (s.updated_at || '-').split('T')[0] + '</td></tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // ========== Init ==========
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
