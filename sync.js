/* راكان · التخزين المحلي وقائمة الانتظار والإرسال
   مشترك بين الصفحة وعامل الخدمة (Service Worker)، فلا يستعمل أي عنصر من الصفحة. */
(function (root) {
  'use strict';
  var DB_NAME = 'rakan-delivery', DB_VER = 1;
  var dbp = null;

  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
        if (!d.objectStoreNames.contains('outbox')) d.createObjectStore('outbox', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('photos')) d.createObjectStore('photos', { keyPath: 'id' });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }

  function tx(store, mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(store, mode);
        var s = t.objectStore(store);
        var out = fn(s);
        t.oncomplete = function () { res(typeof IDBRequest !== 'undefined' && out instanceof IDBRequest ? out.result : out); };
        t.onerror = function () { rej(t.error); };
        t.onabort = function () { rej(t.error); };
      });
    });
  }

  var S = {
    get: function (k) { return tx('kv', 'readonly', function (s) { return s.get(k); }); },
    set: function (k, v) { return tx('kv', 'readwrite', function (s) { s.put(v, k); }); },
    del: function (k) { return tx('kv', 'readwrite', function (s) { s.delete(k); }); },
    all: function (store) { return tx(store, 'readonly', function (s) { return s.getAll(); }); },
    put: function (store, v) { return tx(store, 'readwrite', function (s) { s.put(v); }); },
    remove: function (store, id) { return tx(store, 'readwrite', function (s) { s.delete(id); }); },
    clearAll: function () {
      return Promise.all(['kv', 'outbox', 'photos'].map(function (st) { return tx(st, 'readwrite', function (s) { s.clear(); }); }));
    }
  };

  function uuid() {
    if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }

  // الوقت المحلي بتوقيت طرابلس (UTC+2) بصيغة الخادم
  function nowStr(d) {
    var t = new Date((d ? d.getTime() : Date.now()) + 2 * 3600e3);
    return t.toISOString().slice(0, 19).replace('T', ' ');
  }

  function api(action, body, opts) {
    opts = opts || {};
    return Promise.all([S.get('api'), S.get('token'), S.get('device')]).then(function (v) {
      var url = opts.url || v[0] || root.RAKAN_API;
      var payload = Object.assign({ app: 1, action: action, token: v[1], device: v[2] }, body || {});
      var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = ctl ? setTimeout(function () { ctl.abort(); }, opts.timeout || 45000) : null;
      return fetch(url, { method: 'POST', body: JSON.stringify(payload), redirect: 'follow', signal: ctl && ctl.signal })
        .then(function (r) {
          if (!r.ok) throw netErr('الخادم لا يستجيب (' + r.status + ')');
          return r.text();
        })
        .then(function (t) {
          var j;
          try { j = JSON.parse(t); } catch (e) { throw netErr('رد غير مفهوم من الخادم'); }
          return j;
        }, function (e) {
          if (e && e.net) throw e;
          throw netErr('لا يوجد اتصال بالإنترنت');
        })
        .finally(function () { if (timer) clearTimeout(timer); });
    });
  }

  function netErr(m) { var e = new Error(m); e.net = true; return e; }

  /* ---------- قائمة الانتظار ---------- */

  function queueStep(step) {
    step.id = step.id || uuid();
    step.t = step.t || nowStr();
    step.seq = Date.now() + Math.random();
    step.tries = 0;
    return S.put('outbox', step).then(function () { requestBgSync(); return step; });
  }

  function queuePhoto(p) {
    p.id = p.id || uuid();
    p.t = p.t || nowStr();
    p.tries = 0;
    return S.put('photos', p).then(function () { requestBgSync(); return p; });
  }

  function requestBgSync() {
    try {
      if (root.navigator && navigator.serviceWorker && root.document) {
        navigator.serviceWorker.ready.then(function (reg) { if (reg.sync) reg.sync.register('rakan-sync').catch(function () {}); });
      }
    } catch (e) {}
  }

  function pendingCount() {
    return Promise.all([S.all('outbox'), S.all('photos')]).then(function (v) {
      return { steps: v[0].length, photos: v[1].length, total: v[0].length + v[1].length,
        failed: v[0].filter(function (s) { return s.final; }) };
    });
  }

  var flushing = null;
  // يرسل النص أولاً ثم الصور، وكل فشل يُعاد لاحقاً بفواصل متزايدة
  function flush() {
    if (flushing) return flushing;
    flushing = doFlush().finally(function () { flushing = null; });
    return flushing;
  }

  function doFlush() {
    var report = { sent: 0, photos: 0, rejected: [], error: null };
    return S.all('outbox').then(function (steps) {
      steps = steps.filter(function (s) { return !s.final; }).sort(function (a, b) { return a.seq - b.seq; });
      if (!steps.length) return;
      var groups = {};
      steps.forEach(function (s) { var k = s.action || 'steps'; (groups[k] = groups[k] || []).push(s); });
      var chain = Promise.resolve();
      Object.keys(groups).forEach(function (action) {
        chain = chain.then(function () { return sendGroup(action, groups[action], report); });
      });
      return chain;
    }).then(function () {
      return S.all('photos');
    }).then(function (photos) {
      var chain = Promise.resolve();
      photos.forEach(function (p) {
        chain = chain.then(function () {
          return api('photo', { photo: { id: p.id, rec: p.rec, kind: p.kind, data: p.data, t: p.t, lat: p.lat, lng: p.lng } }, { timeout: 90000 })
            .then(function (r) {
              if (r.ok) { report.photos++; return S.remove('photos', p.id); }
              if (r.error === 'auth') throw authErr(r);
              p.tries++; p.error = r.error; return S.put('photos', p);
            });
        });
      });
      return chain;
    }).then(function () { return S.set('last_sync', nowStr()); }).then(function () { return report; }, function (e) {
      report.error = e; return report;
    });
  }

  function authErr(r) { var e = new Error(r.msg || 'سجّل الدخول من جديد'); e.auth = true; return e; }

  function sendGroup(action, list, report) {
    var batches = [];
    for (var i = 0; i < list.length; i += 25) batches.push(list.slice(i, i + 25));
    var chain = Promise.resolve();
    batches.forEach(function (b) {
      chain = chain.then(function () {
        var body;
        if (action === 'steps') body = { steps: b.map(clean) };
        else body = Object.assign({}, b[0].body);  // إجراءات مفردة (مثل تسجيل موقع)
        if (action !== 'steps' && b.length > 1) {
          // نرسل الإجراءات المفردة واحداً واحداً
          var c = Promise.resolve();
          b.forEach(function (one) { c = c.then(function () { return sendSingle(action, one, report); }); });
          return c;
        }
        if (action !== 'steps') return sendSingle(action, b[0], report);
        return api('steps', body).then(function (r) {
          if (!r.ok) { if (r.error === 'auth') throw authErr(r); throw netErr(r.error || 'رفض الخادم الطلب'); }
          var byId = {};
          (r.results || []).forEach(function (x) { byId[x.id] = x; });
          var ops = b.map(function (s) {
            var x = byId[s.id];
            if (x && x.ok) { report.sent++; return S.remove('outbox', s.id); }
            if (x && x.final) { s.final = true; s.error = x.error; report.rejected.push(s); return S.put('outbox', s); }
            s.tries++; return S.put('outbox', s);
          });
          return Promise.all(ops);
        });
      });
    });
    return chain;
  }

  function sendSingle(action, s, report) {
    return api(action, s.body).then(function (r) {
      if (r.ok) { report.sent++; return S.remove('outbox', s.id); }
      if (r.error === 'auth') throw authErr(r);
      if (r.error === 'busy') { s.tries++; return S.put('outbox', s); }
      s.final = true; s.error = r.error; report.rejected.push(s); return S.put('outbox', s);
    });
  }

  function clean(s) {
    var o = {};
    Object.keys(s).forEach(function (k) { if (['seq', 'tries', 'final', 'error', 'label', 'action'].indexOf(k) < 0) o[k] = s[k]; });
    return o;
  }

  root.RK = { S: S, api: api, uuid: uuid, nowStr: nowStr, queueStep: queueStep, queuePhoto: queuePhoto,
    flush: flush, pendingCount: pendingCount, requestBgSync: requestBgSync };
})(typeof self !== 'undefined' ? self : this);
