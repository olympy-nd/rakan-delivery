/* راكان · أدوات الخريطة المشتركة (تطبيق المتابعة وصفحة تتبع العميل)
   الخريطة: Leaflet مع خرائط CARTO المبنية على OpenStreetMap. خط الطريق ومدة الوصول: خدمة OSRM المجانية،
   وإن تعذّرت نرسم خطاً مستقيماً ونقدّر الوقت بالمسافة. */
(function (root) {
  'use strict';
  var loading = null;
  function load() {
    if (root.L) return Promise.resolve(root.L);
    if (loading) return loading;
    loading = new Promise(function (res, rej) {
      var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'leaflet.css'; document.head.appendChild(css);
      var sc = document.createElement('script'); sc.src = 'leaflet.js';
      sc.onload = function () { res(root.L); }; sc.onerror = function () { loading = null; rej(new Error('تعذّر تحميل الخريطة. تأكد من الإنترنت')); };
      document.head.appendChild(sc);
    });
    return loading;
  }
  var LIBYA = [32.0, 15.0];
  function create(el, opts) {
    opts = opts || {};
    var map = L.map(el, { zoomControl: false, attributionControl: true, center: opts.center || LIBYA, zoom: opts.zoom || 6, tap: true });
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    // خرائط OpenStreetMap المجانية (لا تحتاج مفتاحاً). إن تعذّر تحميلها نتحوّل تلقائياً إلى خرائط Esri.
    var TILES = [
      ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }],
      ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri · OpenStreetMap' }]
    ];
    function useTiles(i) {
      var ok = 0, bad = 0, layer = L.tileLayer(TILES[i][0], TILES[i][1]);
      layer.on('tileload', function () { ok++; });
      layer.on('tileerror', function () {
        if (++bad >= 4 && !ok && i + 1 < TILES.length) { map.removeLayer(layer); useTiles(i + 1); }
      });
      layer.addTo(map);
    }
    useTiles(0);
    map.attributionControl.setPrefix(false);
    return map;
  }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var COLORS = { live: '#0C4CA2', idle: '#E08A00', off: '#8A94A6', sel: '#F15C22' };
  // سيارة: دائرة فيها شاحنة، وسهم يدور مع اتجاه السير، واسم السائق تحتها
  function truckIcon(o) {
    var c = COLORS[o.status] || COLORS.live, ring = o.selected ? COLORS.sel : '#fff';
    var arrow = o.heading === null || o.heading === undefined || o.status !== 'live' ? '' :
      '<div class="rk-hd" style="transform:rotate(' + Math.round(o.heading) + 'deg)"><svg viewBox="0 0 24 24" width="62" height="62"><path d="M12 1l4 6h-8z" fill="' + c + '"/></svg></div>';
    return L.divIcon({ className: 'rk-truck', iconSize: [62, 62], iconAnchor: [31, 31],
      html: arrow + '<div class="rk-tc" style="background:' + c + ';box-shadow:0 0 0 3px ' + ring + ',0 4px 12px rgba(0,0,0,.35)">' +
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>' +
        (o.status === 'live' ? '<i class="rk-pulse" style="border-color:' + c + '"></i>' : '') + '</div>' +
        (o.label ? '<div class="rk-tl">' + esc(o.label) + '</div>' : '') });
  }
  var STOP_C = { done: '#157347', next: '#F15C22', wait: '#0C4CA2', bad: '#B23E10', here: '#7A5AF8' };
  function stopIcon(n, kind, big) {
    var c = STOP_C[kind] || STOP_C.wait, s = big ? 40 : 30;
    return L.divIcon({ className: 'rk-stop', iconSize: [s, s + 10], iconAnchor: [s / 2, s + 8],
      html: '<svg viewBox="0 0 30 40" width="' + s + '" height="' + (s + 10) + '"><path d="M15 39C15 39 2 24 2 15a13 13 0 0 1 26 0c0 9-13 24-13 24z" fill="' + c + '" stroke="#fff" stroke-width="2"/>' +
        '<text x="15" y="19" text-anchor="middle" font-size="' + (String(n).length > 1 ? 11 : 13) + '" font-weight="800" fill="#fff" font-family="Tajawal,sans-serif">' + esc(n) + '</text></svg>' });
  }
  function shopIcon() {
    return L.divIcon({ className: 'rk-stop', iconSize: [46, 56], iconAnchor: [23, 54],
      html: '<svg viewBox="0 0 46 56" width="46" height="56"><path d="M23 55S3 33 3 21a20 20 0 0 1 40 0c0 12-20 34-20 34z" fill="#F15C22" stroke="#fff" stroke-width="2.5"/>' +
        '<g transform="translate(11 9)" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18l-2-6H5zM4 9v11h16V9M9 20v-6h6v6"/></g></svg>' });
  }
  // تحريك الماركر بنعومة بين موقعين
  function animate(marker, to, ms) {
    var from = marker.getLatLng(), t0 = null; ms = ms || 1200;
    if (!from || (Math.abs(from.lat - to[0]) < 1e-7 && Math.abs(from.lng - to[1]) < 1e-7)) { marker.setLatLng(to); return; }
    if (marker._rkAnim) cancelAnimationFrame(marker._rkAnim);
    var step = function (ts) {
      if (!t0) t0 = ts;
      var k = Math.min(1, (ts - t0) / ms), e = k < .5 ? 2 * k * k : -1 + (4 - 2 * k) * k;
      marker.setLatLng([from.lat + (to[0] - from.lat) * e, from.lng + (to[1] - from.lng) * e]);
      if (k < 1) marker._rkAnim = requestAnimationFrame(step); else marker._rkAnim = null;
    };
    marker._rkAnim = requestAnimationFrame(step);
  }
  function distM(a1, o1, a2, o2) {
    var R = 6371000, r = Math.PI / 180, dA = (a2 - a1) * r, dO = (o2 - o1) * r;
    var h = Math.sin(dA / 2) * Math.sin(dA / 2) + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(dO / 2) * Math.sin(dO / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function bearing(a1, o1, a2, o2) {
    var r = Math.PI / 180, y = Math.sin((o2 - o1) * r) * Math.cos(a2 * r), x = Math.cos(a1 * r) * Math.sin(a2 * r) - Math.sin(a1 * r) * Math.cos(a2 * r) * Math.cos((o2 - o1) * r);
    return (Math.atan2(y, x) / r + 360) % 360;
  }
  // الطريق بالسيارة من موقع إلى المحل: { line:[[lat,lng]...], sec, m, approx }
  var RC = {};
  function route(from, to) {
    var key = from[0].toFixed(3) + ',' + from[1].toFixed(3) + '>' + to[0].toFixed(5) + ',' + to[1].toFixed(5);
    var hit = RC[key];
    if (hit && Date.now() - hit.at < 120000) return Promise.resolve(hit.r);
    var straight = function () { var m = distM(from[0], from[1], to[0], to[1]) * 1.3; return { line: [from, to], m: m, sec: m / (35 / 3.6), approx: true }; };
    var url = 'https://router.project-osrm.org/route/v1/driving/' + from[1] + ',' + from[0] + ';' + to[1] + ',' + to[0] + '?overview=full&geometries=geojson';
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 8000) : null;
    return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) { return r.json(); }).then(function (j) {
      if (timer) clearTimeout(timer);
      var rt = j && j.routes && j.routes[0];
      if (!rt) return straight();
      var res = { line: rt.geometry.coordinates.map(function (c) { return [c[1], c[0]]; }), m: rt.distance, sec: rt.duration * 1.15, approx: false };
      RC[key] = { at: Date.now(), r: res };
      return res;
    }).catch(function () { if (timer) clearTimeout(timer); return straight(); });
  }
  function etaText(sec) {
    if (sec === null || sec === undefined || !isFinite(sec)) return '';
    var m = Math.max(1, Math.round(sec / 60));
    return m < 60 ? m + ' د' : Math.floor(m / 60) + ' س ' + (m % 60 ? (m % 60) + ' د' : '');
  }
  function kmText(m) { return m >= 1000 ? (m / 1000).toFixed(m >= 10000 ? 0 : 1) + ' كم' : Math.round(m) + ' م'; }
  root.RKMap = { load: load, create: create, truckIcon: truckIcon, stopIcon: stopIcon, shopIcon: shopIcon, animate: animate, route: route,
    distM: distM, bearing: bearing, etaText: etaText, kmText: kmText, COLORS: COLORS, STOP_C: STOP_C };
})(window);
