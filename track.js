/* راكان · صفحة تتبع العميل: موقع السائق المباشر، وخط الطريق، والوقت المتوقع للوصول. لا تحتاج دخولاً ولا تعرض أي مبالغ. */
(function () {
  'use strict';
  var token = new URLSearchParams(location.search).get('t') || '';
  var $p = document.getElementById('panel'), $live = document.getElementById('live');
  var map = RKMap.create('map', { zoom: 6 }), truck = null, shop = null, trailLine = null, routeLine = null, fitted = false, last = null, lastRoute = 0, routeInfo = null;
  map.attributionControl.setPosition('topright');
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ts(s) { return s ? new Date(s.replace(' ', 'T') + '+02:00').getTime() : 0; }
  function hm(s) { return s ? String(s).slice(11, 16) : ''; }
  function ago(s) { var d = Math.max(0, Math.round((Date.now() - ts(s)) / 1000)); return d < 60 ? 'قبل ' + d + ' ث' : d < 3600 ? 'قبل ' + Math.round(d / 60) + ' د' : 'منذ ' + hm(s); }
  function call() {
    return fetch(self.RAKAN_API, { method: 'POST', body: JSON.stringify({ app: 1, action: 'track_pub', t: token }), redirect: 'follow' }).then(function (r) { return r.json(); });
  }
  var STEPS = [['assigned', 'جُهّزت'], ['on_way', 'في الطريق'], ['arrived', 'وصل'], ['delivered', 'سُلّمت']];
  function stepIdx(st) { return st === 'assigned' ? 0 : st === 'on_way' ? 1 : st === 'arrived' ? 2 : ['delivered', 'partial', 'picked', 'closed', 'to_store'].indexOf(st) >= 0 ? 3 : st === 'failed' ? 2 : 0; }
  function draw(d) {
    var ret = d.kind === 'مرتجع مبيع', i = stepIdx(d.state), done = i === 3;
    var head = d.state === 'assigned' ? 'طلبيتك جاهزة وستخرج قريباً' : d.state === 'on_way' ? 'السائق في الطريق إليك' : d.state === 'arrived' ? 'وصل السائق إلى محلك' :
      d.state === 'failed' ? 'تعذّر التسليم، سيتواصل معك فريقنا' : done ? (ret ? 'تم استلام المرتجع ✓' : 'تم التسليم ✓') : d.state_ar;
    var eta = '';
    if (d.state === 'on_way' && routeInfo) eta = '<div class="eta"><b>' + esc(RKMap.etaText(routeInfo.sec)) + '</b><span>' + (routeInfo.approx ? 'تقريباً · ' : '') + esc(RKMap.kmText(routeInfo.m)) + '</span></div>';
    var sub = d.state === 'on_way' ? (d.stops_before ? 'قبلك ' + d.stops_before + (d.stops_before === 1 ? ' محل' : ' محلات') + ' في هذه الرحلة' : 'محلك هو التالي في الرحلة') + (d.pos ? '' : ' · سيظهر موقع السائق عند اتصال هاتفه') :
      d.state === 'arrived' ? 'منذ ' + hm(d.arrive_at) : done ? 'الساعة ' + hm(d.result_at) : d.state === 'assigned' ? 'سيظهر موقع السائق هنا عند خروجه' : '';
    $p.innerHTML = '<div class="grab"></div><p class="st' + (done ? ' done' : '') + '">' + esc(head) + '</p>' + eta + (sub ? '<p class="sub">' + esc(sub) + '</p>' : '') +
      '<div class="steps">' + STEPS.map(function (s, k) { return '<div class="' + (k < i || done ? 'ok' : k === i ? 'on' : '') + '">' + (k === 3 && ret ? 'استُلم' : s[1]) + '</div>'; }).join('') + '</div>' +
      '<div class="drv"><div class="av"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg></div>' +
      '<div><b>' + esc(d.driver || 'سائق راكان') + '</b><small>' + esc(d.truck || '') + '</small></div></div>' +
      '<div class="meta"><span>' + (ret ? 'مرتجع' : 'فاتورة') + ' ' + esc(d.inv) + ' · ' + esc(d.cust) + '</span><span>' + (d.pos_at ? 'آخر تحديث ' + esc(ago(d.pos_at)) : '') + '</span></div>';
    $live.className = 'live' + (d.pos && d.state === 'on_way' ? '' : ' off');
    $live.lastChild.textContent = d.pos && d.state === 'on_way' ? 'مباشر' : done ? 'انتهت الرحلة' : 'بانتظار الموقع';
  }
  function updateMap(d) {
    if (d.dest && !shop) shop = L.marker([d.dest.lat, d.dest.lng], { icon: RKMap.shopIcon(), zIndexOffset: 500 }).addTo(map);
    var live = d.pos && (d.state === 'on_way' || d.state === 'arrived');
    if (live) {
      var p = [d.pos.lat, d.pos.lng], hdg = d.pos.hdg;
      if (last && (hdg === null || hdg === undefined) && RKMap.distM(last[0], last[1], p[0], p[1]) > 10) hdg = RKMap.bearing(last[0], last[1], p[0], p[1]);
      var icon = RKMap.truckIcon({ status: 'live', heading: hdg });
      if (!truck) truck = L.marker(p, { icon: icon, zIndexOffset: 1000 }).addTo(map); else { truck.setIcon(icon); RKMap.animate(truck, p, 1500); }
      last = p;
      var tr = (d.trail || []).map(function (x) { return [x[0], x[1]]; });
      if (trailLine) trailLine.setLatLngs(tr); else trailLine = L.polyline(tr, { color: '#8AA4C8', weight: 5, opacity: .8, lineCap: 'round' }).addTo(map);
      if (d.dest && d.state === 'on_way' && Date.now() - lastRoute > 45000) {
        lastRoute = Date.now();
        RKMap.route(p, [d.dest.lat, d.dest.lng]).then(function (r) {
          routeInfo = r;
          if (routeLine) routeLine.setLatLngs(r.line); else routeLine = L.polyline(r.line, { color: '#0C4CA2', weight: 6, opacity: .9, dashArray: r.approx ? '8 10' : null, lineCap: 'round' }).addTo(map);
          draw(d);
        });
      }
    } else { if (truck) { map.removeLayer(truck); truck = null; } if (routeLine) { map.removeLayer(routeLine); routeLine = null; } routeInfo = null; }
    if (!fitted) {
      var pts = []; if (live) pts.push(last); if (d.dest) pts.push([d.dest.lat, d.dest.lng]);
      if (pts.length === 2) map.fitBounds(pts, { paddingTopLeft: [50, 90], paddingBottomRight: [50, ($p.offsetHeight || 300) + 30], maxZoom: 16 });
      else if (pts.length === 1) { map.setView(pts[0], 15); map.panBy([0, ($p.offsetHeight || 300) / 2]); }
      if (pts.length) fitted = true;
    }
  }
  var timer = null;
  function tick() {
    call().then(function (d) {
      if (!d.ok) { $p.innerHTML = '<div class="grab"></div><div class="msg"><b>تعذّر عرض التتبع</b>' + esc(d.error || '') + '</div>'; $live.className = 'live off'; return; }
      draw(d); updateMap(d);
      var done = ['delivered', 'partial', 'picked', 'closed', 'to_store', 'failed'].indexOf(d.state) >= 0;
      if (!done) timer = setTimeout(tick, (d.every || 10) * 1000);
    }).catch(function () { $live.className = 'live off'; timer = setTimeout(tick, 15000); });
  }
  if (!token) $p.innerHTML = '<div class="grab"></div><div class="msg"><b>رابط غير مكتمل</b>اطلب من راكان رابط التتبع مرة أخرى.</div>';
  else tick();
  document.addEventListener('visibilitychange', function () { if (!document.hidden && token) { clearTimeout(timer); tick(); } });
})();
