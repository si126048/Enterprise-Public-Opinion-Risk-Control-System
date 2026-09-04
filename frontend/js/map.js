/* ============================================
   map.js — WuhuaMap 地图模块
   Leaflet + GeoJSON 10街道 着色 + 交互
   ============================================ */

var WuhuaMap = (function() {
    var map = null;
    var geojsonLayer = null;
    var selectedLayer = null;
    var currentZoom = 12;
    var center = [25.0389, 102.7183];
    var selectedDistrict = null;

    var defaultStyle = {
        fillColor: '#EDE8DF',
        fillOpacity: 0.75,
        color: '#2C2C2C',
        weight: 1.5,
        dashArray: null
    };

    var highlightStyle = {
        color: '#FFD700',
        weight: 3,
        fillOpacity: 0.85
    };

    var colorScale = [
        { threshold: 50,  color: '#EDE8DF' },
        { threshold: 150, color: '#F5E6A3' },
        { threshold: 300, color: '#FFD700' },
        { threshold: 500, color: '#F6A83D' },
        { threshold: Infinity, color: '#F65413' }
    ];

    function getColorByCount(count) {
        for (var i = 0; i < colorScale.length; i++) {
            if (count < colorScale[i].threshold) return colorScale[i].color;
        }
        return '#F65413';
    }

    function init(containerId) {
        containerId = containerId || 'map-container';
        map = L.map(containerId, {
            center: center,
            zoom: currentZoom,
            zoomControl: false
        });

        L.control.zoom({ position: 'topright' }).addTo(map);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map);

        loadGeoJSON();
    }

    function loadGeoJSON() {
        fetch('data/geo/wuhua_districts.geojson')
            .then(function(res) { return res.json(); })
            .then(function(data) {
                geojsonLayer = L.geoJSON(data, {
                    style: getDistrictStyle,
                    onEachFeature: onEachFeature
                }).addTo(map);
                map.fitBounds(geojsonLayer.getBounds(), { padding: [20, 20] });
                AppStore.notify('map_ready');
            })
            .catch(function(err) {
                console.error('GeoJSON load failed:', err);
            });
    }

    function getDistrictStyle(feature) {
        var name = feature.properties.name;
        var stats = AppStore.getDistrictStats(name);
        var count = stats ? stats.total : 0;
        return {
            fillColor: getColorByCount(count),
            fillOpacity: 0.75,
            color: '#2C2C2C',
            weight: 1.5,
            dashArray: null
        };
    }

    function onEachFeature(feature, layer) {
        var name = feature.properties.name;

        layer.on({
            mouseover: function(e) { handleMouseOver(e, name, layer); },
            mouseout: function(e) { handleMouseOut(e, layer); },
            click: function(e) { handleDistrictClick(e, name, layer); }
        });

        var stats = AppStore.getDistrictStats(name);
        var popupHtml = buildPopupHtml(name, stats);
        layer.bindPopup(popupHtml, {
            className: 'map-popup-wrapper',
            closeButton: false,
            offset: L.point(0, -10)
        });
    }

    function buildPopupHtml(name, stats) {
        var total = stats ? stats.total : '-';
        var negative = stats ? stats.negative : '-';
        var negRate = stats && stats.total > 0 ? (stats.negative / stats.total * 100).toFixed(1) + '%' : '-';
        var topIssue = stats && stats.top_issue ? stats.top_issue : '暂无数据';

        return '<div class="map-popup">' +
            '<div class="popup-title">' + name + '</div>' +
            '<div class="popup-row"><span>诉求总量</span><span class="popup-val">' + total + '</span></div>' +
            '<div class="popup-row"><span>负面数量</span><span class="popup-val">' + negative + '</span></div>' +
            '<div class="popup-row"><span>负面率</span><span class="popup-val">' + negRate + '</span></div>' +
            '<div class="popup-issue">TOP: ' + topIssue + '</div>' +
            '</div>';
    }

    function handleMouseOver(e, name, layer) {
        if (selectedDistrict !== name) {
            layer.setStyle({
                color: '#FFD700',
                weight: 2.5,
                fillOpacity: 0.8
            });
            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                layer.bringToFront();
            }
        }
        layer.openPopup();
    }

    function handleMouseOut(e, layer) {
        if (selectedDistrict) {
            geojsonLayer.resetStyle();
            if (selectedLayer) {
                selectedLayer.setStyle(highlightStyle);
            }
        } else {
            geojsonLayer.resetStyle();
        }
        layer.closePopup();
    }

    function handleDistrictClick(e, name, layer) {
        e.stopPropagation();

        if (selectedDistrict === name) {
            resetView();
            return;
        }

        selectedDistrict = name;

        if (selectedLayer) {
            geojsonLayer.resetStyle();
        }
        selectedLayer = layer;
        layer.setStyle(highlightStyle);
        layer.bringToFront();

        map.fitBounds(layer.getBounds(), { padding: [50, 50], maxZoom: 14 });

        var resetBtn = document.querySelector('.map-reset-btn');
        if (resetBtn) resetBtn.classList.add('visible');

        AppStore.setDistrict(name);
        triggerDrillDown(name);
    }

    function triggerDrillDown(name) {
        if (typeof StatsPanel !== 'undefined' && StatsPanel.updateForDistrict) {
            StatsPanel.updateForDistrict(name);
        }
        if (typeof Charts !== 'undefined' && Charts.updateForDistrict) {
            Charts.updateForDistrict(name);
        }
        if (typeof ContentList !== 'undefined' && ContentList.refreshForDistrict) {
            ContentList.refreshForDistrict(name);
        }
    }

    function resetView() {
        selectedDistrict = null;
        selectedLayer = null;
        if (geojsonLayer) {
            geojsonLayer.resetStyle();
        }
        if (map) {
            map.fitBounds(geojsonLayer.getBounds(), { padding: [20, 20] });
        }

        var resetBtn = document.querySelector('.map-reset-btn');
        if (resetBtn) resetBtn.classList.remove('visible');

        AppStore.setDistrict(null);

        if (typeof StatsPanel !== 'undefined' && StatsPanel.reset) {
            StatsPanel.reset();
        }
        if (typeof Charts !== 'undefined' && Charts.reset) {
            Charts.reset();
        }
        if (typeof ContentList !== 'undefined' && ContentList.reset) {
            ContentList.reset();
        }
    }

    function highlightDistrict(name) {
        if (!geojsonLayer) return;
        geojsonLayer.eachLayer(function(layer) {
            if (layer.feature.properties.name === name) {
                layer.setStyle(highlightStyle);
                selectedLayer = layer;
            } else {
                geojsonLayer.resetStyle(layer);
            }
        });
    }

    function refreshStyles() {
        if (geojsonLayer) {
            geojsonLayer.eachLayer(function(layer) {
                var name = layer.feature.properties.name;
                if (selectedDistrict === name) {
                    layer.setStyle(highlightStyle);
                } else {
                    layer.setStyle(getDistrictStyle(layer.feature));
                }
            });
        }
    }

    function getMap() {
        return map;
    }

    function getSelectedDistrict() {
        return selectedDistrict;
    }

    return {
        init: init,
        resetView: resetView,
        highlightDistrict: highlightDistrict,
        refreshStyles: refreshStyles,
        getMap: getMap,
        getSelectedDistrict: getSelectedDistrict,
        getColorByCount: getColorByCount
    };
})();
