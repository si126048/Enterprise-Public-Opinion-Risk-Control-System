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

    function initSentimentDistribution(containerId, data) {
        var chart = getOrCreate(containerId);
        if (!chart) return;

        var colorMap = {
            '正面': '#14D0D0',
            '中性': '#8A8A8A',
            '负面': '#F65413',
            'positive': '#14D0D0',
            'neutral': '#8A8A8A',
            'negative': '#F65413'
        };

        var chartData = data.map(function(d) {
            return {
                name: d.name,
                value: d.value,
                itemStyle: { color: colorMap[d.name] || colorMap[d.key] || '#8A8A8A' }
            };
        });

        chart.setOption({
            tooltip: {
                trigger: 'item',
                formatter: '{b}: {c} ({d}%)'
            },
            series: [{
                type: 'pie',
                radius: ['45%', '70%'],
                center: ['50%', '50%'],
                data: chartData,
                label: {
                    color: '#4A4A4A',
                    fontSize: 12,
                    formatter: '{b}\n{d}%'
                },
                emphasis: {
                    scaleSize: 6
                },
                itemStyle: {
                    borderColor: '#F5F2EB',
                    borderWidth: 2
                }
            }]
        });
    }

    function initTrend(containerId, data) {
        var chart = getOrCreate(containerId);
        if (!chart) return;

        var dates = data.map(function(d) { return d.date; });
        var counts = data.map(function(d) { return d.count; });

        chart.setOption({
            tooltip: { trigger: 'axis' },
            grid: { left: 40, right: 16, top: 16, bottom: 32 },
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
            series: [{
                type: 'line',
                data: counts,
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
            }]
        });
    }

    function initRiskDistribution(containerId, data) {
        var chart = getOrCreate(containerId);
        if (!chart) return;

        var colorMap = {
            '高': '#E53935', '中': '#FFD700', '低': '#43A047',
            'high': '#E53935', 'medium': '#FFD700', 'low': '#43A047'
        };

        var chartData = data.map(function(d) {
            return {
                name: d.name,
                value: d.value,
                itemStyle: { color: colorMap[d.name] || colorMap[d.key] || '#8A8A8A' }
            };
        });

        chart.setOption({
            tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
            series: [{
                type: 'pie',
                radius: ['45%', '70%'],
                center: ['50%', '50%'],
                data: chartData,
                label: { color: '#4A4A4A', fontSize: 12, formatter: '{b}\n{d}%' },
                itemStyle: { borderColor: '#F5F2EB', borderWidth: 2 }
            }]
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

    function updateForDistrict(districtName) {
        var stats = AppStore.getDistrictStats(districtName);
        if (!stats) return;

        if (stats.topic_distribution) {
            initTopicDistribution('chart-topic-dist', stats.topic_distribution);
        }
        if (stats.sentiment_distribution) {
            initSentimentDistribution('chart-sentiment-dist', stats.sentiment_distribution);
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
        initSentimentDistribution: initSentimentDistribution,
        initTrend: initTrend,
        initRiskDistribution: initRiskDistribution,
        initBarChart: initBarChart,
        updateForDistrict: updateForDistrict,
        reset: reset,
        resize: resize,
        dispose: dispose
    };
})();
