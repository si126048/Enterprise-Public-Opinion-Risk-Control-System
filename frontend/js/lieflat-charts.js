/* lieflat-charts.js — 基于 lieflat-charts 品味的 ECharts 图表模块
   适配 RhineAI 暗色主题，porcelain 色系（蓝阶 = 有序数据）
   图型选型遵循 catalog.md：F2 Hairline Area / F5 Tick Rows / F4 Tick Donut / F1 Rung Bars */
(function (global) {
  'use strict';

  /* ── Dark 色板 ────────────────────────────────── */
  var DK = {
    bg:       'transparent',
    cardBg:   '#1E1E1E',
    txt:      '#FFFFFF',
    mut:      'rgba(255,255,255,0.5)',
    faint:    'rgba(255,255,255,0.25)',
    grid:     'rgba(255,255,255,0.06)',
    data:     '#F5D000',
    data2:    '#FFE44D',
    hero:     '#F5D000',
    accent:   '#00D4FF',
    danger:   '#FF3B3B',
    warn:     '#F5D000',
    success:  '#34D399',
    ladder:   ['#FFFFFF', '#D4D4D4', '#B0B0B0', '#8C8C8C', '#F5D000', '#C4A800', '#997E00'],
    cat4:     ['#F5D000', '#00D4FF', '#FF3B3B', '#34D399'],
    ser:      ['#F5D000', '#00D4FF', '#FF3B3B', '#34D399', '#FFE44D', '#66E0FF'],
  };

  var FONT = {
    family: "'Inter', system-ui, -apple-system, sans-serif",
    titleSize: 14,
    subSize: 11,
    axisSize: 10,
    valueWeight: 800,
    axisWeight: 600,
  };

  var MOTION = {
    enter: 600,
    easing: 'cubicOut',
    staggerBar: 80,
  };

  function baseOpt() {
    return {
      backgroundColor: DK.bg,
      textStyle: { fontFamily: FONT.family, color: DK.txt },
      tooltip: {
        backgroundColor: 'rgba(24,24,24,0.95)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        padding: [10, 14],
        textStyle: { color: '#E5E5E5', fontFamily: FONT.family, fontSize: 12 },
        extraCssText: 'border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.3);',
      },
      animationDuration: MOTION.enter,
      animationEasing: MOTION.easing,
      animationDurationUpdate: 400,
    };
  }

  var charts = [];

  function initChart(el, opt) {
    if (!el) return null;
    var c = echarts.init(el, null, { renderer: 'canvas' });
    c.setOption(opt);
    charts.push(c);
    return c;
  }

  function resizeAll() {
    charts.forEach(function (c) { c.resize(); });
  }
  window.addEventListener('resize', resizeAll);

  /* ═══ F3 · Hairline Area — 日序列趋势（双系列）═══════
     数据形状：≤30 天逐日读数，两条线（总量 + 低信度）
     来自 templates/basics-gallery.html B3 hairline area */
  function hairlineArea(el, data) {
    if (!el || !data) return;
    var dates = data.dates || [];
    var total = data.total || [];
    var low = data.low_credibility || [];

    var shortDates = dates.map(function (d) {
      return d.length > 5 ? d.slice(5) : d;
    });

    var opt = baseOpt();
    opt.legend = {
      data: ['总舆情', '低信度'],
      top: 4, right: 8,
      textStyle: { color: DK.mut, fontSize: FONT.subSize, fontFamily: FONT.family },
      itemWidth: 16, itemHeight: 2,
    };
    opt.grid = { left: 42, right: 16, top: 36, bottom: 36 };
    opt.xAxis = {
      type: 'category',
      data: shortDates,
      boundaryGap: false,
      axisLine: { lineStyle: { color: DK.grid } },
      axisTick: { show: false },
      axisLabel: {
        color: DK.mut, fontSize: FONT.axisSize, fontWeight: FONT.axisWeight,
        fontFamily: FONT.family, letterSpacing: '0.05em',
        rotate: dates.length > 10 ? 30 : 0,
      },
    };
    opt.yAxis = {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: DK.mut, fontSize: FONT.axisSize, fontWeight: FONT.axisWeight, fontFamily: FONT.family },
      splitLine: { lineStyle: { color: DK.grid, type: 'dashed' } },
    };
    opt.series = [
      {
        name: '总舆情',
        type: 'line',
        smooth: 0.3,
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: false,
        lineStyle: { color: DK.hero, width: 1.5 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59,130,246,0.25)' },
              { offset: 1, color: 'rgba(59,130,246,0.01)' },
            ],
          },
        },
        itemStyle: { color: DK.hero },
        emphasis: { focus: 'series', itemStyle: { borderWidth: 2 } },
        data: total,
        animationDelay: function (idx) { return idx * 30; },
      },
      {
        name: '低信度',
        type: 'line',
        smooth: 0.3,
        symbol: 'diamond',
        symbolSize: 4,
        showSymbol: false,
        lineStyle: { color: DK.danger, width: 1.2, type: [4, 3] },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(248,113,113,0.12)' },
              { offset: 1, color: 'rgba(248,113,113,0.01)' },
            ],
          },
        },
        itemStyle: { color: DK.danger },
        emphasis: { focus: 'series' },
        data: low,
        animationDelay: function (idx) { return idx * 30 + 150; },
      },
    ];
    return initChart(el, opt);
  }

  /* ═══ F5 · Tick Rows — 横向排名比较 ═══════════════════
     数据形状：≤8 类目的排名比较
     来自 templates/basics-gallery.html C1 tick rows
     用 ECharts 横向柱状图实现，保持发丝风格 */
  function tickRows(el, data, options) {
    if (!el || !data || !data.length) return;
    var opts = options || {};
    var sorted = data.slice().sort(function (a, b) { return a.value - b.value; });
    var names = sorted.map(function (d) { return d.name; });
    var values = sorted.map(function (d) { return d.value; });
    var maxVal = Math.max.apply(null, values);

    var opt = baseOpt();
    opt.grid = { left: opts.labelWidth || 90, right: 48, top: 8, bottom: 8 };
    opt.xAxis = {
      type: 'value',
      show: false,
      max: maxVal * 1.15,
    };
    opt.yAxis = {
      type: 'category',
      data: names,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: DK.mut,
        fontSize: FONT.axisSize,
        fontWeight: FONT.axisWeight,
        fontFamily: FONT.family,
        letterSpacing: '0.06em',
      },
      inverse: false,
    };
    opt.series = [{
      type: 'bar',
      barWidth: 6,
      data: values.map(function (v, i) {
        var ratio = i / (values.length - 1 || 1);
        return {
          value: v,
          itemStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: lerpColor(DK.hero, DK.data, ratio) },
                { offset: 1, color: lerpColor(DK.accent, DK.data2, ratio) },
              ],
            },
            borderRadius: [0, 3, 3, 0],
          },
        };
      }),
      label: {
        show: true,
        position: 'right',
        color: DK.txt,
        fontSize: 11,
        fontWeight: FONT.valueWeight,
        fontFamily: FONT.family,
      },
      animationDelay: function (idx) { return idx * MOTION.staggerBar; },
    }];
    return initChart(el, opt);
  }

  /* ═══ F4 · Tick Donut — 100% 构成 ═══════════════════
     数据形状：≤6 段的占比构成
     来自 templates/basics-gallery.html B4 tick donut */
  function tickDonut(el, data, options) {
    if (!el || !data || !data.length) return;
    var opts = options || {};
    var total = data.reduce(function (s, d) { return s + d.value; }, 0);
    var colors = opts.colors || DK.cat4;

    var donutCenter = opts.donutCenter || ['38%', '50%'];

    var opt = baseOpt();
    opt.tooltip = Object.assign({}, opt.tooltip, {
      trigger: 'item',
      formatter: function (p) {
        return '<b>' + p.name + '</b><br/>' +
          p.value + ' (' + p.percent.toFixed(1) + '%)';
      },
    });
    opt.legend = {
      orient: 'vertical',
      right: 12,
      top: 'center',
      textStyle: { color: DK.mut, fontSize: FONT.subSize, fontFamily: FONT.family },
      itemWidth: 8, itemHeight: 8, itemGap: 12,
    };
    opt.series = [{
      type: 'pie',
      radius: ['52%', '74%'],
      center: donutCenter,
      avoidLabelOverlap: false,
      itemStyle: {
        borderColor: 'rgba(15,23,42,0.8)',
        borderWidth: 2,
        borderRadius: 4,
      },
      label: { show: false },
      emphasis: {
        label: { show: false },
        itemStyle: {
          shadowBlur: 20,
          shadowColor: 'rgba(59,130,246,0.3)',
        },
      },
      data: data.map(function (d, i) {
        return {
          name: d.name,
          value: d.value,
          itemStyle: { color: colors[i % colors.length] },
        };
      }),
      animationType: 'scale',
      animationEasing: 'elasticOut',
      animationDelay: function (idx) { return idx * 80; },
    }];

    if (opts.centerLabel) {
      opt.graphic = [{
        type: 'group',
        left: donutCenter[0],
        top: donutCenter[1],
        children: [
          {
            type: 'text',
            style: {
              text: opts.centerLabel.value || total,
              fontSize: 22,
              fontWeight: FONT.valueWeight,
              fontFamily: FONT.family,
              fill: DK.txt,
              textAlign: 'center',
              textVerticalAlign: 'middle',
            },
            y: -8,
          },
          {
            type: 'text',
            style: {
              text: opts.centerLabel.unit || '总计',
              fontSize: 9,
              fontWeight: FONT.axisWeight,
              fontFamily: FONT.family,
              fill: DK.mut,
              textAlign: 'center',
              textVerticalAlign: 'middle',
              letterSpacing: 2,
            },
            y: 14,
          },
        ],
      }];
    }

    return initChart(el, opt);
  }

  /* ═══ F1 · Rung Bars — 少类目比较 ═══════════════════
     数据形状：≤8 类目的数值比较
     来自 templates/basics-gallery.html B1 rung bars */
  function rungBars(el, data, options) {
    if (!el || !data || !data.length) return;
    var opts = options || {};
    var names = data.map(function (d) { return d.name; });
    var values = data.map(function (d) { return d.value; });
    var maxVal = Math.max.apply(null, values);

    var opt = baseOpt();
    opt.grid = { left: 48, right: 16, top: 12, bottom: 36 };
    opt.xAxis = {
      type: 'category',
      data: names,
      axisLine: { lineStyle: { color: DK.grid } },
      axisTick: { show: false },
      axisLabel: {
        color: DK.mut,
        fontSize: FONT.axisSize,
        fontWeight: FONT.axisWeight,
        fontFamily: FONT.family,
        letterSpacing: '0.06em',
        rotate: opts.rotate || 0,
      },
    };
    opt.yAxis = {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: DK.mut, fontSize: FONT.axisSize, fontWeight: FONT.axisWeight, fontFamily: FONT.family },
      splitLine: { lineStyle: { color: DK.grid, type: 'dashed' } },
    };
    opt.series = [{
      type: 'bar',
      barWidth: opts.barWidth || 24,
      data: values.map(function (v, i) {
        var ratio = i / (values.length - 1 || 1);
        return {
          value: v,
          itemStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: lerpColor(DK.hero, DK.data, ratio) },
                { offset: 1, color: 'rgba(59,130,246,0.15)' },
              ],
            },
            borderRadius: [4, 4, 0, 0],
          },
        };
      }),
      label: {
        show: true,
        position: 'top',
        color: DK.txt,
        fontSize: 11,
        fontWeight: FONT.valueWeight,
        fontFamily: FONT.family,
      },
      animationDelay: function (idx) { return idx * MOTION.staggerBar; },
    }];
    return initChart(el, opt);
  }

  /* ═══ F11 · Tick Gauge — 单值进度 ═══════════════════
     数据形状：0-100% 的单值进度 */
  function tickGauge(el, value, options) {
    if (!el) return;
    var opts = options || {};
    var color = opts.color || DK.hero;

    var opt = baseOpt();
    opt.series = [{
      type: 'gauge',
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 100,
      radius: '90%',
      center: ['50%', '55%'],
      progress: {
        show: true,
        width: 10,
        roundCap: true,
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: color },
              { offset: 1, color: DK.accent },
            ],
          },
        },
      },
      pointer: { show: false },
      axisLine: {
        lineStyle: {
          width: 10,
          color: [[1, DK.grid]],
          roundCap: true,
        },
      },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      title: {
        show: true,
        offsetCenter: [0, '30%'],
        fontSize: FONT.subSize,
        fontWeight: FONT.axisWeight,
        fontFamily: FONT.family,
        color: DK.mut,
      },
      detail: {
        valueAnimation: true,
        offsetCenter: [0, '-5%'],
        fontSize: 26,
        fontWeight: FONT.valueWeight,
        fontFamily: FONT.family,
        color: DK.txt,
        formatter: '{value}%',
      },
      data: [{
        value: value,
        name: opts.label || '',
      }],
      animationDuration: 1200,
      animationEasing: 'cubicOut',
    }];
    return initChart(el, opt);
  }

  /* ═══ 风控事件等级分布 — 横向分段条 ═══════════════ */
  function riskLevelBar(el, data) {
    if (!el || !data) return;

    var levelColors = {
      critical: '#EF4444',
      high: '#F87171',
      medium: '#FBBF24',
      low: '#34D399',
    };
    var levelNames = {
      critical: '严重',
      high: '高',
      medium: '中',
      low: '低',
    };

    var items = [];
    ['critical', 'high', 'medium', 'low'].forEach(function (lvl) {
      if (data[lvl] != null && data[lvl] > 0) {
        items.push({
          name: levelNames[lvl] || lvl,
          value: data[lvl],
          itemStyle: { color: levelColors[lvl] || DK.data },
        });
      }
    });

    if (!items.length) return;

    var opt = baseOpt();
    opt.grid = { left: 56, right: 48, top: 8, bottom: 8 };
    opt.xAxis = { type: 'value', show: false };
    opt.yAxis = {
      type: 'category',
      data: items.map(function (d) { return d.name; }),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: DK.mut,
        fontSize: FONT.axisSize,
        fontWeight: FONT.axisWeight,
        fontFamily: FONT.family,
      },
    };
    opt.series = [{
      type: 'bar',
      barWidth: 8,
      data: items.map(function (d) { return d; }),
      label: {
        show: true,
        position: 'right',
        color: DK.txt,
        fontSize: 11,
        fontWeight: FONT.valueWeight,
        fontFamily: FONT.family,
      },
      itemStyle: { borderRadius: [0, 4, 4, 0] },
      animationDelay: function (idx) { return idx * MOTION.staggerBar; },
    }];
    return initChart(el, opt);
  }

  /* ═══ 雷达图 — 多维风险画像 ═══════════════════════════ */
  function sentimentRadar(el, data) {
    if (!el || !data) return;
    var indicators = data.indicators || [];
    var series = data.series || [];

    var opt = baseOpt();
    opt.tooltip = Object.assign({}, opt.tooltip, { trigger: 'item' });
    opt.legend = {
      data: series.map(function (s) { return s.name; }),
      bottom: 4, right: 8,
      textStyle: { color: DK.mut, fontSize: FONT.subSize, fontFamily: FONT.family },
      itemWidth: 12, itemHeight: 3,
    };
    opt.radar = {
      indicator: indicators,
      radius: '65%',
      center: ['50%', '46%'],
      axisName: {
        color: DK.mut,
        fontSize: FONT.axisSize,
        fontWeight: FONT.axisWeight,
        fontFamily: FONT.family,
      },
      splitArea: {
        areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.01)'] },
      },
      splitLine: { lineStyle: { color: DK.grid } },
      axisLine: { lineStyle: { color: DK.grid } },
    };
    opt.series = [{
      type: 'radar',
      data: series.map(function (s, i) {
        return {
          name: s.name,
          value: s.values,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { width: 1.5, color: DK.ser[i % DK.ser.length] },
          areaStyle: { color: DK.ser[i % DK.ser.length], opacity: 0.12 },
          itemStyle: { color: DK.ser[i % DK.ser.length] },
        };
      }),
    }];
    return initChart(el, opt);
  }

  /* ═══ 日历热力图 — 舆情发布时间分布 ═══════════════════ */
  function heatCalendar(el, data) {
    if (!el || !data) return;
    var dates = data.dates || [];
    var values = data.values || [];

    var calData = dates.map(function (d, i) {
      return [d, values[i] || 0];
    });

    var opt = baseOpt();
    opt.tooltip = Object.assign({}, opt.tooltip, {
      position: 'top',
      formatter: function (p) {
        return p.data[0] + '<br/>' + p.data[1] + ' 条舆情';
      },
    });
    opt.visualMap = {
      min: 0,
      max: Math.max.apply(null, values) || 10,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 4,
      inRange: {
        color: ['rgba(59,130,246,0.1)', 'rgba(59,130,246,0.35)', '#3B82F6'],
      },
      textStyle: { color: DK.mut, fontSize: FONT.axisSize, fontFamily: FONT.family },
      itemWidth: 10, itemHeight: 80,
    };
    opt.calendar = {
      top: 32,
      left: 48,
      right: 16,
      cellSize: ['auto', 14],
      range: data.range || 'auto',
      orient: 'horizontal',
      splitLine: { show: false },
      axisLine: { show: false },
      axisLabel: { show: false },
      dayLabel: {
        nameMap: 'cn',
        color: DK.mut,
        fontSize: 9,
        fontFamily: FONT.family,
      },
      monthLabel: {
        color: DK.mut,
        fontSize: 9,
        fontFamily: FONT.family,
      },
      itemStyle: {
        color: 'rgba(255,255,255,0.02)',
        borderColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderRadius: 2,
      },
    };
    opt.series = [{
      type: 'heatmap',
      coordinateSystem: 'calendar',
      data: calData,
      emphasis: {
        itemStyle: { borderColor: '#fff', borderWidth: 1 },
      },
    }];
    return initChart(el, opt);
  }

  /* ═══ 漏斗图 — 信度分布 ═══════════════════════════════ */
  function funnelChart(el, data) {
    if (!el || !data || !data.length) return;

    var sorted = data.slice().sort(function (a, b) { return b.value - a.value; });

    var opt = baseOpt();
    opt.tooltip = Object.assign({}, opt.tooltip, {
      trigger: 'item',
      formatter: function (p) {
        return '<b>' + p.name + '</b><br/>' + p.value;
      },
    });
    opt.legend = {
      data: sorted.map(function (d) { return d.name; }),
      bottom: 4, right: 8,
      textStyle: { color: DK.mut, fontSize: FONT.subSize, fontFamily: FONT.family },
      itemWidth: 8, itemHeight: 8, itemGap: 12,
    };
    opt.series = [{
      type: 'funnel',
      left: '15%',
      right: '15%',
      top: 16,
      bottom: 40,
      width: '70%',
      min: 0,
      max: sorted[0] ? sorted[0].value : 100,
      sort: 'descending',
      gap: 4,
      label: {
        show: true,
        position: 'inside',
        color: '#fff',
        fontSize: 11,
        fontWeight: FONT.valueWeight,
        fontFamily: FONT.family,
        formatter: '{b}\n{c}',
      },
      itemStyle: {
        borderColor: DK.cardBg,
        borderWidth: 2,
        borderRadius: 4,
      },
      emphasis: {
        label: { fontSize: 13 },
      },
      data: sorted.map(function (d, i) {
        return {
          name: d.name,
          value: d.value,
          itemStyle: { color: DK.ser[i % DK.ser.length] },
        };
      }),
    }];
    return initChart(el, opt);
  }

  /* ═══ 散点图 — 信度 vs 热度 ═══════════════════════════ */
  function scatterPlot(el, data, options) {
    if (!el || !data || !data.length) return;
    var opts = options || {};

    var opt = baseOpt();
    opt.grid = { left: 48, right: 24, top: 24, bottom: 40 };
    opt.xAxis = {
      type: 'value',
      name: opts.xName || '信度',
      nameTextStyle: { color: DK.mut, fontSize: FONT.axisSize, fontFamily: FONT.family },
      axisLine: { lineStyle: { color: DK.grid } },
      axisTick: { show: false },
      axisLabel: { color: DK.mut, fontSize: FONT.axisSize, fontWeight: FONT.axisWeight, fontFamily: FONT.family },
      splitLine: { lineStyle: { color: DK.grid, type: 'dashed' } },
    };
    opt.yAxis = {
      type: 'value',
      name: opts.yName || '热度',
      nameTextStyle: { color: DK.mut, fontSize: FONT.axisSize, fontFamily: FONT.family },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: DK.mut, fontSize: FONT.axisSize, fontWeight: FONT.axisWeight, fontFamily: FONT.family },
      splitLine: { lineStyle: { color: DK.grid, type: 'dashed' } },
    };
    opt.tooltip = Object.assign({}, opt.tooltip, {
      formatter: function (p) {
        var d = p.data;
        return '<b>' + (d[3] || '') + '</b><br/>' +
          (opts.xName || '信度') + ': ' + d[0] + '<br/>' +
          (opts.yName || '热度') + ': ' + d[1];
      },
    });
    opt.series = [{
      type: 'scatter',
      data: data.map(function (d) {
        return [d.x, d.y, d.size || 8, d.label || ''];
      }),
      symbolSize: function (d) { return Math.sqrt(d[2]) * 3; },
      itemStyle: {
        color: DK.hero,
        opacity: 0.7,
        borderColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
      },
      emphasis: {
        itemStyle: { opacity: 1, borderColor: '#fff', borderWidth: 2 },
      },
    }];
    return initChart(el, opt);
  }

  /* ═══ 矩形树图 — 主题层级结构 ═════════════════════════ */
  function treemapChart(el, data) {
    if (!el || !data || !data.length) return;

    var opt = baseOpt();
    opt.tooltip = Object.assign({}, opt.tooltip, {
      formatter: function (p) {
        return '<b>' + p.name + '</b><br/>数量: ' + p.value;
      },
    });
    opt.series = [{
      type: 'treemap',
      top: 8,
      left: 8,
      right: 8,
      bottom: 8,
      roam: false,
      nodeClick: false,
      width: '100%',
      height: '100%',
      breadcrumb: { show: false },
      label: {
        show: true,
        color: '#fff',
        fontSize: 12,
        fontWeight: FONT.valueWeight,
        fontFamily: FONT.family,
        formatter: '{b}',
      },
      itemStyle: {
        borderColor: DK.cardBg,
        borderWidth: 2,
        gapWidth: 2,
        borderRadius: 4,
      },
      emphasis: {
        itemStyle: { borderColor: '#fff', borderWidth: 1 },
        label: { fontSize: 14 },
      },
      levels: [
        {
          itemStyle: { borderColor: DK.cardBg, borderWidth: 3, gapWidth: 3 },
          upperLabel: { show: false },
        },
        {
          itemStyle: { borderColor: 'rgba(255,255,255,0.06)', borderWidth: 1, gapWidth: 1 },
          colorSaturation: [0.35, 0.5],
        },
      ],
      data: data,
      color: DK.ser,
    }];
    return initChart(el, opt);
  }

  /* ═══ 旭日图 — 主题×平台构成 ═════════════════════════ */
  function sunburstChart(el, data) {
    if (!el || !data || !data.length) return;

    var opt = baseOpt();
    opt.tooltip = Object.assign({}, opt.tooltip, {
      trigger: 'item',
      formatter: function (p) {
        return '<b>' + p.name + '</b><br/>数量: ' + p.value;
      },
    });
    opt.series = [{
      type: 'sunburst',
      radius: ['15%', '80%'],
      center: ['50%', '50%'],
      sort: 'desc',
      emphasis: {
        focus: 'ancestor',
      },
      label: {
        show: true,
        color: DK.txt,
        fontSize: 10,
        fontWeight: FONT.axisWeight,
        fontFamily: FONT.family,
        rotate: 'radial',
      },
      itemStyle: {
        borderColor: DK.cardBg,
        borderWidth: 2,
        borderRadius: 4,
      },
      levels: [
        {},
        {
          r0: '15%', r: '45%',
          itemStyle: { borderWidth: 2 },
          label: { fontSize: 11, fontWeight: FONT.valueWeight },
        },
        {
          r0: '45%', r: '72%',
          itemStyle: { borderWidth: 1 },
          label: { fontSize: 9, align: 'right' },
        },
      ],
      data: data,
      color: DK.ser,
    }];
    return initChart(el, opt);
  }

  /* ═══ 工具函数 ═══════════════════════════════════════ */
  function lerpColor(a, b, t) {
    var ah = parseInt(a.replace('#', ''), 16);
    var bh = parseInt(b.replace('#', ''), 16);
    var ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
    var br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
    var rr = Math.round(ar + (br - ar) * t);
    var rg = Math.round(ag + (bg - ag) * t);
    var rb = Math.round(ab + (bb - ab) * t);
    return '#' + ((1 << 24) + (rr << 16) + (rg << 8) + rb).toString(16).slice(1);
  }

  function disposeAll() {
    charts.forEach(function (c) { c.dispose(); });
    charts = [];
  }

  function disposeChart(el) {
    if (!el) return;
    var inst = echarts.getInstanceByDom(el);
    if (inst) {
      inst.dispose();
      var idx = charts.indexOf(inst);
      if (idx >= 0) charts.splice(idx, 1);
    }
  }

  global.LieflatCharts = {
    DK: DK,
    hairlineArea: hairlineArea,
    tickRows: tickRows,
    tickDonut: tickDonut,
    rungBars: rungBars,
    tickGauge: tickGauge,
    riskLevelBar: riskLevelBar,
    sentimentRadar: sentimentRadar,
    heatCalendar: heatCalendar,
    funnelChart: funnelChart,
    scatterPlot: scatterPlot,
    treemapChart: treemapChart,
    sunburstChart: sunburstChart,
    resizeAll: resizeAll,
    disposeAll: disposeAll,
    disposeChart: disposeChart,
  };
})(typeof window !== 'undefined' ? window : globalThis);
