/* ============================================
   charts.js — ECharts 图表模块
   趋势折线图、主题分布柱状图、情感分布饼图
   ============================================ */

var Charts = (function() {
    var chartInstances = {};

    var baseTheme = {
        textStyle: {
            fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif",
            color: '#4A4A4A'
        },
        title: {
            textStyle: { color: '#1A1A1A', fontWeight: 700, fontSize: 14 }
        }
    };

    function getOrCreate(containerId, type) {
        var el = document.getElementById(containerId);
        if (!el) return null;
        if (chartInstances[containerId]) {
            return chartInstances[containerId];
        }
        var chart = echarts.init(el);
        chartInstances[containerId] = chart;
        return chart;
    }

    function initTopicDistribution(containerId, data) {
        var chart = getOrCreate(containerId);
        if (!chart) return;

        var names = data.map(function(d) { return d.name; });
        var values = data.map(function(d) { return d.count; });

        chart.setOption({
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: 80, right: 24, top: 8, bottom: 24 },
            xAxis: {
                type: 'value',
                axisLine: { lineStyle: { color: '#D0D0D0' } },
                axisLabel: { color: '#8A8A8A', fontSize: 11 }
            },
            yAxis: {
                type: 'category',
                data: names.reverse(),
                axisLine: { lineStyle: { color: '#D0D0D0' } },
                axisLabel: { color: '#4A4A4A', fontSize: 12, fontWeight: 600 }
            },
            series: [{
                type: 'bar',
                data: values.reverse(),
                barWidth: '60%',
                itemStyle: {
                    color: '#FFD700',
                    borderRadius: [0, 0, 0, 0]
                },
                emphasis: {
                    itemStyle: { color: '#F6A83D' }
                }
            }]
        });
    }

    function initTrend(containerId, data) {
        var chart = getOrCreate(containerId);
        if (!chart) return;

        var dates = data.map(function(d) { return d.date; });
        var hasLowCredibility = data.some(function(d) { return d.low_credibility !== undefined; });

        var series = [{
            name: '舆情量',
            type: 'line',
            data: data.map(function(d) { return d.total !== undefined ? d.total : d.count; }),
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { color: '#14D0D0', width: 2 },
            itemStyle: { color: '#14D0D0' },
            areaStyle: {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(20, 208, 208, 0.25)' },
                        { offset: 1, color: 'rgba(20, 208, 208, 0.02)' }
                    ]
                }
            }
        }];

        if (hasLowCredibility) {
            series.push({
                name: '低信度量',
                type: 'line',
                data: data.map(function(d) { return d.low_credibility || 0; }),
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: { color: '#F65413', width: 2 },
                itemStyle: { color: '#F65413' },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(246, 84, 19, 0.15)' },
                            { offset: 1, color: 'rgba(246, 84, 19, 0.02)' }
                        ]
                    }
                }
            });
        }

        chart.setOption({
            tooltip: { trigger: 'axis' },
            legend: { data: series.map(function(s) { return s.name; }), bottom: 0, textStyle: { color: '#8A8A8A', fontSize: 11 } },
            grid: { left: 40, right: 16, top: 16, bottom: 40 },
            xAxis: {
                type: 'category',
                data: dates,
                axisLine: { lineStyle: { color: '#D0D0D0' } },
                axisLabel: { color: '#8A8A8A', fontSize: 10, rotate: 30 }
            },
            yAxis: {
                type: 'value',
                axisLine: { lineStyle: { color: '#D0D0D0' } },
                axisLabel: { color: '#8A8A8A', fontSize: 11 },
                splitLine: { lineStyle: { color: '#EDE8DF' } }
            },
            series: series
        });
    }

    function initBarChart(containerId, data, options) {
        var chart = getOrCreate(containerId);
        if (!chart) return;
        options = options || {};

        chart.setOption({
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: options.leftPad || 60, right: 16, top: 8, bottom: 24 },
            xAxis: {
                type: 'value',
                axisLine: { lineStyle: { color: '#D0D0D0' } },
                axisLabel: { color: '#8A8A8A', fontSize: 11 }
            },
            yAxis: {
                type: 'category',
                data: data.map(function(d) { return d.name; }).reverse(),
                axisLine: { lineStyle: { color: '#D0D0D0' } },
                axisLabel: { color: '#4A4A4A', fontSize: 11 }
            },
            series: [{
                type: 'bar',
                data: data.map(function(d) { return d.value; }).reverse(),
                barWidth: '55%',
                itemStyle: { color: options.barColor || '#FFD700' }
            }]
        });
    }

    function updateForProduct(productName) {
        var stats = AppStore.getProductStats(productName);
        if (!stats) return;

        if (stats.topic_distribution) {
            initTopicDistribution('chart-topic-dist', stats.topic_distribution);
        }
        if (stats.daily_trend) {
            initTrend('chart-trend', stats.daily_trend);
        }
    }

    function reset() {
        if (typeof Dashboard !== 'undefined' && Dashboard.loadAll) {
            Dashboard.loadAll();
        }
    }

    function resize() {
        Object.keys(chartInstances).forEach(function(key) {
            if (chartInstances[key]) {
                chartInstances[key].resize();
            }
        });
    }

    function dispose(containerId) {
        if (chartInstances[containerId]) {
            chartInstances[containerId].dispose();
            delete chartInstances[containerId];
        }
    }

    window.addEventListener('resize', function() {
        resize();
    });

    return {
        initTopicDistribution: initTopicDistribution,
        initTrend: initTrend,
        initBarChart: initBarChart,
        updateForProduct: updateForProduct,
        reset: reset,
        resize: resize,
        dispose: dispose
    };
})();
