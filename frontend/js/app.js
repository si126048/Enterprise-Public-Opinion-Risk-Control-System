function fetchApi(endpoint, options) {
  options = options || {};
  var url = endpoint;
  if (url.charAt(0) !== '/' && url.indexOf('http') !== 0) {
    url = '/api/' + url;
  }
  return fetch(url, options)
    .then(function(res) {
      if (!res.ok) {
        throw new Error('HTTP ' + res.status + ': ' + res.statusText);
      }
      var contentType = res.headers.get('content-type') || '';
      if (contentType.indexOf('json') !== -1) {
        return res.json();
      }
      return res.text();
    });
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  var h = String(d.getHours()).padStart(2, '0');
  var min = String(d.getMinutes()).padStart(2, '0');
  return y + '-' + m + '-' + day + ' ' + h + ':' + min;
}

function sentimentBadge(sentiment) {
  var cls = 'badge badge-' + (sentiment || 'uncertain');
  var labels = {
    positive: '正面',
    negative: '负面',
    neutral: '中性',
    uncertain: '不确定'
  };
  return '<span class="' + cls + '">' + (labels[sentiment] || sentiment || '-') + '</span>';
}

function riskBadge(risk) {
  var cls = 'badge badge-' + (risk || 'uncertain');
  var labels = {
    low: '低',
    medium: '中',
    high: '高',
    uncertain: '不确定'
  };
  return '<span class="' + cls + '">' + (labels[risk] || risk || '-') + '</span>';
}

function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function formatNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString('zh-CN');
}

function debounce(fn, ms) {
  var timer = null;
  return function() {
    var args = arguments;
    var ctx = this;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(ctx, args); }, ms);
  };
}
