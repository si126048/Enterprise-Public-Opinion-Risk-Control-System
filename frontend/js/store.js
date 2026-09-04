/* ============================================
   store.js — AppStore 全局状态管理
   发布-订阅模式，各模块监听状态变化自动更新
   ============================================ */

var AppStore = (function() {
    var state = {
        currentDistrict: null,
        filters: {
            sentiment: null,
            topic: null,
            risk_level: null,
            date_from: null,
            date_to: null,
            search: null
        },
        data: {
            stats: null,
            topics: [],
            contents: [],
            sources: [],
            districtStats: {}
        },
        pagination: {
            page: 1,
            page_size: 20,
            total: 0,
            total_pages: 0
        }
    };

    var listeners = [];

    function subscribe(fn) {
        if (typeof fn === 'function') {
            listeners.push(fn);
        }
    }

    function notify(changeType, payload) {
        listeners.forEach(function(fn) {
            try { fn(changeType, payload); } catch(e) { console.error('Store listener error:', e); }
        });
    }

    function getState() {
        return state;
    }

    function setFilter(key, value) {
        state.filters[key] = value;
        notify('filter_changed', { key: key, value: value });
    }

    function getFilter(key) {
        return key ? state.filters[key] : Object.assign({}, state.filters);
    }

    function clearFilters() {
        Object.keys(state.filters).forEach(function(k) { state.filters[k] = null; });
        notify('filters_cleared');
    }

    function setDistrict(name) {
        state.currentDistrict = name;
        notify('district_changed', name);
    }

    function getDistrict() {
        return state.currentDistrict;
    }

    function setData(key, value) {
        state.data[key] = value;
        notify('data_updated', { key: key, value: value });
    }

    function getData(key) {
        return key ? state.data[key] : state.data;
    }

    function setPagination(p) {
        Object.assign(state.pagination, p);
    }

    function getPagination() {
        return Object.assign({}, state.pagination);
    }

    function getDistrictStats(name) {
        if (state.data.districtStats && state.data.districtStats[name]) {
            return state.data.districtStats[name];
        }
        return null;
    }

    function getActiveFilters() {
        var active = {};
        Object.keys(state.filters).forEach(function(k) {
            if (state.filters[k]) active[k] = state.filters[k];
        });
        if (state.currentDistrict) {
            active.district = state.currentDistrict;
        }
        return active;
    }

    return {
        subscribe: subscribe,
        notify: notify,
        getState: getState,
        setFilter: setFilter,
        getFilter: getFilter,
        clearFilters: clearFilters,
        setDistrict: setDistrict,
        getDistrict: getDistrict,
        setData: setData,
        getData: getData,
        setPagination: setPagination,
        getPagination: getPagination,
        getDistrictStats: getDistrictStats,
        getActiveFilters: getActiveFilters
    };
})();
