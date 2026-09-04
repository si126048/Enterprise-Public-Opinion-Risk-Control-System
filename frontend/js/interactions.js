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

    function initDashboard() {
        loadDashboardData();

        AppStore.subscribe(function(changeType, payload) {
            if (changeType === 'product_changed' && payload) {
                // Product filter changed — charts already updated by caller
            }
        });
    }

    function loadDashboardData() {
        ApiService.getStatsOverview().then(function(stats) {
            AppStore.setData('stats', stats);
            renderDashboardStats(stats);
            renderDashboardDistributions(stats);
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
            { label: '总舆情', value: stats.total_count || stats.total || 0 },
            { label: '低信度', value: Math.round((stats.low_credibility_rate || 0) * 100) + '%' },
            { label: '社区热度', value: Math.round(stats.community_heat_score || 0) },
            { label: '产品数', value: stats.product_distribution ? Object.keys(stats.product_distribution).length : 0 },
            { label: '平台数', value: stats.platform_distribution ? Object.keys(stats.platform_distribution).length : 0 }
        ];
        Components.renderStatCards('stats-cards', cards);

        if (stats.trend_data) {
            var trendData = stats.trend_data.dates.map(function(date, i) {
                return { date: date, total: stats.trend_data.total[i], low_credibility: stats.trend_data.low_credibility[i] };
            });
            Charts.initTrend('chart-trend', trendData);
        }
    }

    function renderDashboardDistributions(stats) {
        if (stats.platform_distribution) {
            var platformData = Object.keys(stats.platform_distribution).map(function(k) {
                return { name: k, value: stats.platform_distribution[k] };
            });
            if (typeof PlatformDistribution !== 'undefined') {
                PlatformDistribution.updatePlatform('chart-platform-dist', platformData);
            }
        }

        if (stats.product_distribution) {
            var productData = Object.keys(stats.product_distribution).map(function(k) {
                return { name: k, value: stats.product_distribution[k] };
            });
            if (typeof PlatformDistribution !== 'undefined') {
                PlatformDistribution.updateProduct('chart-product-dist', productData);
            }
        }
    }

    function renderDashboardTopics(topics) {
        if (!Array.isArray(topics)) return;

        var sorted = topics.slice().sort(function(a, b) {
            return (b.content_count || b.count || 0) - (a.content_count || a.count || 0);
        });

        var rankData = sorted.map(function(t) {
            return { name: t.name || t.topic_id || t.id, count: t.content_count || t.count || 0 };
        });

        Components.renderTopicRank('topic-rank', rankData);

        var topicDist = sorted.slice(0, 8).map(function(t) {
            return { name: t.name || t.topic_id || t.id, count: t.content_count || t.count || 0 };
        });
        Charts.initTopicDistribution('chart-topic-dist', topicDist);
    }

    var StatsPanel = {
        updateForProduct: function(productName) {
            var stats = AppStore.getProductStats(productName);
            if (!stats) return;

            var cards = [
                { label: productName + ' · 总量', value: stats.total || 0 },
                { label: '平台覆盖', value: stats.platform_distribution ? Object.keys(stats.platform_distribution).length : 0 },
                { label: '社区热度', value: Math.round(stats.community_heat_score || 0) }
            ];
            Components.renderStatCards('stats-cards', cards);
        },
        reset: function() {
            loadDashboardData();
        }
    };

    var ContentList = {
        refreshForProduct: function(productName) {
            AppStore.setFilter('product_name', productName);
            ApiService.getContent({ product_name: productName, page: 1, page_size: 10 }).then(function(data) {
                Components.renderContentList('dashboard-content-list', data.items || []);
            }).catch(function(err) {
                console.error('Content load failed:', err);
            });
        },
        refreshForPlatform: function(platformName) {
            AppStore.setFilter('platform', platformName);
            ApiService.getContent({ platform: platformName, page: 1, page_size: 10 }).then(function(data) {
                Components.renderContentList('dashboard-content-list', data.items || []);
            }).catch(function(err) {
                console.error('Content load failed:', err);
            });
        },
        reset: function() {
            AppStore.setFilter('product_name', null);
            AppStore.setFilter('platform', null);
        }
    };

    function initThemeToggle() {
        var saved = localStorage.getItem('theme');
        if (saved === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
        }

        document.querySelectorAll('.theme-toggle').forEach(function(btn) {
            updateToggleLabel(btn);
            btn.addEventListener('click', function() {
                var isDark = document.body.getAttribute('data-theme') === 'dark';
                if (isDark) {
                    document.body.removeAttribute('data-theme');
                    localStorage.setItem('theme', 'light');
                } else {
                    document.body.setAttribute('data-theme', 'dark');
                    localStorage.setItem('theme', 'dark');
                }
                document.querySelectorAll('.theme-toggle').forEach(function(b) {
                    updateToggleLabel(b);
                });
            });
        });
    }

    function updateToggleLabel(btn) {
        var isDark = document.body.getAttribute('data-theme') === 'dark';
        btn.textContent = isDark ? '☀' : '☾';
        btn.title = isDark ? '切换到日间模式' : '切换到夜间模式';
    }

    function init() {
        initNavbar();
        initPageTransition();
        initThemeToggle();
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

var StatsPanel = Interactions.StatsPanel;
var ContentList = Interactions.ContentList;
var Dashboard = { loadAll: Interactions.loadDashboardData };
