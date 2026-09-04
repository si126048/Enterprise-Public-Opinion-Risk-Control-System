/* ============================================
   api.js — API 封装 + mock 开关
   ============================================ */

var ApiService = (function() {
    var useMock = true;
    var detectPromise = null;

    function setMock(val) {
        useMock = !!val;
    }

    function autoDetectMock() {
        if (detectPromise) return detectPromise;
        detectPromise = fetch('/api/health').then(function(res) {
            if (res.ok) {
                useMock = false;
                console.log('[ApiService] Backend detected, using real API');
            }
        }).catch(function() {
            console.log('[ApiService] No backend, using Mock 数据');
        });
        return detectPromise;
    }

    function ensureDetected() {
        return detectPromise || autoDetectMock();
    }

    async function fetchApi(endpoint, options) {
        await ensureDetected();
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
        ensureDetected: ensureDetected,

        // Health
        getHealth: async function() {
            await ensureDetected();
            if (useMock) return mockDelay({ status: 'ok', version: '1.0.0-mock', name: '企业舆情风控管理系统' });
            return fetchApi('/api/health');
        },

        // Content
        getContent: async function(params) {
            await ensureDetected();
            if (useMock) {
                var items = (typeof MOCK_DATA !== 'undefined') ? MOCK_DATA : [];
                var p = params || {};
                if (p.credibility_level) items = items.filter(function(i) { return i.credibility_level === p.credibility_level; });
                if (p.topic) items = items.filter(function(i) { return i.topic === p.topic; });
                if (p.risk_level) items = items.filter(function(i) { return i.risk_level === p.risk_level; });
                if (p.product_name) items = items.filter(function(i) { return i.product_name === p.product_name; });
                if (p.platform) items = items.filter(function(i) { return i.platform === p.platform || i.source === p.platform; });
                if (p.company_id) items = items.filter(function(i) { return i.company_id === p.company_id; });
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

        getContentById: async function(id) {
            await ensureDetected();
            if (useMock) {
                var items = (typeof MOCK_DATA !== 'undefined') ? MOCK_DATA : [];
                var item = items.find(function(i) { return i.id === id; });
                return mockDelay(item || null);
            }
            return fetchApi('/api/content/' + id);
        },

        getStatsOverview: async function() {
            await ensureDetected();
            if (useMock) {
                return mockDelay(typeof MOCK_STATS !== 'undefined' ? MOCK_STATS : {});
            }
            return fetchApi('/api/stats/overview');
        },

        getProductStats: async function(productName) {
            await ensureDetected();
            if (useMock) {
                var stats = typeof MOCK_STATS !== 'undefined' ? MOCK_STATS : {};
                var pd = stats.product_distribution || {};
                var count = pd[productName] || 0;
                return mockDelay({
                    product: productName,
                    total: count,
                    platform_distribution: {}
                });
            }
            return fetchApi('/api/stats/product/' + encodeURIComponent(productName));
        },

        // Companies
        getCompanies: async function() {
            await ensureDetected();
            if (useMock) {
                return mockDelay({
                    companies: [
                        {
                            id: 'mihoyo',
                            name: '米哈游',
                            full_name: '上海米哈游网络科技股份有限公司',
                            is_active: true,
                            products: ['原神', '崩坏：星穹铁道', '绝区零', '未定事件簿'],
                            platforms: ['微博', '小红书', '知乎', 'B站', 'TapTap', '小黑盒', '米游社']
                        }
                    ]
                });
            }
            return fetchApi('/api/companies');
        },

        getCompanyById: async function(id) {
            await ensureDetected();
            if (useMock) {
                return mockDelay({
                    company: {
                        id: 'mihoyo',
                        name: '米哈游',
                        full_name: '上海米哈游网络科技股份有限公司',
                        is_active: true,
                        products: ['原神', '崩坏：星穹铁道', '绝区零', '未定事件簿'],
                        platforms: ['微博', '小红书', '知乎', 'B站', 'TapTap', '小黑盒', '米游社']
                    }
                });
            }
            return fetchApi('/api/companies/' + id);
        },

        // Semantic Search
        semanticSearch: async function(query, filters) {
            await ensureDetected();
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
        getTopics: async function() {
            await ensureDetected();
            if (useMock) {
                return mockDelay({ topics: typeof MOCK_TOPICS !== 'undefined' ? MOCK_TOPICS : [] });
            }
            return fetchApi('/api/routing/topics');
        },

        getTopicById: async function(id) {
            await ensureDetected();
            if (useMock) {
                var topics = (typeof MOCK_TOPICS !== 'undefined') ? MOCK_TOPICS : [];
                return mockDelay(topics.find(function(t) { return t.topic_id === id; }) || null);
            }
            return fetchApi('/api/routing/topics/' + id);
        },

        analyzeContent: function() {
            return fetchApi('/api/routing/analyze', { method: 'POST' });
        },

        // Validation
        getValidationSummary: async function() {
            await ensureDetected();
            if (useMock) {
                return mockDelay({
                    total_analyses: 0, content_count: 0, full_agreement_rate: 0,
                    partial_agreement_rate: 0, provider_distributions: {},
                    provider_stats: {}, content_results: []
                });
            }
            return fetchApi('/api/validation/summary');
        },

        runValidation: async function(contentId) {
            await ensureDetected();
            if (useMock) return mockDelay({ stats: { processed: 0, content_count: 0, provider_count: 3 } });
            var body = contentId ? { content_id: contentId } : {};
            return fetchApi('/api/validation/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        },

        getValidationResults: async function(contentId) {
            await ensureDetected();
            if (useMock) return mockDelay({ results: [] });
            var qs = contentId ? '?content_id=' + contentId : '';
            return fetchApi('/api/validation/results' + qs);
        },

        getValidationResultsByContent: async function(contentId) {
            await ensureDetected();
            if (useMock) return mockDelay({ results: [] });
            return fetchApi('/api/validation/results/' + contentId);
        },

        // Risk Events
        getRiskEvents: async function() {
            await ensureDetected();
            if (useMock) return mockDelay({ events: [], total: 0 });
            return fetchApi('/api/risk/events');
        },

        // Ingest
        importCSV: function(formData) {
            return fetchApi('/api/ingest/import', {
                method: 'POST',
                body: formData
            });
        },

        // Crawler
        getCrawlerStatus: async function() {
            await ensureDetected();
            if (useMock) {
                return mockDelay({
                    available_crawlers: 7, enabled_crawlers: 7, total_runs: 0, last_run: null
                });
            }
            return fetchApi('/api/crawler/status');
        },

        getCrawlers: async function() {
            await ensureDetected();
            if (useMock) {
                return mockDelay([
                    { name: 'weibo', enabled: true, registered: true, category: 'social', description: '微博舆情爬虫（超话/热搜/品牌官微评论）', max_pages: 50, delay: 2.0, urls: ['https://weibo.com'] },
                    { name: 'xiaohongshu', enabled: true, registered: true, category: 'social', description: '小红书笔记搜索爬虫', max_pages: 30, delay: 3.0, urls: ['https://www.xiaohongshu.com'] },
                    { name: 'zhihu', enabled: true, registered: true, category: 'social', description: '知乎问题搜索爬虫', max_pages: 30, delay: 3.0, urls: ['https://www.zhihu.com'] },
                    { name: 'bilibili', enabled: true, registered: true, category: 'social', description: 'B站视频评论爬虫', max_pages: 50, delay: 2.0, urls: ['https://www.bilibili.com'] },
                    { name: 'taptap', enabled: true, registered: true, category: 'social', description: 'TapTap游戏评分/评价爬虫', max_pages: 20, delay: 3.0, urls: ['https://www.taptap.cn'] },
                    { name: 'xiaoheihe', enabled: true, registered: true, category: 'social', description: '小黑盒游戏社区帖子/评论爬虫', max_pages: 30, delay: 3.0, urls: ['https://www.xiaoheihe.cn'] },
                    { name: 'miyoushe', enabled: true, registered: true, category: 'social', description: '米游社官方社区帖子/评论爬虫', max_pages: 30, delay: 3.0, urls: ['https://www.miyoushe.com'] }
                ]);
            }
            return fetchApi('/api/crawler/crawlers');
        },

        runCrawler: async function(name) {
            await ensureDetected();
            if (useMock) return mockDelay({ run_id: 'mock_' + Date.now(), crawler_name: name, status: 'completed', total_fetched: 0, total_imported: 0, total_skipped_dup: 0, total_errors: 0 });
            return fetchApi('/api/crawler/run/' + name, { method: 'POST' });
        },

        runAllCrawlers: async function() {
            await ensureDetected();
            if (useMock) return mockDelay({ runs: [], total_imported: 0 });
            return fetchApi('/api/crawler/run-all', { method: 'POST' });
        },

        getCrawlerRuns: async function(limit, offset) {
            await ensureDetected();
            if (useMock) return mockDelay({ runs: [], total: 0 });
            var qs = '?limit=' + (limit || 20) + '&offset=' + (offset || 0);
            return fetchApi('/api/crawler/runs' + qs);
        },

        getCrawlerRunDetail: async function(runId) {
            await ensureDetected();
            if (useMock) return mockDelay({ run: null });
            return fetchApi('/api/crawler/runs/' + runId);
        },

        // Alias for backward compatibility
        getSources: function() { return this.getCompanies(); }
    };
})();

// Global fetchApi (mock-aware) for pages that call it directly
window.fetchApi = async function(endpoint, options) {
    await ApiService.ensureDetected();
    if (ApiService.useMock) {
        var path = endpoint.indexOf('/api/') === 0 ? endpoint : '/api/' + endpoint;
        var method = (options && options.method || 'GET').toUpperCase();

        if (path === '/api/stats/overview') return ApiService.getStatsOverview();
        if (path.indexOf('/api/stats/product/') === 0) {
            var pn = decodeURIComponent(path.substring('/api/stats/product/'.length));
            return ApiService.getProductStats(pn);
        }
        if (path === '/api/companies' && method === 'GET') return ApiService.getCompanies();
        if (path.indexOf('/api/companies/') === 0 && method === 'GET') return ApiService.getCompanyById(path.split('/').pop());
        if (path === '/api/routing/topics') return ApiService.getTopics();
        if (path.indexOf('/api/validation/summary') === 0) return ApiService.getValidationSummary();
        if (path.indexOf('/api/validation/results/') === 0) {
            var cid = path.substring('/api/validation/results/'.length);
            return ApiService.getValidationResultsByContent(cid);
        }
        if (path.indexOf('/api/validation/results') === 0) return ApiService.getValidationResults();
        if (path === '/api/validation/run') return ApiService.runValidation();

        if (path === '/api/crawler/status') return ApiService.getCrawlerStatus();
        if (path === '/api/crawler/crawlers') return ApiService.getCrawlers();
        if (path.indexOf('/api/crawler/run/') === 0 && method === 'POST') return ApiService.runCrawler(decodeURIComponent(path.split('/').pop()));
        if (path === '/api/crawler/run-all' && method === 'POST') return ApiService.runAllCrawlers();
        if (path.indexOf('/api/crawler/runs?') === 0) return ApiService.getCrawlerRuns();
        if (path.indexOf('/api/crawler/runs/') === 0) return ApiService.getCrawlerRunDetail(decodeURIComponent(path.split('/').pop()));

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
if (typeof window.credibilityBadge === 'undefined') {
    window.credibilityBadge = function(credibility) {
        var cls = 'badge badge-' + (credibility || 'uncertain');
        var labels = { high: '高可信', low: '低可信', medium: '中可信', uncertain: '不确定' };
        return '<span class="' + cls + '">' + (labels[credibility] || credibility || '-') + '</span>';
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
