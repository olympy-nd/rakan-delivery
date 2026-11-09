/* راكان · زر «تثبيت التطبيق»: يظهر عند فتح الموقع في المتصفح ليُضاف التطبيق إلى الجهاز بجانب التطبيقات.
   أندرويد والكمبيوتر (Chrome وEdge وSamsung): زر تثبيت بضغطة واحدة.
   آيفون وآيباد (Safari): خطوتان تظهران بالصور لأن Apple لا تسمح بالتثبيت المباشر. */
(function () {
  'use strict';
  var me = document.currentScript, NAME = (me && me.getAttribute('data-name')) || 'راكان';
  var KEY = 'rk.install.snooze', deferred = null, shown = null;
  var standalone = function () { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; };
  var snoozed = function () { try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < 3 * 864e5; } catch (e) { return false; } };
  var snooze = function () { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} };
  var ua = navigator.userAgent || '';
  var ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var inApp = /FBAN|FBAV|Instagram|Line|WhatsApp|Telegram|wv\)/i.test(ua);
  var iosSafari = ios && /safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua) && !inApp;

  var css = '.rk-inst{position:fixed;inset-inline:12px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:60;max-width:520px;margin:0 auto;background:var(--card,#fff);color:var(--ink,#1B2433);' +
    'border:1px solid var(--line,#DCE3EE);border-radius:18px;box-shadow:0 10px 34px rgba(8,20,40,.22);padding:14px;display:flex;gap:12px;align-items:flex-start;font-family:inherit;animation:rkIn .25s ease-out}' +
    '@keyframes rkIn{from{transform:translateY(20px);opacity:0}to{transform:none;opacity:1}}' +
    '.rk-inst img{width:52px;height:52px;border-radius:12px;flex-shrink:0;background:#fff;border:1px solid var(--line,#DCE3EE)}' +
    '.rk-inst .t{flex:1;min-width:0}.rk-inst b{display:block;font-size:16px;margin-bottom:2px}.rk-inst p{margin:0;font-size:13.5px;color:var(--muted,#5B6678);line-height:1.6}' +
    '.rk-inst .a{display:flex;gap:8px;margin-top:10px}.rk-inst button{font:inherit;font-weight:800;border-radius:12px;padding:10px 18px;cursor:pointer;border:1.5px solid var(--blue,#0C4CA2)}' +
    '.rk-inst .go{background:var(--blue,#0C4CA2);color:#fff}.rk-inst .no{background:transparent;color:var(--muted,#5B6678);border-color:var(--line,#DCE3EE)}' +
    '.rk-inst ol{margin:6px 0 0;padding-inline-start:20px;font-size:14px;line-height:1.9}.rk-inst .ic{display:inline-flex;vertical-align:-5px;width:22px;height:22px;color:var(--blue,#0C4CA2)}' +
    '@media (max-width:760px){body:has(.bnav) .rk-inst{bottom:calc(84px + env(safe-area-inset-bottom))}}' +
    '@media print{.rk-inst{display:none!important}}';
  var SHARE = '<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v8h14v-8"/></svg></span>';
  var ADD = '<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg></span>';

  function show(kind) {
    if (shown || standalone()) return;
    if (!document.getElementById('rk-inst-css')) { var s = document.createElement('style'); s.id = 'rk-inst-css'; s.textContent = css; document.head.appendChild(s); }
    var el = document.createElement('div');
    el.className = 'rk-inst'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'تثبيت التطبيق');
    el.innerHTML = '<img src="icon-192.png" alt=""><div class="t"><b>ثبّت «' + NAME + '» على جهازك</b>' +
      (kind === 'ios' ? '<p>ليظهر بجانب تطبيقاتك ويفتح بضغطة:</p><ol><li>اضغط زر المشاركة ' + SHARE + ' أسفل الشاشة</li><li>اختر «إضافة إلى الشاشة الرئيسية» ' + ADD + '</li></ol><div class="a"><button class="no" data-x>حسناً</button></div>'
        : '<p>يظهر بجانب تطبيقاتك، ويفتح أسرع وبدون شريط المتصفح.</p><div class="a"><button class="go" data-go>تثبيت</button><button class="no" data-x>لاحقاً</button></div>') + '</div>';
    document.body.appendChild(el); shown = el;
    el.querySelector('[data-x]').onclick = function () { snooze(); hide(); };
    var g = el.querySelector('[data-go]');
    if (g) g.onclick = function () {
      if (!deferred) { hide(); return; }
      deferred.prompt();
      deferred.userChoice.then(function (r) { if (r.outcome !== 'accepted') snooze(); deferred = null; hide(); }).catch(hide);
    };
  }
  function hide() { if (shown) { shown.remove(); shown = null; } }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    if (!snoozed()) setTimeout(function () { show('prompt'); }, 1200);
  });
  window.addEventListener('appinstalled', function () { deferred = null; hide(); });
  if (iosSafari && !standalone() && !snoozed()) window.addEventListener('load', function () { setTimeout(function () { show('ios'); }, 1500); });
  // لزر «تثبيت التطبيق» داخل القوائم
  window.RKInstall = { can: function () { return !standalone() && (!!deferred || iosSafari); }, show: function () { show(deferred ? 'prompt' : 'ios'); } };
})();
