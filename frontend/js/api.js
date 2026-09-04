/* ============================================
   api.js — API 封装 + mock 开关
   ============================================ */

var ApiService = (function() {
    var useMock = true;
    var autoDetected = false;

    function setMock(val) {
        useMock = !!val;
    }

    function autoDetectMock() {
        if (autoDetected) return;
        autoDetected = true;
        fetch('/api/health').then(function(res) {
            if (res.ok) {
                useMock = false;
                console.log('[ApiService] Backend detected, using real API');
            }
        }).catch(function() {
            console.log('[ApiService] No backend, using Mock 数据');
        });
    }

    async function fetchApi(endpoint, options) {
        options = options || {};
        var url = endpoint.indexOf('/api/') === 0 ? endpoint : '/api/' + endpoint.replace(/^\/+/, '');
        var res = await fetch(url, options);
        if (!res.ok) {
            var text = '';
            try { text = await res.text(); } catch(e) {}
            throw new Error('API Error ' + res.status + ': ' + text);
        }
        var ct = res.headers.get('content-type') || '';
        return ct.indexOf('application/json') >= 0 ? res.json() : res.text();
    }

    function mockDelay(data, ms) {
        ms = ms || 200;
        return new Promise(function(resolve) {
            setTimeout(function() { resolve(data); }, ms);
        });
    }

    autoDetectMock();

    return {
        get useMock() { return useMock; },
        setMock: setMock,

        // Health
        getHealth: function() {
            if (useMock) return mockDelay({ status: 'ok', version: '0.7.0-mock' });
            return fetchApi('/api/health');
        },

        // Content
        getContent: function(params) {
            if (useMock) {
                var items = (typeof MOCK_DATA !== 'undefined') ? MOCK_DATA : [];
                var p = params || {};
                if (p.sentiment) items = items.filter(function(i) { return i.sentiment === p.sentiment; });
                if (p.topic) items = items.filter(function(i) { return i.topic === p.topic; });
                if (p.risk_level) items = items.filter(function(i) { return i.risk_level === p.risk_level; });
                if (p.district) items = items.filter(function(i) { return i.district === p.district; });
                if (p.search) {
                    var q = p.search.toLowerCase();
                    items = items.filter(function(i) {
                        return (i.title && i.title.toLowerCase().indexOf(q) >= 0) ||
                               (i.clean_text && i.clean_text.toLowerCase().indexOf(q) >= 0);
                    });
                }
                var page = parseInt(p.page) || 1;
                var pageSize = parseInt(p.page_size) || 20;
                var start = (page - 1) * pageSize;
                var paged = items.slice(start, start + pageSize);
                return mockDelay({
                    items: paged,
                    pagination: { page: page, page_size: pageSize, total: items.length, total_pages: Math.ceil(items.length / pageSize) }
                });
            }
            var qs = new URLSearchParams();
            if (params) {
                Object.keys(params).forEach(function(k) {
                    if (params[k] !== null && params[k] !== undefined && params[k] !== '') {
                        qs.set(k, params[k]);
                    }
                });
            }
            return fetchApi('/api/content?' + qs.toString());
        },

        getContentById: function(id) {
            if (useMock) {
                var items = (typeof MOCK_DATA !== 'undefined') ? MOCK_DATA : [];
                var item = items.find(function(i) { return i.id === id; });
                return mockDelay(item || null);
            }
            return fetchApi('/api/content/' + id);
        },

        getStatsOverview: function() {
            if (useMock) {
                return mockDelay(typeof MOCK_STATS !== 'undefined' ? MOCK_STATS : {});
            }
            return fetchApi('/api/stats/overview');
        },

        // Semantic Search
        semanticSearch: function(query, filters) {
            if (useMock) {
                var items = (typeof MOCK_DATA !== 'undefined') ? MOCK_DATA : [];
                var q = query.toLowerCase();
                var results = items.filter(function(i) {
                    return (i.title && i.title.toLowerCase().indexOf(q) >= 0) ||
                           (i.clean_text && i.clean_text.toLowerCase().indexOf(q) >= 0);
                }).map(function(i) {
                    return Object.assign({}, i, { similarity: 0.5 + Math.random() * 0.4 });
                }).sort(function(a, b) { return b.similarity - a.similarity; });
                return mockDelay({ items: results.slice(0, 20), total: results.length });
            }
            var body = Object.assign({ query: query }, filters || {});
            return fetchApi('/api/embedding/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        },

        // Topics
        getTopics: function() {
            if (useMock) {
                return mockDelay({ topics: typeof MOCK_TOPICS !== 'undefined' ? MOCK_TOPICS : [] });
            }
            return fetchApi('/api/routing/topics');
        },

        getTopicById: function(id) {
            if (useMock) {
                var topics = (typeof MOCK_TOPICS !== 'undefined') ? MOCK_TOPICS : [];
                return mockDelay(topics.find(function(t) { return t.id === id; }) || null);
            }
            return fetchApi('/api/routing/topics/' + id);
        },

        analyzeContent: function() {
            return fetchApi('/api/routing/analyze', { method: 'POST' });
        },

        // Discovery
        getDiscoveryCandidates: function(status) {
            if (useMock) return mockDelay({ candidates: [], stats: { pending: 0 } });
            var qs = status ? '?status=' + status : '';
            return fetchApi('/api/discovery/candidates' + qs);
        },

        getDiscoveryCandidateById: function(id) {
            return fetchApi('/api/discovery/candidates/' + encodeURIComponent(id));
        },

        runDiscovery: function() {
            return fetchApi('/api/discovery/run', { method: 'POST' });
        },

        approveCandidate: function(id) {
            return fetchApi('/api/discovery/' + id + '/approve', { method: 'POST' });
        },

        ignoreCandidate: function(id, comment) {
            return fetchApi('/api/discovery/' + id + '/ignore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment: comment || '' })
            });
        },

        mergeCandidate: function(id, targetTopicId) {
            return fetchApi('/api/discovery/' + id + '/merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_topic_id: targetTopicId })
            });
        },

        // Sources
        getSources: function() {
            if (useMock) return mockDelay({ sources: [] });
            return fetchApi('/api/sources');
        },

        getSourceById: function(id) {
            if (useMock) return mockDelay({ source: { id: id, source_name: 'Mock来源', data_type: 'csv_import', record_count: 0, access_date: '-', description: '模拟数据', verified: false }, content_stats: { total: 0, analyzed: 0 } });
            return fetchApi('/api/sources/' + id);
        },

        createSource: function(data) {
            if (useMock) return mockDelay({ id: 'mock_' + Date.now(), message: 'created' });
            return fetchApi('/api/sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        },

        deleteSource: function(id) {
            if (useMock) return mockDelay({ message: 'deleted' });
            return fetchApi('/api/sources/' + id, { method: 'DELETE' });
        },

        syncSources: function() {
            if (useMock) return mockDelay({ synced: 0 });
            return fetchApi('/api/sources/sync', { method: 'POST' });
        },

        // Validation
        getValidationSummary: function() {
            if (useMock) {
                return mockDelay({
                    total_analyses: 0, content_count: 0, full_agreement_rate: 0,
                    partial_agreement_rate: 0, provider_distributions: {},
                    provider_stats: {}, content_results: []
                });
            }
            return fetchApi('/api/validation/summary');
        },

        runValidation: function(contentId) {
            if (useMock) return mockDelay({ stats: { processed: 0, content_count: 0, provider_count: 3 } });
            var body = contentId ? { content_id: contentId } : {};
            return fetchApi('/api/validation/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        },

        getValidationResults: function(contentId) {
            if (useMock) return mockDelay({ results: [] });
            var qs = contentId ? '?content_id=' + contentId : '';
            return fetchApi('/api/validation/results' + qs);
        },

        getValidationResultsByContent: function(contentId) {
            if (useMock) return mockDelay({ results: [] });
            return fetchApi('/api/validation/results/' + contentId);
        },

        // Ingest
        importCSV: function(formData) {
            return fetchApi('/api/ingest/import', {
                method: 'POST',
                body: formData
            });
        }
    };
})();

// Global fetchApi (mock-aware) for pages that call it directly
window.fetchApi = function(endpoint, options) {
    if (ApiService.useMock) {
        var path = endpoint.indexOf('/api/') === 0 ? endpoint : '/api/' + endpoint;
        var method = (options && options.method || 'GET').toUpperCase();

        if (path === '/api/stats/overview') return ApiService.getStatsOverview();
        if (path === '/api/routing/topics') return ApiService.getTopics();
        if (path.indexOf('/api/validation/summary') === 0) return ApiService.getValidationSummary();
        if (path.indexOf('/api/validation/results/') === 0) {
            var cid = path.substring('/api/validation/results/'.length);
            return ApiService.getValidationResultsByContent(cid);
        }
        if (path.indexOf('/api/validation/results') === 0) return ApiService.getValidationResults();
        if (path === '/api/validation/run') return ApiService.runValidation();

        if (path === '/api/sources' && method === 'GET') return ApiService.getSources();
        if (path === '/api/sources' && method === 'POST') return ApiService.createSource(options && options.body ? JSON.parse(options.body) : {});
        if (path === '/api/sources/sync') return ApiService.syncSources();
        if (path.indexOf('/api/sources/') === 0 && method === 'GET') return ApiService.getSourceById(path.split('/').pop());
        if (path.indexOf('/api/sources/') === 0 && method === 'DELETE') return ApiService.deleteSource(path.split('/').pop());

        if (path === '/api/content') return ApiService.getContent();
    }
    return ApiService._fetchApi(endpoint, options);
};

// Expose internal fetchApi for ApiService methods
ApiService._fetchApi = (function() {
    return async function(endpoint, options) {
        options = options || {};
        var url = endpoint.indexOf('/api/') === 0 ? endpoint : '/api/' + endpoint.replace(/^\/+/, '');
        var res = await fetch(url, options);
        if (!res.ok) {
            var text = '';
            try { text = await res.text(); } catch(e) {}
            throw new Error('API Error ' + res.status + ': ' + text);
        }
        var ct = res.headers.get('content-type') || '';
        return ct.indexOf('application/json') >= 0 ? res.json() : res.text();
    };
})();

// Utility functions (available even without app.js)
if (typeof window.escapeHtml === 'undefined') {
    window.escapeHtml = function(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    };
}
if (typeof window.sentimentBadge === 'undefined') {
    window.sentimentBadge = function(sentiment) {
        var cls = 'badge badge-' + (sentiment || 'uncertain');
        var labels = { positive: '正面', negative: '负面', neutral: '中性', uncertain: '不确定' };
        return '<span class="' + cls + '">' + (labels[sentiment] || sentiment || '-') + '</span>';
    };
}
if (typeof window.riskBadge === 'undefined') {
    window.riskBadge = function(risk) {
        var cls = 'badge badge-' + (risk || 'uncertain');
        var labels = { low: '低', medium: '中', high: '高', uncertain: '不确定' };
        return '<span class="' + cls + '">' + (labels[risk] || risk || '-') + '</span>';
    };
}
if (typeof window.formatDate === 'undefined') {
    window.formatDate = function(dateStr) {
        if (!dateStr) return '-';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') +
            ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    };
}
if (typeof window.formatNumber === 'undefined') {
    window.formatNumber = function(n) {
        if (n == null) return '0';
        return Number(n).toLocaleString('zh-CN');
    };
}
