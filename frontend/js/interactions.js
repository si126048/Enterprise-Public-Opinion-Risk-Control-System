/* ============================================
   interactions.js — 动线系统
   导航联动、汉堡菜单、页面过渡、数字动画
   ============================================ */

var Interactions = (function() {

    function initNavbar() {
        var toggle = document.querySelector('.nav-toggle');
        var links = document.querySelector('.nav-links');

        if (toggle && links) {
            toggle.addEventListener('click', function() {
                links.classList.toggle('open');
                toggle.textContent = links.classList.contains('open') ? '×' : '≡';
            });

            document.addEventListener('click', function(e) {
                if (!e.target.closest('.navbar')) {
                    links.classList.remove('open');
                    toggle.textContent = '≡';
                }
            });
        }

        var currentPath = window.location.pathname;
        document.querySelectorAll('.nav-links a').forEach(function(a) {
            var href = a.getAttribute('href');
            if (href && currentPath.indexOf(href) >= 0 && href !== 'index.html') {
                a.classList.add('active');
            } else if (href === 'index.html' && (currentPath.endsWith('/') || currentPath.endsWith('index.html'))) {
                a.classList.add('active');
            }
        });
    }

    function initPageTransition() {
        var main = document.querySelector('.main-content') || document.querySelector('.page-body') || document.body;
        main.classList.add('page-transition');
    }

    function initMapReset() {
        var resetBtn = document.querySelector('.map-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', function() {
                WuhuaMap.resetView();
            });
        }

        var mapContainer = document.getElementById('map-container');
        if (mapContainer) {
            mapContainer.addEventListener('click', function(e) {
                if (e.target === mapContainer || e.target.classList.contains('leaflet-container')) {
                    // Click on empty map area - handled by Leaflet
                }
            });
        }
    }

    function initDashboard() {
        if (typeof WuhuaMap !== 'undefined') {
            WuhuaMap.init('map-container');
        }

        loadDashboardData();

        AppStore.subscribe(function(changeType, payload) {
            if (changeType === 'district_changed' && payload) {
                var resetBtn = document.querySelector('.map-reset-btn');
                if (resetBtn) resetBtn.classList.add('visible');
            }
        });
    }

    function loadDashboardData() {
        ApiService.getStatsOverview().then(function(stats) {
            AppStore.setData('stats', stats);
            renderDashboardStats(stats);
        }).catch(function(err) {
            console.error('Stats load failed:', err);
        });

        ApiService.getTopics().then(function(data) {
            var topics = data.topics || data || [];
            AppStore.setData('topics', topics);
            renderDashboardTopics(topics);
        }).catch(function(err) {
            console.error('Topics load failed:', err);
        });
    }

    function renderDashboardStats(stats) {
        var cards = [
            { label: '总样本', value: stats.total_count || stats.total || 0 },
            { label: '已分析', value: stats.analyzed_count || 0 },
            { label: '负面率', value: Math.round((stats.negative_rate || 0) * 100) },
            { label: '高风险', value: stats.high_risk_count || (stats.risk_distribution ? stats.risk_distribution.high || 0 : 0) },
            { label: '主题数', value: stats.topic_count || 0 },
            { label: '来源数', value: stats.source_count || 0 }
        ];
        Components.renderStatCards('stats-cards', cards);

        if (stats.recent_high_risk) {
            Components.renderHighRiskTable('high-risk-table', stats.recent_high_risk);
        }

        if (stats.daily_trend) {
            Charts.initTrend('chart-trend', stats.daily_trend);
        }
    }

    function renderDashboardTopics(topics) {
        if (!Array.isArray(topics)) return;

        var sorted = topics.slice().sort(function(a, b) {
            return (b.content_count || b.count || 0) - (a.content_count || a.count || 0);
        });

        var rankData = sorted.map(function(t) {
            return { name: t.topic_id || t.name || t.id, count: t.content_count || t.count || 0 };
        });

        Components.renderTopicRank('topic-rank', rankData);

        var topicDist = sorted.slice(0, 8).map(function(t) {
            return { name: t.topic_id || t.name || t.id, count: t.content_count || t.count || 0 };
        });
        Charts.initTopicDistribution('chart-topic-dist', topicDist);

        var sentimentData = [];
        if (sorted.length > 0) {
            var totalPos = 0, totalNeg = 0, totalNeu = 0;
            sorted.forEach(function(t) {
                if (t.sentiment_distribution) {
                    totalPos += t.sentiment_distribution.positive || 0;
                    totalNeg += t.sentiment_distribution.negative || 0;
                    totalNeu += t.sentiment_distribution.neutral || 0;
                }
            });
            if (totalPos + totalNeg + totalNeu > 0) {
                sentimentData = [
                    { name: '正面', value: totalPos },
                    { name: '中性', value: totalNeu },
                    { name: '负面', value: totalNeg }
                ];
            }
        }
        if (sentimentData.length > 0) {
            Charts.initSentimentDistribution('chart-sentiment-dist', sentimentData);
        }
    }

    // StatsPanel for map drill-down
    var StatsPanel = {
        updateForDistrict: function(name) {
            var stats = AppStore.getDistrictStats(name);
            if (!stats) return;

            var cards = [
                { label: name + ' · 总量', value: stats.total || 0 },
                { label: '负面数量', value: stats.negative || 0 },
                { label: '负面率', value: stats.total > 0 ? Math.round(stats.negative / stats.total * 100) : 0 },
                { label: '高风险', value: stats.high_risk || 0 }
            ];
            Components.renderStatCards('stats-cards', cards);
        },
        reset: function() {
            loadDashboardData();
        }
    };

    // ContentList for map drill-down
    var ContentList = {
        refreshForDistrict: function(name) {
            AppStore.setFilter('district', name);
            ApiService.getContent({ district: name, page: 1, page_size: 10 }).then(function(data) {
                Components.renderContentList('dashboard-content-list', data.items || []);
            }).catch(function(err) {
                console.error('Content load failed:', err);
            });
        },
        reset: function() {
            AppStore.setFilter('district', null);
        }
    };

    function init() {
        initNavbar();
        initPageTransition();
        initMapReset();
        Components.initModal();
    }

    return {
        init: init,
        initNavbar: initNavbar,
        initPageTransition: initPageTransition,
        initDashboard: initDashboard,
        loadDashboardData: loadDashboardData,
        StatsPanel: StatsPanel,
        ContentList: ContentList
    };
})();

// Expose for map.js compatibility
var StatsPanel = Interactions.StatsPanel;
var ContentList = Interactions.ContentList;
var Dashboard = { loadAll: Interactions.loadDashboardData };
