/* عامل الخدمة: يحفظ ملفات التطبيق ليفتح بلا إنترنت، ويرسل قائمة الانتظار عند عودة الشبكة */
var VERSION = 'rakan-v3';
var SHELL = ['./', 'index.html', 'style.css', 'app.js', 'sync.js', 'config.js', 'qrcode.js', 'logo.png',
  'icon-192.png', 'icon-512.png', 'manifest.webmanifest', 'fonts/Tajawal-Regular.ttf', 'fonts/Tajawal-Bold.ttf',
  'fonts/Tajawal-ExtraBold.ttf'];

importScripts('config.js', 'sync.js');

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  // الملفات من الذاكرة أولاً مع تحديثها في الخلفية
  e.respondWith(caches.open(VERSION).then(function (c) {
    return c.match(e.request, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(e.request).then(function (r) {
        if (r && r.ok) c.put(e.request, r.clone());
        return r;
      }).catch(function () { return hit || c.match('index.html'); });
      return hit || net;
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
