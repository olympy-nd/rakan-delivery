/* عامل الخدمة: يحفظ ملفات التطبيق ليفتح بلا إنترنت، ويرسل قائمة الانتظار عند عودة الشبكة */
var VERSION = 'rakan-v13';
var SHELL = ['./', 'index.html', 'style.css', 'app.js', 'install.js', 'map.js', 'leaflet.js', 'leaflet.css', 'track.html', 'track.js', 'sync.js', 'config.js', 'qrcode.js', 'logo.png',
  'icon-192.png', 'icon-512.png', 'manifest.webmanifest', 'fonts/Tajawal-Regular.ttf', 'fonts/Tajawal-Bold.ttf',
  'fonts/Tajawal-ExtraBold.ttf'];

importScripts('config.js', 'sync.js');

self.addEventListener('install', function (e) {
  // نتجاوز ذاكرة المتصفح عند التنزيل حتى تُحفظ النسخة الجديدة فعلاً وليست نسخة قديمة مخزّنة
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return Promise.all(SHELL.map(function (u) {
      return fetch(new Request(u, { cache: 'reload' })).then(function (r) { if (!r.ok) throw new Error(u); return c.put(u, r); });
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// من الشبكة أولاً (مع التحقق من آخر نسخة)، ومن الذاكرة عند انقطاع الإنترنت
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  var key = e.request.mode === 'navigate' ? 'index.html' : u.pathname.replace(/^.*\/rakan-delivery\//, '').replace(/^\//, '') || 'index.html';
  e.respondWith(caches.open(VERSION).then(function (c) {
    var net = fetch(e.request.url, { cache: 'no-cache' }).then(function (r) {
      if (r && r.ok && SHELL.indexOf(key) >= 0) c.put(key, r.clone());
      return r;
    });
    var timeout = new Promise(function (res) { setTimeout(res, 6000); });
    return Promise.race([net, timeout.then(function () { return c.match(key); })]).then(function (r) {
      return r || net;
    }).catch(function () {
      return c.match(key).then(function (hit) { return hit || c.match('index.html'); });
    });
  }));
});

self.addEventListener('sync', function (e) {
  if (e.tag === 'rakan-sync') e.waitUntil(RK.flush().then(notifyClients));
});

self.addEventListener('message', function (e) {
  if (e.data === 'flush') e.waitUntil(RK.flush().then(notifyClients));
});

function notifyClients(report) {
  return self.clients.matchAll().then(function (list) {
    list.forEach(function (c) { c.postMessage({ type: 'flushed', sent: report && report.sent, photos: report && report.photos }); });
  });
}
