/* ============================================
   components.js — 可复用组件渲染
   统计卡片、内容列表、主题排行、分页、高风险表
   ============================================ */

var Components = (function() {

    function animateNumber(el, target, duration) {
        duration = duration || 600;
        var start = 0;
        var startTime = null;
        target = parseInt(target) || 0;

        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            var progress = Math.min((timestamp - startTime) / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = formatNum(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    function formatNum(n) {
        if (n === null || n === undefined) return '0';
        return n.toLocaleString('zh-CN');
    }

    function renderStatCards(container, cards) {
        var el = typeof container === 'string' ? document.getElementById(container) : container;
        if (!el) return;

        el.innerHTML = '';
        cards.forEach(function(card, i) {
            var div = document.createElement('div');
            div.className = 'stat-card card-stagger';
            div.style.animationDelay = (i * 0.08) + 's';
            div.innerHTML =
                '<div class="stat-value" data-target="' + (card.value || 0) + '">0</div>' +
                '<div class="stat-label">' + (card.label || '') + '</div>' +
                (card.accent ? '<div class="stat-accent"></div>' : '');
            el.appendChild(div);

            var valueEl = div.querySelector('.stat-value');
            setTimeout(function() {
                animateNumber(valueEl, card.value);
            }, 100 + i * 80);
        });
    }

    function renderContentList(container, items) {
        var el = typeof container === 'string' ? document.getElementById(container) : container;
        if (!el) return;

        if (!items || items.length === 0) {
            el.innerHTML = '<div class="empty-state"><div class="empty-icon">◇</div><p>暂无数据</p></div>';
            return;
        }

        el.innerHTML = '';
        items.forEach(function(item, i) {
            var sentimentClass = 'sentiment-' + (item.sentiment || 'neutral');
            var div = document.createElement('div');
            div.className = 'content-card card-stagger ' + sentimentClass;
            div.style.animationDelay = (i * 0.05) + 's';
            div.setAttribute('data-id', item.id);

            var riskBadge = '';
            if (item.risk_level) {
                var riskClass = 'badge-' + (item.risk_level === 'high' ? 'high' : item.risk_level === 'medium' ? 'medium' : 'low');
                var riskLabel = item.risk_level === 'high' ? '高' : item.risk_level === 'medium' ? '中' : '低';
                riskBadge = '<span class="card-risk-tag badge ' + riskClass + '">' + riskLabel + '</span>';
            }

            var topicTag = item.topic_id ? '<span class="card-topic-tag">' + escapeHtml(item.topic_id) + '</span>' : '';
            var source = item.source ? '<div class="card-source">来源：' + escapeHtml(item.source) + '</div>' : '';
            var time = item.publish_time ? formatDate(item.publish_time) : '';
            var text = item.clean_text || item.title || '';

            div.innerHTML =
                '<div class="card-meta">' +
                    topicTag +
                    '<span>' + time + '</span>' +
                '</div>' +
                riskBadge +
                '<div class="card-text">' + escapeHtml(text.substring(0, 120)) + '</div>' +
                source;

            div.addEventListener('click', function() {
                showContentDetail(item.id);
            });

            el.appendChild(div);
        });
    }

    function renderTopicRank(container, topics) {
        var el = typeof container === 'string' ? document.getElementById(container) : container;
        if (!el) return;

        if (!topics || topics.length === 0) {
            el.innerHTML = '<div class="empty-state"><p>暂无主题数据</p></div>';
            return;
        }

        var maxCount = Math.max.apply(null, topics.map(function(t) { return t.count || 0; }));
        el.innerHTML = '';

        topics.forEach(function(topic, i) {
            var pct = maxCount > 0 ? ((topic.count / maxCount) * 100) : 0;
            var div = document.createElement('div');
            div.className = 'topic-rank-item';
            div.innerHTML =
                '<span class="topic-rank-num">' + (i + 1) + '</span>' +
                '<span class="topic-rank-name">' + escapeHtml(topic.name || topic.topic_id) + '</span>' +
                '<div class="topic-rank-bar"><div class="topic-rank-bar-fill" style="width: 0%"></div></div>' +
                '<span class="topic-rank-count">' + (topic.count || 0) + '</span>';
            el.appendChild(div);

            setTimeout(function() {
                var fill = div.querySelector('.topic-rank-bar-fill');
                if (fill) fill.style.width = pct + '%';
            }, 100 + i * 50);
        });
    }

    function renderHighRiskTable(container, items) {
        var el = typeof container === 'string' ? document.getElementById(container) : container;
        if (!el) return;

        if (!items || items.length === 0) {
            el.innerHTML = '<div class="empty-state"><p>暂无高风险样本</p></div>';
            return;
        }

        var html = '<table class="data-table"><thead><tr>' +
            '<th>标题</th><th>来源</th><th>时间</th><th>风险</th>' +
            '</tr></thead><tbody>';

        items.forEach(function(item) {
            html += '<tr data-id="' + item.id + '" style="cursor:pointer">' +
                '<td>' + escapeHtml((item.title || item.clean_text || '').substring(0, 50)) + '</td>' +
                '<td>' + escapeHtml(item.source || '-') + '</td>' +
                '<td>' + formatDate(item.publish_time) + '</td>' +
                '<td><span class="badge badge-high">高</span></td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        el.innerHTML = html;

        el.querySelectorAll('tr[data-id]').forEach(function(row) {
            row.addEventListener('click', function() {
                showContentDetail(row.getAttribute('data-id'));
            });
        });
    }

    function renderPagination(container, pagination, callback) {
        var el = typeof container === 'string' ? document.getElementById(container) : container;
        if (!el) return;

        if (!pagination || pagination.total_pages <= 1) {
            el.innerHTML = '';
            return;
        }

        var page = pagination.page;
        var total = pagination.total_pages;
        var html = '';

        html += '<button ' + (page <= 1 ? 'disabled' : '') + ' data-page="' + (page - 1) + '">‹</button>';

        var start = Math.max(1, page - 2);
        var end = Math.min(total, page + 2);

        if (start > 1) {
            html += '<button data-page="1">1</button>';
            if (start > 2) html += '<span class="page-info">...</span>';
        }

        for (var i = start; i <= end; i++) {
            html += '<button data-page="' + i + '" class="' + (i === page ? 'active' : '') + '">' + i + '</button>';
        }

        if (end < total) {
            if (end < total - 1) html += '<span class="page-info">...</span>';
            html += '<button data-page="' + total + '">' + total + '</button>';
        }

        html += '<button ' + (page >= total ? 'disabled' : '') + ' data-page="' + (page + 1) + '">›</button>';
        html += '<span class="page-info">共 ' + pagination.total + ' 条</span>';

        el.innerHTML = html;

        el.querySelectorAll('button[data-page]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var p = parseInt(btn.getAttribute('data-page'));
                if (p >= 1 && p <= total) callback(p);
            });
        });
    }

    function showContentDetail(id) {
        var overlay = document.getElementById('detail-modal');
        if (!overlay) return;

        var body = document.getElementById('detail-modal-body');
        if (body) body.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div>加载中...</div>';

        overlay.classList.add('active');

        ApiService.getContentById(id).then(function(data) {
            if (!data) {
                if (body) body.innerHTML = '<p>未找到该记录</p>';
                return;
            }
            if (body) {
                body.innerHTML =
                    '<div style="margin-bottom:1rem">' +
                        '<span class="badge badge-' + (data.sentiment || 'neutral') + '">' + (data.sentiment || '-') + '</span> ' +
                        '<span class="badge badge-' + (data.risk_level === 'high' ? 'high' : data.risk_level === 'medium' ? 'medium' : 'low') + '">' + (data.risk_level || '-') + '</span>' +
                    '</div>' +
                    '<h3 style="margin-bottom:0.5rem">' + escapeHtml(data.title || '无标题') + '</h3>' +
                    '<p class="text-muted mb-1">' + formatDate(data.publish_time) + ' · ' + escapeHtml(data.source || '-') + '</p>' +
                    '<div style="line-height:1.8;margin-top:1rem;padding:1rem;background:var(--color-bg-secondary)">' +
                        escapeHtml(data.clean_text || data.title || '') +
                    '</div>' +
                    (data.summary ? '<div style="margin-top:1rem"><strong>AI 摘要：</strong>' + escapeHtml(data.summary) + '</div>' : '') +
                    (data.url ? '<div style="margin-top:0.5rem"><a href="' + escapeHtml(data.url) + '" target="_blank" class="text-accent">原文链接 →</a></div>' : '');
            }
        }).catch(function(err) {
            if (body) body.innerHTML = '<p>加载失败</p>';
            console.error(err);
        });
    }

    function escapeHtml(str) {
        if (typeof escapeHtml_fn === 'function') return escapeHtml_fn(str);
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        if (typeof formatDate_fn === 'function') return formatDate_fn(dateStr);
        if (!dateStr) return '-';
        try {
            var d = new Date(dateStr);
            return d.getFullYear() + '-' +
                String(d.getMonth() + 1).padStart(2, '0') + '-' +
                String(d.getDate()).padStart(2, '0') + ' ' +
                String(d.getHours()).padStart(2, '0') + ':' +
                String(d.getMinutes()).padStart(2, '0');
        } catch(e) {
            return dateStr;
        }
    }

    function initModal() {
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal-overlay')) {
                e.target.classList.remove('active');
            }
            if (e.target.classList.contains('modal-close')) {
                var overlay = e.target.closest('.modal-overlay');
                if (overlay) overlay.classList.remove('active');
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.active').forEach(function(m) {
                    m.classList.remove('active');
                });
            }
        });
    }

    return {
        renderStatCards: renderStatCards,
        renderContentList: renderContentList,
        renderTopicRank: renderTopicRank,
        renderHighRiskTable: renderHighRiskTable,
        renderPagination: renderPagination,
        showContentDetail: showContentDetail,
        animateNumber: animateNumber,
        initModal: initModal
    };
})();
