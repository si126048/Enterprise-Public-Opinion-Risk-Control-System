/* ============================================
   timeline.js — 地图时间轴播放控件
   逐月/逐日推进，热力图渐变，数字滚动
   ============================================ */

var TimelinePlayer = (function() {
    var playing = false;
    var timer = null;
    var currentIndex = 0;
    var speed = 1500;
    var dates = [];
    var container = null;

    var months = [
        '2026-03', '2026-04', '2026-05', '2026-06',
        '2026-07', '2026-08', '2026-09'
    ];

    var monthData = {};
    months.forEach(function(m, i) {
        var base = 8000 + i * 1200 + Math.round(Math.random() * 2000);
        monthData[m] = {
            total: base,
            low_credibility: Math.round(base * (0.05 + Math.random() * 0.05)),
            high_risk: Math.round(20 + Math.random() * 30)
        };
    });

    function init(containerId) {
        container = document.getElementById(containerId || 'timeline-container');
        if (!container) return;

        dates = months;
        currentIndex = dates.length - 1;

        render();
        bindEvents();
    }

    function render() {
        if (!container) return;

        var sliderHtml = dates.map(function(d, i) {
            var active = i === currentIndex ? ' active' : '';
            return '<span class="timeline-dot' + active + '" data-index="' + i + '"></span>';
        }).join('');

        container.innerHTML =
            '<div class="timeline-controls">' +
                '<button class="timeline-btn timeline-play" title="播放/暂停">' + (playing ? '⏸' : '▶') + '</button>' +
                '<button class="timeline-btn timeline-speed" title="速度">' + (speed === 1500 ? '1x' : speed === 800 ? '2x' : '0.5x') + '</button>' +
            '</div>' +
            '<div class="timeline-track">' +
                '<div class="timeline-labels">' +
                    dates.map(function(d, i) {
                        var cls = 'timeline-label';
                        if (i === currentIndex) cls += ' active';
                        return '<span class="' + cls + '" data-index="' + i + '">' + d.substring(5) + '月</span>';
                    }).join('') +
                '</div>' +
                '<div class="timeline-dots">' + sliderHtml + '</div>' +
                '<div class="timeline-progress" style="width:' + ((currentIndex / (dates.length - 1)) * 100) + '%"></div>' +
            '</div>' +
            '<div class="timeline-info">' +
                '<span class="timeline-date">' + dates[currentIndex] + '</span>' +
                '<span class="timeline-stat">总量 <strong>' + formatNum(monthData[dates[currentIndex]].total) + '</strong></span>' +
                '<span class="timeline-stat">低信度 <strong>' + formatNum(monthData[dates[currentIndex]].low_credibility) + '</strong></span>' +
            '</div>';
    }

    function bindEvents() {
        if (!container) return;

        container.addEventListener('click', function(e) {
            var playBtn = e.target.closest('.timeline-play');
            if (playBtn) { togglePlay(); return; }

            var speedBtn = e.target.closest('.timeline-speed');
            if (speedBtn) { cycleSpeed(); return; }

            var dot = e.target.closest('.timeline-dot');
            if (dot) { goToIndex(parseInt(dot.dataset.index)); return; }

            var label = e.target.closest('.timeline-label');
            if (label) { goToIndex(parseInt(label.dataset.index)); return; }
        });
    }

    function togglePlay() {
        playing = !playing;
        if (playing) {
            if (currentIndex >= dates.length - 1) currentIndex = 0;
            startTimer();
        } else {
            stopTimer();
        }
        render();
    }

    function startTimer() {
        stopTimer();
        timer = setInterval(function() {
            if (currentIndex < dates.length - 1) {
                currentIndex++;
                render();
                updateMap(currentIndex);
            } else {
                stopTimer();
                playing = false;
                render();
            }
        }, speed);
    }

    function stopTimer() {
        if (timer) { clearInterval(timer); timer = null; }
    }

    function cycleSpeed() {
        if (speed === 1500) speed = 800;
        else if (speed === 800) speed = 3000;
        else speed = 1500;
        if (playing) startTimer();
        render();
    }

    function goToIndex(idx) {
        if (idx >= 0 && idx < dates.length) {
            currentIndex = idx;
            render();
            updateMap(currentIndex);
        }
    }

    function updateMap(idx) {
        var date = dates[idx];
        var data = monthData[date];
        if (typeof KunmingMap !== 'undefined' && KunmingMap.getMap()) {
            var evt = new CustomEvent('timeline-update', { detail: { date: date, data: data } });
            document.dispatchEvent(evt);
        }
    }

    function formatNum(n) {
        if (n >= 10000) return (n / 10000).toFixed(1) + '万';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
        return String(n);
    }

    function getCurrentDate() {
        return dates[currentIndex];
    }

    function destroy() {
        stopTimer();
        playing = false;
    }

    return {
        init: init,
        togglePlay: togglePlay,
        goToIndex: goToIndex,
        getCurrentDate: getCurrentDate,
        destroy: destroy
    };
})();
