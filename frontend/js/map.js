/* ============================================
   map.js — PlatformDistribution 平台分布可视化
   ECharts 饼图 + 柱状图 替代旧版 Leaflet 地图
   ============================================ */

var PlatformDistribution = (function() {
    var platformChart = null;
    var productChart = null;
    var selectedProduct = null;

    var platformColors = {
        '微博': '#E6162D',
        '小红书': '#FF2442',
        '知乎': '#0066FF',
        'B站': '#00A1D6',
        'TapTap': '#15C51A',
        '小黑盒': '#1B1B1B',
        '米游社': '#00B4E8'
    };

    var productColors = {
        '原神': '#6C5CE7',
        '崩坏：星穹铁道': '#E17055',
        '绝区零': '#00B894',
        '未定事件簿': '#FD79A8',
        '公司层面': '#636E72'
    };

    function init(containerId, options) {
        options = options || {};
        var container = document.getElementById(containerId);
        if (!container) return;

        platformChart = echarts.init(container);
        _bindResize();
    }

    function initProduct(containerId) {
        var container = document.getElementById(containerId);
        if (!container) return;

        productChart = echarts.init(container);
        _bindResize();
    }

    function _bindResize() {
        window.addEventListener('resize', function() {
            if (platformChart) platformChart.resize();
            if (productChart) productChart.resize();
        });
    }

    function updatePlatform(statsOrId, data) {
        if (typeof statsOrId === 'string') {
            var container = document.getElementById(statsOrId);
            if (!container) return;
            if (!platformChart) {
                platformChart = echarts.init(container);
                _bindResize();
            }
            var pieData = (data || []).map(function(d) {
                return { name: d.name, value: d.value, itemStyle: { color: platformColors[d.name] || '#B2BEC3' } };
            });
            _renderPlatformPie(pieData);
            return;
        }
        if (!platformChart) return;
        var dist = statsOrId.platform_distribution || {};
        var pieData2 = Object.keys(dist).map(function(k) {
            return { name: k, value: dist[k], itemStyle: { color: platformColors[k] || '#B2BEC3' } };
        });
        _renderPlatformPie(pieData2);
    }

    function _renderPlatformPie(data) {
        if (!platformChart) return;
        platformChart.setOption({
            tooltip: {
                trigger: 'item',
                formatter: function(p) {
                    return '<strong>' + p.name + '</strong><br/>舆情量: ' + p.value +
                        '<br/>占比: ' + p.percent.toFixed(1) + '%';
                }
            },
            legend: {
                orient: 'vertical',
                right: '5%',
                top: 'center',
                textStyle: { color: '#888', fontSize: 12 }
            },
            series: [{
                type: 'pie',
                radius: ['40%', '70%'],
                center: ['35%', '50%'],
                avoidLabelOverlap: true,
                itemStyle: {
                    borderRadius: 6,
                    borderColor: 'var(--color-bg-primary, #0D1117)',
                    borderWidth: 2
                },
                label: { show: false },
                emphasis: {
                    label: { show: true, fontSize: 14, fontWeight: 'bold' },
                    itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.3)' }
                },
                data: data
            }]
        });
    }

    function updateProduct(statsOrId, data) {
        if (typeof statsOrId === 'string') {
            var container = document.getElementById(statsOrId);
            if (!container) return;
            if (!productChart) {
                productChart = echarts.init(container);
                _bindResize();
            }
            var pieData = (data || []).map(function(d) {
                return { name: d.name, value: d.value, itemStyle: { color: productColors[d.name] || '#B2BEC3' } };
            });
            _renderProductPie(pieData);
            return;
        }
        if (!productChart) return;
        var dist = statsOrId.product_distribution || {};
        var pieData2 = Object.keys(dist).map(function(k) {
            return { name: k, value: dist[k], itemStyle: { color: productColors[k] || '#B2BEC3' } };
        });
        _renderProductPie(pieData2);
    }

    function _renderProductPie(data) {
        if (!productChart) return;
        productChart.setOption({
            tooltip: {
                trigger: 'item',
                formatter: function(p) {
                    return '<strong>' + p.name + '</strong><br/>舆情量: ' + p.value +
                        '<br/>占比: ' + p.percent.toFixed(1) + '%';
                }
            },
            legend: {
                orient: 'vertical',
                right: '5%',
                top: 'center',
                textStyle: { color: '#888', fontSize: 12 }
            },
            series: [{
                type: 'pie',
                radius: ['40%', '70%'],
                center: ['35%', '50%'],
                avoidLabelOverlap: true,
                itemStyle: {
                    borderRadius: 6,
                    borderColor: 'var(--color-bg-primary, #0D1117)',
                    borderWidth: 2
                },
                label: { show: false },
                emphasis: {
                    label: { show: true, fontSize: 14, fontWeight: 'bold' },
                    itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.3)' }
                },
                data: data
            }]
        });
    }

    function updateBar(containerId, stats) {
        var chart = echarts.init(document.getElementById(containerId));
        var dist = stats.platform_distribution || {};
        var platforms = Object.keys(dist);
        var values = platforms.map(function(p) { return dist[p]; });
        var colors = platforms.map(function(p) { return platformColors[p] || '#B2BEC3'; });

        chart.setOption({
            tooltip: { trigger: 'axis' },
            xAxis: {
                type: 'category',
                data: platforms,
                axisLabel: { color: '#888', fontSize: 11 }
            },
            yAxis: {
                type: 'value',
                axisLabel: { color: '#888' },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } }
            },
            series: [{
                type: 'bar',
                data: values.map(function(v, i) {
                    return { value: v, itemStyle: { color: colors[i] } };
                }),
                barWidth: '50%',
                itemStyle: { borderRadius: [4, 4, 0, 0] }
            }]
        });

        window.addEventListener('resize', function() { chart.resize(); });
        return chart;
    }

    function getSelectedProduct() {
        return selectedProduct;
    }

    function resize() {
        if (platformChart) platformChart.resize();
        if (productChart) productChart.resize();
    }

    function dispose() {
        if (platformChart) { platformChart.dispose(); platformChart = null; }
        if (productChart) { productChart.dispose(); productChart = null; }
    }

    return {
        init: init,
        initProduct: initProduct,
        updatePlatform: updatePlatform,
        updateProduct: updateProduct,
        updateBar: updateBar,
        getSelectedProduct: getSelectedProduct,
        resize: resize,
        dispose: dispose,
        platformColors: platformColors,
        productColors: productColors
    };
})();

// Backward compatibility aliases
var KunmingMap = PlatformDistribution;
var WuhuaMap = PlatformDistribution;
