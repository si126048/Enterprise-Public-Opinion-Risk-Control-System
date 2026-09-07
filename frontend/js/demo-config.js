/*
 * demo-config.js — GitHub Pages demo mode detection and mock data routing.
 * Activates when hostname contains github.io or URL has ?demo=1.
 */
(function () {
  'use strict';

  var isDemo = (
    location.hostname.indexOf('github.io') !== -1 ||
    location.search.indexOf('demo=1') !== -1 ||
    sessionStorage.getItem('__demo_mode') === '1'
  );

  window.__DEMO_MODE = isDemo;

  if (isDemo) {
    sessionStorage.setItem('__demo_mode', '1');
  }

  var DEMO_MAP = {
    '/api/stats/overview':       'stats-overview.json',
    '/api/routing/status':       'routing-status.json',
    '/api/risk/events':          'risk-events.json',
    '/api/content':              'content-list.json',
    '/api/routing/topics':       'topics.json',
    '/api/discovery/candidates': 'candidates.json',
    '/api/review-agent/log':     'review-log.json',
    '/api/sources':              'sources.json',
    '/api/credibility/overview': 'credibility-overview.json',
    '/api/crawler/crawlers':     'crawlers.json'
  };

  var DEMO_PREFIX_MAP = [
    { prefix: '/api/opinions/',       file: 'opinion-detail.json' },
    { prefix: '/api/topics/',         file: 'topic-detail.json' },
    { prefix: '/api/risk/events/',    file: 'risk-event-detail.json' },
    { prefix: '/api/embedding/search', file: 'search-results.json' }
  ];

  window.__resolveMockFile = function (endpoint) {
    if (DEMO_MAP[endpoint]) return DEMO_MAP[endpoint];
    for (var i = 0; i < DEMO_PREFIX_MAP.length; i++) {
      if (endpoint.indexOf(DEMO_PREFIX_MAP[i].prefix) === 0) {
        return DEMO_PREFIX_MAP[i].file;
      }
    }
    return null;
  };

  window.__demoFetch = function (url, options) {
    options = options || {};
    var method = (options.method || 'GET').toUpperCase();

    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      return Promise.resolve(new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
    }

    var path = url;
    try {
      var u = new URL(url, location.origin);
      path = u.pathname;
    } catch (e) {}

    var mockFile = window.__resolveMockFile(path);
    if (mockFile) {
      return fetch('data/mock/' + mockFile, { cache: 'no-cache' });
    }

    return Promise.resolve(new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));
  };
})();
