/* ============================================
   evidence_panel.js — 证据链侧边面板
   点击分析结果，右侧滑出显示完整证据链
   ============================================ */

var EvidencePanel = (function() {
    var panel = null;
    var visible = false;

    function init() {
        panel = document.createElement('div');
        panel.className = 'evidence-panel';
        panel.id = 'evidence-panel';
        panel.innerHTML = buildEmptyHtml();
        document.body.appendChild(panel);

        panel.querySelector('.evidence-close').addEventListener('click', hide);
    }

    function buildEmptyHtml() {
        return '<div class="evidence-header">' +
            '<h3>证据链详情</h3>' +
            '<button class="evidence-close">✕</button>' +
            '</div>' +
            '<div class="evidence-body">' +
            '<div class="empty-state"><p>点击任意分析结果查看证据链</p></div>' +
            '</div>';
    }

    function show(data) {
        if (!panel) init();

        var body = panel.querySelector('.evidence-body');
        body.innerHTML = buildContent(data);

        panel.classList.add('visible');
        visible = true;
    }

    function hide() {
        if (panel) {
            panel.classList.remove('visible');
            visible = false;
        }
    }

    function buildContent(data) {
        if (!data) return '<div class="empty-state"><p>无数据</p></div>';

        var html = '';

        html += '<div class="evidence-section">' +
            '<div class="evidence-label">平台信息</div>' +
            '<div class="evidence-value">' + escapeHtml(data.platform || data.source || '-') + '</div>' +
            (data.url ? '<div class="evidence-link"><a href="' + escapeHtml(data.url) + '" target="_blank">' + escapeHtml(data.url) + '</a></div>' : '') +
            '</div>';

        html += '<div class="evidence-section">' +
            '<div class="evidence-label">原始标题</div>' +
            '<div class="evidence-value">' + escapeHtml(data.title || '-') + '</div>' +
            '</div>';

        html += '<div class="evidence-section">' +
            '<div class="evidence-label">分析结果</div>' +
            '<div class="evidence-grid">' +
                '<div><span class="ev-label">信度</span><span class="ev-val">' + credibilityLabel(data.credibility_level) + '</span></div>' +
                '<div><span class="ev-label">风险</span><span class="ev-val">' + riskLabel(data.risk_level) + '</span></div>' +
                '<div><span class="ev-label">主题</span><span class="ev-val">' + escapeHtml(data.topic_id || '-') + '</span></div>' +
                '<div><span class="ev-label">置信度</span><span class="ev-val">' + (data.credibility_confidence ? (data.credibility_confidence * 100).toFixed(1) + '%' : '-') + '</span></div>' +
            '</div>' +
            '</div>';

        html += '<div class="evidence-section">' +
            '<div class="evidence-label">模型信息</div>' +
            '<div class="evidence-grid">' +
                '<div><span class="ev-label">Embedding</span><span class="ev-val">Qwen3-4B</span></div>' +
                '<div><span class="ev-label">LLM</span><span class="ev-val">' + escapeHtml(data.llm_model || 'Mock-LLM') + '</span></div>' +
                '<div><span class="ev-label">版本</span><span class="ev-val">' + escapeHtml(data.analysis_version || 'v1.0') + '</span></div>' +
                '<div><span class="ev-label">分析时间</span><span class="ev-val">' + escapeHtml(data.publish_time || '-') + '</span></div>' +
            '</div>' +
            '</div>';

        if (data.reply_text) {
            html += '<div class="evidence-section">' +
                '<div class="evidence-label">官方回复</div>' +
                '<div class="evidence-reply">' + escapeHtml(data.reply_text) + '</div>' +
                '</div>';
        }

        html += '<div class="evidence-section">' +
            '<div class="evidence-label">审核状态</div>' +
            '<div class="evidence-value">' + reviewLabel(data.review_status) + '</div>' +
            '</div>';

        return html;
    }

    function credibilityLabel(c) {
        var map = { high: '高可信', low: '低可信', medium: '中可信' };
        return map[c] || c || '-';
    }

    function riskLabel(r) {
        var map = { low: '低', medium: '中', high: '高' };
        return map[r] || r || '-';
    }

    function reviewLabel(s) {
        var map = { pending: '待审核', approved: '已通过', rejected: '已驳回' };
        return map[s] || s || '未审核';
    }

    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function isVisible() {
        return visible;
    }

    return {
        init: init,
        show: show,
        hide: hide,
        isVisible: isVisible
    };
})();
