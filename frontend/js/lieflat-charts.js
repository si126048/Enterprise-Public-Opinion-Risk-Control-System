/* lieflat-charts.js — 基于 lieflat-charts 品味的 ECharts 图表模块
   适配暗色主题，porcelain 色系
   图型选型遵循 catalog.md：F2 Hairline Area / F5 Tick Rows / F4 Tick Donut / F1 Rung Bars / F8 Plumb Scatter
   动画语法：quarticOut 快进快停 + stagger 逐项延迟 + animateCounter 数字递增 */
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
    guide:    'rgba(255,255,255,0.03)',
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
    enter: 900,
    easing: 'quarticOut',
    staggerBar: 100,
    staggerDot: 40,
  };

  /* ── 确定性伪随机 — hash-based jitter ──────────── */
  function rnd(i, k) {
    var n = ((i * 73856093) ^ ((k || 0) * 19349663)) >>> 0;
    return (n % 1000) / 1000;
  }

  /* ── 数字递增动画 ─────────────────────────────── */
  function animateCounter(el, target, duration, formatter) {
    if (!el || typeof target !== 'number') return;
    var start = performance.now();
    var fmt = formatter || function (v) { return Math.round(v); };
    function tick(now) {
      var p = Math.min(1, (now - start) / (duration || 800));
      var eased = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(target * eased);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ── 基础选项 ─────────────────────────────────── */
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
        extraCssText: 'border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.3);backdrop-filter:blur(8px);',
      },
      animationDuration: MOTION.enter,
      animationEasing: MOTION.easing,
      animationDurationUpdate: 400,
    };
  }

  var charts = [];

  function initChart(el, opt) {
    if (!el) return null;
    var existing = echarts.getInstanceByDom(el);
    if (existing) {
      existing.dispose();
      var idx = charts.indexOf(existing);
      if (idx >= 0) charts.splice(idx, 1);
    }
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
     增强：渐变面积 + 峰值标注 + 平滑入场 + 十字准线 */
  function hairlineArea(el, data) {
    if (!el || !data) return;
    var dates = data.dates || [];
    var total = data.total || [];
    var low = data.low_credibility || [];

    var shortDates = dates.map(function (d) {
      return d.length > 5 ? d.slice(5) : d;
    });

    var peakIdx = 0;
    total.forEach(function (v, i) { if (v > total[peakIdx]) peakIdx = i; });

    var opt = baseOpt();
    opt.animationDuration = 1200;
    opt.animationEasing = 'quarticOut';
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
        fontFamily: FONT.family,
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
    opt.tooltip = Object.assign({}, opt.tooltip, {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        lineStyle: { color: DK.faint, width: 1 },
        crossStyle: { color: DK.faint },
        label: { backgroundColor: 'rgba(24,24,24,0.9)', color: DK.txt, fontSize: 10 },
      },
    });
    opt.series = [
      {
        name: '总舆情',
        type: 'line',
        smooth: 0.4,
        symbol: 'circle',
        symbolSize: 5,
        showSymbol: false,
        lineStyle: { color: DK.hero, width: 2, shadowColor: 'rgba(245,208,0,0.2)', shadowBlur: 8 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(245,208,0,0.2)' },
              { offset: 0.6, color: 'rgba(245,208,0,0.05)' },
              { offset: 1, color: 'rgba(245,208,0,0)' },
            ],
          },
        },
        itemStyle: { color: DK.hero },
        emphasis: { focus: 'series', itemStyle: { borderWidth: 3, borderColor: '#fff' } },
        markPoint: peakIdx >= 0 ? {
          symbol: 'circle',
          symbolSize: 8,
          data: [{ coord: [shortDates[peakIdx], total[peakIdx]], value: total[peakIdx] }],
          itemStyle: { color: DK.hero, borderColor: '#fff', borderWidth: 2 },
          label: {
            show: true,
            formatter: '{c}',
            fontSize: 11,
            fontWeight: FONT.valueWeight,
            fontFamily: FONT.family,
            color: DK.txt,
            position: 'top',
            distance: 8,
          },
          animationDelay: 1000,
        } : undefined,
        data: total,
        animationDelay: function (idx) { return idx * 40; },
      },
      {
        name: '低信度',
        type: 'line',
        smooth: 0.4,
        symbol: 'diamond',
        symbolSize: 4,
        showSymbol: false,
        lineStyle: { color: DK.danger, width: 1.5, type: [6, 4], shadowColor: 'rgba(255,59,59,0.15)', shadowBlur: 6 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(255,59,59,0.1)' },
              { offset: 1, color: 'rgba(255,59,59,0)' },
            ],
          },
        },
        itemStyle: { color: DK.danger },
        emphasis: { focus: 'series' },
        data: low,
        animationDelay: function (idx) { return idx * 40 + 200; },
      },
    ];
    return initChart(el, opt);
  }

  /* ═══ F5 · Tick Rows — 横向排名比较 ═══════════════════
     增强：导轨线 + stagger 逐行入场 + 渐变条 + 圆角 */
  function tickRows(el, data, options) {
    if (!el || !data || !data.length) return;
    var opts = options || {};
    var sorted = data.slice().sort(function (a, b) { return a.value - b.value; });
    var names = sorted.map(function (d) { return d.name; });
    var values = sorted.map(function (d) { return d.value; });
    var maxVal = Math.max.apply(null, values);

    var opt = baseOpt();
    opt.animationDuration = 800;
    opt.grid = { left: opts.labelWidth || 90, right: 56, top: 8, bottom: 8 };
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
      },
      inverse: false,
    };
    opt.series = [{
      type: 'bar',
      barWidth: 8,
      z: 2,
      data: values.map(function (v, i) {
        var ratio = i / (values.length - 1 || 1);
        return {
          value: v,
          itemStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: lerpColor(DK.hero, DK.data, ratio * 0.5) },
                { offset: 1, color: lerpColor(DK.hero, DK.accent, ratio) },
              ],
            },
            borderRadius: [0, 4, 4, 0],
            shadowColor: 'rgba(245,208,0,0.08)',
            shadowBlur: 4,
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
        formatter: function (p) { return p.value; },
      },
      animationDelay: function (idx) { return idx * MOTION.staggerBar; },
      animationEasing: 'quarticOut',
    },
    {
      type: 'bar',
      barWidth: 8,
      barGap: '-100%',
      z: 1,
      silent: true,
      data: values.map(function () { return maxVal * 1.1; }),
      itemStyle: { color: DK.guide, borderRadius: [0, 4, 4, 0] },
      animation: false,
    }];
    return initChart(el, opt);
  }

  /* ═══ F4 · Tick Donut — 100% 构成 ═══════════════════
     增强：hover 弹出 + 弹性动画 + 中心标签动画 */
  function tickDonut(el, data, options) {
    if (!el || !data || !data.length) return;
    var opts = options || {};
    var total = data.reduce(function (s, d) { return s + d.value; }, 0);
    var colors = opts.colors || DK.cat4;

    var donutCenter;
    var labelPos = opts.labelPosition || null;
    if (labelPos === 'top') {
      donutCenter = opts.donutCenter || ['50%', '60%'];
    } else if (labelPos === 'bottom') {
      donutCenter = opts.donutCenter || ['50%', '42%'];
    } else {
      donutCenter = opts.donutCenter || ['38%', '50%'];
    }

    var opt = baseOpt();
    opt.animationDuration = 1000;
    opt.animationEasing = 'cubicOut';
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
      radius: ['50%', '72%'],
      center: donutCenter,
      avoidLabelOverlap: false,
      itemStyle: {
        borderColor: 'rgba(30,30,30,0.9)',
        borderWidth: 2,
        borderRadius: 6,
      },
      label: { show: false },
      emphasis: {
        scale: true,
        scaleSize: 8,
        label: { show: false },
        itemStyle: {
          shadowBlur: 24,
          shadowColor: 'rgba(0,0,0,0.4)',
        },
      },
      data: data.map(function (d, i) {
        return {
          name: d.name,
          value: d.value,
          itemStyle: { color: colors[i % colors.length] },
        };
      }),
      animationType: 'expansion',
      animationEasing: 'quarticOut',
      animationDelay: function (idx) { return idx * 120; },
    }];

    if (opts.centerLabel) {
      var titleTop, titleAlign, titleVAlign;
      if (labelPos === 'top') {
        titleTop = '4%';
        titleAlign = 'center';
        titleVAlign = 'top';
      } else if (labelPos === 'bottom') {
        titleTop = '90%';
        titleAlign = 'center';
        titleVAlign = 'bottom';
      } else {
        titleTop = donutCenter[1];
        titleAlign = 'center';
        titleVAlign = 'middle';
      }
      opt.title = {
        text: String(opts.centerLabel.value != null ? opts.centerLabel.value : total),
        subtext: opts.centerLabel.unit || '总计',
        left: labelPos ? 'center' : donutCenter[0],
        top: titleTop,
        textAlign: titleAlign,
        textVerticalAlign: titleVAlign,
        textStyle: {
          fontSize: 24,
          fontWeight: FONT.valueWeight,
          fontFamily: FONT.family,
          color: DK.txt,
        },
        subtextStyle: {
          fontSize: 9,
          fontWeight: FONT.axisWeight,
          fontFamily: FONT.family,
          color: DK.mut,
        },
        itemGap: 6,
        animation: true,
        animationDuration: 1000,
        animationDelay: 600,
      };
    }

    return initChart(el, opt);
  }

  /* ═══ F1 · Rung Bars — 少类目比较 ═══════════════════
     增强：胶囊柱 + 渐变 + 虚线网格 + 逐柱弹入 */
  function rungBars(el, data, options) {
    if (!el || !data || !data.length) return;
    var opts = options || {};
    var names = data.map(function (d) { return d.name; });
    var values = data.map(function (d) { return d.value; });
    var maxVal = Math.max.apply(null, values);

    var opt = baseOpt();
    opt.animationDuration = 800;
    opt.grid = { left: 48, right: 16, top: 16, bottom: 36 };
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
        rotate: opts.rotate || 0,
      },
    };
    opt.yAxis = {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: DK.mut, fontSize: FONT.axisSize, fontWeight: FONT.axisWeight, fontFamily: FONT.family },
      splitLine: { lineStyle: { color: DK.grid, type: [3, 4] } },
    };
    opt.series = [{
      type: 'bar',
      barWidth: opts.barWidth || 28,
      data: values.map(function (v, i) {
        var ratio = i / (values.length - 1 || 1);
        return {
          value: v,
          itemStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: lerpColor(DK.hero, DK.accent, ratio * 0.6) },
                { offset: 1, color: lerpColor('rgba(245,208,0,0.3)', 'rgba(0,212,255,0.15)', ratio) },
              ],
            },
            borderRadius: [6, 6, 0, 0],
            shadowColor: 'rgba(245,208,0,0.1)',
            shadowBlur: 6,
            shadowOffsetY: 2,
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
        distance: 6,
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 16,
          shadowColor: 'rgba(245,208,0,0.25)',
        },
      },
      animationDelay: function (idx) { return idx * MOTION.staggerBar; },
      animationEasing: 'quarticOut',
    }];
    return initChart(el, opt);
  }

  /* ═══ F11 · Tick Gauge — 单值进度 ═══════════════════
     增强：扫入动画 + 渐变色带 + 里程碑标记 */
  function tickGauge(el, value, options) {
    if (!el) return;
    var opts = options || {};
    var color = opts.color || DK.hero;

    var opt = baseOpt();
    opt.animationDuration = 1500;
    opt.animationEasing = 'cubicOut';
    opt.series = [{
      type: 'gauge',
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 100,
      radius: '88%',
      center: ['50%', '55%'],
      progress: {
        show: true,
        width: 12,
        roundCap: true,
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: color },
              { offset: 0.5, color: lerpColor(color, DK.accent, 0.5) },
              { offset: 1, color: DK.accent },
            ],
          },
          shadowColor: 'rgba(245,208,0,0.2)',
          shadowBlur: 10,
        },
      },
      pointer: { show: false },
      axisLine: {
        lineStyle: {
          width: 12,
          color: [[1, DK.grid]],
          roundCap: true,
        },
      },
      axisTick: { show: false },
      splitLine: {
        show: true,
        distance: -14,
        length: 4,
        lineStyle: { color: DK.faint, width: 1 },
      },
      axisLabel: {
        show: true,
        distance: -22,
        fontSize: 8,
        fontWeight: FONT.axisWeight,
        fontFamily: FONT.family,
        color: DK.faint,
        formatter: function (v) {
          if (v === 0 || v === 25 || v === 50 || v === 75 || v === 100) return v;
          return '';
        },
      },
      title: {
        show: true,
        offsetCenter: [0, '32%'],
        fontSize: FONT.subSize,
        fontWeight: FONT.axisWeight,
        fontFamily: FONT.family,
        color: DK.mut,
      },
      detail: {
        valueAnimation: true,
        offsetCenter: [0, '-5%'],
        fontSize: 28,
        fontWeight: FONT.valueWeight,
        fontFamily: FONT.family,
        color: DK.txt,
        formatter: '{value}%',
      },
      data: [{
        value: value,
        name: opts.label || '',
      }],
    }];
    return initChart(el, opt);
  }

  /* ═══ 风控事件等级分布 — 横向分段条 ═══════════════
     增强：等级色编码 + 圆角 + stagger */
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
          itemStyle: {
            color: levelColors[lvl] || DK.data,
            borderRadius: [0, 4, 4, 0],
            shadowColor: levelColors[lvl] ? levelColors[lvl] + '33' : 'transparent',
            shadowBlur: 6,
          },
        });
      }
    });

    if (!items.length) return;

    var opt = baseOpt();
    opt.animationDuration = 800;
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
      barWidth: 10,
      data: items.map(function (d) { return d; }),
      label: {
        show: true,
        position: 'right',
        color: DK.txt,
        fontSize: 11,
        fontWeight: FONT.valueWeight,
        fontFamily: FONT.family,
      },
      emphasis: {
        itemStyle: { shadowBlur: 12 },
      },
      animationDelay: function (idx) { return idx * MOTION.staggerBar; },
      animationEasing: 'quarticOut',
    }];
    return initChart(el, opt);
  }

  /* ═══ 雷达图 — 多维风险画像 ═══════════════════════
     增强：渐变填充 + 顶点高亮 + 扫入动画 */
  function sentimentRadar(el, data) {
    if (!el || !data) return;
    var indicators = data.indicators || [];
    var series = data.series || [];

    var opt = baseOpt();
    opt.animationDuration = 1200;
    opt.animationEasing = 'cubicOut';
    opt.tooltip = Object.assign({}, opt.tooltip, { trigger: 'item' });
    opt.legend = {
      data: series.map(function (s) { return s.name; }),
      bottom: 4, right: 8,
      textStyle: { color: DK.mut, fontSize: FONT.subSize, fontFamily: FONT.family },
      itemWidth: 12, itemHeight: 3,
    };
    opt.radar = {
      indicator: indicators,
      radius: '62%',
      center: ['50%', '46%'],
      axisName: {
        color: DK.mut,
        fontSize: FONT.axisSize,
        fontWeight: FONT.axisWeight,
        fontFamily: FONT.family,
      },
      splitArea: {
        areaStyle: {
          color: [
            'rgba(255,255,255,0.02)',
            'rgba(255,255,255,0.01)',
            'rgba(255,255,255,0.02)',
            'rgba(255,255,255,0.01)',
          ],
        },
      },
      splitLine: { lineStyle: { color: DK.grid } },
      axisLine: { lineStyle: { color: DK.grid } },
    };
    opt.series = [{
      type: 'radar',
      data: series.map(function (s, i) {
        var c = DK.ser[i % DK.ser.length];
        return {
          name: s.name,
          value: s.values,
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: { width: 2, color: c, shadowColor: c + '44', shadowBlur: 6 },
          areaStyle: {
            color: {
              type: 'radial', x: 0.5, y: 0.5, r: 0.5,
              colorStops: [
                { offset: 0, color: c + '30' },
                { offset: 1, color: c + '08' },
              ],
            },
          },
          itemStyle: { color: c, borderColor: '#fff', borderWidth: 1 },
          emphasis: {
            lineStyle: { width: 3 },
            areaStyle: { opacity: 0.25 },
          },
        };
      }),
      animationDelay: function (idx) { return idx * 200; },
    }];
    return initChart(el, opt);
  }

  /* ═══ 日历热力图 — 舆情发布时间分布 ═══════════════
     增强：三级色阶 + hover 放大 + 渐变视觉映射 */
  function heatCalendar(el, data) {
    if (!el || !data) return;
    var dates = data.dates || [];
    var values = data.values || [];

    var calData = dates.map(function (d, i) {
      return [d, values[i] || 0];
    });

    var maxVal = Math.max.apply(null, values) || 10;

    var opt = baseOpt();
    opt.animationDuration = 600;
    opt.tooltip = Object.assign({}, opt.tooltip, {
      position: 'top',
      formatter: function (p) {
        return p.data[0] + '<br/><b>' + p.data[1] + '</b> 条舆情';
      },
    });
    opt.visualMap = {
      min: 0,
      max: maxVal,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 4,
      inRange: {
        color: ['rgba(245,208,0,0.08)', 'rgba(245,208,0,0.3)', 'rgba(245,208,0,0.6)', DK.hero],
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
        borderRadius: 3,
      },
    };
    opt.series = [{
      type: 'heatmap',
      coordinateSystem: 'calendar',
      data: calData,
      emphasis: {
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 1.5,
          shadowBlur: 8,
          shadowColor: 'rgba(245,208,0,0.3)',
        },
      },
      itemStyle: {
        borderRadius: 2,
      },
      animationDelay: function (idx) { return idx * 3; },
    }];
    return initChart(el, opt);
  }

  /* ═══ 漏斗图 — 信度分布 ═══════════════════════════
     增强：逐层落入 + 渐变填充 + hover 高亮 */
  function funnelChart(el, data) {
    if (!el || !data || !data.length) return;

    var sorted = data.slice().sort(function (a, b) { return b.value - a.value; });

    var opt = baseOpt();
    opt.animationDuration = 800;
    opt.tooltip = Object.assign({}, opt.tooltip, {
      trigger: 'item',
      formatter: function (p) {
        return '<b>' + p.name + '</b><br/>' + p.value + ' (' + p.percent.toFixed(1) + '%)';
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
      gap: 5,
      label: {
        show: true,
        position: 'inside',
        color: '#fff',
        fontSize: 11,
        fontWeight: FONT.valueWeight,
        fontFamily: FONT.family,
        formatter: '{b}\n{c}',
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowBlur: 4,
      },
      itemStyle: {
        borderColor: DK.cardBg,
        borderWidth: 2,
        borderRadius: 6,
      },
      emphasis: {
        label: { fontSize: 13, fontWeight: FONT.valueWeight },
        itemStyle: {
          shadowBlur: 20,
          shadowColor: 'rgba(0,0,0,0.3)',
        },
      },
      data: sorted.map(function (d, i) {
        var c = DK.ser[i % DK.ser.length];
        return {
          name: d.name,
          value: d.value,
          itemStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: c },
                { offset: 1, color: lerpColor(c, '#fff', 0.15) },
              ],
            },
          },
        };
      }),
      animationDelay: function (idx) { return idx * 150; },
      animationEasing: 'quarticOut',
    }];
    return initChart(el, opt);
  }

  /* ═══ F8 · Plumb Scatter — 信度 vs 热度 ═══════════
     增强：垂线（plumb lines）+ 逐点 pop 入场 + hero 标注 + barcode 刻度 */
  function scatterPlot(el, data, options) {
    if (!el || !data || !data.length) return;
    var opts = options || {};

    var pts = data.map(function (d) {
      return [d.x, d.y, d.size || 8, d.label || ''];
    });

    var maxY = Math.max.apply(null, pts.map(function (p) { return p[1]; })) || 1;
    var minY = Math.min.apply(null, pts.map(function (p) { return p[1]; }));
    var heroIdx = 0;
    pts.forEach(function (p, i) { if (p[1] > pts[heroIdx][1]) heroIdx = i; });

    var opt = baseOpt();
    opt.animationDuration = 600;
    opt.grid = { left: 52, right: 24, top: 24, bottom: 44 };
    opt.xAxis = {
      type: 'value',
      name: opts.xName || '信度',
      nameLocation: 'end',
      nameGap: 28,
      nameTextStyle: { color: DK.mut, fontSize: FONT.axisSize, fontWeight: FONT.axisWeight, fontFamily: FONT.family },
      axisLine: { lineStyle: { color: DK.grid } },
      axisTick: { show: false },
      axisLabel: { color: DK.mut, fontSize: FONT.axisSize, fontWeight: FONT.axisWeight, fontFamily: FONT.family },
      splitLine: { lineStyle: { color: DK.grid, type: [3, 4] } },
    };
    opt.yAxis = {
      type: 'value',
      name: opts.yName || '热度',
      nameTextStyle: { color: DK.mut, fontSize: FONT.axisSize, fontWeight: FONT.axisWeight, fontFamily: FONT.family },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: DK.mut, fontSize: FONT.axisSize, fontWeight: FONT.axisWeight, fontFamily: FONT.family },
      splitLine: { lineStyle: { color: DK.grid, type: [3, 4] } },
    };
    opt.tooltip = Object.assign({}, opt.tooltip, {
      formatter: function (p) {
        var d = p.data;
        return '<b>' + (d[3] || '') + '</b><br/>' +
          (opts.xName || '信度') + ': ' + d[0] + '<br/>' +
          (opts.yName || '热度') + ': ' + d[1];
      },
    });

    var plumbLines = pts.map(function (p) {
      return {
        type: 'line',
        shape: { x1: 0, y1: 0, x2: 0, y2: 0 },
        style: { stroke: 'rgba(255,255,255,0.06)', lineWidth: 0.5 },
        silent: true,
        z: 1,
      };
    });

    opt.series = [
      {
        type: 'scatter',
        data: pts,
        symbolSize: function (d) { return Math.max(6, Math.min(36, Math.sqrt(d[2]) * 2.5)); },
        itemStyle: {
          color: function (params) {
            var ratio = params.dataIndex / (pts.length - 1 || 1);
            return lerpColor(DK.hero, DK.accent, ratio * 0.6);
          },
          opacity: 0.75,
          borderColor: 'rgba(255,255,255,0.12)',
          borderWidth: 1,
          shadowColor: 'rgba(245,208,0,0.12)',
          shadowBlur: 6,
        },
        emphasis: {
          itemStyle: {
            opacity: 1,
            borderColor: '#fff',
            borderWidth: 2,
            shadowBlur: 16,
            shadowColor: 'rgba(245,208,0,0.3)',
          },
        },
        markPoint: {
          symbol: 'pin',
          symbolSize: 36,
          data: pts.length > 0 ? [{
            coord: [pts[heroIdx][0], pts[heroIdx][1]],
            value: pts[heroIdx][1],
            itemStyle: { color: DK.hero },
            label: { color: '#000', fontSize: 9, fontWeight: FONT.valueWeight },
          }] : [],
          animationDelay: 800,
        },
        animationDelay: function (idx) { return idx * MOTION.staggerDot + 100; },
        animationEasing: 'backOut',
      },
      {
        type: 'scatter',
        data: pts.map(function (p) { return [p[0], 0]; }),
        symbolSize: 0,
        markLine: {
          silent: true,
          symbol: ['none', 'none'],
          lineStyle: { color: 'rgba(255,255,255,0.04)', width: 0.5, type: 'solid' },
          data: pts.map(function (p) {
            return [
              { coord: [p[0], 0] },
              { coord: [p[0], p[1]] },
            ];
          }),
          animation: false,
        },
      },
    ];
    return initChart(el, opt);
  }

  /* ═══ 矩形树图 — 主题层级结构 ═════════════════════
     增强：渐进缩放 + hover 边框高亮 */
  function treemapChart(el, data) {
    if (!el || !data || !data.length) return;

    var opt = baseOpt();
    opt.animationDuration = 800;
    opt.animationEasing = 'quarticOut';
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
        textShadowColor: 'rgba(0,0,0,0.4)',
        textShadowBlur: 4,
      },
      itemStyle: {
        borderColor: DK.cardBg,
        borderWidth: 2,
        gapWidth: 2,
        borderRadius: 4,
      },
      emphasis: {
        itemStyle: { borderColor: DK.hero, borderWidth: 2 },
        label: { fontSize: 14 },
      },
      levels: [
        {
          itemStyle: { borderColor: DK.cardBg, borderWidth: 3, gapWidth: 3 },
          upperLabel: { show: false },
        },
        {
          itemStyle: { borderColor: 'rgba(255,255,255,0.06)', borderWidth: 1, gapWidth: 1 },
          colorSaturation: [0.35, 0.55],
        },
      ],
      data: data,
      color: DK.ser,
      animationDelay: function (idx) { return idx * 60; },
    }];
    return initChart(el, opt);
  }

  /* ═══ 旭日图 — 主题×平台构成 ═════════════════════ */
  function sunburstChart(el, data) {
    if (!el || !data || !data.length) return;

    var opt = baseOpt();
    opt.animationDuration = 1000;
    opt.animationEasing = 'quarticOut';
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
      animationDelay: function (idx) { return idx * 80; },
    }];
    return initChart(el, opt);
  }

  /* ═══ 工具函数 ═══════════════════════════════════════ */
  function lerpColor(a, b, t) {
    if (a.startsWith('rgba') || b.startsWith('rgba')) {
      var ac = parseColor(a), bc = parseColor(b);
      var rr = Math.round(ac.r + (bc.r - ac.r) * t);
      var rg = Math.round(ac.g + (bc.g - ac.g) * t);
      var rb = Math.round(ac.b + (bc.b - ac.b) * t);
      var ra = ac.a + (bc.a - ac.a) * t;
      return 'rgba(' + rr + ',' + rg + ',' + rb + ',' + ra.toFixed(2) + ')';
    }
    var ah = parseInt(a.replace('#', ''), 16);
    var bh = parseInt(b.replace('#', ''), 16);
    var ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
    var br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
    var rr = Math.round(ar + (br - ar) * t);
    var rg = Math.round(ag + (bg - ag) * t);
    var rb = Math.round(ab + (bb - ab) * t);
    return '#' + ((1 << 24) + (rr << 16) + (rg << 8) + rb).toString(16).slice(1);
  }

  function parseColor(c) {
    if (c.startsWith('#')) {
      var h = parseInt(c.replace('#', ''), 16);
      return { r: (h >> 16) & 0xff, g: (h >> 8) & 0xff, b: h & 0xff, a: 1 };
    }
    var m = c.match(/[\d.]+/g);
    return { r: +m[0], g: +m[1], b: +m[2], a: m[3] != null ? +m[3] : 1 };
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
    rnd: rnd,
    animateCounter: animateCounter,
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
