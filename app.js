/* راكان · تطبيق تتبع الفواتير — واجهة كل الأدوار */
(function () {
  'use strict';
  var S = RK.S;
  var $app = document.getElementById('app');
  var st = { user: null, settings: {}, tab: null, online: navigator.onLine, pend: { total: 0, failed: [] },
    board: null, region: null, date: null, sel: {}, driverSel: null, kindF: 'all', q: '', drv: null, photoCache: {},
    lastFlush: null, follow: { driver: '', state: 'open' } };
  var IOS = /iPhone|iPad|iPod/.test(navigator.userAgent);

  /* ===================== أدوات ===================== */
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(n) { var x = Number(n || 0); return x.toLocaleString('en-US', { maximumFractionDigits: 3 }); }
  function N(n) { return '<span class="num">' + esc(n) + '</span>'; }
  function hm(ts) { return ts ? N(String(ts).slice(11, 16)) : ''; }
  function today() { return RK.nowStr().slice(0, 10); }
  // عرض التاريخ بصيغة واحدة في كل المنظومة: 14/11/2026، والصيغة الطويلة: السبت 14 نوفمبر 2026
  var AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  var AR_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  function dmy(ts) { var d = String(ts || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : d; }
  function dlong(ts, noYear) {
    var d = String(ts || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    var w = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))).getUTCDay();
    return AR_DAYS[w] + ' ' + (+d.slice(8, 10)) + ' ' + AR_MONTHS[+d.slice(5, 7) - 1] + (noYear ? '' : ' ' + d.slice(0, 4));
  }
  // حقل تاريخ يعرض التاريخ بالعربية؛ الضغط عليه يفتح تقويم الجهاز
  function dateField(id, value, o) {
    o = o || {};
    return '<label class="datebtn' + (o.cls ? ' ' + o.cls : '') + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>' +
      '<span>' + esc(o.short ? dmy(value) : dlong(value)) + '</span><input type="date" id="' + id + '" value="' + esc(value) + '"' + (o.max ? ' max="' + esc(o.max) + '"' : '') + ' aria-label="' + esc(o.label || 'التاريخ') + '"></label>';
  }
  function bindDates(el) { qa('.datebtn input', el).forEach(function (i) { i.addEventListener('click', function () { try { if (i.showPicker) i.showPicker(); } catch (e) {} }); }); }
  function q(sel, el) { return (el || document).querySelector(sel); }
  function qa(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  var ICON = {
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
    out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2"/></svg>'
  };

  function toast(msg, err) {
    var t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, err ? 5200 : 3000);
  }

  function call(action, body, opts) {
    if (st.user && canSwitchBr()) body = Object.assign({ br: curBr() }, body || {});
    return RK.api(action, body, opts).then(function (r) {
      if (r.ok) return r;
      if (r.error === 'auth') { logout(r.msg || 'انتهت الجلسة، سجّل الدخول من جديد'); throw new Error(r.msg || 'سجّل الدخول'); }
      if (r.error === 'busy') throw new Error('الخادم مشغول، حاول بعد لحظة');
      var e = new Error(r.msg || r.error || 'تعذّر تنفيذ الطلب'); e.code = r.error; throw e;
    });
  }

  function sheet(title, html, mount) {
    var bg = document.createElement('div');
    bg.className = 'sheet-bg';
    bg.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="sheet-h"><h2>' + esc(title) +
      '</h2><button class="iconbtn" data-x aria-label="إغلاق">' + ICON.close + '</button></div><div class="sheet-b">' + html + '</div></div>';
    document.body.appendChild(bg);
    var api = { el: q('.sheet-b', bg), close: function () { bg.remove(); if (api.onclose) api.onclose(); } };
    q('[data-x]', bg).onclick = api.close;
    bg.addEventListener('click', function (e) { if (e.target === bg && !api.sticky) api.close(); });
    if (mount) mount(api);
    return api;
  }

  // نافذة سؤال بسيطة تعيد النص المكتوب (للأسباب الإلزامية)
  function askReason(title, label, opts) {
    opts = opts || {};
    return new Promise(function (res) {
      var chips = (opts.choices || []).map(function (c) { return '<button class="chip" data-c="' + esc(c) + '">' + esc(c) + '</button>'; }).join('');
      var s = sheet(title, (opts.intro ? '<div class="msg info">' + esc(opts.intro) + '</div>' : '') +
        (chips ? '<div class="chips">' + chips + '</div>' : '') +
        '<div class="field"><label for="rs">' + esc(label) + '</label><textarea id="rs" class="input" placeholder="' + esc(opts.ph || '') + '"></textarea></div>' +
        '<div class="row"><button class="btn primary grow" data-ok>' + esc(opts.ok || 'تأكيد') + '</button><button class="btn ghost" data-no>إلغاء</button></div>',
        function (s) {
          var ta = q('#rs', s.el);
          qa('[data-c]', s.el).forEach(function (b) { b.onclick = function () { qa('[data-c]', s.el).forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); ta.value = b.dataset.c; }; });
          q('[data-ok]', s.el).onclick = function () {
            var v = ta.value.trim();
            if (!v && !opts.optional) { ta.focus(); toast('اكتب السبب', true); return; }
            s.done = true; s.close(); res(v);
          };
          q('[data-no]', s.el).onclick = function () { s.close(); };
          s.onclose = function () { if (!s.done) res(null); };
          setTimeout(function () { if (!chips) ta.focus(); }, 50);
        });
    });
  }

  function confirmBox(title, text, ok) {
    return new Promise(function (res) {
      sheet(title, '<p style="margin:0">' + text + '</p><div class="row"><button class="btn primary grow" data-ok>' + esc(ok || 'نعم') +
        '</button><button class="btn ghost" data-no>إلغاء</button></div>', function (s) {
        q('[data-ok]', s.el).onclick = function () { s.done = true; s.close(); res(true); };
        q('[data-no]', s.el).onclick = function () { s.close(); };
        s.onclose = function () { if (!s.done) res(false); };
      });
    });
  }

  function busy(btn, on) {
    if (!btn) return;
    if (on) { btn.dataset.t = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>'; }
    else { btn.disabled = false; if (btn.dataset.t) btn.innerHTML = btn.dataset.t; }
  }

  function badge(state, txt) { return '<span class="badge b-' + esc(state) + '">' + esc(txt) + '</span>'; }
  var STATE_AR = { assigned: 'قيد الانتظار', on_way: 'في الطريق', arrived: 'وصل', delivered: 'تم التسليم', partial: 'تسليم جزئي',
    failed: 'تعذّر التسليم', picked: 'استُلم المرتجع', to_store: 'عائدة للمخزن', closed: 'مغلقة', canceled: 'ملغاة' };
  function isRet(a) { return a.kind === 'مرتجع مبيع'; }

  /* ===================== التشغيل ===================== */
  function boot() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(function () {});
      navigator.serviceWorker.addEventListener('message', function (e) { if (e.data && e.data.type === 'flushed') afterFlush(); });
      // عند وصول نسخة جديدة من التطبيق: إعادة تحميل الصفحة مرة واحدة لتظهر فوراً
      var hadCtl = !!navigator.serviceWorker.controller, reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!hadCtl || reloaded) { hadCtl = true; return; }
        reloaded = true;
        RK.pendingCount().then(function (p) { if (!q('.sheet-bg')) location.reload(); else toast('وصلت نسخة جديدة من التطبيق. أعد فتحه بعد إنهاء ما تقوم به'); });
      });
      navigator.serviceWorker.getRegistration().then(function (reg) { if (reg) reg.update(); });
    }
    window.addEventListener('online', function () { st.online = true; netUI(); flushNow(); });
    window.addEventListener('offline', function () { st.online = false; netUI(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { flushNow(); refresh(true); } });
    setInterval(flushNow, 30000);
    setInterval(function () { if (!document.hidden) refresh(true); }, 60000);
    Promise.all([S.get('device'), S.get('token'), S.get('user'), S.get('settings')]).then(function (v) {
      var dev = v[0];
      if (!dev) { dev = RK.uuid(); S.set('device', dev); }
      if (!v[1] || !v[2]) return renderLogin();
      st.user = v[2]; st.settings = v[3] || {};
      if (st.user.must_change) return renderChangePin();
      startApp();
      if (navigator.onLine) call('me').then(function (r) { st.user = r.user; st.settings = r.settings; S.set('user', r.user); S.set('settings', r.settings); shellUI(); }).catch(function () {});
    });
  }

  var logoutHooks = [];
  function logout(msg) {
    S.del('token'); S.del('user');
    logoutHooks.forEach(function (f) { try { f(); } catch (e) {} });
    st.user = null; st.board = null; st.drv = null;
    renderLogin(msg);
  }

  /* ===================== الدخول ===================== */
  function renderLogin(msg) {
    $app.innerHTML = '<div class="strip"></div><div class="login"><div class="card"><div class="brand"><img src="logo.png" alt="شعار راكان">' +
      '<h1>تتبع الفواتير</h1><p>ادخل باسم المستخدم والرقم السري</p></div><form class="form" id="lf" autocomplete="on">' +
      (msg ? '<div class="msg warn">' + esc(msg) + '</div>' : '') +
      '<div class="field"><label for="lu">اسم المستخدم</label><input id="lu" class="input ltr" autocapitalize="none" autocomplete="username" required></div>' +
      '<div class="field"><label for="lp">الرقم السري</label><input id="lp" class="input pin" type="password" inputmode="numeric" autocomplete="current-password" required></div>' +
      '<div class="field" id="lcw" hidden><label for="lc">رمز التحقق من البريد</label><input id="lc" class="input pin" inputmode="numeric" maxlength="6"></div>' +
      '<div id="lm"></div><button class="btn primary big" id="lb">دخول</button></form></div></div>';
    var f = q('#lf');
    f.onsubmit = function (e) {
      e.preventDefault();
      var b = q('#lb'), m = q('#lm');
      m.innerHTML = '';
      if (!navigator.onLine) { m.innerHTML = '<div class="msg err">الدخول يحتاج إنترنت. افتح التطبيق في المخزن قبل الخروج.</div>'; return; }
      busy(b, true);
      S.get('device').then(function (dev) {
        return RK.api('login', { username: q('#lu').value.trim(), pin: q('#lp').value, device: dev, code: q('#lc').value.trim() || undefined });
      }).then(function (r) {
        busy(b, false);
        if (r.ok) {
          st.user = r.user; st.settings = r.settings;
          return Promise.all([S.set('token', r.token), S.set('user', r.user), S.set('settings', r.settings)]).then(function () {
            if (r.user.must_change) renderChangePin(); else startApp();
          });
        }
        if (r.error === 'code') { q('#lcw').hidden = false; q('#lc').focus(); m.innerHTML = '<div class="msg info">' + esc(r.msg) + '</div>'; return; }
        m.innerHTML = '<div class="msg ' + (r.error === 'device' ? 'warn' : 'err') + '">' + esc(r.msg || r.error) + '</div>';
      }).catch(function (e) { busy(b, false); m.innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; });
    };
  }

  function renderChangePin() {
    $app.innerHTML = '<div class="strip"></div><div class="login"><div class="card"><div class="brand"><img src="logo.png" alt="شعار راكان">' +
      '<h1>اختر رقمك السري</h1><p>أهلاً ' + esc(st.user.name) + '. لحماية حسابك اختر رقماً سرياً جديداً لا يعرفه غيرك.</p></div>' +
      '<form class="form" id="pf"><div class="field"><label for="p0">الرقم السري الحالي (المؤقت)</label><input id="p0" class="input pin" type="password" inputmode="numeric" required></div>' +
      '<div class="field"><label for="p1">الرقم السري الجديد (4 إلى 8 أرقام)</label><input id="p1" class="input pin" type="password" inputmode="numeric" required></div>' +
      '<div class="field"><label for="p2">أعد كتابته</label><input id="p2" class="input pin" type="password" inputmode="numeric" required></div>' +
      '<div id="pm"></div><button class="btn primary big" id="pb">حفظ والمتابعة</button><button type="button" class="btn ghost" id="po">خروج</button></form></div></div>';
    q('#po').onclick = function () { logout(); };
    q('#pf').onsubmit = function (e) {
      e.preventDefault();
      var m = q('#pm');
      if (q('#p1').value !== q('#p2').value) { m.innerHTML = '<div class="msg err">الرقمان غير متطابقين</div>'; return; }
      var b = q('#pb'); busy(b, true);
      call('change_pin', { old: q('#p0').value, pin: q('#p1').value }).then(function (r) {
        st.user = r.user; S.set('user', r.user); startApp(); toast('تم حفظ رقمك السري');
      }).catch(function (e2) { busy(b, false); m.innerHTML = '<div class="msg err">' + esc(e2.message) + '</div>'; });
    };
  }

  /* ===================== الفرع (مساحة العمل) =====================
   * عند قراءة أكثر من قاعدة سراج تنفصل المعاملات: كل مستخدم يعمل داخل فرع واحد.
   * المربوط بفرع يبقى فيه دائماً، وغير المربوط (كل الفروع) يبدّل من أعلى الشاشة. */
  function brList() { return (st.settings && st.settings.branches) || []; }
  function multiWs() { return brList().length > 1; }
  function canSwitchBr() { return multiWs() && !(st.user && st.user.ws); }
  function curBr() {
    if (!multiWs()) return '';
    if (st.user && st.user.ws) return st.user.ws;
    if (!st.br) { try { st.br = localStorage.getItem('rk:br') || 'main'; } catch (e) { st.br = 'main'; } }
    if (!brList().some(function (b) { return b.code === st.br; })) st.br = 'main';
    return st.br;
  }
  function curBrName() { var c = curBr(), b = brList().filter(function (x) { return x.code === c; })[0]; return b ? b.name : ''; }
  function switchBr() {
    var cur = curBr();
    sheet('اختر الفرع', '<p class="muted" style="margin:0 0 12px">معاملات كل فرع مستقلة: فواتيره وسائقوه وكشوفه وتقاريره.</p><div class="list">' + brList().map(function (b) {
      return '<button class="item tap' + (b.code === cur ? ' sel' : '') + '" data-br="' + esc(b.code) + '" style="text-align:start"><div class="main"><b>' + esc(b.name) + '</b></div>' + (b.code === cur ? '<span class="badge b-delivered">الحالي</span>' : '') + '</button>';
    }).join('') + '</div>', function (s) {
      qa('[data-br]', s.el).forEach(function (x) {
        x.onclick = function () {
          s.close();
          if (x.dataset.br === cur) return;
          st.br = x.dataset.br; try { localStorage.setItem('rk:br', st.br); } catch (e) {}
          st.board = null; st.customers = null; st.locs = null; st.locsOk = null; st.sel = {}; st.region = null; st.driverSel = null;
          render(); refresh(false); toast('تعمل الآن على: ' + curBrName());
        };
      });
    });
  }

  /* ===================== الهيكل ===================== */
  var TABS = {
    manager: [['today', 'اليوم'], ['follow', 'المتابعة'], ['map', 'الخريطة'], ['trips', 'الكشوف'], ['back', 'الإيصالات والمخزن'], ['locs', 'المواقع'],
      ['reports', 'التقارير'], ['users', 'المستخدمون'], ['settings', 'الإعدادات'], ['audit', 'سجل التدقيق']],
    supervisor: [['today', 'اليوم'], ['follow', 'المتابعة'], ['map', 'الخريطة'], ['trips', 'الكشوف'], ['back', 'الإيصالات والمخزن'], ['locs', 'المواقع'], ['reports', 'التقارير']],
    accountant: [['follow', 'المتابعة'], ['reports', 'التقارير']],
    storekeeper: [['back', 'الإيصالات والمخزن'], ['map', 'الخريطة']],
    rep: [['addloc', 'تسجيل موقع عميل']],
    driver: [['my', 'فواتيري'], ['mysum', 'ملخصي']]
  };

  var TAB_ICON = {
    today: '<path d="M4 7h16M4 12h10M4 17h7"/><path d="M17 15l2 2 3-4"/>', follow: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    map: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', trips: '<path d="M7 3h10v18l-5-3-5 3z"/><path d="M10 8h4M10 12h4"/>',
    back: '<path d="M4 8l8-5 8 5v11H4z"/><path d="M9 19v-6h6v6"/>', locs: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
    reports: '<path d="M5 20V10M12 20V4M19 20v-7"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5a3.5 3.5 0 0 1 0 7M18 14.5a6 6 0 0 1 3.5 5.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    audit: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7M9 8h3"/>', addloc: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><path d="M12 7v5M9.5 9.5h5"/>',
    my: '<path d="M6 3h12v18l-6-3-6 3z"/>', mysum: '<path d="M5 20V10M12 20V4M19 20v-7"/>', more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'
  };
  function tabIcon(k) { return '<svg class="ti" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (TAB_ICON[k] || TAB_ICON.today) + '</svg>'; }
  // تجميع الصفحات في القائمة الجانبية
  var TAB_GROUP = { today: 'العمل اليومي', follow: 'العمل اليومي', map: 'العمل اليومي', trips: 'العمل اليومي', back: 'العمل اليومي', my: '', mysum: '', addloc: '',
    locs: 'البيانات والتقارير', reports: 'البيانات والتقارير', users: 'الإدارة', settings: 'الإدارة', audit: 'الإدارة' };
  var TAB_SHORT = { back: 'الإيصالات', addloc: 'موقع عميل', audit: 'السجل' };
  function isPhone() { return window.matchMedia('(max-width: 899px)').matches; }
  function tabName(k) { var t = (TABS[st.user.role] || []).filter(function (x) { return x[0] === k; })[0]; return t ? t[1] : ''; }
  function goTab(k) { st.tab = k; render(); refresh(true); window.scrollTo(0, 0); }

  function startApp() {
    var tabs = TABS[st.user.role] || [];
    if (!st.tab || !tabs.some(function (t) { return t[0] === st.tab; })) st.tab = tabs[0] && tabs[0][0];
    var phone = isPhone(); st.phone = phone;
    var cnt = '<span class="cnt" hidden></span>';
    var nav = '';
    if (tabs.length > 1 && !phone) {
      var last = null;
      nav = '<aside class="side"><div class="side-brand"><img class="logo" src="logo.png" alt="راكان"></div><div id="brbox"></div><nav class="side-nav" id="tabs">' + tabs.map(function (t) {
        var g = TAB_GROUP[t[0]] || '', head = g && g !== last ? '<div class="side-g">' + esc(g) + '</div>' : ''; last = g || last;
        return head + '<button class="tab side-i" data-tab="' + t[0] + '">' + tabIcon(t[0]) + '<span>' + esc(t[1]) + '</span>' + cnt + '</button>';
      }).join('') + '</nav><div class="side-user"><div class="av">' + esc(String(st.user.name || '').trim().charAt(0)) + '</div><div class="grow"><b>' + esc(st.user.name) + '</b><span>' + esc(st.user.role_ar || '') + '</span></div></div></aside>';
    } else if (tabs.length > 1) {
      var main = tabs.length > 5 ? tabs.slice(0, 4) : tabs;
      nav = '<nav class="bnav" id="tabs">' + main.map(function (t) { return '<button class="tab bn-i" data-tab="' + t[0] + '">' + tabIcon(t[0]) + '<span>' + esc(TAB_SHORT[t[0]] || t[1]) + '</span>' + cnt + '</button>'; }).join('') +
        (tabs.length > main.length ? '<button class="bn-i" data-more aria-label="المزيد">' + tabIcon('more') + '<span>المزيد</span>' + cnt + '</button>' : '') + '</nav>';
    }
    $app.innerHTML = '<div class="strip"></div><div class="shell' + (nav && !phone ? ' has-side' : '') + (nav && phone ? ' has-bnav' : '') + '">' + (phone ? '' : nav) +
      '<div class="shell-b"><header class="top"><div class="top-in">' + (phone || !nav ? '<img class="logo" src="logo.png" alt="راكان">' : '') +
      '<div class="who"><h1 id="ptitle"></h1><span id="psub"></span></div>' +
      (phone ? '<span id="brbox"></span>' : '') +
      '<span class="net" id="net"></span><button class="iconbtn" id="rf" aria-label="تحديث" title="تحديث">' + ICON.refresh + '</button>' +
      '<button class="iconbtn" id="lo" aria-label="خروج" title="خروج">' + ICON.out + '</button></div>' +
      '</header><div class="pendbar" id="pb" hidden></div><main id="main"></main></div>' + (phone ? nav : '') + '</div>';
    q('#rf').onclick = function () { flushNow(); refresh(false); };
    q('#lo').onclick = function () {
      RK.pendingCount().then(function (p) {
        var warn = p.total ? '<b>تنبيه:</b> ' + p.total + ' خطوة أو صورة لم تُرسل بعد، وستضيع إذا خرجت الآن. اتصل بالإنترنت أولاً.' : 'هل تريد الخروج من التطبيق؟';
        confirmBox('خروج', warn, p.total ? 'خروج على أي حال' : 'خروج').then(function (y) {
          if (!y) return;
          if (p.total) S.clearAll().then(function () { return S.set('device', RK.uuid()); }).then(function () { logout(); });
          else logout();
        });
      });
    };
    qa('[data-tab]').forEach(function (b) { b.onclick = function () { goTab(b.dataset.tab); }; });
    var more = q('[data-more]');
    if (more) more.onclick = function () {
      var rest = tabs.slice(4), last2 = null;
      sheet('المزيد', '<div class="more-list">' + rest.map(function (t) {
        var g = TAB_GROUP[t[0]] || '', head = g && g !== last2 ? '<div class="side-g">' + esc(g) + '</div>' : ''; last2 = g || last2;
        return head + '<button class="tab more-i' + (st.tab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '">' + tabIcon(t[0]) + '<span>' + esc(t[1]) + '</span>' + (st.cnts && st.cnts[t[0]] ? '<span class="cnt">' + st.cnts[t[0]] + '</span>' : '') + '</button>';
      }).join('') + '</div>', function (s) {
        qa('[data-tab]', s.el).forEach(function (b) { b.onclick = function () { s.close(); goTab(b.dataset.tab); }; });
      });
    };
    if (!startApp.bound) {
      startApp.bound = true;
      window.addEventListener('resize', function () { if (st.user && q('#main') && isPhone() !== st.phone) startApp(); });
    }
    netUI();
    pendUI();
    render();
    refresh(false);
    flushNow();
  }

  // عنوان الصفحة، اسم المستخدم والفرع، وإبراز الصفحة الحالية في القائمة
  function shellUI() {
    var t = q('#ptitle'), sub = q('#psub');
    var tabs = TABS[st.user.role] || [];
    if (t) t.textContent = tabs.length > 1 ? tabName(st.tab) : st.user.name;
    if (sub) sub.textContent = tabs.length > 1 ? (st.phone ? st.user.name : '') : (st.user.role_ar || '') + (st.user.truck ? ' · ' + st.user.truck : '');
    var more = q('[data-more]');
    if (more) more.classList.toggle('on', tabs.slice(4).some(function (x) { return x[0] === st.tab; }));
    var bb = q('#brbox');
    if (bb) {
      var sig = multiWs() ? curBr() + '|' + canSwitchBr() + '|' + curBrName() : '';
      if (bb.dataset.sig !== sig) {
        bb.dataset.sig = sig;
        bb.innerHTML = !multiWs() ? '' : canSwitchBr()
          ? '<button class="brsw" id="brsw" aria-label="تبديل الفرع"><span class="brsw-l">الفرع</span><b>' + esc(curBrName()) + '</b><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg></button>'
          : '<span class="brsw fixed"><span class="brsw-l">الفرع</span><b>' + esc(curBrName()) + '</b></span>';
        var sw = q('#brsw'); if (sw) sw.onclick = switchBr;
      }
    }
  }

  function netUI() {
    var n = q('#net');
    if (!n) return;
    n.className = 'net' + (st.online ? '' : ' off');
    n.textContent = st.online ? 'متصل' : 'بلا إنترنت';
  }

  function render() {
    qa('[data-tab]').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === st.tab); });
    var m = q('#main');
    if (!m) return;
    var v = VIEWS[st.tab];
    try {
      if (v) m.innerHTML = v.html();
      if (v && v.bind) v.bind(m);
      bindDates(m); shellUI();
    } catch (e) {
      m.innerHTML = '<div class="msg err">حدث خطأ في عرض الشاشة: ' + esc(e.message) + '. اضغط زر التحديث.</div>';
      if (window.console) console.error(e);
    }
  }

  function refresh(quiet) {
    if (!st.user || !navigator.onLine) return;
    var v = VIEWS[st.tab];
    if (v && v.load) v.load(quiet).then(function (changed) { var vv = VIEWS[st.tab]; if (vv === v && changed !== false) render(); }).catch(function (e) { if (!quiet) toast(e.message, true); });
  }

  /* ===================== قائمة الانتظار ===================== */
  function flushNow() {
    if (!navigator.onLine || !st.user) return pendUI();
    return RK.flush().then(function (rep) {
      if (rep.error && rep.error.auth) logout(rep.error.message);
      if (rep.rejected && rep.rejected.length) toast('لم يقبل الخادم ' + rep.rejected.length + ' خطوة. راجع الشريط أعلى الشاشة', true);
      afterFlush(rep);
    });
  }

  function afterFlush(rep) {
    pendUI().then(function () {
      if (rep && (rep.sent || rep.photos) && st.user && st.user.role === 'driver') loadDriver(true).then(function () { if (st.tab === 'my' || st.tab === 'mysum') render(); });
    });
  }

  function pendUI() {
    return RK.pendingCount().then(function (p) {
      st.pend = p;
      var bar = q('#pb');
      if (!bar) return;
      if (!p.total) {
        if (bar.dataset.had === '1') {
          bar.className = 'pendbar ok'; bar.hidden = false; bar.innerHTML = '<div class="in">تم الإرسال ✓</div>';
          bar.dataset.had = '';
          setTimeout(function () { if (!st.pend.total) bar.hidden = true; }, 2500);
        } else bar.hidden = true;
        return;
      }
      bar.dataset.had = '1';
      bar.hidden = false;
      var live = p.total - p.failed.length;
      bar.className = 'pendbar' + (p.failed.length ? ' bad' : '');
      var html = '<div class="in">';
      if (live > 0) html += '<span>بانتظار الإرسال: ' + N(live) + '</span>' + (st.online ? '<span class="spin" style="width:16px;height:16px"></span>' : '<span>· يُرسل تلقائياً عند عودة الإنترنت</span>');
      if (IOS && live > 0) html += '<span class="small">· أبقِ التطبيق مفتوحاً حتى يكتمل الإرسال</span>';
      p.failed.forEach(function (f) {
        html += '<span style="flex-basis:100%">لم تُقبل خطوة «' + esc(f.label || f.kind || f.action) + '»: ' + esc(f.error) +
          ' <button class="btn sm danger" data-drop="' + esc(f.id) + '">حذفها</button></span>';
      });
      bar.innerHTML = html + '</div>';
      qa('[data-drop]', bar).forEach(function (b) { b.onclick = function () { S.remove('outbox', b.dataset.drop).then(function () { pendUI(); loadDriver(true).then(render); }); }; });
    });
  }

  /* ===================== الموقع والكاميرا ===================== */
  function getPos(opts) {
    opts = opts || {};
    return new Promise(function (res) {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(function (p) {
        res({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy) });
      }, function () { res(null); }, { enableHighAccuracy: true, timeout: opts.timeout || 15000, maximumAge: opts.maxAge === undefined ? 30000 : opts.maxAge });
    });
  }

  function distM(a1, o1, a2, o2) {
    var R = 6371000, r = Math.PI / 180, dA = (a2 - a1) * r, dO = (o2 - o1) * r;
    var h = Math.sin(dA / 2) * Math.sin(dA / 2) + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(dO / 2) * Math.sin(dO / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // التقاط صورة من الكاميرا فقط، مع ختم الوقت والموقع ورقم الفاتورة، وضغطها لحجم صغير
  function takePhoto(meta) {
    return new Promise(function (res, rej) {
      var inp = document.getElementById('camera');
      var fresh = inp.cloneNode(true);
      inp.parentNode.replaceChild(fresh, inp);
      var started = Date.now();
      fresh.onchange = function () {
        var f = fresh.files && fresh.files[0];
        if (!f) return rej(new Error('لم تُلتقط صورة'));
        if (f.lastModified && (Date.now() - f.lastModified > 3 * 60000 || f.lastModified < started - 60000)) {
          return rej(new Error('هذه صورة قديمة من المعرض. التقط صورة جديدة بالكاميرا'));
        }
        var url = URL.createObjectURL(f);
        var img = new Image();
        img.onload = function () {
          var max = 1280, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
          var c = document.createElement('canvas');
          c.width = Math.round(w * k); c.height = Math.round(h * k);
          var g = c.getContext('2d');
          g.drawImage(img, 0, 0, c.width, c.height);
          var lines = [RK.nowStr().slice(0, 16) + '  ·  ' + (meta.label || ''),
            (meta.inv ? 'فاتورة ' + meta.inv + '  ·  ' : '') + (meta.who || ''),
            meta.pos ? meta.pos.lat + ', ' + meta.pos.lng + '  (±' + meta.pos.acc + 'م)' : 'الموقع غير متاح'];
          var fs = Math.max(16, Math.round(c.width / 36));
          g.fillStyle = 'rgba(0,0,0,.55)';
          g.fillRect(0, c.height - fs * 4.2, c.width, fs * 4.2);
          g.fillStyle = '#fff';
          g.font = '700 ' + fs + 'px Tajawal, sans-serif';
          g.textAlign = 'right'; g.direction = 'rtl';
          lines.forEach(function (t, i) { g.fillText(t, c.width - fs * .6, c.height - fs * (3.1 - i * 1.25)); });
          var data = c.toDataURL('image/jpeg', 0.62);
          if (data.length > 330000) data = c.toDataURL('image/jpeg', 0.45);
          URL.revokeObjectURL(url);
          res({ id: RK.uuid(), data: data });
        };
        img.onerror = function () { rej(new Error('تعذّر قراءة الصورة')); };
        img.src = url;
      };
      fresh.click();
    });
  }

  function photoThumb(id) {
    if (st.photoCache[id]) return Promise.resolve(st.photoCache[id]);
    return S.get('ph:' + id).then(function (d) {
      if (d) { st.photoCache[id] = d; return d; }
      return call('photo_get', { id: id }).then(function (r) { st.photoCache[id] = r.data; S.set('ph:' + id, r.data); return r.data; });
    });
  }

  function loadPhotos(el) {
    qa('[data-ph]', el).forEach(function (box) {
      photoThumb(box.dataset.ph).then(function (d) {
        var img = document.createElement('img');
        img.src = d; img.alt = box.getAttribute('aria-label') || 'صورة';
        img.onclick = function () { sheet('صورة', '<img src="' + d + '" alt="" style="width:100%;border-radius:12px">'); };
        box.replaceWith(img);
      }).catch(function (e) { box.textContent = e.message.indexOf('لم تُرفع') >= 0 ? 'لم تُرفع بعد' : 'تعذّر التحميل'; });
    });
  }

  /* ===================== السائق ===================== */
  function loadDriver(quiet) {
    return S.get('drv').then(function (cached) {
      if (!st.drv && cached) st.drv = cached;
      if (!navigator.onLine) return st.drv;
      return call('driver_sync').then(function (r) {
        st.settings = r.settings; S.set('settings', r.settings);
        return S.all('outbox').then(function (box) {
          var items = r.items;
          box.filter(function (s) { return !s.final && s.kind; }).sort(function (a, b) { return a.seq - b.seq; }).forEach(function (s) { applyLocal(items, s); });
          st.drv = { items: items, at: RK.nowStr() };
          S.set('drv', st.drv);
          trkSync();
          prefetchFacades(items);
          return st.drv;
        });
      }).catch(function (e) { if (!quiet) toast(e.message, true); return st.drv; });
    });
  }

  function prefetchFacades(items) {
    items.forEach(function (a) { if (a.loc && a.loc.photo) photoThumb(a.loc.photo).catch(function () {}); });
  }

  function applyLocal(items, s) {
    if (s.kind === 'start_trip') {
      items.forEach(function (a) { if (a.trip_id === s.trip_id) { a.trip_started = true; if (a.state === 'assigned') { a.state = 'on_way'; a.start_at = s.t; } } });
      return;
    }
    var a = items.filter(function (x) { return x.rec === s.rec; })[0];
    if (!a) return;
    if (s.kind === 'arrive' && (a.state === 'on_way' || a.state === 'assigned')) { a.state = 'arrived'; a.arrive_at = s.t; }
    var res = { deliver: 'delivered', partial: 'partial', fail: 'failed', pickup: 'picked' }[s.kind];
    if (res && a.state === 'arrived') { a.state = res; a.result = res; a.result_at = s.t; if (res === 'partial' || res === 'failed') a.approval = 'بانتظار الاعتماد'; }
    a.state_ar = STATE_AR[a.state];
    a._pending = true;
  }

  function queueDriverStep(step, label) {
    step.label = label;
    return S.all('outbox').then(function (box) {
      // نفس الخطوة لنفس الفاتورة ما زالت في الانتظار: لا نكررها
      var same = box.filter(function (x) { return !x.final && x.kind === step.kind && (x.rec || x.trip_id) === (step.rec || step.trip_id); })[0];
      if (same) return same;
      return RK.queueStep(step);
    }).then(function (saved) {
      applyLocal(st.drv.items, saved);
      S.set('drv', st.drv);
      trkSync();
      render(); pendUI(); flushNow();
      return saved;
    });
  }

  function driverNext(a) {
    if (a.state === 'assigned') return a.trip_started ? { k: 'arrive', t: 'وصلت لموقع المحل' } : null;
    if (a.state === 'on_way') return { k: 'arrive', t: 'وصلت لموقع المحل' };
    if (a.state === 'arrived') return { k: 'result', t: isRet(a) ? 'استلام المرتجع' : 'تسليم الفاتورة' };
    return null;
  }

  /* ===================== التتبع المباشر: هاتف السائق يرسل موقعه أثناء الرحلة ===================== */
  var TRK = { on: false, watch: null, buf: [], lastFix: null, lastKeep: 0, lastPost: 0, timer: null, wake: null, err: '', weak: false, every: 15, sentAt: '', sending: false };
  function trkActive() { return (st.drv && st.drv.items || []).filter(function (a) { return a.trip_started && (a.state === 'on_way' || a.state === 'arrived'); }); }
  function trkShould() { return !!(st.user && st.user.role === 'driver' && trkActive().length); }
  function trkSync() { var want = trkShould(); if (want && !TRK.on) trkStart(); else if (!want && TRK.on) trkStop(); }
  function trkStart() {
    if (!navigator.geolocation) { TRK.err = 'unsupported'; return; }
    TRK.on = true; TRK.err = '';
    S.get('trk_buf').then(function (b) { if (b && b.length) TRK.buf = b.concat(TRK.buf).slice(-300); });
    TRK.watch = navigator.geolocation.watchPosition(trkFix, function (e) { TRK.err = e.code === 1 ? 'denied' : 'weak'; trkUI(); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
    TRK.timer = setInterval(trkSend, TRK.every * 1000);
    trkWake(); trkUI();
  }
  function trkStop() {
    TRK.on = false;
    if (TRK.watch !== null) navigator.geolocation.clearWatch(TRK.watch);
    TRK.watch = null; clearInterval(TRK.timer); trkSend();
    if (TRK.wake) { TRK.wake.release().catch(function () {}); TRK.wake = null; }
    trkUI();
  }
  function trkFix(p) {
    var c = p.coords;
    TRK.err = '';
    if (c.accuracy > 120) { TRK.weak = true; trkUI(); return; }
    TRK.weak = false;
    var pt = { lat: +c.latitude.toFixed(6), lng: +c.longitude.toFixed(6), acc: Math.round(c.accuracy), t: RK.nowStr(),
      spd: c.speed === null || c.speed === undefined || isNaN(c.speed) ? null : +c.speed.toFixed(1), hdg: c.heading === null || c.heading === undefined || isNaN(c.heading) ? null : Math.round(c.heading) };
    var l = TRK.lastFix; TRK.lastFix = pt;
    if (!l || distM(l.lat, l.lng, pt.lat, pt.lng) >= 15 || Date.now() - TRK.lastKeep > 60000) { TRK.buf.push(pt); TRK.lastKeep = Date.now(); }
    if (!TRK.lastPost) trkSend();
    trkUI();
  }
  function trkSend() {
    if (!TRK.buf.length) {
      if (TRK.on && TRK.lastFix && Date.now() - TRK.lastPost > 60000) TRK.buf.push(Object.assign({}, TRK.lastFix, { t: RK.nowStr() })); else return;
    }
    if (!navigator.onLine || TRK.sending) { S.set('trk_buf', TRK.buf.slice(-300)); return; }
    var pts = TRK.buf.slice(0, 200), act = trkActive()[0];
    TRK.sending = true;
    RK.api('loc_ping', { pts: pts, trip_id: act ? act.trip_id : '' }, { timeout: 20000 }).then(function (r) {
      if (r.ok) {
        TRK.buf = TRK.buf.slice(pts.length); TRK.sentAt = RK.nowStr(); TRK.lastPost = Date.now();
        if (r.every && r.every !== TRK.every && TRK.on) { TRK.every = r.every; clearInterval(TRK.timer); TRK.timer = setInterval(trkSend, TRK.every * 1000); }
      }
    }).catch(function () {}).then(function () { TRK.sending = false; S.set('trk_buf', TRK.buf.slice(-300)); trkUI(); });
  }
  // إبقاء الشاشة مضاءة أثناء الرحلة حتى لا يتوقف إرسال الموقع
  function trkWake() {
    if (!TRK.on || !('wakeLock' in navigator) || document.hidden || TRK.wake) return;
    navigator.wakeLock.request('screen').then(function (l) { TRK.wake = l; l.addEventListener('release', function () { TRK.wake = null; }); }).catch(function () {});
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && TRK.on) { trkWake(); trkSend(); } });
  logoutHooks.push(function () { if (TRK.on) trkStop(); TRK.buf = []; });
  function trkBarHTML() {
    if (!trkShould()) return '';
    return '<div class="trkbar" id="trkbar">' + trkBarInner() + '</div>';
  }
  function trkBarInner() {
    if (TRK.err === 'denied') return '<span class="tdot bad"></span><div><b>الموقع مغلق</b><small>اسمح للتطبيق بالوصول إلى موقعك من إعدادات المتصفح، حتى يرى المشرف والعميل أين وصلت.</small></div>';
    if (TRK.err === 'unsupported') return '<span class="tdot bad"></span><div><b>هاتفك لا يدعم تحديد الموقع</b></div>';
    if (!TRK.lastFix || TRK.weak || TRK.err === 'weak') return '<span class="tdot warn"></span><div><b>جارٍ تحديد موقعك…</b><small>' + (TRK.weak ? 'إشارة GPS ضعيفة، اقترب من النافذة أو اخرج للطريق' : 'تأكد أن GPS مفتوح') + '</small></div>';
    return '<span class="tdot ok"></span><div><b>التتبع المباشر يعمل</b><small>' + (TRK.sentAt ? 'آخر إرسال ' + TRK.sentAt.slice(11, 19) : 'جارٍ الإرسال…') + (TRK.buf.length > 3 ? ' · ' + TRK.buf.length + ' نقطة بانتظار الإنترنت' : '') +
      ' · أبقِ التطبيق مفتوحاً' + (TRK.wake ? ' (الشاشة لن تنطفئ)' : ' ولا تقفل الشاشة') + '</small></div>';
  }
  function trkUI() { var b = q('#trkbar'); if (b) b.innerHTML = trkBarInner(); }

  var VIEWS = {};
  VIEWS.my = {
    load: function (quiet) { return loadDriver(quiet); },
    html: function () {
      if (!st.drv) { loadDriver(false).then(render); return '<div class="loading"><span class="spin"></span> جارٍ تحميل فواتيرك…</div>'; }
      var items = st.drv.items || [];
      if (!items.length) return '<div class="card empty"><h2>لا توجد فواتير في عهدتك الآن</h2><p>عندما يعيّن لك المشرف فواتير ستظهر هنا. اسحب للتحديث أو اضغط زر التحديث.</p></div>';
      var trips = {};
      items.forEach(function (a) { var t = trips[a.trip_id] || (trips[a.trip_id] = { id: a.trip_id, code: a.trip_code, started: a.trip_started, n: 0 }); t.n++; if (a.trip_started) t.started = true; });
      var h = '';
      Object.keys(trips).forEach(function (k) {
        var t = trips[k];
        if (!t.started) h += '<div class="card"><h2>كشف ' + N(t.code) + '</h2><p class="muted" style="margin:0 0 12px">' + N(t.n) +
          ' فاتورة جاهزة. تأكد أن البضاعة كلها في الشاحنة ثم اضغط:</p><button class="btn accent big" data-start="' + esc(t.id) + '">' + ICON.truck + ' بدء الرحلة</button></div>';
      });
      var open = items.filter(function (a) { return ['assigned', 'on_way', 'arrived'].indexOf(a.state) >= 0; });
      var doneToday = items.filter(function (a) { return ['assigned', 'on_way', 'arrived'].indexOf(a.state) < 0; });
      h += trkBarHTML();
      h += '<div class="kpis"><div class="kpi"><span>بقي للتسليم</span><b>' + N(open.length) + '</b></div><div class="kpi"><span>انتهيت منها</span><b>' + N(doneToday.length) + '</b></div></div>';
      h += stopsHTML(open, true);
      if (doneToday.length) h += '<div class="sec-title"><h2>ما انتهيت منه</h2></div>' + stopsHTML(doneToday, false);
      return h;
    },
    bind: function (m) {
      trkSync();
      qa('[data-start]', m).forEach(function (b) {
        b.onclick = function () {
          confirmBox('بدء الرحلة', 'ستصبح كل فواتير هذا الكشف «في الطريق». هل خرجت من المخزن والبضاعة معك؟', 'نعم، بدء الرحلة').then(function (y) {
            if (!y) return;
            getPos({ timeout: 8000 }).then(function (p) {
              queueDriverStep(Object.assign({ kind: 'start_trip', trip_id: b.dataset.start }, p || {}), 'بدء الرحلة');
              toast('بدأت الرحلة. بالتوفيق');
            });
          });
        };
      });
      qa('[data-inv]', m).forEach(function (el) { el.onclick = function (e) { if (e.target.closest('[data-step]')) return; openDriverInv(el.dataset.inv); }; });
      qa('[data-step]', m).forEach(function (b) { b.onclick = function () { driverAct(b.dataset.step, b.dataset.k); }; });
    }
  };

  function stopsHTML(list, actions) {
    var stops = {}, order = [];
    list.forEach(function (a) {
      var k = a.trip_id + '|' + a.stop + '|' + a.cust_id;
      if (!stops[k]) { stops[k] = { stop: a.stop, cust: a.cust_name, loc: a.loc, items: [] }; order.push(k); }
      stops[k].items.push(a);
    });
    order.sort(function (x, y) { return (Number(stops[x].stop) - Number(stops[y].stop)); });
    return '<div class="list">' + order.map(function (k) {
      var s = stops[k];
      return '<div class="stop"><div class="stop-h"><span class="stop-n">' + N(s.stop) + '</span><div class="grow"><b>' + esc(s.cust) + '</b>' +
        '<div class="small muted">' + (s.loc ? 'موقع معتمد' + (s.loc.desc ? ' · ' + esc(s.loc.desc) : '') : 'لا يوجد موقع معتمد بعد') + '</div></div>' +
        (s.loc ? '<a class="btn sm ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + s.loc.lat + ',' + s.loc.lng + '">' + ICON.pin + ' الطريق</a>' : '') +
        '</div><div class="stop-b">' + s.items.map(function (a) {
          var nx = actions ? driverNext(a) : null;
          return '<div class="inv tap" data-inv="' + esc(a.rec) + '"><div class="grow"><b>' + (isRet(a) ? 'مرتجع ' : 'فاتورة ') + N(a.inv_number) + '</b> ' +
            (isRet(a) ? '<span class="badge b-ret">مرتجع</span> ' : '') + badge(a.state, a.state_ar) + (a._pending ? ' <span class="badge">لم تُرسل</span>' : '') + (a.arrive_ok === 'مرفوض' ? ' <span class="badge b-flag">رُفض الوصول</span>' : '') +
            '<div class="small muted">' + esc((a.lines || []).length) + ' صنف · إيصال ' + N(a.rec) + '</div></div>' +
            (nx ? '<button class="btn ' + (nx.k === 'arrive' ? 'primary' : 'accent') + ' sm" data-step="' + esc(a.rec) + '" data-k="' + nx.k + '">' + esc(nx.t) + '</button>' : '') + '</div>';
        }).join('') + '</div></div>';
    }).join('') + '</div>';
  }

  function itemsTable(lines, partial) {
    if (!lines || !lines.length) return '<p class="muted">لا توجد أصناف</p>';
    return '<div class="scroll-x"><table class="tbl"><thead><tr><th>الصنف</th><th>الكمية</th><th>هدية</th></tr></thead><tbody>' +
      lines.map(function (l) { return '<tr><td>' + esc(l.item) + '</td><td>' + N(num(l.qty)) + ' ' + esc(l.unit) + '</td><td>' + (Number(l.gift) ? N(num(l.gift)) : '') + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
  }

  function findDrv(rec) { return (st.drv.items || []).filter(function (x) { return x.rec === rec; })[0]; }

  function openDriverInv(rec) {
    var a = findDrv(rec);
    if (!a) return;
    var nx = driverNext(a);
    var tl = [['تعيين', a.assigned_at], ['في الطريق', a.start_at], ['الوصول', a.arrive_at], [STATE_AR[a.result] || 'النتيجة', a.result_at]]
      .filter(function (x) { return x[1]; }).map(function (x) { return '<div>' + esc(x[0]) + ' · ' + hm(x[1]) + '</div>'; }).join('');
    var s = sheet((isRet(a) ? 'مرتجع ' : 'فاتورة ') + a.inv_number, '<div class="row"><b class="grow">' + esc(a.cust_name) + '</b>' + badge(a.state, a.state_ar) + '</div>' +
      (a.approval === 'بانتظار الاعتماد' ? '<div class="msg warn">بانتظار قرار المشرف. تبقى البضاعة في عهدتك حتى يقرر.</div>' : '') +
      (a.loc && a.loc.photo ? '<div><div class="lbl">واجهة المحل المعتمدة</div><div class="photos"><div class="ph" data-ph="' + esc(a.loc.photo) + '" aria-label="واجهة المحل">…</div></div></div>' : '') +
      '<div><div class="lbl">الأصناف</div>' + itemsTable(a.lines) + '</div>' + (tl ? '<div class="timeline">' + tl + '</div>' : '') +
      (nx ? '<button class="btn big ' + (nx.k === 'arrive' ? 'primary' : 'accent') + '" data-go>' + esc(nx.t) + '</button>' : ''),
      function (s) { loadPhotos(s.el); var g = q('[data-go]', s.el); if (g) g.onclick = function () { s.close(); driverAct(rec, nx.k); }; });
    return s;
  }

  function driverAct(rec, k) {
    var a = findDrv(rec);
    if (!a || q('.sheet-bg')) return;   // نافذة مفتوحة بالفعل: نتجاهل الضغطة الثانية
    if (k === 'arrive') return doArrive(a);
    if (k === 'result') return chooseResult(a);
  }

  function doArrive(a) {
    var s = sheet('وصلت لموقع المحل', '<div class="loading"><span class="spin"></span> جارٍ تحديد موقعك…</div>');
    s.sticky = true;
    getPos({ timeout: 20000, maxAge: 10000 }).then(function (p) {
      var info = '', cls = 'info';
      if (!p) { info = 'تعذّر تحديد موقعك. تأكد أن الموقع (GPS) مفعّل. يمكنك المتابعة، وسيُعلَّم الوصول «بلا موقع» للمشرف.'; cls = 'warn'; }
      else if (a.loc) {
        var d = Math.round(distM(p.lat, p.lng, a.loc.lat, a.loc.lng)), lim = Number(st.settings.alert_m || 300);
        if (d <= lim) info = 'أنت عند المحل (على بعد ' + d + ' م من الموقع المعتمد).';
        else { info = 'أنت على بعد ' + num(d) + ' م من الموقع المعتمد للمحل. يمكنك المتابعة، لكن سيُنبَّه المشرف.'; cls = 'warn'; }
      } else info = 'لا يوجد موقع معتمد لهذا العميل. سيُسجّل موقعك الحالي كموقع مقترح ليراجعه المشرف.';
      s.el.innerHTML = '<b>' + esc(a.cust_name) + '</b><div class="msg ' + cls + '">' + esc(info) + '</div>' +
        (a.loc && a.loc.photo ? '<div><div class="lbl">هل أنت أمام هذا المحل؟</div><div class="photos"><div class="ph" data-ph="' + esc(a.loc.photo) + '">…</div></div></div>' : '') +
        '<button class="btn primary big" data-ok>تأكيد الوصول</button><button class="btn ghost" data-no>إلغاء</button>';
      loadPhotos(s.el);
      q('[data-no]', s.el).onclick = s.close;
      q('[data-ok]', s.el).onclick = function () {
        if (this.disabled) return;
        this.disabled = true;
        // كل فواتير العميل نفسه في المحطة نفسها تُسجّل وصولاً معاً
        var same = st.drv.items.filter(function (x) { return x.trip_id === a.trip_id && x.cust_id === a.cust_id && (x.state === 'on_way' || x.state === 'assigned') && x.trip_started; });
        if (!same.length) same = [a];
        var chain = Promise.resolve();
        same.forEach(function (x) { chain = chain.then(function () { return queueDriverStep(Object.assign({ kind: 'arrive', rec: x.rec }, p || {}), 'وصلت · ' + x.inv_number); }); });
        chain.then(function () { s.close(); setTimeout(function () { chooseResult(findDrv(a.rec)); }, 60); });
      };
    });
  }

  function chooseResult(a) {
    var ret = isRet(a);
    var s = sheet((ret ? 'مرتجع ' : 'فاتورة ') + a.inv_number + ' · النتيجة', '<b>' + esc(a.cust_name) + '</b>' +
      (ret ? '<button class="btn accent big" data-r="pickup">' + ICON.check + ' استلمت المرتجع</button>'
        : '<button class="btn accent big" data-r="deliver">' + ICON.check + ' تم التسليم كاملاً</button><button class="btn big" data-r="partial">تسليم جزئي (تلف أو نقص)</button>') +
      '<button class="btn danger big" data-r="fail">تعذّر ' + (ret ? 'استلام المرتجع' : 'التسليم') + '</button><button class="btn ghost" data-no>لاحقاً</button>',
      function (s) {
        q('[data-no]', s.el).onclick = s.close;
        qa('[data-r]', s.el).forEach(function (b) { b.onclick = function () { s.close(); resultFlow(a, b.dataset.r); }; });
      });
    return s;
  }

  var FAIL_REASONS = ['المحل مغلق', 'العميل رفض الاستلام', 'العنوان خاطئ', 'أخرى'];
  var PART_REASONS = ['تلف', 'نقص', 'رفض الصنف'];

  function resultFlow(a, kind) {
    var shots = {
      deliver: [['goods', 'صورة البضاعة عند المحل'], ['rcpt', 'صورة الإيصال الموقّع (النسخة العائدة)']],
      pickup: [['goods', 'صورة البضاعة المرتجعة'], ['rcpt', 'صورة إيصال المرتجع الموقّع']],
      partial: [['dmg', 'صورة التالف أو الناقص'], ['rcpt', 'صورة الإيصال وفيه النقص مكتوباً بيد العميل']],
      fail: [['front', 'صورة واجهة المحل']]
    }[kind];
    var title = { deliver: 'تم التسليم كاملاً', pickup: 'استلمت المرتجع', partial: 'تسليم جزئي', fail: 'تعذّر التسليم' }[kind];
    var got = {}, pos = null, reason = '', lines = [];
    var h = '<b>' + esc(a.cust_name) + ' · ' + (isRet(a) ? 'مرتجع ' : 'فاتورة ') + N(a.inv_number) + '</b>';
    if (kind === 'partial') {
      h += '<div class="lbl">ما الذي لم يُسلّم؟ اكتب الكمية الناقصة أو التالفة لكل صنف</div>' + (a.lines || []).map(function (l, i) {
        return '<div class="qtyrow"><div><b>' + esc(l.item) + '</b><div class="small muted">المُرسل: ' + N(num(l.qty)) + ' ' + esc(l.unit) + '</div></div>' +
          '<input class="input num" type="number" inputmode="decimal" min="0" max="' + esc(l.qty) + '" data-q="' + i + '" placeholder="0"></div>';
      }).join('') + '<div class="lbl">السبب</div><div class="chips" data-reasons>' + PART_REASONS.map(function (r) { return '<button class="chip" data-rs="' + esc(r) + '">' + esc(r) + '</button>'; }).join('') + '</div>';
    }
    if (kind === 'fail') {
      h += '<div class="lbl">السبب</div><div class="chips" data-reasons>' + FAIL_REASONS.map(function (r) { return '<button class="chip" data-rs="' + esc(r) + '">' + esc(r) + '</button>'; }).join('') + '</div>' +
        '<textarea class="input" id="fnote" placeholder="ملاحظة (اختياري)"></textarea>';
    }
    h += '<div class="lbl">الإثبات المطلوب (من الكاميرا مباشرة)</div>' + shots.map(function (x) {
      return '<div class="shot" data-shot="' + x[0] + '" role="button" tabindex="0"><div class="ico">' + ICON.cam + '</div><div class="grow"><b>' + esc(x[1]) + '</b><div class="small muted">اضغط لفتح الكاميرا</div></div></div>';
    }).join('') + '<div id="rerr"></div><button class="btn accent big" data-save disabled>حفظ</button>';
    var s = sheet(title, h, function (s) {
      s.sticky = true;
      getPos({ timeout: 15000 }).then(function (p) { pos = p; });
      qa('[data-rs]', s.el).forEach(function (b) { b.onclick = function () { qa('[data-rs]', s.el).forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); reason = b.dataset.rs; check(); }; });
      qa('[data-q]', s.el).forEach(function (inp) { inp.oninput = check; });
      qa('[data-shot]', s.el).forEach(function (box) {
        box.onclick = function () {
          var label = shots.filter(function (x) { return x[0] === box.dataset.shot; })[0][1];
          takePhoto({ label: label, inv: a.inv_number, who: st.user.name, pos: pos }).then(function (ph) {
            got[box.dataset.shot] = ph;
            box.classList.add('done');
            box.innerHTML = '<img src="' + ph.data + '" alt=""><div class="grow"><b>' + esc(label) + '</b><div class="small">✓ التُقطت · اضغط لإعادة الالتقاط</div></div>';
            check();
          }).catch(function (e) { toast(e.message, true); });
        };
      });
      function check() {
        lines = [];
        qa('[data-q]', s.el).forEach(function (inp) {
          var v = Number(inp.value || 0), l = a.lines[Number(inp.dataset.q)];
          if (v > 0) lines.push({ item: l.item, item_id: l.item_id, unit: l.unit, qty: Math.min(v, Number(l.qty)), sent: l.qty, reason: reason });
        });
        var okShots = shots.every(function (x) { return got[x[0]]; });
        var okReason = (kind !== 'fail' && kind !== 'partial') || reason;
        var okLines = kind !== 'partial' || lines.length;
        q('[data-save]', s.el).disabled = !(okShots && okReason && okLines);
      }
      q('[data-save]', s.el).onclick = function () {
        var b = q('[data-save]', s.el); busy(b, true);
        var ids = [];
        var chain = Promise.resolve();
        shots.forEach(function (x) {
          chain = chain.then(function () {
            var ph = got[x[0]];
            ids.push(ph.id);
            return RK.queuePhoto({ id: ph.id, rec: a.rec, kind: x[1], data: ph.data, lat: pos && pos.lat, lng: pos && pos.lng });
          });
        });
        chain.then(function () {
          var note = q('#fnote', s.el);
          return queueDriverStep(Object.assign({ kind: kind, rec: a.rec, photos: ids, reason: reason, note: note ? note.value.trim() : '',
            lines: kind === 'partial' ? lines : undefined }, pos || {}), title + ' · ' + a.inv_number);
        }).then(function () {
          s.close();
          toast(kind === 'deliver' || kind === 'pickup' ? 'تم الحفظ. لا تنسَ إعادة الإيصال الموقّع للمخزن' : 'تم الحفظ وأُرسل للمشرف للاعتماد');
        }).catch(function (e) { busy(b, false); q('#rerr', s.el).innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; });
      };
    });
    return s;
  }

  VIEWS.mysum = {
    load: function () {
      return loadDriver(true).then(function () {
        var d = today();
        return call('report_day', { from: d.slice(0, 8) + '01', to: d }).then(function (r) { st.myMonth = r; });
      });
    },
    html: function () {
      var items = (st.drv && st.drv.items) || [];
      var delivered = items.filter(function (a) { return ['delivered', 'closed'].indexOf(a.state) >= 0 && a.result === 'delivered'; }).length;
      var custody = items.filter(function (a) { return a.state !== 'closed'; });
      var rcpt = items.filter(function (a) { return ['delivered', 'partial', 'picked'].indexOf(a.result) >= 0 && !a.back_at; });
      var goods = items.filter(function (a) { return ['failed', 'to_store', 'partial'].indexOf(a.state) >= 0; });
      var rets = items.filter(function (a) { return a.state === 'picked'; });
      var h = '<div class="kpis"><div class="kpi"><span>سلّمت اليوم</span><b>' + N(delivered) + '</b></div><div class="kpi warn"><span>في عهدتي</span><b>' + N(custody.length) + '</b></div></div>';
      h += '<div class="card"><h2>ما يجب أن تعيده للمخزن</h2>' +
        listMini('إيصالات موقّعة', rcpt) + listMini('بضاعة لم تُسلّم', goods) + listMini('مرتجعات استلمتها', rets) + '</div>';
      var m = st.myMonth;
      if (m && m.drivers && m.drivers[0]) {
        var x = m.drivers[0];
        h += '<div class="card"><h2>هذا الشهر</h2><div class="kpis"><div class="kpi"><span>فواتير</span><b>' + N(x.total) + '</b></div><div class="kpi"><span>سُلّمت كاملة</span><b>' + N(x.delivered) +
          '</b></div><div class="kpi"><span>جزئي</span><b>' + N(x.partial) + '</b></div><div class="kpi"><span>تعذّر</span><b>' + N(x.failed) + '</b></div><div class="kpi"><span>مرتجعات</span><b>' + N(x.returns) + '</b></div></div></div>';
      }
      return h;
    }
  };

  function listMini(title, list) {
    return '<div style="margin-bottom:10px"><div class="lbl">' + esc(title) + ' (' + N(list.length) + ')</div>' +
      (list.length ? '<div class="small">' + list.map(function (a) { return 'فاتورة ' + N(a.inv_number) + ' · ' + esc(a.cust_name) + ' · إيصال ' + N(a.rec); }).join('<br>') + '</div>' : '<div class="small muted">لا شيء</div>') + '</div>';
  }

  /* ===================== المشرف: اليوم والتعيين ===================== */
  function loadBoard() {
    return call('board', { date: st.date || today() }).then(function (b) {
      st.board = b;
      if (!st.region || !b.regions.some(function (r) { return r.id === st.region; })) st.region = b.regions[0] && b.regions[0].id;
      tabCounts();
      return b;
    });
  }

  function tabCounts() {
    var b = st.board;
    if (!b) return;
    var set = function (tab, n) { (st.cnts = st.cnts || {})[tab] = n; var mo = q('[data-more] .cnt'); if (mo && !q('[data-tab="' + tab + '"]')) { mo.hidden = !n; mo.textContent = n; } var el = q('[data-tab="' + tab + '"] .cnt'); if (el) { el.hidden = !n; el.textContent = n; } };
    set('today', b.alerts.length);
    set('locs', (b.alerts.filter(function (a) { return a.kind === 'locs'; })[0] || {}).text ? Number(String(b.alerts.filter(function (a) { return a.kind === 'locs'; })[0].text).split(' ')[0]) : 0);
  }

  // الفروع: تظهر الشارة والفلتر فقط إذا كان الوكيل يقرأ أكثر من قاعدة
  function multiBr() { return false; }
  function brName(b, code) { var x = ((b && b.branches) || []).filter(function (y) { return y.code === (code || ''); })[0]; return x ? x.name : (code || ''); }
  function brBadge(b, code) { return multiBr(b) ? '<span class="badge b-br' + (code ? ' alt' : '') + '">' + esc(brName(b, code)) + '</span>' : ''; }

  function regionName(id) { var r = (st.board && st.board.regions || []).filter(function (x) { return x.id === id; })[0]; return r ? r.name : id; }

  VIEWS.today = {
    load: function () { return loadBoard(); },
    html: function () {
      var b = st.board;
      if (!b) return '<div class="loading"><span class="spin"></span> جارٍ التحميل…</div>';
      var reg = st.region;
      var ses = b.sessions.filter(function (s) { return s.region_id === reg; })[0] || {};
      var h = '';
      if (b.regions.length > 1) h += '<div class="chips">' + b.regions.map(function (r) { return '<button class="chip' + (r.id === reg ? ' on' : '') + '" data-reg="' + esc(r.id) + '">' + esc(r.name) + '</button>'; }).join('') + '</div>';
      var beat = b.agent.last_beat, late = beat && (Date.now() - parseTs(beat) > 10 * 60000);
      var isToday = b.date === today();
      h += '<div class="card"><div class="row"><div class="grow"><div class="daypick"><h2 style="margin:0">يوم العمل</h2>' + dateField('dpick', b.date, { label: 'تاريخ يوم العمل' }) +
        (isToday ? '<span class="badge b-on_way">اليوم</span>' : '<span class="badge b-partial">ليس اليوم</span><button class="btn sm ghost" data-today>العودة لليوم</button>') +
        (b.regions.length > 1 ? '<span class="muted">· ' + esc(regionName(reg)) + '</span>' : '') + '</div>' +
        '<div class="small ' + (late ? '' : 'muted') + '" style="' + (late ? 'color:var(--orange);font-weight:700' : '') + '">آخر مزامنة من سراج: ' + (beat ? hm(beat) + ' (' + N(dmy(beat)) + ')' : 'لا يوجد') + (late ? ' · تحقّق من الجهاز الرئيسي' : '') + '</div></div>';
      if (ses.open_other) h += '</div><div class="msg warn" style="margin-top:10px">يوم ' + N(ses.open_other.date) + ' ما زال مفتوحاً لهذه المنطقة. أغلقه أولاً من زر «إغلاق اليوم».</div><button class="btn danger" data-close="' + esc(ses.open_other.id) + '" style="margin-top:10px">إغلاق يوم ' + N(ses.open_other.date) + '</button>';
      else if (!ses.session) h += '<button class="btn accent" data-open>فتح يوم العمل</button></div>';
      else if (ses.session.status === 'مفتوحة') h += '<span class="badge b-delivered">مفتوح</span><button class="btn sm danger" data-close="' + esc(ses.session.id) + '">إغلاق اليوم</button></div>';
      else h += '<span class="badge">مُغلق</span>' + (st.user.role === 'manager' ? '<button class="btn sm" data-reopen>إعادة فتح</button>' : '') + '</div>';
      h += '</div>';
      // ملخص اليوم في نظرة واحدة
      var act = b.active.filter(function (a) { return a.region_id === reg; });
      var onRoad = act.filter(function (a) { return ['assigned', 'on_way', 'arrived'].indexOf(a.state) >= 0; }).length;
      var doneN = act.length - onRoad, waitN = b.pending.filter(function (p) { return p.region_id === reg; }).length;
      h += '<div class="kpis day-kpis"><div class="kpi' + (waitN ? ' warn' : '') + '"><span>بانتظار التعيين</span><b class="num">' + waitN + '</b></div>' +
        '<div class="kpi"><span>مع السائقين الآن</span><b class="num">' + onRoad + '</b></div>' +
        '<div class="kpi"><span>انتهت اليوم</span><b class="num">' + doneN + '</b></div>' +
        '<div class="kpi' + (b.alerts.length ? ' warn' : '') + '"><span>تنبيهات</span><b class="num">' + b.alerts.length + '</b></div></div>';
      var al = b.alerts;
      if (al.length) h += '<div class="card"><h2>تنبيهات تحتاج انتباهك (' + N(al.length) + ')</h2><div class="list">' + al.map(function (x, i) {
        var act = '';
        if (x.kind === 'approval' || x.kind === 'far' || x.kind === 'siraj') act = '<button class="btn sm" data-asg="' + esc(x.rec) + '">فتح</button>';
        if (x.kind === 'arrive') act = '<button class="btn sm" data-asg="' + esc(x.rec) + '">التفاصيل</button><button class="btn sm primary" data-arok="' + esc(x.rec) + '">اعتماد</button>';
        if (x.kind === 'device') act = '<button class="btn sm primary" data-dev="' + esc(x.user_id) + '">اعتماد</button><button class="btn sm ghost" data-devno="' + esc(x.user_id) + '">رفض</button>';
        if (x.kind === 'locs') act = '<button class="btn sm" data-goto="locs">مراجعة</button>';
        return '<div class="alert' + (x.kind === 'siraj' || x.kind === 'far' || x.flag ? ' err' : '') + '"><span class="t">' + esc(x.text) + '</span>' + act + '</div>';
      }).join('') + '</div>' + (function () {
        var clean = al.filter(function (x) { return x.kind === 'arrive' && !x.flag; });
        return clean.length > 1 ? '<button class="btn primary" data-arall style="margin-top:10px">اعتماد كل الوصولات السليمة (' + clean.length + ')</button>' : '';
      })() + '</div>';
      var open = ses.session && ses.session.status === 'مفتوحة';
      var pend = b.pending.filter(function (p) { return p.region_id === reg; });
      var pm = b.perms || {}, canBulk = pm.bulk || pm.del, selOK = open || canBulk;
      var oldN = pend.filter(function (p) { return p.old; }).length;
      if (oldN && canBulk) h += '<div class="card bulk-card"><div class="row"><div class="grow"><h2 style="margin:0">فواتير من أيام سابقة (' + N(oldN) + ')</h2>' +
        '<div class="small muted">عالجها دفعة واحدة: حدّدها ثم اختر الإجراء من الشريط أسفل الشاشة.</div></div><button class="btn" data-selold>تحديد كل فواتير الأيام السابقة</button></div></div>';
      h += '<div class="sec-title"><h2>بانتظار التعيين (' + N(pend.length) + ')</h2>' + (b.processed && b.processed.length && pm.bulk ? '<button class="btn sm ghost" data-proc>المعالَجة سابقاً (' + N(b.processed.length) + ')</button>' : '') + '</div>';
      if (!open) h += '<div class="msg info">افتح يوم العمل لتتمكن من تعيين الفواتير للسائقين.</div>';
      var drivers = b.drivers.filter(function (d) { return d.regions === '*' || d.regions.split(',').indexOf(reg) >= 0; });
      if (open) {
        var sug = suggestedDriver(pend);
        h += '<div class="card"><div class="lbl" style="margin-bottom:8px">1. اختر السائق</div>' + (drivers.length ? '<div class="chips">' + drivers.map(function (d) {
          var n = b.active.filter(function (a) { return a.driver_id === d.id && ['assigned', 'on_way', 'arrived'].indexOf(a.state) >= 0; }).length;
          return '<button class="chip' + (st.driverSel === d.id ? ' on' : '') + '" data-drv="' + esc(d.id) + '">' + esc(d.name) + (d.truck ? ' <small>' + esc(d.truck) + '</small>' : '') +
            (n ? ' <small>· معه ' + n + '</small>' : '') + (sug === d.id ? ' <small>★ آخر من ذهب لهذا العميل</small>' : '') + '</button>';
        }).join('') + '</div>' : '<div class="msg warn">لا يوجد سائقون في هذه المنطقة. ' + (st.user.role === 'manager' ? 'أضفهم من «المستخدمون».' : 'اطلب من المدير إضافتهم.') + '</div>') + '</div>';
        h += '<div class="row"><input class="input grow" id="fq" placeholder="بحث برقم الفاتورة أو اسم العميل" value="' + esc(st.q) + '"><div class="chips">' +
          [['all', 'الكل'], ['sale', 'مبيع'], ['ret', 'مرتجع']].map(function (k) { return '<button class="chip' + (st.kindF === k[0] ? ' on' : '') + '" data-kf="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div>' +
          (multiBr(b) ? '<div class="chips">' + [{ code: '*', name: 'كل الفروع' }].concat(b.branches).map(function (x) { return '<button class="chip' + ((st.brF || '*') === x.code ? ' on' : '') + '" data-brf="' + esc(x.code) + '">' + esc(x.name) + '</button>'; }).join('') + '</div>' : '') + '</div>';
      }
      var shown = pend.filter(function (p) {
        if (st.kindF === 'sale' && p.kind === 'مرتجع مبيع') return false;
        if (st.kindF === 'ret' && p.kind !== 'مرتجع مبيع') return false;
        if (multiBr(b) && st.brF && st.brF !== '*' && (p.src || '') !== st.brF) return false;
        return !st.q || (p.number + ' ' + p.cust_name).indexOf(st.q) >= 0;
      });
      if (!shown.length) h += '<div class="card empty">' + (pend.length ? 'لا نتائج للبحث' : 'لا توجد فواتير بانتظار التعيين. الفواتير الجديدة من سراج تظهر هنا خلال دقيقة تقريباً.') + '</div>';
      else {
        var groups = {}, order = [];
        shown.sort(function (x, y) { return (y.old - x.old) || (x.cust_name > y.cust_name ? 1 : -1) || (x.dt > y.dt ? 1 : -1); });
        shown.forEach(function (p) { if (!groups[p.cust_id]) { groups[p.cust_id] = []; order.push(p.cust_id); } groups[p.cust_id].push(p); });
        h += '<div class="list">' + order.map(function (cid) {
          var g = groups[cid];
          return g.map(function (p) {
            return '<label class="item tap' + (st.sel[p.id] ? ' sel' : '') + (p.old ? ' old' : '') + '">' + (selOK ? '<input type="checkbox" data-sel="' + esc(p.id) + '"' + (st.sel[p.id] ? ' checked' : '') + '>' : '') +
              '<div class="main"><b>' + esc(p.cust_name) + '</b><div class="meta">' + (p.kind === 'مرتجع مبيع' ? '<span class="badge b-ret">مرتجع</span>' : '<span class="badge">مبيع</span>') +
              brBadge(b, p.src) + '<span>فاتورة ' + N(p.number) + '</span><span>' + hm(p.dt) + (p.old ? ' · ' + N(dmy(p.dt)) : '') + '</span>' + (p.net !== null && p.net !== undefined ? '<span>' + N(num(p.net)) + ' د.ل</span>' : '') +
              (p.old ? '<span class="badge b-partial">من يوم سابق</span>' : '') + (p.status === 'معدّلة في سراج' ? '<span class="badge b-flag">معدّلة في سراج</span>' : '') + '</div>' +
              '<div class="small muted">' + esc(p.items) + '</div></div></label>';
          }).join('');
        }).join('') + '</div>';
      }
      var n = Object.keys(st.sel).filter(function (k) { return st.sel[k]; }).length;
      if (n && (open || canBulk)) {
        var dn = (b.drivers.filter(function (d) { return d.id === st.driverSel; })[0] || {}).name;
        h += '<div class="selbar"><div class="selbar-in"><div class="selbar-h"><b>' + N(n) + ' فاتورة محددة</b><button class="btn sm ghost" data-unsel>إلغاء التحديد</button></div>' +
          (open ? '<button class="btn accent big" data-assign' + (dn ? '' : ' disabled') + '>' + (dn ? 'تعيين ' + n + ' فاتورة لـ ' + esc(dn) : 'اختر السائق لتعيين ' + n + ' فاتورة') + '</button>' : '') +
          (canBulk ? '<div class="row selbar-acts">' + (pm.bulk ? '<button class="btn sm" data-bulk="outside">مسلّمة خارج المنظومة</button><button class="btn sm" data-bulk="exclude">استبعاد من اليوم</button>' : '') +
            (pm.del ? '<button class="btn sm danger" data-bulk="delete">حذف</button>' : '') + '</div>' : '') + '</div></div>';
      }
      return h;
    },
    bind: function (m) {
      var b = st.board;
      if (!b) return;
      qa('[data-reg]', m).forEach(function (x) { x.onclick = function () { st.region = x.dataset.reg; st.sel = {}; render(); }; });
      qa('[data-brf]', m).forEach(function (x) { x.onclick = function () { st.brF = x.dataset.brf; st.sel = {}; render(); }; });
      var so = q('[data-selold]', m);
      if (so) so.onclick = function () { b.pending.forEach(function (p) { if (p.old && p.region_id === st.region) st.sel[p.id] = true; }); render(); };
      var us = q('[data-unsel]', m);
      if (us) us.onclick = function () { st.sel = {}; render(); };
      qa('[data-bulk]', m).forEach(function (x) {
        x.onclick = function () {
          var act = x.dataset.bulk, ids = Object.keys(st.sel).filter(function (k) { return st.sel[k]; });
          var T = { outside: ['اعتبارها مسلّمة خارج المنظومة', 'تُغلق ' + ids.length + ' فاتورة على أنها سُلّمت بطريقة أخرى، وتخرج من «بانتظار التعيين». يمكن استرجاعها لاحقاً.', ['سُلّمت يدوياً', 'استلمها العميل من المخزن', 'سُلّمت قبل تشغيل المنظومة']],
            exclude: ['استبعاد من اليوم', 'تخرج ' + ids.length + ' فاتورة من «بانتظار التعيين» ولا تُعيَّن. يمكن استرجاعها لاحقاً من «المعالَجة سابقاً».', ['مؤجلة', 'العميل طلب التأجيل', 'تنتظر مراجعة']],
            'delete': ['حذف من المنظومة', 'تُحذف ' + ids.length + ' فاتورة من منظومة الفواتير نهائياً ولا تعود حتى لو أعاد الوكيل إرسالها. سراج لا يتأثر. لا يمكن التراجع.', ['فاتورة مكررة', 'فاتورة تجريبية', 'أُلغيت في سراج']] }[act];
          askReason(T[0], 'السبب (يُحفظ في سجل التدقيق)', { intro: T[1], choices: T[2], ok: act === 'delete' ? 'حذف نهائياً' : 'تنفيذ' }).then(function (r) {
            if (!r) return;
            busy(x, true);
            call('inv_bulk', { act: act, ids: ids, reason: r }).then(function (res) { st.sel = {}; toast('تم: ' + T[0] + ' (' + res.n + ' فاتورة)'); return loadBoard(); }).then(render).catch(function (e) { busy(x, false); toast(e.message, true); });
          });
        };
      });
      var pr = q('[data-proc]', m);
      if (pr) pr.onclick = function () {
        var list = b.processed, picked = {};
        sheet('الفواتير المعالَجة سابقاً', '<p class="muted small" style="margin:0 0 10px">الفواتير المستبعدة أو المسلّمة خارج المنظومة. حدّد ما تريد إعادته إلى «بانتظار التعيين».</p><div class="list">' + list.map(function (x) {
          return '<label class="item tap"><input type="checkbox" data-rp2="' + esc(x.id) + '"><div class="main"><b>' + esc(x.cust_name) + '</b><div class="meta"><span>فاتورة ' + N(x.number) + '</span><span>' + N(dmy(x.dt)) + '</span>' +
            '<span class="badge' + (x.action === 'مستبعدة' ? ' b-partial' : ' b-delivered') + '">' + esc(x.action) + '</span></div><div class="small muted">' + esc(x.reason) + ' · ' + esc(x.by) + ' · ' + N(dmy(x.at)) + '</div></div></label>';
        }).join('') + '</div><button class="btn primary big" data-restore disabled>إعادة المحدد إلى «بانتظار التعيين»</button>', function (s2) {
          var btn = q('[data-restore]', s2.el);
          qa('[data-rp2]', s2.el).forEach(function (c) { c.onchange = function () { picked[c.dataset.rp2] = c.checked; btn.disabled = !Object.keys(picked).some(function (k) { return picked[k]; }); }; });
          btn.onclick = function () {
            var ids = Object.keys(picked).filter(function (k) { return picked[k]; });
            busy(btn, true);
            call('inv_restore', { ids: ids }).then(function (r) { s2.close(); toast('أُعيدت ' + r.n + ' فاتورة'); return loadBoard(); }).then(render).catch(function (e) { busy(btn, false); toast(e.message, true); });
          };
        });
      };
      var dp = q('#dpick', m);
      if (dp) dp.onchange = function () { if (!dp.value) return; st.date = dp.value; st.sel = {}; st.board = null; render(); loadBoard().then(render).catch(function (e) { toast(e.message, true); }); };
      var td = q('[data-today]', m);
      if (td) td.onclick = function () { st.date = today(); st.sel = {}; st.board = null; render(); loadBoard().then(render).catch(function (e) { toast(e.message, true); }); };
      var o = q('[data-open]', m);
      if (o) o.onclick = function () {
        var go = function () { busy(o, true); call('session_open', { region_id: st.region, date: b.date }).then(function () { toast('فُتح يوم العمل ' + dmy(b.date)); return loadBoard(); }).then(render).catch(function (e) { busy(o, false); toast(e.message, true); }); };
        if (b.date === today()) go();
        else confirmBox('فتح يوم عمل', 'ستفتح يوم العمل بتاريخ <b>' + esc(dlong(b.date)) + '</b> وليس اليوم. هل أنت متأكد؟', 'نعم، افتحه').then(function (y) { if (y) go(); });
      };
      var ro = q('[data-reopen]', m);
      if (ro) ro.onclick = function () { askReason('إعادة فتح اليوم', 'سبب إعادة الفتح').then(function (r) { if (r) call('session_open', { region_id: st.region, date: b.date, reason: r }).then(loadBoard).then(render).catch(function (e) { toast(e.message, true); }); }); };
      qa('[data-close]', m).forEach(function (x) { x.onclick = function () { closeDay(x.dataset.close); }; });
      qa('[data-asg]', m).forEach(function (x) { x.onclick = function () { openAsg(x.dataset.asg); }; });
      qa('[data-arok]', m).forEach(function (x) { x.onclick = function () { busy(x, true); call('arrive_decide', { rec: x.dataset.arok, approve: true }).then(function () { toast('اعتُمد الوصول'); return loadBoard(); }).then(render).catch(function (e) { busy(x, false); toast(e.message, true); }); }; });
      var arall = q('[data-arall]', m);
      if (arall) arall.onclick = function () {
        var recs = b.alerts.filter(function (x) { return x.kind === 'arrive' && !x.flag; }).map(function (x) { return x.rec; });
        busy(arall, true);
        call('arrive_decide', { recs: recs, approve: true }).then(function (r) { toast('اعتُمد ' + r.done + ' وصول'); return loadBoard(); }).then(render).catch(function (e) { busy(arall, false); toast(e.message, true); });
      };
      qa('[data-goto]', m).forEach(function (x) { x.onclick = function () { st.tab = x.dataset.goto; render(); refresh(false); }; });
      qa('[data-dev]', m).forEach(function (x) { x.onclick = function () { call('approve_device', { user_id: x.dataset.dev }).then(function () { toast('اعتُمد الهاتف الجديد'); return loadBoard(); }).then(render).catch(function (e) { toast(e.message, true); }); }; });
      qa('[data-devno]', m).forEach(function (x) { x.onclick = function () { askReason('رفض الهاتف الجديد', 'السبب').then(function (r) { if (r) call('approve_device', { user_id: x.dataset.devno, reject: true, reason: r }).then(loadBoard).then(render).catch(function (e) { toast(e.message, true); }); }); }; });
      qa('[data-drv]', m).forEach(function (x) { x.onclick = function () { st.driverSel = st.driverSel === x.dataset.drv ? null : x.dataset.drv; render(); }; });
      qa('[data-kf]', m).forEach(function (x) { x.onclick = function () { st.kindF = x.dataset.kf; render(); }; });
      var fq = q('#fq', m);
      if (fq) fq.oninput = function () { st.q = fq.value.trim(); var pos = fq.selectionStart; render(); var f2 = q('#fq'); f2.focus(); f2.setSelectionRange(pos, pos); };
      qa('[data-sel]', m).forEach(function (x) { x.onchange = function () { st.sel[x.dataset.sel] = x.checked; render(); }; });
      var as = q('[data-assign]', m);
      if (as) as.onclick = function () {
        var ids = Object.keys(st.sel).filter(function (k) { return st.sel[k]; });
        busy(as, true);
        call('assign', { driver_id: st.driverSel, invoice_ids: ids }).then(function (r) {
          st.sel = {};
          return loadBoard().then(function () {
            render();
            sheet('تم التعيين', '<div class="msg ok">عُيّنت ' + r.recs.length + ' فاتورة وظهرت في هاتف السائق.</div><p style="margin:0">اطبع الآن إيصالات العملاء وكشف الرحلة لتخرج مع البضاعة.</p>' +
              r.trips.map(function (t) { return '<button class="btn primary big" data-pt="' + esc(t) + '">' + ICON.print + ' طباعة الإيصالات والكشف</button>'; }).join('') +
              '<button class="btn ghost" data-x2>لاحقاً من «الكشوف»</button>', function (s) {
              qa('[data-pt]', s.el).forEach(function (p) { p.onclick = function () { s.close(); printTrip(p.dataset.pt); }; });
              q('[data-x2]', s.el).onclick = s.close;
            });
          });
        }).catch(function (e) { busy(as, false); toast(e.message, true); });
      };
    }
  };

  function suggestedDriver(pend) {
    var ids = Object.keys(st.sel).filter(function (k) { return st.sel[k]; });
    if (!ids.length) return null;
    var p = pend.filter(function (x) { return x.id === ids[0]; })[0];
    return p ? st.board.last_driver[p.cust_id] : null;
  }

  function parseTs(s) {
    var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 2, +m[5], +(m[6] || 0)) : 0;
  }

  function closeDay(sid) {
    var b = st.board;
    var reg = (b.sessions.filter(function (s) { return (s.session && s.session.id === sid) || (s.open_other && s.open_other.id === sid); })[0] || {}).region_id || st.region;
    var mine = b.active.filter(function (a) { return a.region_id === reg && a.state !== 'canceled'; });
    var notClosed = mine.filter(function (a) { return a.state !== 'closed'; });
    var noBack = mine.filter(function (a) { return ['delivered', 'partial', 'picked'].indexOf(a.result) >= 0 && !a.back_at; });
    var wait = mine.filter(function (a) { return a.approval === 'بانتظار الاعتماد' || a.arrive_ok === 'بانتظار'; });
    var stale = b.alerts.filter(function (x) { return x.kind === 'stale'; });
    var row = function (t, list, bad) { return '<div class="alert' + (bad && list.length ? ' err' : '') + '" style="' + (list.length ? '' : 'background:var(--ok-soft)') + '"><span class="t">' + esc(t) + ': ' + list.length + '</span></div>'; };
    sheet('إغلاق يوم العمل', '<p style="margin:0">قائمة التدقيق قبل الإغلاق:</p>' + row('فواتير لم تُغلق (تُرحّل لليوم التالي في عهدة السائق)', notClosed) +
      row('إيصالات موقّعة لم تعد بعد', noBack) + row('طلبات ووصولات بانتظار اعتمادك', wait, true) + row('هواتف لم ترسل بياناتها', stale) +
      (wait.length ? '<div class="msg err">لا يمكن الإغلاق قبل البت في الطلبات بانتظار الاعتماد.</div>' : '<div class="msg info">بعد الإغلاق يُنشأ ملخص اليوم ويُقفل، وأي تراجع بعده للمدير فقط.</div>') +
      '<button class="btn danger big" data-c' + (wait.length ? ' disabled' : '') + '>إغلاق اليوم</button>', function (s) {
      var c = q('[data-c]', s.el);
      c.onclick = function () {
        busy(c, true);
        call('session_close', { session_id: sid }).then(function (r) {
          s.close();
          var x = r.summary;
          sheet('أُغلق اليوم', '<div class="kpis"><div class="kpi"><span>عُيّنت</span><b>' + N(x.assigned) + '</b></div><div class="kpi"><span>سُلّمت</span><b>' + N(x.delivered) + '</b></div><div class="kpi"><span>جزئي</span><b>' + N(x.partial) +
            '</b></div><div class="kpi"><span>تعذّر</span><b>' + N(x.failed) + '</b></div><div class="kpi"><span>مرتجعات</span><b>' + N(x.returns) + '</b></div><div class="kpi warn"><span>مرحّلة</span><b>' + N(x.open) + '</b></div></div>');
          return loadBoard().then(render);
        }).catch(function (e) { busy(c, false); toast(e.message, true); });
      };
    });
  }

  /* ===================== المتابعة وتفاصيل الفاتورة ===================== */
  VIEWS.follow = {
    load: function () { return loadBoard(); },
    html: function () {
      var b = st.board;
      if (!b) return '<div class="loading"><span class="spin"></span> جارٍ التحميل…</div>';
      var f = st.follow;
      var list = b.active.filter(function (a) {
        if (a.state === 'canceled' && f.state !== 'all') return false;
        if (f.driver && a.driver_id !== f.driver) return false;
        if (f.state === 'open') return a.state !== 'closed';
        if (f.state === 'wait') return a.approval === 'بانتظار الاعتماد' || a.arrive_ok === 'بانتظار' || a.state === 'to_store' || a.state === 'picked';
        if (f.state === 'flag') return a.arrive_flag || a.siraj;
        return true;
      });
      var cnt = function (fn) { return b.active.filter(fn).length; };
      var h = '<div class="kpis"><div class="kpi"><span>قيد الانتظار</span><b>' + N(cnt(function (a) { return a.state === 'assigned'; })) + '</b></div>' +
        '<div class="kpi"><span>في الطريق</span><b>' + N(cnt(function (a) { return a.state === 'on_way' || a.state === 'arrived'; })) + '</b></div>' +
        '<div class="kpi"><span>تم التسليم</span><b>' + N(cnt(function (a) { return a.result === 'delivered'; })) + '</b></div>' +
        '<div class="kpi warn"><span>تحتاج إجراء</span><b>' + N(cnt(function (a) { return a.approval === 'بانتظار الاعتماد' || a.arrive_ok === 'بانتظار'; })) + '</b></div></div>';
      h += '<div class="row"><select class="input grow" id="fd" aria-label="السائق"><option value="">كل السائقين</option>' + b.drivers.map(function (d) { return '<option value="' + esc(d.id) + '"' + (f.driver === d.id ? ' selected' : '') + '>' + esc(d.name) + '</option>'; }).join('') + '</select>' +
        '<select class="input grow" id="fs" aria-label="الحالة">' + [['open', 'المفتوحة'], ['wait', 'تحتاج إجراء'], ['flag', 'عليها تنبيه'], ['all', 'الكل']].map(function (o) { return '<option value="' + o[0] + '"' + (f.state === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>';
      if (!list.length) return h + '<div class="card empty">لا توجد فواتير</div>';
      h += '<div class="list">' + list.map(function (a) {
        return '<div class="item tap" data-asg="' + esc(a.rec) + '"><div class="main"><b>' + esc(a.cust_name) + '</b><div class="meta">' + (isRet(a) ? '<span class="badge b-ret">مرتجع</span>' : '') +
          '<span>فاتورة ' + N(a.inv_number) + '</span><span>' + esc(a.driver_name) + '</span><span>إيصال ' + N(a.rec) + '</span>' + (a.carried ? '<span class="badge b-partial">مرحّلة ' + N(a.carried) + '</span>' : '') + '</div></div>' +
          '<div style="text-align:end">' + badge(a.state, a.state_ar) + (a.arrive_flag ? '<br><span class="badge b-flag">' + esc(a.arrive_flag) + '</span>' : '') + (a.siraj ? '<br><span class="badge b-flag">' + esc(a.siraj) + '</span>' : '') +
          (a.approval === 'بانتظار الاعتماد' ? '<br><span class="badge b-partial">بانتظار الاعتماد</span>' : '') +
          (a.arrive_ok === 'بانتظار' ? '<br><span class="badge b-partial">وصول بانتظار الاعتماد</span>' : a.arrive_ok === 'مرفوض' ? '<br><span class="badge b-flag">وصول مرفوض</span>' : '') +
          '<div class="small muted">' + hm(a.updated) + '</div></div></div>';
      }).join('') + '</div>';
      return h;
    },
    bind: function (m) {
      var fd = q('#fd', m), fs = q('#fs', m);
      if (fd) fd.onchange = function () { st.follow.driver = fd.value; render(); };
      if (fs) fs.onchange = function () { st.follow.state = fs.value; render(); };
      qa('[data-asg]', m).forEach(function (x) { x.onclick = function () { openAsg(x.dataset.asg); }; });
    }
  };

  function openAsg(rec) {
    var a = (st.board.active || []).filter(function (x) { return x.rec === rec; })[0];
    if (!a) { toast('الفاتورة غير موجودة في القائمة الحالية', true); return; }
    var sup = st.user.role === 'manager' || st.user.role === 'supervisor';
    var tl = [['تعيين لـ ' + a.driver_name, a.assigned_at], ['في الطريق', a.start_at],
      ['الوصول' + (a.arrive_dist !== '' && a.arrive_dist !== undefined ? ' · ' + a.arrive_dist + ' م من المحل' : '') + (a.arrive_flag ? ' · ' + a.arrive_flag : ''), a.arrive_at],
      [(STATE_AR[a.result] || 'النتيجة') + (a.reason ? ' · ' + a.reason : '') + (a.note ? ' · ' + a.note : ''), a.result_at],
      ['قرار المشرف: ' + a.decision, a.decision && a.updated], ['عاد الإيصال الموقّع', a.back_at], ['تأكيد المخزن', a.store_at], ['أُغلقت', a.closed_at]]
      .filter(function (x) { return x[1]; }).map(function (x) { return '<div>' + esc(x[0]) + ' · ' + hm(x[1]) + ' <span class="muted small">' + N(dmy(x[1])) + '</span></div>'; }).join('');
    var acts = '';
    var arr = '';
    if (a.arrive_at) {
      var okTxt = { 'بانتظار': '<span class="badge b-partial">بانتظار اعتمادك</span>', 'معتمد': '<span class="badge b-delivered">معتمد</span>',
        'مرفوض': '<span class="badge b-flag">مرفوض</span>', 'تلقائي': '<span class="badge b-delivered">داخل النطاق</span>' }[a.arrive_ok] || '';
      arr = '<div class="card" style="padding:12px"><div class="row"><b class="grow">الوصول ' + hm(a.arrive_at) + '</b>' + okTxt + '</div>' +
        '<div class="small" style="margin-top:4px">' + (a.arrive_flag === 'بلا موقع' ? 'لم يرسل الهاتف موقعاً (GPS مغلق أو ضعيف)' :
          a.arrive_dist !== '' ? 'على بعد <b class="num">' + N(num(a.arrive_dist)) + ' م</b> من الموقع المعتمد للمحل' + (a.arrive_flag ? ' · <b style="color:var(--err)">' + esc(a.arrive_flag) + '</b>' : '') :
          'لا يوجد موقع معتمد لهذا العميل، وسُجّل موقع السائق كموقع مقترح') + (a.arrive_acc ? ' · دقة ±' + N(a.arrive_acc) + ' م' : '') + '</div>' +
        (a.arrive_by ? '<div class="small muted">' + (a.arrive_ok === 'مرفوض' ? 'رفضه ' : 'اعتمده ') + esc(a.arrive_by) + (a.arrive_note ? ' · ' + esc(a.arrive_note) : '') + '</div>' : '') +
        '<div class="row" style="margin-top:8px">' + (a.arrive_lat ? '<a class="btn sm ghost" target="_blank" rel="noopener" href="https://www.google.com/maps?q=' + a.arrive_lat + ',' + a.arrive_lng + '">' + ICON.pin + ' موقع السائق</a>' : '') +
        (sup && a.arrive_ok === 'بانتظار' ? '<button class="btn sm primary" data-aok>اعتماد الوصول</button><button class="btn sm danger" data-ano>رفض الوصول</button>' : '') + '</div></div>';
    }
    if (sup) {
      if (a.approval === 'بانتظار الاعتماد') {
        var opts = a.state === 'failed' ? [['retry', 'إعادة محاولة التسليم'], ['to_store', 'إرجاع للمخزن']]
          : [['to_store', 'إرجاع الناقص/التالف للمخزن'], ['destroy', 'إتلاف'], ['accept', 'قبول بلا إرجاع'], ['field_check', 'تحقق ميداني']];
        acts += '<div class="lbl">قرارك</div><div class="row">' + opts.map(function (o) { return '<button class="btn sm' + (o[0] === 'to_store' || o[0] === 'retry' ? ' primary' : '') + '" data-dec="' + o[0] + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>';
      }
      if (a.state === 'assigned') acts += '<div class="row"><button class="btn sm" data-move>نقل لسائق آخر</button><button class="btn sm danger" data-cancel>إلغاء التعيين</button></div>';
      if (['on_way', 'arrived', 'delivered', 'partial', 'failed', 'picked', 'closed'].indexOf(a.state) >= 0) acts += '<button class="btn sm ghost" data-undo>تراجع خطوة للخلف (بسبب)</button>';
      if (a.state !== 'canceled') acts += '<button class="btn sm ghost" data-rp>' + ICON.print + ' إعادة طباعة الإيصال</button>';
    }
    if (st.board.perms && st.board.perms.del) acts += '<button class="btn sm danger" data-adel>حذف التعيين والإيصال نهائياً</button>';
    if ((TABS[st.user.role] || []).some(function (t) { return t[0] === 'map'; }) && (['assigned', 'on_way', 'arrived'].indexOf(a.state) >= 0 || (a.start_at && String(a.start_at).slice(0, 10) === today())))
      acts = '<div class="row"><button class="btn sm primary" data-onmap>' + ICON.pin + ' تتبع على الخريطة</button>' + (['assigned', 'on_way', 'arrived'].indexOf(a.state) >= 0 && canShareTrack() ? '<button class="btn sm" data-trklink>رابط تتبع للعميل</button>' : '') + '</div>' + acts;
    sheet((isRet(a) ? 'مرتجع ' : 'فاتورة ') + a.inv_number + ' · إيصال ' + a.rec,
      '<div class="row"><b class="grow">' + esc(a.cust_name) + '</b>' + badge(a.state, a.state_ar) + '</div>' +
      (a.siraj ? '<div class="msg err">' + esc(a.siraj) + ' بعد تعيينها. راجع الفاتورة في سراج قبل أي قرار.</div>' : '') +
      (a.net !== undefined && a.net !== '' ? '<div class="small muted">الصافي: ' + N(num(a.net)) + ' د.ل</div>' : '') +
      '<div class="timeline">' + tl + '</div>' + arr +
      (a.partial && a.partial.length ? '<div><div class="lbl">النقص/التالف</div>' + itemsTable(a.partial) + '</div>' : '') +
      (a.photos && a.photos.length ? '<div><div class="lbl">الصور</div><div class="photos">' + a.photos.map(function (p) { return '<div class="ph" data-ph="' + esc(p) + '">…</div>'; }).join('') + '</div></div>' : '') +
      '<div><div class="lbl">الأصناف</div>' + itemsTable(a.lines) + '</div>' + acts,
      function (s) {
        loadPhotos(s.el);
        var done = function (msg) { s.close(); toast(msg); loadBoard().then(render); };
        var fail = function (e) { toast(e.message, true); };
        qa('[data-dec]', s.el).forEach(function (b) {
          b.onclick = function () {
            var d = b.dataset.dec;
            var p = d === 'retry' || d === 'to_store' ? askReason('القرار', 'ملاحظة (اختياري)', { optional: true }) : askReason('القرار', 'السبب');
            p.then(function (r) { if (r === null) return; call('decide', { rec: a.rec, decision: d, reason: r }).then(function () { done('تم حفظ القرار'); }).catch(fail); });
          };
        });
        var aok = q('[data-aok]', s.el), ano = q('[data-ano]', s.el);
        if (aok) aok.onclick = function () { busy(aok, true); call('arrive_decide', { rec: a.rec, approve: true }).then(function () { done('اعتُمد الوصول'); }).catch(function (e) { busy(aok, false); fail(e); }); };
        if (ano) ano.onclick = function () {
          askReason('رفض الوصول', 'سبب الرفض (يظهر للمدير وفي تقرير السائق)', { choices: ['السائق لم يكن عند المحل', 'الموقع بعيد جداً', 'وصول بلا موقع'] })
            .then(function (r) { if (r) call('arrive_decide', { rec: a.rec, reason: r }).then(function () { done('سُجّل رفض الوصول'); }).catch(fail); });
        };
        var u = q('[data-undo]', s.el);
        if (u) u.onclick = function () { askReason('تراجع خطوة', 'سبب التراجع (إلزامي ويظهر للمدير)', { choices: ['ضغط «وصلت» بالخطأ', 'سجّل النتيجة بالخطأ', 'تصحيح بعد التحقق'] }).then(function (r) { if (r) call('undo', { rec: a.rec, reason: r }).then(function () { done('تم التراجع'); }).catch(fail); }); };
        var ad = q('[data-adel]', s.el);
        if (ad) ad.onclick = function () {
          askReason('حذف التعيين والإيصال', 'سبب الحذف (يُحفظ في سجل التدقيق)', { intro: 'يُحذف الإيصال ' + a.rec + ' وكل خطواته وصوره من المنظومة، وتعود الفاتورة ' + a.inv_number + ' إلى «بانتظار التعيين». لا يمكن التراجع عن الحذف. سراج لا يتأثر.', ok: 'حذف نهائياً' })
            .then(function (r) { if (r) call('asg_delete', { rec: a.rec, reason: r }).then(function () { done('حُذف التعيين وعادت الفاتورة للانتظار'); }).catch(fail); });
        };
        var c = q('[data-cancel]', s.el);
        if (c) c.onclick = function () { askReason('إلغاء التعيين', 'السبب').then(function (r) { if (r) call('reassign', { rec: a.rec, reason: r }).then(function () { done('أُلغي التعيين وعادت الفاتورة للانتظار'); }).catch(fail); }); };
        var mv = q('[data-move]', s.el);
        if (mv) mv.onclick = function () {
          var ds = st.board.drivers.filter(function (d) { return d.id !== a.driver_id; });
          s.close();
          sheet('نقل لسائق آخر', '<div class="msg info">يُلغى الإيصال القديم ويُطبع إيصال جديد.</div><div class="chips">' + ds.map(function (d) { return '<button class="chip" data-to="' + esc(d.id) + '">' + esc(d.name) + '</button>'; }).join('') + '</div>', function (s2) {
            qa('[data-to]', s2.el).forEach(function (b) {
              b.onclick = function () {
                askReason('نقل الفاتورة', 'سبب النقل').then(function (r) {
                  if (!r) return;
                  call('reassign', { rec: a.rec, driver_id: b.dataset.to, reason: r }).then(function (res) {
                    s2.close(); toast('نُقلت الفاتورة. اطبع الإيصال الجديد');
                    loadBoard().then(render);
                    if (res.trips && res.trips[0]) printTrip(res.trips[0], res.recs[0]);
                  }).catch(fail);
                });
              };
            });
          });
        };
        var rp = q('[data-rp]', s.el);
        if (rp) rp.onclick = function () { printTrip(a.trip_id, a.rec); };
        var om = q('[data-onmap]', s.el); if (om) om.onclick = function () { s.close(); openOnMap(a); };
        var tlk = q('[data-trklink]', s.el); if (tlk) tlk.onclick = function () { shareTrack(a.rec); };
      });
  }

  /* ===================== خريطة التتبع المباشر (المدير والمشرف وأمين المخزن) ===================== */
  var MV = { map: null, el: null, data: null, markers: {}, sel: null, focusRec: null, layer: null, timer: null, day: null, fitted: false, routeAt: 0, routeKey: '', route: null, err: '' };
  var DONE_ST = { delivered: 1, partial: 1, picked: 1, closed: 1, to_store: 1 };
  function mvAge(d) { var t = d.pos && d.pos.t ? parseTs(d.pos.t) : 0, a = d.at ? parseTs(d.at) : t; return a ? (Date.now() - a) / 60000 : 1e9; }
  function mvStatus(d) {
    if (!d.pos) return 'none';
    var age = mvAge(d), stale = (MV.data && MV.data.stale_min) || 30;
    if (!MV.data.today || age > stale) return 'off';
    if (age > 3) return 'idle';
    return d.pos.spd !== null && d.pos.spd !== undefined && d.pos.spd < 0.8 ? 'idle' : 'live';
  }
  function mvNext(d) { return d.stops.filter(function (s) { return s.state === 'on_way' || s.state === 'assigned' || s.state === 'arrived'; })[0] || null; }
  function mvStatusText(d) {
    var s = mvStatus(d);
    if (s === 'none') return d.stops.some(function (x) { return x.start_at; }) ? 'لم يرسل موقعاً بعد' : 'لم يبدأ الرحلة';
    if (s === 'off') return 'آخر موقع ' + hm(d.at || d.pos.t);
    if (s === 'idle') return 'متوقف' + (mvAge(d) > 3 ? ' · آخر تحديث ' + hm(d.at) : '');
    return 'يتحرك' + (d.pos.spd ? ' · ' + Math.round(d.pos.spd * 3.6) + ' كم/س' : '');
  }
  VIEWS.map = {
    load: function () { return Promise.resolve(false); },
    html: function () {
      return '<div class="mapwrap" id="mapwrap"><div id="lmap" class="lmap"></div><div class="mpanel" id="mpanel"><div class="loading"><span class="spin"></span> جارٍ تحميل الخريطة…</div></div></div>';
    },
    bind: function (m) {
      var hd = q('header.top'), pb = q('#pb');
      if (hd) document.documentElement.style.setProperty('--hdr', (hd.offsetHeight + (pb && !pb.hidden ? pb.offsetHeight : 0)) + 'px');
      RKMap.load().then(function () {
        if (MV.map) { MV.map.remove(); MV.map = null; }
        MV.el = q('#lmap', m); MV.map = RKMap.create(MV.el); MV.markers = {}; MV.layer = L.layerGroup().addTo(MV.map); MV.fitted = false; MV.route = null; MV.routeKey = '';
        MV.map.on('click', function () { if (MV.sel && !MV.focusRec) { MV.sel = null; mvDraw(); } });
        setTimeout(function () { if (MV.map) MV.map.invalidateSize(); }, 200);
        mvTick();
      }).catch(function (e) { var p = q('#mpanel', m); if (p) p.innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; });
    }
  };
  function mvTick() {
    clearTimeout(MV.timer);
    if (st.tab !== 'map' || !MV.map || !document.body.contains(MV.el)) return;
    call('track', { date: MV.day || undefined, full: MV.day ? 1 : undefined }).then(function (r) {
      if (st.tab !== 'map' || !document.body.contains(MV.el)) return;
      MV.data = r; MV.err = ''; mvDraw();
      if (r.today && !document.hidden) MV.timer = setTimeout(mvTick, (r.every || 15) * 1000);
    }).catch(function (e) { MV.err = e.message; mvPanel(); MV.timer = setTimeout(mvTick, 30000); });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && st.tab === 'map' && MV.map) mvTick(); });
  function mvDraw() {
    var D = MV.data, map = MV.map;
    if (!D || !map) return;
    var seen = {};
    D.drivers.forEach(function (d) {
      if (!d.pos) return;
      seen[d.id] = 1;
      var stt = mvStatus(d), tr = d.trail || [], hdg = d.pos.hdg;
      if ((hdg === null || hdg === undefined) && tr.length > 1) { var a = tr[tr.length - 2], b = tr[tr.length - 1]; hdg = RKMap.bearing(a[0], a[1], b[0], b[1]); }
      var icon = RKMap.truckIcon({ status: stt, heading: hdg, label: d.name, selected: MV.sel === d.id });
      var mk = MV.markers[d.id];
      if (!mk) { mk = MV.markers[d.id] = L.marker([d.pos.lat, d.pos.lng], { icon: icon, zIndexOffset: 1000 }).addTo(map); mk.on('click', function (e) { L.DomEvent.stopPropagation(e); MV.sel = d.id; MV.focusRec = null; MV.fitted = false; mvDraw(); }); }
      else { mk.setIcon(icon); RKMap.animate(mk, [d.pos.lat, d.pos.lng], 1500); }
      mk.setZIndexOffset(MV.sel === d.id ? 2000 : 1000);
    });
    Object.keys(MV.markers).forEach(function (id) { if (!seen[id]) { map.removeLayer(MV.markers[id]); delete MV.markers[id]; } });
    MV.layer.clearLayers();
    var sel = MV.sel && D.drivers.filter(function (d) { return d.id === MV.sel; })[0], fit = [];
    if (sel) {
      var tr2 = (sel.trail || []).map(function (p) { return [p[0], p[1]]; });
      if (tr2.length > 1) L.polyline(tr2, { color: '#7E9CC6', weight: 5, opacity: .85, lineCap: 'round', lineJoin: 'round' }).addTo(MV.layer);
      var nx = mvNext(sel), seenC = {};
      sel.stops.forEach(function (s) {
        var ll = s.loc ? [s.loc.lat, s.loc.lng] : s.alat ? [s.alat, s.alng] : null;
        if (!ll || seenC[s.cust_id]) return;
        seenC[s.cust_id] = 1;
        var kind = DONE_ST[s.state] ? 'done' : s.state === 'failed' ? 'bad' : nx && nx.cust_id === s.cust_id ? 'next' : 'wait';
        var m = L.marker(ll, { icon: RKMap.stopIcon(s.stop || '•', kind, kind === 'next' || s.rec === MV.focusRec), zIndexOffset: kind === 'next' ? 900 : 500 }).addTo(MV.layer);
        m.bindTooltip(esc(s.cust) + ' · ' + esc(s.state_ar), { direction: 'top', offset: [0, -30] });
        fit.push(ll);
      });
      if (sel.pos) fit.push([sel.pos.lat, sel.pos.lng]);
      // خط الطريق إلى المحطة التالية والوقت المتوقع
      if (sel.pos && nx && nx.loc && D.today && mvStatus(sel) !== 'off') {
        var key = sel.id + nx.cust_id;
        if (key !== MV.routeKey || Date.now() - MV.routeAt > 45000) {
          MV.routeKey = key; MV.routeAt = Date.now();
          RKMap.route([sel.pos.lat, sel.pos.lng], [nx.loc.lat, nx.loc.lng]).then(function (r) { MV.route = r; mvDraw(); });
        }
        if (MV.route && MV.routeKey === key) L.polyline(MV.route.line, { color: '#0C4CA2', weight: 6, opacity: .9, dashArray: MV.route.approx ? '8 10' : null, lineCap: 'round' }).addTo(MV.layer);
      } else MV.route = null;
    } else D.drivers.forEach(function (d) { if (d.pos) fit.push([d.pos.lat, d.pos.lng]); });
    mvPanel();
    if (!MV.fitted && fit.length) {
      // نترك مكان لوحة السائقين حتى لا تغطي السيارة أو المحلات
      var pn = q('#mpanel'), phone = window.innerWidth <= 760, pw = pn ? pn.offsetWidth : 0, ph = pn ? pn.offsetHeight : 0;
      var o = phone ? { paddingTopLeft: [30, 30], paddingBottomRight: [30, ph + 20], maxZoom: 15 } : { paddingTopLeft: [pw + 40, 40], paddingBottomRight: [40, 40], maxZoom: 15 };
      if (fit.length === 1) map.setView(fit[0], 14); else map.fitBounds(fit, o);
      MV.fitted = true;
    }
  }
  function mvPanel() {
    var p = q('#mpanel'), D = MV.data;
    if (!p) return;
    var head = '<div class="mp-head"><b class="grow">' + (MV.sel ? '' : 'السائقون على الخريطة') + '</b>' + dateField('mvday', MV.day || today(), { max: today(), short: true, label: 'اليوم', cls: 'sm' }) + '</div>';
    if (MV.err && !D) { p.innerHTML = head + '<div class="msg err">' + esc(MV.err) + '</div>'; mvBindPanel(p); return; }
    if (!D) return;
    var sel = MV.sel && D.drivers.filter(function (d) { return d.id === MV.sel; })[0];
    if (sel) {
      var nx = mvNext(sel), done = sel.stops.filter(function (s) { return DONE_ST[s.state]; }).length, stt = mvStatus(sel);
      p.innerHTML = '<div class="mp-head"><button class="iconbtn" data-mvback aria-label="كل السائقين">→</button><div class="grow"><b>' + esc(sel.name) + '</b><div class="small muted">' + esc(sel.truck) + '</div></div>' +
        (sel.phone ? '<a class="btn sm ghost" href="tel:' + esc(sel.phone) + '">اتصال</a>' : '') + '</div>' +
        '<div class="mp-stat"><span class="sdot s-' + stt + '"></span><span>' + esc(mvStatusText(sel)) + '</span><span class="muted">· سلّم ' + N(done) + ' من ' + N(sel.stops.length) + '</span></div>' +
        (nx ? '<div class="mp-next"><div class="small muted">المحطة التالية</div><b>' + esc(nx.cust) + '</b>' +
          (MV.route && D.today && stt !== 'off' ? '<div class="mp-eta">' + esc(RKMap.etaText(MV.route.sec)) + ' <span>' + (MV.route.approx ? 'تقريباً · ' : '') + esc(RKMap.kmText(MV.route.m)) + '</span></div>' : nx.loc ? '' : '<div class="small muted">لا يوجد موقع معتمد لهذا المحل</div>') + '</div>' : '') +
        '<div class="mp-stops">' + sel.stops.map(function (s) {
          var kind = DONE_ST[s.state] ? 'done' : s.state === 'failed' ? 'bad' : nx && nx.cust_id === s.cust_id ? 'next' : 'wait';
          return '<div class="mp-s' + (s.rec === MV.focusRec ? ' foc' : '') + '" data-mvs="' + esc(s.rec) + '"><span class="mp-n k-' + kind + '">' + N(s.stop || '•') + '</span><div class="grow"><b>' + esc(s.cust) + '</b>' +
            '<div class="small muted">' + (s.kind === 'مرتجع مبيع' ? 'مرتجع ' : 'فاتورة ') + N(s.inv) + ' · ' + esc(s.state_ar) + (s.result_at ? ' ' + hm(s.result_at) : s.arrive_at ? ' ' + hm(s.arrive_at) : '') + '</div></div>' +
            (D.today && !DONE_ST[s.state] && s.state !== 'failed' && canShareTrack() ? '<button class="iconbtn mp-sh" data-share="' + esc(s.rec) + '" title="رابط تتبع للعميل" aria-label="رابط تتبع للعميل"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg></button>' : '') + '</div>';
        }).join('') + '</div>';
    } else {
      var list = D.drivers.slice().sort(function (a, b) { var o = { live: 0, idle: 1, off: 2, none: 3 }; return o[mvStatus(a)] - o[mvStatus(b)]; });
      p.innerHTML = head + (list.length ? '<div class="mp-list">' + list.map(function (d) {
        var stt = mvStatus(d), done = d.stops.filter(function (s) { return DONE_ST[s.state]; }).length, nx = mvNext(d);
        return '<button class="mp-d" data-mvd="' + esc(d.id) + '"><span class="sdot s-' + stt + '"></span><div class="grow"><b>' + esc(d.name) + '</b><div class="small muted">' + esc(mvStatusText(d)) + '</div>' +
          (nx ? '<div class="small">التالي: ' + esc(nx.cust) + '</div>' : '') + '</div><span class="mp-prog">' + N(done) + '/' + N(d.stops.length) + '</span></button>';
      }).join('') + '</div>' : '<div class="msg info">لا يوجد سائقون في رحلات ' + (D.today ? 'الآن' : 'في هذا اليوم') + '. يظهر السائق هنا عند ضغط «بدء الرحلة» في هاتفه.</div>') +
        '<div class="mp-legend small muted"><span><i class="sdot s-live"></i>يتحرك</span><span><i class="sdot s-idle"></i>متوقف</span><span><i class="sdot s-off"></i>غير متصل</span></div>';
    }
    mvBindPanel(p);
  }
  function mvBindPanel(p) {
    var dy = q('#mvday', p);
    if (dy) dy.onchange = function () { MV.day = dy.value && dy.value !== today() ? dy.value : null; MV.sel = null; MV.fitted = false; mvTick(); };
    var bk = q('[data-mvback]', p); if (bk) bk.onclick = function () { MV.sel = null; MV.focusRec = null; MV.fitted = false; mvDraw(); };
    qa('[data-mvd]', p).forEach(function (b) { b.onclick = function () { MV.sel = b.dataset.mvd; MV.focusRec = null; MV.fitted = false; mvDraw(); }; });
    qa('[data-mvs]', p).forEach(function (b) {
      b.onclick = function (e) {
        if (e.target.closest('[data-share]')) return;
        var d = MV.data.drivers.filter(function (x) { return x.id === MV.sel; })[0], s = d && d.stops.filter(function (x) { return x.rec === b.dataset.mvs; })[0];
        var ll = s && (s.loc ? [s.loc.lat, s.loc.lng] : s.alat ? [s.alat, s.alng] : null);
        MV.focusRec = s ? s.rec : null; if (ll) MV.map.setView(ll, 16); mvDraw();
      };
    });
    qa('[data-share]', p).forEach(function (b) { b.onclick = function () { shareTrack(b.dataset.share); }; });
  }
  function canShareTrack() { return st.user && ['manager', 'supervisor', 'storekeeper'].indexOf(st.user.role) >= 0; }
  // رابط تتبع يُرسل للعميل (واتساب أو أي تطبيق)
  function shareTrack(rec) {
    call('track_link', { rec: rec }).then(function (r) {
      var url = new URL('track.html?t=' + encodeURIComponent(r.token), location.href).href;
      var text = 'راكان: تابع وصول طلبيتك على الخريطة مباشرة';
      sheet('رابط تتبع للعميل', '<p style="margin:0">أرسل هذا الرابط للعميل ليرى السائق على الخريطة والوقت المتوقع للوصول. لا يظهر فيه أي مبلغ، وينتهي بعد 3 أيام.</p>' +
        '<input class="input ltr" readonly value="' + esc(url) + '" id="trku">' +
        '<div class="row"><a class="btn primary grow" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(text + '\n' + url) + '">واتساب</a>' +
        (navigator.share ? '<button class="btn grow" data-sh>مشاركة</button>' : '') + '<button class="btn ghost" data-cp>نسخ</button><a class="btn ghost" target="_blank" rel="noopener" href="' + esc(url) + '">فتح</a></div>', function (s) {
        var sh = q('[data-sh]', s.el); if (sh) sh.onclick = function () { navigator.share({ title: 'تتبع طلبيتك', text: text, url: url }).catch(function () {}); };
        q('[data-cp]', s.el).onclick = function () { var i = q('#trku', s.el); i.select(); (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { toast('نُسخ الرابط'); }).catch(function () { document.execCommand('copy'); toast('نُسخ الرابط'); }); };
      });
    }).catch(function (e) { toast(e.message, true); });
  }
  function openOnMap(a) { MV.sel = a.driver_id; MV.focusRec = a.rec; MV.fitted = false; MV.day = null; st.tab = 'map'; render(); }

  /* ===================== الكشوف والطباعة ===================== */
  VIEWS.trips = {
    load: function () { return loadBoard(); },
    html: function () {
      var b = st.board;
      if (!b) return '<div class="loading"><span class="spin"></span></div>';
      if (!b.trips.length) return '<div class="card empty">لا توجد كشوف اليوم بعد. تُنشأ تلقائياً عند تعيين الفواتير لسائق.</div>';
      return '<div class="list">' + b.trips.map(function (t) {
        var n = b.active.filter(function (a) { return a.trip_id === t.id && a.state !== 'canceled'; }).length;
        return '<div class="item"><div class="main"><b>' + N(t.code) + ' · ' + esc(t.driver_name) + '</b><div class="meta"><span>' + N(n) + ' فاتورة</span>' + (t.truck ? '<span>' + esc(t.truck) + '</span>' : '') +
          '<span>' + (t.started_at ? 'خرج ' + hm(t.started_at) : 'لم يخرج بعد') + '</span><span>' + (t.print_count ? 'طُبع ' + N(t.print_count) + ' مرة' : '<b style="color:var(--orange)">لم يُطبع</b>') + '</span></div></div>' +
          '<button class="btn sm primary" data-pt="' + esc(t.id) + '">' + ICON.print + ' طباعة</button>' + (b.perms && b.perms.del ? '<button class="btn sm danger" data-tdel="' + esc(t.id) + '" aria-label="حذف الكشف">حذف</button>' : '') + '</div>';
      }).join('') + '</div>';
    },
    bind: function (m) {
      qa('[data-pt]', m).forEach(function (b) { b.onclick = function () { printTrip(b.dataset.pt); }; });
      qa('[data-tdel]', m).forEach(function (b) {
        b.onclick = function () {
          var t = st.board.trips.filter(function (x) { return x.id === b.dataset.tdel; })[0];
          var n = st.board.active.filter(function (a) { return a.trip_id === t.id; }).length;
          askReason('حذف الكشف ' + t.code, 'سبب الحذف (يُحفظ في سجل التدقيق)', { intro: 'يُحذف الكشف وكل إيصالاته (' + n + ') وخطوات السائق فيها، وتعود فواتيره إلى «بانتظار التعيين». لا يمكن التراجع عن الحذف.', ok: 'حذف الكشف نهائياً' })
            .then(function (r) { if (r) call('trip_delete', { id: t.id, reason: r }).then(function () { toast('حُذف الكشف'); return loadBoard(); }).then(render).catch(function (e) { toast(e.message, true); }); });
        };
      });
    }
  };

  function qrSvg(text, cell) {
    var qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: cell || 3, margin: 0, scalable: true });
  }

  function printTrip(tripId, rec) {
    call('print', { trip_id: tripId, rec: rec }).then(function (r) {
      var t = r.trip, P = document.getElementById('print');
      var amt = r.show_amounts;
      var head = function (title, copy) {
        return '<div class="p-head"><img src="logo.png" alt=""><div class="t"><b>' + esc(title) + '</b><span>' + esc(r.company) + '</span></div><span class="p-copy">' + esc(copy) + '</span></div>';
      };
      var meta = function (x) {
        return '<div class="p-meta"><div><span>رقم الإيصال</span><b class="num">' + esc(x.rec) + '</b></div><div><span>فاتورة سراج</span><b class="num">' + esc(x.inv_number) + '</b></div>' +
          '<div><span>التاريخ</span><b class="num">' + esc(dmy(x.dt)) + '</b></div><div style="grid-column:span 2"><span>العميل</span><b>' + esc(x.cust_name) + '</b></div>' +
          '<div><span>المحطة</span><b class="num">' + esc(x.stop) + '</b></div><div><span>السائق</span><b>' + esc(t.driver_name) + '</b></div><div><span>الشاحنة</span><b>' + esc(t.truck || '—') + '</b></div>' +
          '<div><span>الكشف</span><b class="num">' + esc(t.code) + '</b></div></div>';
      };
      var tbl = function (x) {
        return '<table class="p-tbl"><thead><tr><th>#</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>هدية</th>' + (amt ? '<th>السعر</th><th>القيمة</th>' : '') + '</tr></thead><tbody>' +
          x.lines.map(function (l, i) {
            return '<tr><td class="n">' + (i + 1) + '</td><td>' + esc(l.item) + '</td><td>' + esc(l.unit) + '</td><td class="n">' + num(l.qty) + '</td><td class="n">' + (Number(l.gift) ? num(l.gift) : '') + '</td>' +
              (amt ? '<td class="n">' + num(l.price) + '</td><td class="n">' + num(l.total) + '</td>' : '') + '</tr>';
          }).join('') + (amt ? '<tr><td colspan="6"><b>الصافي</b></td><td class="n"><b>' + num(x.net) + '</b></td></tr>' : '') + '</tbody></table>';
      };
      var rp = r.reprint ? '<div class="p-reprint">نسخة معادة</div>' : '';
      var pages = r.receipts.map(function (x) {
        var title = x.kind === 'مرتجع مبيع' ? 'إيصال استلام مرتجع' : 'إيصال استلام بضاعة';
        return '<div class="p-page"><div class="p-half">' + rp + head(title, 'نسخة العميل') + meta(x) + tbl(x) +
          '<div class="p-foot"><div class="p-note">احتفظ بهذه النسخة. إذا وجدت نقصاً أو تلفاً فاكتبه بخط يدك على النسخة الأخرى قبل التوقيع.</div></div></div>' +
          '<div class="p-half"><span class="p-cut">✂ النسخة العائدة: تُوقّع وتُختم وتعود مع السائق</span>' + rp + head(title, 'النسخة العائدة') + meta(x) + tbl(x) +
          '<div class="p-foot"><div class="p-sign"><div>اسم المستلم</div><div>التوقيع</div><div>ختم العميل</div></div><div class="p-qr">' + qrSvg(x.qr, 3) +
          '<div>رمز التحقق</div><div class="p-code">' + esc(x.code4) + '</div></div></div><div class="p-note">النقص أو التلف (يكتبه العميل): ..............................................................................................</div></div></div>';
      }).join('');
      if (!rec) {
        var rows = '', stop = null, totQ = 0, totN = 0;
        r.receipts.forEach(function (x) {
          if (x.stop !== stop) { stop = x.stop; rows += '<tr class="p-stop"><td colspan="6">المحطة ' + esc(x.stop) + ' · ' + esc(x.cust_name) + '</td></tr>'; }
          var q2 = x.lines.reduce(function (s, l) { return s + Number(l.qty || 0); }, 0);
          totQ += q2; totN += Number(x.net || 0);
          rows += '<tr><td class="n">' + esc(x.rec) + '</td><td class="n">' + esc(x.inv_number) + '</td><td>' + (x.kind === 'مرتجع مبيع' ? '<b>مرتجع: يُستلم من العميل</b>' : 'مبيع') + '</td><td>' +
            x.lines.map(function (l) { return esc(l.item) + ' × ' + num(l.qty) + ' ' + esc(l.unit); }).join('<br>') + '</td><td class="n">' + num(q2) + '</td><td class="n">' + num(x.net) + '</td></tr>';
        });
        pages += '<div class="p-page"><div class="p-trip">' + rp + head('كشف الرحلة الداخلي', 'داخلي · لا يُعطى للعميل') +
          '<div class="p-meta"><div><span>رقم الكشف</span><b class="num">' + esc(t.code) + '</b></div><div><span>السائق</span><b>' + esc(t.driver_name) + '</b></div><div><span>الشاحنة</span><b>' + esc(t.truck || '—') + '</b></div>' +
          '<div><span>التاريخ</span><b class="num">' + esc(String(t.created_at).slice(0, 16)) + '</b></div><div><span>عدد الإيصالات</span><b class="num">' + r.receipts.length + '</b></div><div><span>طبعه</span><b>' + esc(r.printed_by) + '</b></div></div>' +
          '<table class="p-tbl"><thead><tr><th>الإيصال</th><th>الفاتورة</th><th>النوع</th><th>الأصناف والكميات</th><th>الكمية</th><th>القيمة</th></tr></thead><tbody>' + rows +
          '<tr><td colspan="4"><b>الإجمالي</b></td><td class="n"><b>' + num(totQ) + '</b></td><td class="n"><b>' + num(totN) + '</b></td></tr></tbody></table>' +
          '<div class="p-foot"><div class="p-sign"><div>السائق</div><div>أمين المخزن</div><div>المشرف</div></div><div class="p-qr">' + qrSvg(t.code, 3) + '</div></div></div></div>';
      }
      P.innerHTML = pages;
      var imgs = qa('img', P);
      Promise.all(imgs.map(function (i) { return i.complete ? 1 : new Promise(function (ok) { i.onload = i.onerror = ok; }); })).then(function () {
        setTimeout(function () { window.print(); }, 150);
      });
      if (st.board) loadBoard().then(function () { if (st.tab === 'trips') render(); });
    }).catch(function (e) { toast(e.message, true); });
  }

  /* ===================== الإيصالات العائدة والمخزن ===================== */
  VIEWS.back = {
    load: function () { return call('store_list').then(function (r) { st.store = r.items; st.rcpts = r.receipts || []; }); },
    html: function () {
      var h = '<div class="card"><h2>استلام الإيصالات الموقّعة</h2><p class="muted small" style="margin:0 0 10px">امسح رمز QR على النسخة العائدة، أو اكتب رقم الإيصال ورمز التحقق المطبوع بجانبه.</p>' +
        '<button class="btn primary big" data-scan>' + ICON.qr + ' مسح رمز QR</button><div class="row" style="margin-top:12px"><input class="input grow num" id="br" placeholder="رقم الإيصال مثل 00184-2" inputmode="text">' +
        '<input class="input num" id="bc" placeholder="الرمز" inputmode="numeric" maxlength="4" style="max-width:110px"><button class="btn" data-man>تأكيد</button></div><div id="bres"></div></div>';
      var rc = st.rcpts;
      h += '<div class="sec-title"><h2>إيصالات موقّعة بانتظار العودة' + (rc ? ' (' + N(rc.length) + ')' : '') + '</h2></div>';
      if (!rc) h += '<div class="loading"><span class="spin"></span></div>';
      else if (!rc.length) h += '<div class="card empty">لا توجد إيصالات معلّقة. كل ما سلّمه السائقون عادت إيصالاته.</div>';
      else {
        var byD = {}, ord = [];
        rc.forEach(function (a) { if (!byD[a.driver_name]) { byD[a.driver_name] = []; ord.push(a.driver_name); } byD[a.driver_name].push(a); });
        h += ord.map(function (dn) {
          return '<div class="card"><h3>' + esc(dn) + ' (' + N(byD[dn].length) + ')</h3><div class="list">' + byD[dn].map(function (a) {
            return '<div class="item"><div class="main"><b>' + esc(a.cust_name) + '</b><div class="meta">' + (isRet(a) ? '<span class="badge b-ret">مرتجع</span>' : '') + badge(a.result, STATE_AR[a.result]) +
              '<span>فاتورة ' + N(a.inv_number) + '</span><span>إيصال ' + N(a.rec) + '</span><span>' + hm(a.result_at) + ' ' + N(dmy(a.result_at)) + '</span>' +
              (a.carried ? '<span class="badge b-partial">مرحّلة ' + N(a.carried) + '</span>' : '') + '</div></div><button class="btn sm primary" data-rb="' + esc(a.rec) + '">استلام الإيصال</button></div>';
          }).join('') + '</div></div>';
        }).join('');
      }
      var items = st.store;
      h += '<div class="sec-title"><h2>بضاعة عائدة بانتظار تأكيد المخزن' + (items ? ' (' + N(items.length) + ')' : '') + '</h2></div>';
      if (!items) h += '<div class="loading"><span class="spin"></span></div>';
      else if (!items.length) h += '<div class="card empty">لا توجد بضاعة عائدة بانتظار التأكيد</div>';
      else h += '<div class="list">' + items.map(function (a) {
        return '<div class="item tap" data-st="' + esc(a.rec) + '"><div class="main"><b>' + esc(a.cust_name) + '</b><div class="meta">' + (isRet(a) ? '<span class="badge b-ret">مرتجع</span>' : '<span class="badge b-to_store">عائدة</span>') +
          '<span>فاتورة ' + N(a.inv_number) + '</span><span>' + esc(a.driver_name) + '</span><span>إيصال ' + N(a.rec) + '</span></div></div><button class="btn sm primary">تأكيد الكمية</button></div>';
      }).join('') + '</div>';
      return h;
    },
    bind: function (m) {
      q('[data-scan]', m).onclick = scanQR;
      q('[data-man]', m).onclick = function () { receiptBack({ rec: q('#br').value.trim(), code: q('#bc').value.trim() }); };
      qa('[data-st]', m).forEach(function (x) { x.onclick = function () { storeConfirm(x.dataset.st); }; });
      qa('[data-rb]', m).forEach(function (x) {
        x.onclick = function () {
          var a = (st.rcpts || []).filter(function (r) { return r.rec === x.dataset.rb; })[0];
          sheet('استلام إيصال ' + a.rec, '<b>' + esc(a.cust_name) + ' · فاتورة ' + N(a.inv_number) + ' · ' + esc(a.driver_name) + '</b>' +
            '<div class="msg info">تأكد أن الإيصال موقّع ومختوم من العميل، ثم اكتب <b>رمز التحقق</b> المطبوع تحت رمز QR على النسخة العائدة. نسخة العميل لا تحمل هذا الرمز.</div>' +
            '<div class="field"><label for="rbc">رمز التحقق (4 أرقام)</label><input id="rbc" class="input pin" inputmode="numeric" maxlength="4"></div><div id="rbe"></div>' +
            '<button class="btn primary big" data-ok>تأكيد الاستلام</button>', function (s) {
            var inp = q('#rbc', s.el); setTimeout(function () { inp.focus(); }, 50);
            q('[data-ok]', s.el).onclick = function () {
              var b = q('[data-ok]', s.el); busy(b, true);
              call('receipt_back', { rec: a.rec, code: inp.value.trim() }).then(function (r) {
                s.close(); toast('تم استلام الإيصال · الحالة الآن: ' + r.state_ar);
                VIEWS.back.load().then(render);
              }).catch(function (e) { busy(b, false); q('#rbe', s.el).innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; });
            };
          });
        };
      });
    }
  };

  function receiptBack(body) {
    var out = q('#bres');
    call('receipt_back', body).then(function (r) {
      var msg = r.already ? 'هذا الإيصال سُجّل عائداً من قبل' : 'تم: عاد إيصال فاتورة ' + r.inv_number + ' · ' + r.cust_name + ' · الحالة الآن: ' + r.state_ar;
      if (out) out.innerHTML = '<div class="msg ' + (r.already ? 'warn' : 'ok') + '" style="margin-top:10px">' + esc(msg) + '</div>';
      toast(r.already ? 'مسجّل من قبل' : 'تم استلام الإيصال');
      var br = q('#br'), bc = q('#bc'); if (br) br.value = ''; if (bc) bc.value = '';
      VIEWS.back.load().then(function () { if (st.tab === 'back') { render(); var o2 = q('#bres'); if (o2) o2.innerHTML = '<div class="msg ' + (r.already ? 'warn' : 'ok') + '" style="margin-top:10px">' + esc(msg) + '</div>'; } });
    }).catch(function (e) { if (out) out.innerHTML = '<div class="msg err" style="margin-top:10px">' + esc(e.message) + '</div>'; toast(e.message, true); });
  }

  function scanQR() {
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices) {
      toast('المسح غير مدعوم في هذا المتصفح. اكتب رقم الإيصال والرمز يدوياً', true); return;
    }
    var stream = null, stop = false;
    var s = sheet('مسح رمز QR', '<video class="scan" playsinline muted></video><p class="muted small" style="margin:0">وجّه الكاميرا نحو الرمز على النسخة العائدة.</p>', function (s) {
      var v = q('video', s.el);
      var det = new window.BarcodeDetector({ formats: ['qr_code'] });
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (st2) {
        stream = st2; v.srcObject = st2; v.play();
        var tick = function () {
          if (stop) return;
          det.detect(v).then(function (codes) {
            if (codes.length) { var raw = codes[0].rawValue; s.close(); receiptBack({ qr: raw }); return; }
            setTimeout(tick, 250);
          }).catch(function () { setTimeout(tick, 400); });
        };
        tick();
      }).catch(function () { s.close(); toast('لم يُسمح باستعمال الكاميرا', true); });
      s.onclose = function () { stop = true; if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); };
    });
    return s;
  }

  function storeConfirm(rec) {
    var a = (st.store || []).filter(function (x) { return x.rec === rec; })[0];
    if (!a) return;
    var expected = a.state === 'to_store' && a.partial && a.partial.length ? a.partial : a.lines;
    sheet('تأكيد استلام المخزن · فاتورة ' + a.inv_number, '<b>' + esc(a.cust_name) + ' · ' + esc(a.driver_name) + '</b>' +
      '<div class="msg info">' + (isRet(a) ? 'مرتجع من العميل.' : a.result === 'failed' ? 'تعذّر التسليم: تعود الفاتورة كاملة.' : 'الناقص أو التالف من تسليم جزئي.') + ' عُدّ البضاعة واكتب ما وصل فعلاً.</div>' +
      expected.map(function (l, i) {
        return '<div class="qtyrow"><div><b>' + esc(l.item) + '</b><div class="small muted">المتوقع: ' + N(num(l.qty)) + ' ' + esc(l.unit) + '</div></div><input class="input num" type="number" inputmode="decimal" min="0" data-g="' + i + '" value="' + esc(l.qty) + '"></div>';
      }).join('') + '<textarea class="input" id="sn" placeholder="ملاحظة (اختياري)"></textarea><button class="btn primary big" data-ok>تأكيد الاستلام وإغلاق الفاتورة</button>',
      function (s) {
        q('[data-ok]', s.el).onclick = function () {
          var b = q('[data-ok]', s.el); busy(b, true);
          var lines = expected.map(function (l, i) { return { item: l.item, unit: l.unit, expected: Number(l.qty), got: Number(q('[data-g="' + i + '"]', s.el).value || 0) }; });
          call('store_confirm', { rec: a.rec, lines: lines, note: q('#sn', s.el).value.trim() }).then(function (r) {
            s.close(); toast(r.diff ? 'حُفظ مع فرق في الكميات، سيظهر للمشرف' : 'تم التأكيد وأُغلقت الفاتورة');
            VIEWS.back.load().then(render);
          }).catch(function (e) { busy(b, false); toast(e.message, true); });
        };
      });
  }

  /* ===================== مواقع العملاء ===================== */
  VIEWS.locs = {
    load: function () {
      if (st.locsTab === 'ok') return call('locs_approved').then(function (r) { st.locsOk = r.locs; });
      return call('locs_list').then(function (r) { st.locs = r.locs; });
    },
    html: function () {
      var tab = st.locsTab || 'new';
      var h = '<div class="row" style="flex-wrap:wrap"><div class="chips grow"><button class="chip' + (tab === 'new' ? ' on' : '') + '" data-ltab="new">بانتظار الاعتماد' + (st.locs && st.locs.length ? ' <small>' + N(st.locs.length) + '</small>' : '') + '</button>' +
        '<button class="chip' + (tab === 'ok' ? ' on' : '') + '" data-ltab="ok">المواقع المعتمدة' + (st.locsOk ? ' <small>' + N(st.locsOk.length) + '</small>' : '') + '</button></div>' +
        (tab === 'ok' ? '<button class="btn" data-man>' + ICON.pin + ' إضافة موقع من الخريطة</button>' : '<button class="btn primary" data-add>' + ICON.pin + ' تسجيل موقع عميل</button>') + '</div>';
      if (tab === 'ok') {
        if (!st.locsOk) return h + '<div class="loading"><span class="spin"></span></div>';
        if (!st.locsOk.length) return h + '<div class="card empty">لا توجد مواقع معتمدة بعد</div>';
        var t = (st.locsQ || '').trim();
        var list = st.locsOk.filter(function (l) { return !t || String(l.cust_name).indexOf(t) >= 0 || String(l.branch).indexOf(t) >= 0; });
        return h + '<div class="field"><input id="lq" class="input" type="search" placeholder="بحث باسم العميل" value="' + esc(t) + '"></div><div class="list" id="lok">' + list.map(function (l) {
          return '<div class="card"><div class="row"><b class="grow">' + esc(l.cust_name) + (l.branch ? ' · ' + esc(l.branch) : '') + '</b><span class="badge b-delivered">معتمد</span></div>' +
            '<div class="small muted">' + (l.decided_by ? 'اعتمده ' + esc(l.decided_by) + ' · ' + N(dmy(l.decided_at)) + ' ' + hm(l.decided_at) : 'سجّله ' + esc(l.by_name)) + (l.note ? ' · ' + esc(l.note) : '') + '</div>' +
            (l.desc ? '<p style="margin:6px 0">' + esc(l.desc) + '</p>' : '') +
            '<div class="row" style="margin-top:8px"><a class="btn sm ghost" target="_blank" rel="noopener" href="https://www.google.com/maps?q=' + l.lat + ',' + l.lng + '">' + ICON.pin + ' على الخريطة</a>' +
            '<button class="btn sm primary" data-edit="' + esc(l.id) + '">تعديل الموقع</button><button class="btn sm danger" data-del="' + esc(l.id) + '">حذف</button></div></div>';
        }).join('') + (list.length ? '' : '<div class="card empty">لا نتائج</div>') + '</div>';
      }
      if (!st.locs) return h + '<div class="loading"><span class="spin"></span></div>';
      if (!st.locs.length) return h + '<div class="card empty">لا توجد مواقع بانتظار الاعتماد</div>';
      return h + '<div class="list">' + st.locs.map(function (l) {
        var d = l.approved ? Math.round(distM(l.lat, l.lng, l.approved.lat, l.approved.lng)) : null;
        return '<div class="card"><div class="row"><b class="grow">' + esc(l.cust_name) + (l.branch ? ' · ' + esc(l.branch) : '') + '</b><span class="badge b-partial">مقترح</span></div>' +
          '<div class="small muted">سجّله ' + esc(l.by_name) + ' · ' + hm(l.at) + ' ' + N(dmy(l.at)) + (l.acc ? ' · دقة ±' + N(l.acc) + ' م' : '') + '</div>' +
          (l.desc ? '<p style="margin:6px 0">' + esc(l.desc) + '</p>' : '') +
          (d !== null ? '<div class="msg warn">يوجد موقع معتمد سابق على بعد ' + N(num(d)) + ' م. الاعتماد يستبدله ويحفظ القديم في السجل.</div>' : '') +
          (l.history.length ? '<div class="small muted">مواقع تسليم سابقة لهذا العميل: ' + l.history.map(function (h2) { return N(Math.round(distM(l.lat, l.lng, h2.lat, h2.lng))) + ' م'; }).join('، ') + ' من الموقع المقترح</div>' : '') +
          (l.photos.length ? '<div class="photos" style="margin:8px 0">' + l.photos.map(function (p) { return '<div class="ph" data-ph="' + esc(p) + '">…</div>'; }).join('') + '</div>' : '') +
          '<div class="row"><a class="btn sm ghost" target="_blank" rel="noopener" href="https://www.google.com/maps?q=' + l.lat + ',' + l.lng + '">' + ICON.pin + ' على الخريطة</a>' +
          '<button class="btn sm primary" data-ap="' + esc(l.id) + '">اعتماد</button><button class="btn sm danger" data-rj="' + esc(l.id) + '">رفض</button></div></div>';
      }).join('') + '</div>';
    },
    bind: function (m) {
      loadPhotos(m);
      qa('[data-ltab]', m).forEach(function (b) {
        b.onclick = function () {
          st.locsTab = b.dataset.ltab; render();
          VIEWS.locs.load().then(render).catch(function (e) { toast(e.message, true); });
        };
      });
      var add = q('[data-add]', m);
      if (add) add.onclick = function () { openAddLoc(); };
      var man = q('[data-man]', m);
      if (man) man.onclick = function () { openLocEdit(null); };
      var lq = q('#lq', m);
      if (lq) lq.oninput = function () {
        st.locsQ = lq.value; var pos = lq.selectionStart; render();
        var n = q('#lq'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} }
      };
      qa('[data-edit]', m).forEach(function (b) { b.onclick = function () { openLocEdit((st.locsOk || []).filter(function (l) { return l.id === b.dataset.edit; })[0]); }; });
      qa('[data-del]', m).forEach(function (b) {
        b.onclick = function () {
          var l = (st.locsOk || []).filter(function (x) { return x.id === b.dataset.del; })[0];
          askReason('حذف موقع ' + l.cust_name, 'سبب الحذف', { intro: 'يُحذف الموقع المعتمد ويُحفظ في السجل. سيظهر العميل «بلا موقع» حتى يُسجَّل له موقع جديد.', ok: 'حذف الموقع' }).then(function (r) {
            if (r) call('loc_remove', { id: l.id, reason: r }).then(function () { toast('حُذف الموقع'); return VIEWS.locs.load(); }).then(render).catch(function (e) { toast(e.message, true); });
          });
        };
      });
      qa('[data-ap]', m).forEach(function (b) { b.onclick = function () { call('loc_decide', { id: b.dataset.ap, approve: true }).then(function () { toast('اعتُمد الموقع'); return VIEWS.locs.load(); }).then(render).catch(function (e) { toast(e.message, true); }); }; });
      qa('[data-rj]', m).forEach(function (b) { b.onclick = function () { askReason('رفض الموقع', 'سبب الرفض').then(function (r) { if (r) call('loc_decide', { id: b.dataset.rj, reason: r }).then(VIEWS.locs.load).then(render).catch(function (e) { toast(e.message, true); }); }); }; });
    }
  };

  // قراءة إحداثيات من نص: «32.88, 13.19» أو رابط خرائط Google (…@32.88,13.19… أو ?q=32.88,13.19)
  function parseLatLng(t) {
    var m = String(t || '').match(/(-?\d{1,2}\.\d+)\s*[,،\s]\s*(-?\d{1,3}\.\d+)/);
    if (!m) return null;
    var la = Number(m[1]), lo = Number(m[2]);
    return Math.abs(la) <= 90 && Math.abs(lo) <= 180 ? { lat: +la.toFixed(6), lng: +lo.toFixed(6) } : null;
  }

  // تعديل موقع معتمد (l) أو إضافة موقع لعميل من الخريطة (l = null): اسحب الدبوس أو اضغط على الخريطة
  function openLocEdit(l) {
    var cust = null, pos = l ? { lat: l.lat, lng: l.lng } : null, map = null, pin = null, acc = '';
    var s = sheet(l ? 'تعديل موقع ' + l.cust_name + (l.branch ? ' · ' + l.branch : '') : 'إضافة موقع عميل من الخريطة',
      (l ? '' : '<div class="field"><label for="ec">العميل</label><input id="ec" class="input" placeholder="اكتب جزءاً من اسم العميل" autocomplete="off"><div id="ecl" class="list"></div></div>' +
        '<div class="field"><label for="eb">الفرع (إن كان للعميل أكثر من فرع)</label><input id="eb" class="input"></div>') +
      '<div class="msg info">اسحب الدبوس إلى باب المحل، أو اضغط على مكانه في الخريطة.' + (l && l.history.length ? ' النقاط الرمادية مواقع وصول السائقين سابقاً، اضغط على أي منها لنقل الدبوس إليها.' : '') + '</div>' +
      '<div id="emap" class="emap"></div>' +
      '<div class="row" style="margin-top:8px"><button class="btn sm" data-me>' + ICON.pin + ' موقعي الحالي</button>' +
      '<input id="ell" class="input grow" dir="ltr" placeholder="32.8872, 13.1913 أو رابط خرائط Google" style="min-width:0"></div>' +
      '<div id="emv" class="small muted" style="margin-top:6px"></div>' +
      '<div class="field"><label for="ed">وصف مختصر</label><input id="ed" class="input" placeholder="مثل: بجانب المسجد، الباب الأزرق" value="' + esc(l ? l.desc : '') + '"></div>' +
      (l ? '<div class="field"><label for="er">سبب التعديل</label><input id="er" class="input" placeholder="مثل: الموقع السابق غير دقيق، المحل انتقل"></div>' : '') +
      '<div id="ee"></div><button class="btn accent big" data-save disabled>' + (l ? 'حفظ الموقع الجديد' : 'حفظ واعتماد الموقع') + '</button>', function (s) {
        s.sticky = true;
        var ell = q('#ell', s.el), emv = q('#emv', s.el), save = q('[data-save]', s.el);
        function check() {
          save.disabled = !(pos && (l || cust));
          if (!pos) { emv.textContent = 'حدّد الموقع على الخريطة'; return; }
          ell.value = pos.lat + ', ' + pos.lng;
          if (!l && cust && cust.has_loc) { emv.innerHTML = '<span style="color:var(--warn,#B45309)">لهذا العميل موقع معتمد، والحفظ يستبدله (يبقى القديم في السجل).</span> الموقع: ' + N(pos.lat + ', ' + pos.lng); return; }
          emv.innerHTML = l ? (function (d) { return d < 3 ? 'لم يتغيّر الموقع بعد' : 'سيُنقل الموقع <b>' + N(num(d)) + ' م</b> عن الموقع الحالي'; })(Math.round(distM(l.lat, l.lng, pos.lat, pos.lng))) : 'الموقع: ' + N(pos.lat + ', ' + pos.lng);
        }
        function place(p, fly) {
          pos = { lat: +Number(p.lat).toFixed(6), lng: +Number(p.lng).toFixed(6) };
          if (map) {
            if (!pin) {
              pin = L.marker([pos.lat, pos.lng], { draggable: true, icon: RKMap.shopIcon(), zIndexOffset: 1000, autoPan: true }).addTo(map);
              pin.on('dragend', function () { var ll = pin.getLatLng(); acc = ''; place({ lat: ll.lat, lng: ll.lng }); });
            } else pin.setLatLng([pos.lat, pos.lng]);
            if (fly) map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), 17));
          }
          check();
        }
        RKMap.load().then(function () {
          map = RKMap.create(q('#emap', s.el), l ? { center: [l.lat, l.lng], zoom: 18 } : {});
          setTimeout(function () { map.invalidateSize(); }, 60);
          if (l) {
            L.circleMarker([l.lat, l.lng], { radius: 6, color: '#0C4CA2', weight: 2, fillOpacity: .15, dashArray: '3 3' }).addTo(map).bindTooltip('الموقع الحالي');
            (l.history || []).forEach(function (h) {
              L.circleMarker([h.lat, h.lng], { radius: 7, color: '#6B7280', weight: 1, fillColor: '#9CA3AF', fillOpacity: .9 }).addTo(map)
                .bindTooltip('وصول سائق ' + dmy(h.at)).on('click', function () { acc = ''; place(h); });
            });
            place(pos);
          } else getPos({ timeout: 8000 }).then(function (p) { if (p && !pos) { acc = p.acc; place(p, true); } });
          map.on('click', function (e) { acc = ''; place({ lat: e.latlng.lat, lng: e.latlng.lng }); });
        }).catch(function (e) { q('#emap', s.el).innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; });
        q('[data-me]', s.el).onclick = function () {
          var b = this; busy(b, true);
          getPos({ maxAge: 0 }).then(function (p) {
            busy(b, false);
            if (!p) { toast('تعذّر تحديد موقعك. فعّل GPS وامنح الإذن', true); return; }
            acc = p.acc; place(p, true); toast('دقة موقعك ±' + p.acc + ' م');
          });
        };
        ell.onchange = function () { var p = parseLatLng(ell.value); if (p) { acc = ''; place(p, true); } else toast('لم أجد إحداثيات في النص', true); };
        if (!l) {
          var ec = q('#ec', s.el), ecl = q('#ecl', s.el);
          var search = function () {
            var t = ec.value.trim();
            if (cust && t === cust.name) { ecl.innerHTML = ''; return; }
            var list = (st.customers || []).filter(function (c) { return !t || c.name.indexOf(t) >= 0; })
              .sort(function (a, b) { return (a.has_loc ? 1 : 0) - (b.has_loc ? 1 : 0); }).slice(0, 8);
            ecl.innerHTML = list.map(function (c) { return '<button class="item tap" data-c="' + esc(c.id) + '" style="text-align:start"><div class="main"><b>' + esc(c.name) + '</b><div class="meta">' + (c.has_loc ? '<span class="badge b-delivered">له موقع معتمد</span>' : '<span class="badge">بلا موقع</span>') + '</div></div></button>'; }).join('');
            qa('[data-c]', ecl).forEach(function (b) { b.onclick = function () { cust = (st.customers || []).filter(function (c) { return c.id === b.dataset.c; })[0]; ec.value = cust.name; ecl.innerHTML = ''; check(); }; });
          };
          ec.oninput = function () { cust = null; search(); check(); };
          ec.onfocus = search;
          loadCustomers().catch(function () {});
        }
        check();
        save.onclick = function () {
          var body = { lat: pos.lat, lng: pos.lng, acc: acc, desc: q('#ed', s.el).value.trim() };
          if (l) { body.id = l.id; body.reason = q('#er', s.el).value.trim(); if (!body.reason) { q('#er', s.el).focus(); toast('اكتب سبب التعديل', true); return; } }
          else { body.cust_id = cust.id; body.branch = q('#eb', s.el).value.trim(); }
          busy(save, true);
          call('loc_set', body).then(function () {
            s.close(); toast(l ? 'حُفظ الموقع الجديد' : 'حُفظ موقع ' + cust.name);
            loadCustomers().catch(function () {});
            st.locsTab = 'ok'; return VIEWS.locs.load();
          }).then(render).catch(function (e) { busy(save, false); q('#ee', s.el).innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; });
        };
      });
  }

  VIEWS.addloc = {
    load: function () { return loadCustomers(); },
    html: function () {
      return '<div class="card"><h2>تسجيل موقع عميل</h2><p class="muted" style="margin:0 0 12px">قف أمام المحل، ثم اختر العميل وحدّد موقعك والتقط صوراً للواجهة واللافتة. يراجعه المشرف ويعتمده.</p>' +
        '<button class="btn primary big" data-add>' + ICON.pin + ' بدء التسجيل</button></div>';
    },
    bind: function (m) { q('[data-add]', m).onclick = function () { openAddLoc(); }; }
  };

  function loadCustomers() {
    return S.get('customers').then(function (c) {
      if (c) st.customers = c;
      if (!navigator.onLine) return c;
      return call('customers').then(function (r) { st.customers = r.customers; S.set('customers', r.customers); return r.customers; });
    });
  }

  function openAddLoc() {
    var pos = null, photos = [], cust = null, watch = null;
    var minAcc = Number(st.settings.gps_min_acc || 50);
    var s = sheet('تسجيل موقع عميل', '<div class="field"><label for="cs">العميل</label><input id="cs" class="input" placeholder="اكتب جزءاً من اسم العميل" autocomplete="off"><div id="cl" class="list"></div></div>' +
      '<div class="field"><label for="cb">الفرع (إن كان للعميل أكثر من فرع)</label><input id="cb" class="input"></div>' +
      '<div><button class="btn big" data-gps>' + ICON.pin + ' تحديد موقعي</button><div id="gp" class="small muted" style="margin-top:6px"></div></div>' +
      '<div class="lbl">صور الواجهة واللافتة (2 إلى 3)</div><div class="photos" id="lp"></div><button class="btn" data-ph>' + ICON.cam + ' التقاط صورة</button>' +
      '<div class="field"><label for="cd">وصف مختصر</label><input id="cd" class="input" placeholder="مثل: بجانب المسجد، الباب الأزرق"></div>' +
      '<div id="le"></div><button class="btn accent big" data-send disabled>إرسال للاعتماد</button>', function (s) {
      s.sticky = true;
      loadCustomers().then(function () { search(); }).catch(function () {});
      var cs = q('#cs', s.el), cl = q('#cl', s.el);
      function search() {
        var t = cs.value.trim();
        if (cust && t === cust.name) { cl.innerHTML = ''; return; }
        var list = (st.customers || []).filter(function (c) { return !t || c.name.indexOf(t) >= 0; }).slice(0, 8);
        cl.innerHTML = list.map(function (c) { return '<button class="item tap" data-c="' + esc(c.id) + '" style="text-align:start"><div class="main"><b>' + esc(c.name) + '</b><div class="meta">' + (c.has_loc ? '<span class="badge b-delivered">له موقع معتمد</span>' : '<span class="badge">بلا موقع</span>') + '</div></div></button>'; }).join('');
        qa('[data-c]', cl).forEach(function (b) { b.onclick = function () { cust = (st.customers || []).filter(function (c) { return c.id === b.dataset.c; })[0]; cs.value = cust.name; cl.innerHTML = ''; check(); }; });
      }
      cs.oninput = function () { cust = null; search(); check(); };
      q('[data-gps]', s.el).onclick = function () {
        var gp = q('#gp', s.el);
        if (!navigator.geolocation) { gp.textContent = 'الموقع غير مدعوم في هذا الهاتف'; return; }
        gp.innerHTML = '<span class="spin" style="width:14px;height:14px"></span> جارٍ تحديد الموقع… ابقَ أمام المحل';
        if (watch !== null) navigator.geolocation.clearWatch(watch);
        watch = navigator.geolocation.watchPosition(function (p) {
          var acc = Math.round(p.coords.accuracy);
          if (!pos || acc <= pos.acc) pos = { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), acc: acc };
          gp.innerHTML = pos.acc <= minAcc ? '<b style="color:var(--ok)">✓ الموقع محدد بدقة ±' + pos.acc + ' م</b>' : 'الدقة الحالية ±' + pos.acc + ' م. ننتظر دقة أفضل من ' + minAcc + ' م… جرّب الوقوف في مكان مكشوف';
          if (pos.acc <= minAcc && watch !== null) { navigator.geolocation.clearWatch(watch); watch = null; }
          check();
        }, function () { gp.textContent = 'تعذّر تحديد الموقع. فعّل GPS وامنح التطبيق الإذن'; }, { enableHighAccuracy: true, maximumAge: 0, timeout: 60000 });
      };
      q('[data-ph]', s.el).onclick = function () {
        if (photos.length >= 3) { toast('3 صور كافية', true); return; }
        takePhoto({ label: 'واجهة المحل', who: st.user.name, pos: pos }).then(function (ph) {
          photos.push(ph);
          q('#lp', s.el).insertAdjacentHTML('beforeend', '<img src="' + ph.data + '" alt="صورة الواجهة">');
          check();
        }).catch(function (e) { toast(e.message, true); });
      };
      function check() { q('[data-send]', s.el).disabled = !(cust && pos && pos.acc <= minAcc && photos.length >= 2); }
      s.onclose = function () { if (watch !== null) navigator.geolocation.clearWatch(watch); };
      q('[data-send]', s.el).onclick = function () {
        var id = RK.uuid();
        var b = q('[data-send]', s.el); busy(b, true);
        var chain = Promise.resolve();
        photos.forEach(function (ph) { chain = chain.then(function () { return RK.queuePhoto({ id: ph.id, rec: 'loc:' + id, kind: 'facade', data: ph.data, lat: pos.lat, lng: pos.lng }); }); });
        chain.then(function () {
          return RK.queueStep({ id: id, action: 'loc_submit', label: 'موقع ' + cust.name, body: { loc: { id: id, cust_id: cust.id, branch: q('#cb', s.el).value.trim(),
            lat: pos.lat, lng: pos.lng, acc: pos.acc, desc: q('#cd', s.el).value.trim(), photos: photos.map(function (p) { return p.id; }), t: RK.nowStr() } } });
        }).then(function () { s.close(); toast('حُفظ الموقع وسيُرسل للمشرف للاعتماد'); pendUI(); flushNow(); })
          .catch(function (e) { busy(b, false); q('#le', s.el).innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; });
      };
    });
  }

  /* ===================== التقارير ===================== */
  var RES_AR = { delivered: 'تم التسليم', partial: 'تسليم جزئي', failed: 'تعذّر التسليم', picked: 'استُلم المرتجع', open: 'مفتوحة' };
  function repF() { return st.rep || (st.rep = { from: today(), to: today(), per: 'd', drivers: [], region: '', kind: '', result: '', cust: '', item: '', view: 'drivers' }); }
  function pct(a, b) { return b ? Math.round(a * 100 / b) + '%' : '—'; }
  function mins(m) { return m === null || m === undefined ? '—' : m < 60 ? m + ' د' : Math.floor(m / 60) + ' س ' + (m % 60) + ' د'; }
  function money(v) { return v === null || v === undefined ? '—' : num(Math.round(v * 1000) / 1000); }
  VIEWS.reports = {
    load: function () {
      var f = repF();
      return call('report_drivers', { from: f.from, to: f.to, f: { drivers: f.drivers, region: f.region, kind: f.kind, result: f.result, cust: f.cust, item: f.item } }).then(function (r) { st.repData = r; });
    },
    html: function () {
      var f = repF(), r = st.repData;
      var opts = function (list, val, all) { return '<option value="">' + all + '</option>' + list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === val ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); };
      var dn = f.drivers.length ? (f.drivers.length === 1 && r ? ((r.all_drivers.filter(function (d) { return d.id === f.drivers[0]; })[0] || {}).name || '١ سائق') : f.drivers.length + ' سائقين') : 'كل السائقين';
      var nf = ['region', 'kind', 'result', 'cust', 'item'].filter(function (k) { return f[k]; }).length + (f.drivers.length ? 1 : 0);
      var h = '<div class="card rep-filters"><div class="chips">' + [['d', 'اليوم'], ['y', 'أمس'], ['w', 'آخر 7 أيام'], ['m', 'هذا الشهر'], ['c', 'فترة مخصصة']].map(function (p) {
        return '<button class="chip' + (f.per === p[0] ? ' on' : '') + '" data-per="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>' +
        '<div class="row rep-dates' + (f.per === 'c' ? '' : ' hide') + '"><div class="field grow"><label for="rf1">من</label>' + dateField('rf1', f.from, { label: 'من' }) + '</div>' +
        '<div class="field grow"><label for="rf2">إلى</label>' + dateField('rf2', f.to, { label: 'إلى' }) + '</div></div>' +
        '<div class="rep-grid">' +
        '<div class="field"><label>السائق</label><button class="input selbtn" data-pickdrv>' + esc(dn) + '</button></div>' +
        '<div class="field"><label for="rfr">المنطقة</label><select id="rfr" class="input">' + opts(r ? r.regions.map(function (g) { return [g.id, g.name]; }) : [], f.region, 'كل المناطق') + '</select></div>' +
        '<div class="field"><label for="rfk">النوع</label><select id="rfk" class="input">' + opts([['sale', 'مبيعات'], ['ret', 'مرتجعات']], f.kind, 'الكل') + '</select></div>' +
        '<div class="field"><label for="rfs">النتيجة</label><select id="rfs" class="input">' + opts(Object.keys(RES_AR).map(function (k) { return [k, RES_AR[k]]; }), f.result, 'كل النتائج') + '</select></div>' +
        '<div class="field"><label for="rfc">العميل</label><input id="rfc" class="input" value="' + esc(f.cust) + '" placeholder="جزء من اسم العميل"></div>' +
        '<div class="field"><label for="rfi">الصنف</label><input id="rfi" class="input" value="' + esc(f.item) + '" placeholder="جزء من اسم الصنف"></div></div>' +
        '<div class="row" style="margin-top:12px"><button class="btn primary" data-run>عرض التقرير</button>' + (nf ? '<button class="btn ghost" data-clr>مسح الفلاتر (' + N(nf) + ')</button>' : '') +
        '<span class="grow"></span><button class="btn ghost" data-xl>تصدير Excel</button><button class="btn ghost" data-prn>' + ICON.print + ' طباعة</button></div></div>';
      if (!r) return h + '<div class="loading"><span class="spin"></span></div>';
      var T = r.drivers.reduce(function (s, d) { ['total', 'delivered', 'partial', 'failed', 'returns', 'open', 'qty_sent', 'qty_done', 'qty_short', 'net_done'].forEach(function (k) { s[k] = (s[k] || 0) + (d[k] || 0); }); return s; }, {});
      var closed = (T.total || 0) - (T.open || 0);
      h += '<div id="repout"><div class="rep-period small muted">' + (r.from === r.to ? dlong(r.from) : 'من ' + dlong(r.from) + ' إلى ' + dlong(r.to)) + '</div>';
      h += '<div class="kpis rep-kpis">' + [['الفواتير', num(T.total || 0), r.drivers.length + ' سائق'], ['سُلّمت', num((T.delivered || 0) + (T.partial || 0)), 'منها جزئي ' + num(T.partial || 0)],
        ['تعذّر', num(T.failed || 0), ''], ['مرتجعات مستلمة', num(T.returns || 0), ''], ['مفتوحة', num(T.open || 0), ''],
        ['نسبة الإنجاز', pct((T.delivered || 0) + (T.partial || 0) + (T.returns || 0), closed), 'من المغلقة'],
        ['الكميات المسلّمة', num(T.qty_done || 0), 'من ' + num(T.qty_sent || 0) + (T.qty_short ? ' · نقص ' + num(T.qty_short) : '')]]
        .concat(r.amounts ? [['قيمة المسلّم', money(T.net_done || 0), 'صافي الفواتير']] : [])
        .map(function (k) { return '<div class="kpi"><span>' + k[0] + '</span><b class="num">' + esc(k[1]) + '</b>' + (k[2] ? '<small>' + esc(k[2]) + '</small>' : '') + '</div>'; }).join('') + '</div>';
      h += '<div class="seg">' + [['drivers', 'السائقون'], ['items', 'الأصناف والكميات'], ['list', 'الفواتير (' + r.list.length + ')']].map(function (v) {
        return '<button class="' + (f.view === v[0] ? 'on' : '') + '" data-rv="' + v[0] + '">' + v[1] + '</button>'; }).join('') + '</div>';
      if (f.view === 'drivers') {
        h += '<div class="card">' + (r.drivers.length ? '<div class="scroll-x"><table class="tbl tbl-click"><thead><tr><th>السائق</th><th>فواتير</th><th>سُلّمت</th><th>جزئي</th><th>تعذّر</th><th>مرتجعات</th><th>مفتوحة</th><th>الإنجاز</th><th>الكمية المسلّمة</th><th>النقص</th>' +
          (r.amounts ? '<th>قيمة المسلّم</th>' : '') + '<th>متوسط الطريق</th><th>متوسط البقاء</th><th>خارج النطاق</th><th>أيام</th><th>كشوف</th><th>عملاء</th></tr></thead><tbody>' +
          r.drivers.map(function (d) {
            return '<tr data-drv="' + esc(d.id) + '"><td><b>' + esc(d.driver) + '</b></td><td>' + N(d.total) + '</td><td>' + N(d.delivered) + '</td><td>' + N(d.partial) + '</td><td>' + N(d.failed) + '</td><td>' + N(d.returns) + '</td><td>' + N(d.open) + '</td>' +
              '<td>' + (d.rate === null ? '—' : '<span class="rate' + (d.rate >= 90 ? ' good' : d.rate >= 70 ? ' mid' : ' bad') + '">' + N(d.rate + '%') + '</span>') + '</td><td>' + N(num(d.qty_done)) + ' <span class="muted small">/ ' + N(num(d.qty_sent)) + '</span></td><td>' + N(num(d.qty_short)) + '</td>' +
              (r.amounts ? '<td>' + N(money(d.net_done)) + '</td>' : '') + '<td>' + N(mins(d.avg_go)) + '</td><td>' + N(mins(d.avg_stay)) + '</td><td>' + N(d.far) + '</td><td>' + N(d.days) + '</td><td>' + N(d.trips) + '</td><td>' + N(d.custs) + '</td></tr>';
          }).join('') + '</tbody></table></div><p class="small muted" style="margin:8px 0 0">اضغط على أي سائق لعرض تقريره التفصيلي.</p>' : '<div class="empty">لا توجد بيانات بهذه الفلاتر</div>') + '</div>';
      } else if (f.view === 'items') {
        h += VIEWS.reports.itemsTbl(r, r.items);
      } else {
        h += VIEWS.reports.listTbl(r, r.list);
      }
      return h + '</div>';
    },
    itemsTbl: function (r, items, oneDrv) {
      var dname = {}; r.drivers.forEach(function (d) { dname[d.id] = d.driver; });
      items = items.slice().sort(function (a, b) { return (dname[a.driver_id] || '').localeCompare(dname[b.driver_id] || '') || b.sent - a.sent; });
      if (!items.length) return '<div class="card empty">لا توجد أصناف</div>';
      return '<div class="card"><div class="scroll-x"><table class="tbl"><thead><tr>' + (oneDrv ? '' : '<th>السائق</th>') + '<th>الصنف</th><th>الوحدة</th><th>النوع</th><th>المرسَل</th><th>المسلّم</th><th>النقص</th><th>الهدايا</th><th>عدد الفواتير</th></tr></thead><tbody>' +
        items.map(function (i) { return '<tr>' + (oneDrv ? '' : '<td>' + esc(dname[i.driver_id] || '') + '</td>') + '<td>' + esc(i.item) + '</td><td>' + esc(i.unit || '') + '</td><td>' + (i.ret ? 'مرتجع' : 'مبيع') + '</td><td>' + N(num(i.sent)) + '</td><td>' + N(num(i.done)) + '</td><td>' + (i.short ? '<b class="txt-bad">' + N(num(i.short)) + '</b>' : N(0)) + '</td><td>' + N(num(i.gift)) + '</td><td>' + N(i.invs) + '</td></tr>'; }).join('') +
        '</tbody></table></div></div>';
    },
    listTbl: function (r, list, oneDrv) {
      if (!list.length) return '<div class="card empty">لا توجد فواتير</div>';
      var more = list.length > 400;
      return '<div class="card"><div class="scroll-x"><table class="tbl"><thead><tr><th>التاريخ</th><th>الفاتورة</th><th>النوع</th><th>العميل</th>' + (oneDrv ? '' : '<th>السائق</th>') + '<th>الحالة</th><th>الكمية</th><th>النقص</th>' + (r.amounts ? '<th>الصافي</th>' : '') + '<th>الطريق</th><th>البقاء</th><th>الوصول</th><th>السبب</th></tr></thead><tbody>' +
        list.slice(0, 400).map(function (a) {
          return '<tr><td>' + N(dmy(a.assigned_at)) + ' ' + hm(a.assigned_at) + '</td><td>' + N(a.inv_number) + '</td><td>' + (isRet(a) ? 'مرتجع' : 'مبيع') + '</td><td>' + esc(a.cust_name) + '</td>' + (oneDrv ? '' : '<td>' + esc(a.driver_name) + '</td>') +
            '<td>' + badge(a.state, a.state_ar) + '</td><td>' + N(num(a.qty)) + '</td><td>' + N(num(a.qty_short)) + '</td>' + (r.amounts ? '<td>' + N(money(a.net)) + '</td>' : '') + '<td>' + N(mins(a.go_min)) + '</td><td>' + N(mins(a.stay_min)) + '</td>' +
            '<td>' + hm(a.arrive_at) + (a.arrive_flag ? ' <span class="badge b-flag">' + esc(a.arrive_flag) + '</span>' : '') + '</td><td>' + esc(a.reason || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' + (more ? '<p class="small muted">يُعرض أول ٤٠٠ فاتورة. صدّر إلى Excel لرؤية الكل.</p>' : '') + '</div>';
    },
    driver: function (id) {
      var r = st.repData, d = r.drivers.filter(function (x) { return x.id === id; })[0];
      if (!d) return;
      var items = r.items.filter(function (i) { return i.driver_id === id; }), list = r.list.filter(function (a) { return a.driver_id === id; });
      var tab = 'items';
      var body = function () {
        return '<div class="rep-period small muted">' + (r.from === r.to ? dlong(r.from) : 'من ' + dlong(r.from) + ' إلى ' + dlong(r.to)) + '</div>' +
          '<div class="kpis rep-kpis">' + [['الفواتير', d.total], ['سُلّمت', d.delivered + d.partial], ['تعذّر', d.failed], ['مرتجعات', d.returns], ['مفتوحة', d.open], ['الإنجاز', d.rate === null ? '—' : d.rate + '%'],
            ['المسلّم من الكميات', num(d.qty_done) + ' / ' + num(d.qty_sent)], ['النقص', num(d.qty_short)]].concat(r.amounts ? [['قيمة المسلّم', money(d.net_done)]] : [])
            .concat([['متوسط الطريق', mins(d.avg_go)], ['متوسط البقاء عند العميل', mins(d.avg_stay)], ['خارج النطاق', d.far], ['أيام العمل', d.days], ['الكشوف', d.trips], ['العملاء', d.custs]])
            .map(function (k) { return '<div class="kpi"><span>' + k[0] + '</span><b class="num">' + esc(k[1]) + '</b></div>'; }).join('') + '</div>' +
          '<div class="row"><button class="btn primary" data-trk>' + ICON.pin + ' تتبع السائق على الخريطة</button><button class="btn ghost" data-dxl>تصدير Excel</button></div>' +
          '<div class="seg"><button data-dt="items" class="' + (tab === 'items' ? 'on' : '') + '">الأصناف والكميات</button><button data-dt="list" class="' + (tab === 'list' ? 'on' : '') + '">الفواتير (' + list.length + ')</button></div>' +
          (tab === 'items' ? VIEWS.reports.itemsTbl(r, items, true) : VIEWS.reports.listTbl(r, list, true));
      };
      sheet('تقرير السائق: ' + d.driver, '<div data-db></div>', function (s) {
        s.el.parentNode.classList.add('wide');
        var paint = function () {
          q('[data-db]', s.el).innerHTML = body();
          qa('[data-dt]', s.el).forEach(function (b) { b.onclick = function () { tab = b.dataset.dt; paint(); }; });
          q('[data-trk]', s.el).onclick = function () { s.close(); MV.sel = id; MV.focusRec = null; MV.fitted = false; MV.day = null; st.tab = 'map'; render(); refresh(false); };
          q('[data-dxl]', s.el).onclick = function () { VIEWS.reports.exportX({ from: r.from, to: r.to, drivers: [d], items: items, list: list, amounts: r.amounts }, 'driver-' + d.id); };
        };
        paint();
      });
    },
    exportX: function (r, who) {
      withXLSX().then(function (X) {
        var dname = {}; r.drivers.forEach(function (d) { dname[d.id] = d.driver; });
        var s1 = [['السائق', 'الفواتير', 'سُلّمت', 'جزئي', 'تعذّر', 'مرتجعات', 'مفتوحة', 'نسبة الإنجاز %', 'الكمية المرسلة', 'الكمية المسلّمة', 'النقص'].concat(r.amounts ? ['قيمة المسلّم', 'صافي الفواتير'] : [])
          .concat(['متوسط الطريق (د)', 'متوسط البقاء (د)', 'خارج النطاق', 'وصول مرفوض', 'أيام', 'كشوف', 'عملاء'])].concat(r.drivers.map(function (d) {
          return [d.driver, d.total, d.delivered, d.partial, d.failed, d.returns, d.open, d.rate, d.qty_sent, d.qty_done, d.qty_short].concat(r.amounts ? [d.net_done, d.net] : []).concat([d.avg_go, d.avg_stay, d.far, d.rejected, d.days, d.trips, d.custs]);
        }));
        var s2 = [['السائق', 'الصنف', 'الوحدة', 'النوع', 'المرسَل', 'المسلّم', 'النقص', 'الهدايا', 'عدد الفواتير']].concat(r.items.map(function (i) { return [dname[i.driver_id] || '', i.item, i.unit, i.ret ? 'مرتجع' : 'مبيع', i.sent, i.done, i.short, i.gift, i.invs]; }));
        var s3 = [['التاريخ', 'الوقت', 'الإيصال', 'الفاتورة', 'النوع', 'العميل', 'السائق', 'الحالة', 'الكمية', 'النقص'].concat(r.amounts ? ['الصافي'] : []).concat(['الطريق (د)', 'البقاء (د)', 'الوصول', 'تنبيه الموقع', 'السبب'])]
          .concat(r.list.map(function (a) { return [dmy(a.assigned_at), String(a.assigned_at).slice(11, 16), a.rec, a.inv_number, a.kind, a.cust_name, a.driver_name, a.state_ar, a.qty, a.qty_short].concat(r.amounts ? [a.net] : []).concat([a.go_min, a.stay_min, String(a.arrive_at || '').slice(11, 16), a.arrive_flag, a.reason]); }));
        var wb = X.utils.book_new();
        [[s1, 'السائقون', 18], [s2, 'الأصناف', 16], [s3, 'الفواتير', 14]].forEach(function (x) {
          var ws = X.utils.aoa_to_sheet(x[0]); ws['!cols'] = x[0][0].map(function () { return { wch: x[2] }; }); ws['!views'] = [{ RTL: true }];
          X.utils.book_append_sheet(wb, ws, x[1]);
        });
        wb.Workbook = { Views: [{ RTL: true }] };
        X.writeFile(wb, 'rakan-drivers-' + (who ? who + '-' : '') + r.from + '_' + r.to + '.xlsx');
      }).catch(function (e) { toast(e.message, true); });
    },
    bind: function (m) {
      var f = repF();
      var read = function () {
        if (q('#rf1')) { f.from = q('#rf1').value || f.from; f.to = q('#rf2').value || f.to; }
        f.region = q('#rfr').value; f.kind = q('#rfk').value; f.result = q('#rfs').value; f.cust = q('#rfc').value.trim(); f.item = q('#rfi').value.trim();
        if (f.from > f.to) { var t = f.from; f.from = f.to; f.to = t; }
      };
      var run = function () { read(); st.repData = null; render(); VIEWS.reports.load().then(render).catch(function (e) { toast(e.message, true); }); };
      q('[data-run]', m).onclick = run;
      [q('#rfc', m), q('#rfi', m)].forEach(function (i) { i.onkeydown = function (e) { if (e.key === 'Enter') run(); }; });
      qa('[data-per]', m).forEach(function (b) {
        b.onclick = function () {
          var p = b.dataset.per, d = today(), day = function (n) { return RK.nowStr(new Date(Date.now() - n * 864e5)).slice(0, 10); };
          f.per = p;
          if (p === 'c') { render(); return; }
          f.from = p === 'd' ? d : p === 'y' ? day(1) : p === 'w' ? day(6) : d.slice(0, 8) + '01';
          f.to = p === 'y' ? day(1) : d;
          run();
        };
      });
      qa('.rep-dates input', m).forEach(function (i) { i.onchange = function () { read(); render(); }; });
      var clr = q('[data-clr]', m);
      if (clr) clr.onclick = function () { f.drivers = []; f.region = f.kind = f.result = f.cust = f.item = ''; q('#rfr').value = q('#rfk').value = q('#rfs').value = q('#rfc').value = q('#rfi').value = ''; run(); };
      q('[data-pickdrv]', m).onclick = function () {
        var r = st.repData, all = r ? r.all_drivers : [], pick = {}; f.drivers.forEach(function (x) { pick[x] = true; });
        sheet('اختر السائقين', '<div class="row" style="margin-bottom:8px"><button class="btn sm ghost" data-all>الكل</button><button class="btn sm ghost" data-none>لا أحد</button></div><div class="list">' +
          all.map(function (d) { return '<label class="item tap"><input type="checkbox" data-pd="' + esc(d.id) + '"' + (pick[d.id] ? ' checked' : '') + '><div class="main"><b>' + esc(d.name) + '</b></div></label>'; }).join('') +
          '</div><button class="btn primary big" data-okd>تطبيق</button>', function (s) {
          q('[data-all]', s.el).onclick = function () { qa('[data-pd]', s.el).forEach(function (c) { c.checked = true; }); };
          q('[data-none]', s.el).onclick = function () { qa('[data-pd]', s.el).forEach(function (c) { c.checked = false; }); };
          q('[data-okd]', s.el).onclick = function () {
            var sel = qa('[data-pd]', s.el).filter(function (c) { return c.checked; }).map(function (c) { return c.dataset.pd; });
            f.drivers = sel.length === all.length ? [] : sel; s.close(); run();
          };
        });
      };
      qa('[data-rv]', m).forEach(function (b) { b.onclick = function () { f.view = b.dataset.rv; render(); }; });
      qa('[data-drv]', m).forEach(function (tr) { tr.onclick = function () { VIEWS.reports.driver(tr.dataset.drv); }; });
      q('[data-xl]', m).onclick = function () { if (st.repData) VIEWS.reports.exportX(st.repData); };
      q('[data-prn]', m).onclick = function () {
        var r = st.repData; if (!r) return;
        var P = document.getElementById('print'), saved = f.view, parts = [];
        ['drivers', 'items'].forEach(function (v) { f.view = v; var tmp = document.createElement('div'); tmp.innerHTML = VIEWS.reports.html(); var o = q('#repout', tmp); qa('.seg', o).forEach(function (x) { x.remove(); }); parts.push(v === 'drivers' ? o.innerHTML : q('.card', o).outerHTML); });
        f.view = saved;
        P.innerHTML = '<div style="padding:10mm;font-family:Tajawal,sans-serif"><div class="p-head"><img src="logo.png" alt=""><div class="t"><b>تقرير السائقين التفصيلي</b><span>' + (r.from === r.to ? dlong(r.from) : 'من ' + dlong(r.from) + ' إلى ' + dlong(r.to)) + '</span></div></div>' + parts.join('<h3>الأصناف والكميات</h3>') + '</div>';
        setTimeout(function () { window.print(); }, 100);
      };
    }
  };

  /* ===================== المدير: المستخدمون ===================== */
  var ROLE_AR = { manager: 'المدير', supervisor: 'المشرف', accountant: 'المحاسب', rep: 'المندوب', storekeeper: 'أمين المخزن', driver: 'السائق' };
  VIEWS.users = {
    load: function () { return call('users_list').then(function (r) { st.users = r; }); },
    html: function () {
      var u = st.users;
      if (!u) return '<div class="loading"><span class="spin"></span></div>';
      var h = '<div class="card"><h2>إضافة المستخدمين</h2><p class="muted small" style="margin:0 0 10px">أضف شخصاً واحداً، أو ارفع ملف Excel فيه كل السائقين والمشرفين دفعة واحدة. المناطق المكتوبة في الملف تُنشأ تلقائياً إن لم تكن موجودة.</p>' +
        '<div class="row"><button class="btn accent" data-new>+ مستخدم جديد</button><button class="btn primary" data-imp>رفع من ملف Excel</button><button class="btn ghost" data-tpl>تحميل نموذج Excel</button></div></div>' +
        '<div class="row"><button class="btn" data-regs>المناطق (' + N(brRegions().length) + ')</button>' +
        (brRegions().length > 1 ? '<button class="btn ghost" data-cr>توزيع العملاء على المناطق</button>' : '') + '</div>';
      ['supervisor', 'driver', 'storekeeper', 'rep', 'accountant', 'manager'].forEach(function (role) {
        var list = u.users.filter(function (x) { return x.role === role; });
        h += '<div class="sec-title"><h2>' + ROLE_AR[role] + ' (' + N(list.length) + ')</h2></div>';
        if (!list.length) { h += '<div class="card empty small">لا يوجد</div>'; return; }
        h += '<div class="list">' + list.map(function (x) {
          return '<div class="item tap" data-u="' + esc(x.id) + '"><div class="main"><b>' + esc(x.name) + (x.active ? '' : ' <span class="badge">موقوف</span>') + '</b><div class="meta"><span class="ltr">' + esc(x.username) + '</span>' +
            (multiWs() ? '<span class="badge b-br">' + esc(x.ws ? (brList().filter(function (b) { return b.code === x.ws; })[0] || {}).name || x.ws : 'كل الفروع') + '</span>' : '') +
            (x.regions && x.regions !== '*' ? '<span>' + esc(x.regions.split(',').map(function (r) { return (u.regions.filter(function (g) { return g.id === r; })[0] || {}).name || r; }).join('، ')) + '</span>' : '') +
            (x.truck ? '<span>' + esc(x.truck) + '</span>' : '') + (x.role === 'driver' ? '<span>' + (x.device ? 'الهاتف مسجّل' : 'لم يسجّل هاتفاً بعد') + '</span>' : '') +
            (x.device_req ? '<span class="badge b-partial">يطلب هاتفاً جديداً</span>' : '') + (x.must_change ? '<span class="badge">لم يدخل بعد</span>' : '') +
            (x.last_seen ? '<span>آخر ظهور ' + hm(x.last_seen) + ' ' + N(dmy(x.last_seen)) + '</span>' : '') + '</div></div></div>';
        }).join('') + '</div>';
      });
      return h;
    },
    bind: function (m) {
      if (!st.users) return;
      q('[data-new]', m).onclick = function () { userForm(null); };
      q('[data-imp]', m).onclick = importUsers;
      q('[data-tpl]', m).onclick = function () { withXLSX().then(downloadTemplate).catch(function (e) { toast(e.message, true); }); };
      q('[data-regs]', m).onclick = regionsForm;
      var cr = q('[data-cr]', m);
      if (cr) cr.onclick = custRegionsForm;
      qa('[data-u]', m).forEach(function (x) { x.onclick = function () { userForm(st.users.users.filter(function (u) { return u.id === x.dataset.u; })[0]); }; });
    }
  };

  // مناطق الفرع المعروض فقط (عند وجود أكثر من فرع)
  function brRegions() { var c = curBr(); return (st.users && st.users.regions || []).filter(function (r) { return !c || (r.ws || 'main') === c; }); }
  function userForm(u) {
    var regs = st.users.regions.filter(function (r) { return r.active; });
    var isNew = !u;
    u = u || { role: 'driver', regions: regs[0] ? regs[0].id : '', active: true };
    var ur = String(u.regions || '').split(',');
    var s = sheet(isNew ? 'مستخدم جديد' : 'تعديل ' + u.name, '<form class="form" id="uf">' +
      '<div class="field"><label for="un">الاسم الكامل</label><input id="un" class="input" value="' + esc(u.name || '') + '" required></div>' +
      '<div class="field"><label for="uu">اسم المستخدم (بالإنجليزية، للدخول)</label><input id="uu" class="input ltr" value="' + esc(u.username || '') + '" autocapitalize="none" placeholder="مثل ali.m" required></div>' +
      '<div class="field"><label for="ur">الدور</label><select id="ur" class="input">' + Object.keys(ROLE_AR).map(function (k) { return '<option value="' + k + '"' + (u.role === k ? ' selected' : '') + '>' + ROLE_AR[k] + '</option>'; }).join('') + '</select></div>' +
      (multiWs() ? '<div class="field"><label for="uw">الفرع</label><select id="uw" class="input"><option value="">كل الفروع (يبدّل بينها من أعلى الشاشة)</option>' + brList().map(function (b) { return '<option value="' + esc(b.code) + '"' + ((isNew ? curBr() : u.ws) === b.code ? ' selected' : '') + '>' + esc(b.name) + ' فقط</option>'; }).join('') + '</select><span class="small muted">المستخدم المربوط بفرع لا يرى إلا معاملات ذلك الفرع.</span></div>' : '') +
      '<div class="field" id="urg"><span class="lbl">المناطق</span><div class="chips">' + regs.map(function (r) { return '<label data-ws="' + esc(r.ws || 'main') + '" class="chip' + (ur.indexOf(r.id) >= 0 ? ' on' : '') + '"><input type="checkbox" value="' + esc(r.id) + '"' + (ur.indexOf(r.id) >= 0 ? ' checked' : '') + ' hidden>' + esc(r.name) + '</label>'; }).join('') + '</div></div>' +
      '<div class="field" id="utr"><label for="ut">الشاحنة (للسائق)</label><input id="ut" class="input" value="' + esc(u.truck || '') + '" placeholder="النوع ورقم اللوحة"></div>' +
      '<div class="field"><label for="up">رقم الهاتف</label><input id="up" class="input ltr" inputmode="tel" value="' + esc(u.phone || '') + '"></div>' +
      '<div class="field" id="uem"><label for="ue">البريد الإلكتروني (للمدير)</label><input id="ue" class="input ltr" value="' + esc(u.email || '') + '"></div>' +
      '<div class="field" id="upm"><span class="lbl">صلاحيات إضافية</span>' +
        '<label class="chk"><input type="checkbox" data-perm="bulk"' + (String(u.perms || '').indexOf('bulk') >= 0 ? ' checked' : '') + '> معالجة فواتير الأيام السابقة دفعة واحدة (استبعاد، مسلّمة خارج المنظومة)</label>' +
        '<label class="chk"><input type="checkbox" data-perm="del"' + (String(u.perms || '').indexOf('del') >= 0 ? ' checked' : '') + '> الحذف (فواتير، تعيينات وإيصالات، كشوف)</label></div>' +
      (isNew ? '' : '<label class="chk"><input type="checkbox" id="ua"' + (u.active ? ' checked' : '') + '> الحساب نشط</label>' +
        '<label class="chk"><input type="checkbox" id="upin"> إصدار رقم سري جديد (نسيه المستخدم)</label>' +
        (u.role === 'driver' ? '<label class="chk"><input type="checkbox" id="udev"> إلغاء تسجيل هاتفه (ليسجّل هاتفاً جديداً عند دخوله)</label>' : '')) +
      '<div id="uerr"></div><button class="btn primary big" id="usv">حفظ</button>' + (isNew || u.id === st.user.id ? '' : '<button type="button" class="btn danger" id="udel" style="margin-top:4px">حذف المستخدم نهائياً</button>') + '</form>', function (s) {
      var role = q('#ur', s.el);
      function vis() {
        var r = role.value;
        q('#urg', s.el).hidden = r === 'manager' || r === 'accountant';
        q('#utr', s.el).hidden = r !== 'driver';
        q('#uem', s.el).hidden = r !== 'manager';
        q('#upm', s.el).hidden = r !== 'supervisor' && r !== 'accountant';
      }
      role.onchange = vis; vis();
      var ud = q('#udel', s.el);
      if (ud) ud.onclick = function () {
        confirmBox('حذف مستخدم', 'حذف <b>' + esc(u.name) + '</b> نهائياً؟ يبقى ما قام به محفوظاً في سجل التدقيق والتقارير باسمه. إن أردت منعه مؤقتاً فقط، ألغِ «الحساب نشط» بدل الحذف.', 'حذف نهائياً').then(function (y) {
          if (y) call('user_delete', { id: u.id }).then(function () { s.close(); toast('حُذف ' + u.name); return VIEWS.users.load(); }).then(render).catch(function (e) { toast(e.message, true); });
        });
      };
      var uw = q('#uw', s.el);
      function wsVis() {
        if (!uw) return;
        qa('#urg label', s.el).forEach(function (l) {
          var okk = !uw.value || l.dataset.ws === uw.value; l.hidden = !okk;
          if (!okk) { q('input', l).checked = false; l.classList.remove('on'); }
        });
      }
      if (uw) { uw.onchange = wsVis; wsVis(); }
      qa('#urg label', s.el).forEach(function (l) { l.onclick = function (e) { e.preventDefault(); var c = q('input', l); c.checked = !c.checked; l.classList.toggle('on', c.checked); }; });
      q('#uf', s.el).onsubmit = function (e) {
        e.preventDefault();
        var b = q('#usv', s.el); busy(b, true);
        var body = { id: u.id, name: q('#un', s.el).value.trim(), username: q('#uu', s.el).value.trim().toLowerCase(), role: role.value,
          regions: qa('#urg input:checked', s.el).map(function (c) { return c.value; }).join(','), truck: q('#ut', s.el).value.trim(),
          phone: q('#up', s.el).value.trim(), email: q('#ue', s.el).value.trim(),
          perms: (role.value === 'supervisor' || role.value === 'accountant') ? qa('[data-perm]:checked', s.el).map(function (c) { return c.dataset.perm; }).join(',') : '',
          ws: uw ? uw.value : undefined, active: isNew ? true : q('#ua', s.el).checked, reset_pin: !isNew && q('#upin', s.el).checked, reset_device: !isNew && q('#udev', s.el) && q('#udev', s.el).checked };
        call('user_save', { user: body }).then(function (r) {
          s.close();
          if (r.pin) {
            sheet('الرقم السري المؤقت', '<p style="margin:0">أعطِ ' + esc(body.name) + ' بيانات الدخول التالية. سيُطلب منه تغيير الرقم السري عند أول دخول.</p>' +
              '<div class="card" style="text-align:center"><div class="muted small">اسم المستخدم</div><div class="ltr" style="font-size:22px;font-weight:800">' + esc(body.username) + '</div>' +
              '<div class="muted small" style="margin-top:10px">الرقم السري المؤقت</div><div class="num" style="font-size:34px;font-weight:800;letter-spacing:6px;color:var(--orange)">' + esc(r.pin) + '</div></div>' +
              '<div class="msg info">رابط التطبيق: <span class="ltr">' + esc(location.origin + location.pathname) + '</span></div><div class="msg warn">لن يظهر هذا الرقم مرة أخرى. اكتبه الآن.</div>');
          } else toast('تم الحفظ');
          VIEWS.users.load().then(render);
        }).catch(function (e2) { busy(b, false); q('#uerr', s.el).innerHTML = '<div class="msg err">' + esc(e2.message) + '</div>'; });
      };
    });
    return s;
  }

  /* ---------- رفع المستخدمين من Excel ---------- */
  var IMP_COLS = [['name', ['الاسم', 'الاسم الكامل', 'name']], ['role', ['الدور', 'الوظيفة', 'role']], ['regions', ['المنطقة', 'المناطق', 'region']],
    ['truck', ['الشاحنة', 'السيارة', 'truck']], ['phone', ['الهاتف', 'رقم الهاتف', 'phone']], ['username', ['اسم المستخدم', 'اسم المستخدم (اختياري)', 'username']],
    ['email', ['البريد', 'البريد (اختياري)', 'email']]];

  function withXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise(function (res, rej) {
      var sc = document.createElement('script');
      sc.src = 'xlsx.full.min.js';
      sc.onload = function () { res(window.XLSX); };
      sc.onerror = function () { rej(new Error('تعذّر تحميل قارئ Excel. تأكد من الإنترنت')); };
      document.head.appendChild(sc);
    });
  }

  function saveBook(X, rows, name, sheetName, widths) {
    var ws = X.utils.aoa_to_sheet(rows);
    ws['!cols'] = (widths || []).map(function (w) { return { wch: w }; });
    ws['!views'] = [{ RTL: true }];
    var wb = X.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    X.utils.book_append_sheet(wb, ws, sheetName);
    return wb;
  }

  function downloadTemplate(X) {
    var regs = (st.users && st.users.regions || []).map(function (r) { return r.name; });
    var r1 = regs[0] || 'المنطقة الغربية';
    var wb = saveBook(X, [['الاسم', 'الدور', 'المنطقة', 'الشاحنة', 'الهاتف', 'اسم المستخدم (اختياري)', 'البريد (اختياري)'],
      ['علي المقربج', 'سائق', r1, 'إيسوزو 5-12345', '0912345678', '', ''],
      ['ضوء عمارة', 'سائق', r1, 'هيونداي 5-6789', '0923456789', '', ''],
      ['أحمد محمد', 'مشرف', r1, '', '0911111111', '', ''],
      ['سالم علي', 'أمين المخزن', r1, '', '', '', ''],
      ['محمود سالم', 'مندوب', r1, '', '', '', '']], 'rakan-users-template.xlsx', 'المستخدمون', [22, 14, 22, 20, 16, 22, 24]);
    var help = X.utils.aoa_to_sheet([['الأدوار المسموحة', 'ملاحظات'], ['سائق', 'المنطقة إلزامية، والشاحنة مستحسنة'], ['مشرف', 'المنطقة إلزامية. لأكثر من منطقة افصل بينها بفاصلة: الغربية، طرابلس'],
      ['أمين المخزن', 'المنطقة إلزامية'], ['مندوب', 'المنطقة إلزامية'], ['محاسب', 'يرى كل المناطق'], ['مدير', 'يرى كل المناطق، ويُفضّل كتابة بريده'],
      ['', ''], ['اسم المستخدم', 'اختياري. إن تُرك فارغاً يُنشأ تلقائياً مثل d001 للسائق و s001 للمشرف'], ['المناطق الحالية', regs.join('، ') || 'لا توجد بعد']]);
    help['!cols'] = [{ wch: 18 }, { wch: 70 }];
    help['!views'] = [{ RTL: true }];
    X.utils.book_append_sheet(wb, help, 'تعليمات');
    X.writeFile(wb, 'rakan-users-template.xlsx');
  }

  function parseUsersFile(X, file) {
    return file.arrayBuffer().then(function (buf) {
      var wb = X.read(buf, { type: 'array' });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var aoa = X.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
      var hi = aoa.findIndex(function (r) { return r.some(function (c) { return String(c).trim() === 'الاسم' || String(c).trim().toLowerCase() === 'name'; }); });
      if (hi < 0) throw new Error('لم أجد عمود «الاسم» في الصفحة الأولى. استعمل النموذج');
      var head = aoa[hi].map(function (c) { return String(c).trim(); });
      var idx = {};
      IMP_COLS.forEach(function (c) { idx[c[0]] = head.findIndex(function (h) { return c[1].indexOf(h) >= 0 || c[1].indexOf(h.toLowerCase()) >= 0; }); });
      if (idx.role < 0) throw new Error('لم أجد عمود «الدور». استعمل النموذج');
      return aoa.slice(hi + 1).filter(function (r) { return r.some(function (c) { return String(c).trim(); }); }).map(function (r) {
        var o = {};
        IMP_COLS.forEach(function (c) { o[c[0]] = idx[c[0]] >= 0 ? String(r[idx[c[0]]]).trim() : ''; });
        return o;
      });
    });
  }

  function importUsers() {
    var rows = null;
    var s = sheet('رفع المستخدمين من ملف Excel', '<div class="msg info">الملف يحتوي عمود <b>الاسم</b> و<b>الدور</b> و<b>المنطقة</b>، ويمكن إضافة <b>الشاحنة</b> و<b>الهاتف</b>. حمّل النموذج إن لم يكن لديك ملف.</div>' +
      '<label class="dropzone" id="dz"><input type="file" id="uf" accept=".xlsx,.xls,.csv" hidden><b>اختر ملف Excel</b><div class="small muted">أو اسحبه وأفلته هنا</div></label>' +
      '<div id="ires"></div>', function (s) {
      var dz = q('#dz', s.el), inp = q('#uf', s.el), out = q('#ires', s.el);
      ['dragover', 'dragenter'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('over'); }); });
      ['dragleave', 'drop'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('over'); }); });
      dz.addEventListener('drop', function (e) { if (e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]); });
      inp.onchange = function () { if (inp.files[0]) handle(inp.files[0]); };
      function handle(file) {
        out.innerHTML = '<div class="loading"><span class="spin"></span> جارٍ قراءة الملف…</div>';
        withXLSX().then(function (X) { return parseUsersFile(X, file); }).then(function (r) {
          rows = r;
          return call('users_import', { rows: rows, dry: true });
        }).then(function (res) {
          var sm = res.summary;
          var h = '<div class="msg ' + (res.errors.length ? 'err' : 'ok') + '">في الملف ' + sm.total + ' صفاً: ' + sm.ok + ' جاهز' + (res.errors.length ? ' و' + res.errors.length + ' فيه أخطاء' : '') + '.</div>';
          if (res.errors.length) h += '<div class="card"><h3>صحّح هذه الصفوف في الملف ثم ارفعه مرة أخرى</h3><ul class="errlist">' + res.errors.map(function (e) {
            return '<li>الصف ' + N(e.line) + (e.name ? ' (' + esc(e.name) + ')' : '') + ': ' + esc(e.errors.join('، ')) + '</li>'; }).join('') + '</ul></div>';
          if (sm.new_regions.length) h += '<div class="msg info">ستُنشأ هذه المناطق الجديدة: ' + esc(sm.new_regions.join('، ')) + '</div>';
          var ok = rows.filter(function (r, i) { return !res.errors.some(function (e) { return e.line === i + 2; }); });
          h += '<div class="card scroll-x"><table class="tbl"><thead><tr><th>الاسم</th><th>الدور</th><th>المنطقة</th><th>الشاحنة</th><th>الهاتف</th></tr></thead><tbody>' +
            ok.slice(0, 50).map(function (r) { return '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.role) + '</td><td>' + esc(r.regions) + '</td><td>' + esc(r.truck) + '</td><td class="num">' + esc(r.phone) + '</td></tr>'; }).join('') +
            '</tbody></table>' + (ok.length > 50 ? '<p class="small muted">و' + (ok.length - 50) + ' آخرون</p>' : '') + '</div>';
          if (!res.errors.length) h += '<button class="btn accent big" data-go>إنشاء ' + sm.ok + ' مستخدم</button>';
          out.innerHTML = h;
          var g = q('[data-go]', out);
          if (g) g.onclick = function () {
            busy(g, true);
            call('users_import', { rows: rows }).then(function (r2) { s.close(); showCreated(r2.created); VIEWS.users.load().then(render); })
              .catch(function (e) { busy(g, false); toast(e.message, true); });
          };
        }).catch(function (e) { out.innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; });
      }
    });
    return s;
  }

  function showCreated(list) {
    var link = location.origin + location.pathname;
    sheet('أُنشئ ' + list.length + ' مستخدم', '<div class="msg warn">هذه الأرقام السرية المؤقتة لن تظهر مرة أخرى. اطبعها أو نزّلها الآن، وأعطِ كل شخص بطاقته. يغيّر كل واحد رقمه عند أول دخول.</div>' +
      '<div class="row"><button class="btn primary" data-pc>' + ICON.print + ' طباعة بطاقات الدخول</button><button class="btn ghost" data-xl>تنزيل Excel</button></div>' +
      '<div class="cards">' + list.map(function (u) {
        return '<div class="lcard"><b>' + esc(u.name) + '</b><div class="small muted">' + esc(u.role_ar) + (u.regions ? ' · ' + esc(u.regions) : '') + (u.truck ? ' · ' + esc(u.truck) : '') + '</div>' +
          '<div class="small">اسم المستخدم: <b class="ltr" style="display:inline">' + esc(u.username) + '</b></div><div class="pin">' + esc(u.pin) + '</div></div>';
      }).join('') + '</div>', function (s) {
      q('[data-pc]', s.el).onclick = function () {
        var P = document.getElementById('print');
        P.innerHTML = '<div style="padding:10mm;font-family:Tajawal,sans-serif;display:grid;grid-template-columns:1fr 1fr;gap:6mm">' + list.map(function (u) {
          return '<div style="border:1.5px dashed #777;border-radius:4mm;padding:5mm;break-inside:avoid"><div class="p-head" style="padding-bottom:2mm"><img src="logo.png" alt="" style="height:10mm"><div class="t"><b style="font-size:12pt">بطاقة دخول تطبيق التتبع</b></div></div>' +
            '<div style="margin-top:3mm;font-size:12pt"><b>' + esc(u.name) + '</b> · ' + esc(u.role_ar) + '</div><div style="font-size:11pt;margin-top:2mm">اسم المستخدم: <b dir="ltr">' + esc(u.username) + '</b></div>' +
            '<div style="font-size:11pt">الرقم السري المؤقت: <b dir="ltr" style="font-size:16pt;letter-spacing:2px">' + esc(u.pin) + '</b></div><div style="font-size:9pt;margin-top:2mm;color:#444">الرابط: <span dir="ltr">' + esc(link) + '</span><br>غيّر الرقم السري عند أول دخول ولا تعطه لأحد.</div></div>';
        }).join('') + '</div>';
        setTimeout(function () { window.print(); }, 150);
      };
      q('[data-xl]', s.el).onclick = function () {
        withXLSX().then(function (X) {
          var wb = saveBook(X, [['الاسم', 'الدور', 'المنطقة', 'الشاحنة', 'اسم المستخدم', 'الرقم السري المؤقت']].concat(list.map(function (u) { return [u.name, u.role_ar, u.regions, u.truck, u.username, u.pin]; })), '', 'بيانات الدخول', [22, 14, 22, 20, 16, 18]);
          X.writeFile(wb, 'rakan-logins.xlsx');
        }).catch(function (e) { toast(e.message, true); });
      };
    });
  }

  function regionsForm() {
    var regs = brRegions();
    sheet('المناطق', '<div class="msg info">كل سائق وعميل يتبع منطقة، ولكل منطقة مشرف أو أكثر. العملاء غير الموزّعين يتبعون أول منطقة نشطة.</div><div class="list">' + regs.map(function (r) {
      return '<div class="item"><div class="main"><input class="input" data-rn="' + esc(r.id) + '" value="' + esc(r.name) + '"></div><label class="chk"><input type="checkbox" data-ra="' + esc(r.id) + '"' + (r.active ? ' checked' : '') + '> نشطة</label><button class="btn sm" data-rs="' + esc(r.id) + '">حفظ</button><button class="btn sm danger" data-rdel="' + esc(r.id) + '" aria-label="حذف">حذف</button></div>';
    }).join('') + '</div><div class="row"><input class="input grow" id="nr" placeholder="اسم منطقة جديدة"><button class="btn accent" data-add>إضافة</button></div>', function (s) {
      q('[data-add]', s.el).onclick = function () { call('region_save', { name: q('#nr', s.el).value.trim() }).then(function () { s.close(); toast('أُضيفت المنطقة'); return VIEWS.users.load(); }).then(function () { render(); regionsForm(); }).catch(function (e) { toast(e.message, true); }); };
      qa('[data-rdel]', s.el).forEach(function (b) {
        b.onclick = function () {
          var r = regs.filter(function (x) { return x.id === b.dataset.rdel; })[0];
          confirmBox('حذف منطقة', 'حذف منطقة <b>' + esc(r.name) + '</b> نهائياً؟ يعود عملاؤها إلى المنطقة الافتراضية.', 'حذف').then(function (y) {
            if (y) call('region_delete', { id: r.id }).then(function () { s.close(); toast('حُذفت المنطقة'); return VIEWS.users.load(); }).then(render).catch(function (e) { toast(e.message, true); });
          });
        };
      });
      qa('[data-rs]', s.el).forEach(function (b) { b.onclick = function () { var id = b.dataset.rs; call('region_save', { id: id, name: q('[data-rn="' + id + '"]', s.el).value.trim(), active: q('[data-ra="' + id + '"]', s.el).checked }).then(function () { toast('حُفظت'); VIEWS.users.load().then(render); }).catch(function (e) { toast(e.message, true); }); }; });
    });
  }

  function custRegionsForm() {
    var regs = brRegions().filter(function (r) { return r.active; });
    var s = sheet('توزيع العملاء على المناطق', '<div class="loading"><span class="spin"></span></div>');
    loadCustomers().then(function (cs) {
      s.el.innerHTML = '<input class="input" id="cq" placeholder="بحث"><div class="list" id="cl2">' + cs.map(function (c) {
        return '<div class="item" data-name="' + esc(c.name) + '"><div class="main"><b>' + esc(c.name) + '</b></div><select class="input" style="max-width:170px" data-cr="' + esc(c.id) + '">' + regs.map(function (r) { return '<option value="' + esc(r.id) + '"' + (c.region_id === r.id ? ' selected' : '') + '>' + esc(r.name) + '</option>'; }).join('') + '</select></div>';
      }).join('') + '</div><button class="btn primary big" data-save>حفظ التغييرات</button>';
      var changed = {};
      qa('[data-cr]', s.el).forEach(function (x) { x.onchange = function () { changed[x.dataset.cr] = x.value; }; });
      q('#cq', s.el).oninput = function () { var t = q('#cq', s.el).value.trim(); qa('#cl2 .item', s.el).forEach(function (i) { i.hidden = t && i.dataset.name.indexOf(t) < 0; }); };
      q('[data-save]', s.el).onclick = function () {
        var items = Object.keys(changed).map(function (k) { return { cust_id: k, region_id: changed[k] }; });
        if (!items.length) { s.close(); return; }
        call('cust_region_save', { items: items }).then(function () { s.close(); S.del('customers'); toast('حُفظ توزيع ' + items.length + ' عميل'); }).catch(function (e) { toast(e.message, true); });
      };
    }).catch(function (e) { s.el.innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; });
  }

  /* ===================== المدير: الإعدادات والتدقيق ===================== */
  VIEWS.settings = {
    load: function () { return call('settings_get').then(function (r) { st.setForm = r.settings; }); },
    html: function () {
      var s = st.setForm;
      if (!s) return '<div class="loading"><span class="spin"></span></div>';
      var f = function (k, label, type, help, extra) {
        return '<div class="field"><label for="s_' + k + '">' + esc(label) + '</label><input id="s_' + k + '" class="input' + (type === 'number' || type === 'date' ? ' num' : '') + '" type="' + type + '" value="' + esc(s[k]) + '"' + (extra || '') + '>' + (help ? '<span class="small muted">' + esc(help) + '</span>' : '') + '</div>';
      };
      return '<div class="card"><h2>الإعدادات العامة</h2><form class="form" id="sf">' +
        f('start_date', 'تاريخ بدء المنظومة', 'date', 'الفواتير الأقدم من هذا التاريخ لا تظهر أبداً لأنها سُلّمت بالطريقة القديمة') +
        f('alert_m', 'مسافة التنبيه عند الوصول (متر)', 'number', 'إذا سجّل السائق «وصلت» أبعد من هذه المسافة عن الموقع المعتمد يُنبَّه المشرف') +
        f('gps_min_acc', 'أسوأ دقة مقبولة لتسجيل موقع عميل (متر)', 'number') +
        f('stale_min', 'تنبيه عن هاتف لم يرسل منذ (دقيقة)', 'number') +
        f('photo_months', 'مدة الاحتفاظ بالصور قبل الأرشفة (شهر)', 'number') +
        '<div class="field"><label for="s_arrive_approval">اعتماد المشرف لوصول السائق</label><select id="s_arrive_approval" class="input">' +
          [['المخالف فقط', 'الوصول المخالف فقط (خارج النطاق، أو بلا موقع، أو عميل بلا موقع معتمد)'], ['الكل', 'كل وصول يحتاج اعتماد المشرف'], ['لا', 'بلا اعتماد (تنبيه فقط)']]
            .map(function (o) { return '<option value="' + o[0] + '"' + ((s.arrive_approval || 'المخالف فقط') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
          '</select><span class="small muted">الاعتماد لا يوقف السائق عن التسليم، لكن لا يُغلق اليوم قبل البت فيه</span></div>' +
        '<label class="chk"><input type="checkbox" id="s_show_amounts"' + (s.show_amounts === 'نعم' ? ' checked' : '') + '> إظهار المبالغ على إيصال العميل</label>' +
        f('manager_email', 'بريد المدير (لرموز التحقق)', 'email', '', ' dir="ltr"') +
        '<button class="btn primary big" id="ssv">حفظ الإعدادات</button></form></div>' +
        '<div class="card"><h3>للعلم</h3><p class="small muted" style="margin:0">الصور محفوظة في Google Drive في مجلد «راكان - صور التسليم» مقسّمة بالشهر. ساعات عمل الوكيل تُضبط من لوحة الوكيل على الجهاز الرئيسي.</p></div>';
    },
    bind: function (m) {
      var fm = q('#sf', m);
      if (!fm) return;
      fm.onsubmit = function (e) {
        e.preventDefault();
        var b = q('#ssv', m); busy(b, true);
        var v = function (k) { return q('#s_' + k, m).value.trim(); };
        call('settings_save', { settings: { start_date: v('start_date'), alert_m: v('alert_m'), gps_min_acc: v('gps_min_acc'), stale_min: v('stale_min'),
          photo_months: v('photo_months'), manager_email: v('manager_email'), arrive_approval: q('#s_arrive_approval', m).value, show_amounts: q('#s_show_amounts', m).checked ? 'نعم' : 'لا' } })
          .then(function (r) { busy(b, false); st.settings = r.settings; S.set('settings', r.settings); toast('حُفظت الإعدادات'); })
          .catch(function (e2) { busy(b, false); toast(e2.message, true); });
      };
    }
  };

  VIEWS.audit = {
    load: function () { var a = st.aud || (st.aud = { q: '', undos: false }); return call('audit', { q: a.q, undos: a.undos }).then(function (r) { st.audData = r.events; }); },
    html: function () {
      var a = st.aud || { q: '', undos: false };
      var h = '<div class="card"><div class="row"><input class="input grow" id="aq" placeholder="بحث برقم الإيصال أو الفاتورة أو الاسم" value="' + esc(a.q) + '"><button class="btn" data-aq>بحث</button></div>' +
        '<label class="chk"><input type="checkbox" id="au"' + (a.undos ? ' checked' : '') + '> التراجعات والنقل وإعادة الطباعة فقط</label><p class="small muted" style="margin:0">سجل التدقيق لا يمكن تعديله من أي شاشة.</p></div>';
      if (!st.audData) return h + '<div class="loading"><span class="spin"></span></div>';
      return h + '<div class="card scroll-x"><table class="tbl"><thead><tr><th>الوقت</th><th>المستخدم</th><th>الفعل</th><th>الإيصال/الفاتورة</th><th>قبل ← بعد</th><th>السبب</th></tr></thead><tbody>' +
        st.audData.map(function (e) {
          return '<tr><td>' + N(String(e.t_real).slice(5, 16)) + (e.late ? '<br><span class="badge b-partial">وصلت ' + N(String(e.t_server).slice(11, 16)) + '</span>' : '') + '</td><td>' + esc(e.user_name) + '<div class="small muted">' + esc(e.role) + '</div></td><td>' + esc(e.action) + '</td><td>' + N(e.rec) + (e.invoice ? '<div class="small muted">فاتورة ' + N(e.invoice) + '</div>' : '') + '</td><td class="small">' + esc(e.before) + (e.before || e.after ? ' ← ' : '') + esc(e.after) + '</td><td class="small">' + esc(e.reason) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    },
    bind: function (m) {
      var go = function () { st.aud = { q: q('#aq', m).value.trim(), undos: q('#au', m).checked }; st.audData = null; render(); VIEWS.audit.load().then(render); };
      q('[data-aq]', m).onclick = go;
      q('#au', m).onchange = go;
    }
  };

  boot();
})();
