/* ============================================
   company_selector.js — 公司选择器
   导航栏公司切换，驱动全局数据刷新
   ============================================ */

var CompanySelector = (function() {
    var companies = [];
    var currentId = 'mihoyo';
    var selectEl = null;

    function init() {
        selectEl = document.getElementById('company-selector');
        if (!selectEl) return;

        companies = [
            { id: 'mihoyo', name: '米哈游', full: 'miHoYo', active: true },
            { id: 'tencent', name: '腾讯', full: 'Tencent', active: false },
            { id: 'netease', name: '网易', full: 'NetEase', active: false }
        ];

        var urlParams = new URLSearchParams(window.location.search);
        var urlCompany = urlParams.get('company');
        if (urlCompany && companies.some(function(c) { return c.id === urlCompany && c.active; })) {
            currentId = urlCompany;
        }

        render();
        selectEl.addEventListener('change', function() {
            var newId = selectEl.value;
            var company = companies.find(function(c) { return c.id === newId; });
            if (!company || !company.active) {
                selectEl.value = currentId;
                return;
            }
            switchCompany(newId);
        });

        if (typeof AppStore !== 'undefined') {
            AppStore.setCompany(currentId);
        }
    }

    function render() {
        if (!selectEl) return;
        selectEl.innerHTML = '';
        companies.forEach(function(c) {
            var opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name + (c.active ? '' : ' (即将上线)');
            opt.disabled = !c.active;
            if (c.id === currentId) opt.selected = true;
            selectEl.appendChild(opt);
        });
    }

    function switchCompany(newId) {
        currentId = newId;
        if (typeof AppStore !== 'undefined') {
            AppStore.setCompany(newId);
        }

        var url = new URL(window.location);
        url.searchParams.set('company', newId);
        window.history.replaceState({}, '', url);

        showLoading(true);

        if (typeof Dashboard !== 'undefined' && Dashboard.loadAll) {
            Dashboard.loadAll();
        }

        setTimeout(function() { showLoading(false); }, 600);
    }

    function showLoading(on) {
        var cards = document.getElementById('stats-cards');
        if (cards && on) {
            cards.innerHTML = '<div class="skeleton-loader" style="height:80px;width:100%"></div>';
        }
    }

    function getCurrent() {
        return currentId;
    }

    function getCurrentName() {
        var c = companies.find(function(c) { return c.id === currentId; });
        return c ? c.name : '';
    }

    return {
        init: init,
        getCurrent: getCurrent,
        getCurrentName: getCurrentName,
        switchCompany: switchCompany
    };
})();
