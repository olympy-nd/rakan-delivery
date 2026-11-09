/* راكان · المنظومة الأولى: التقارير المالية والتنفيذية والمبيعات والمديونيات
   البيانات تأتي من الوكيل عبر Google، تُحفظ على جهاز المدير والمحاسب، وتُحسب التقارير هنا مباشرة. */
(function () {
  'use strict';
  window.RKFIN = function (A) {
    var esc = A.esc, q = A.q, qa = A.qa, call = A.call, sheet = A.sheet, toast = A.toast, busy = A.busy, S = RK.S, ICON = A.ICON, st = A.st;
    var F = { rows: null, rev: 0, meta: null, D: null, boxes: [], reports: [], sub: 'dash', loading: null, progress: '', cur: null,
      dashPer: 'month', custom: null };

    /* ===================== أدوات ===================== */
    function N(v) { return '<span class="num">' + esc(v) + '</span>'; }
    function fm(n) { n = Number(n) || 0; return (Math.abs(n) < 0.0005 ? 0 : n).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }); }
    function fk(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); }
    function fq(n) { return (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
    function pct(a, b) { return b ? (a / b * 100) : 0; }
    function fp(n) { return (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 1 }) + '%'; }
    function today() { return RK.nowStr().slice(0, 10); }
    function d2t(d) { return Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)); }
    function t2d(t) { return new Date(t).toISOString().slice(0, 10); }
    function addD(d, n) { return t2d(d2t(d) + n * 864e5); }
    function days(a, b) { return Math.round((d2t(b) - d2t(a)) / 864e5); }
    function weekStart(d) { var w = new Date(d2t(d)).getUTCDay(); return addD(d, -((w + 1) % 7)); }   // الأسبوع يبدأ السبت
    function monthEnd(m) { var y = +m.slice(0, 4), mo = +m.slice(5, 7); return t2d(Date.UTC(y, mo, 0)); }
    var MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    function monthLabel(m) { return MONTHS[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4); }
    function bucket(d, g) { return g === 'month' ? d.slice(0, 7) : g === 'week' ? weekStart(d) : d; }
    function bucketLabel(k, g) { return g === 'month' ? monthLabel(k) : g === 'week' ? 'أسبوع ' + k : k; }

    var PRESETS = [['today', 'اليوم'], ['yesterday', 'أمس'], ['week', 'هذا الأسبوع'], ['last7', 'آخر 7 أيام'], ['month', 'هذا الشهر'],
      ['lastmonth', 'الشهر الماضي'], ['quarter', 'هذا الربع'], ['year', 'هذه السنة'], ['custom', 'فترة محددة']];
    function presetRange(p, from, to) {
      var t = today(), m = t.slice(0, 7);
      switch (p) {
        case 'today': return [t, t];
        case 'yesterday': return [addD(t, -1), addD(t, -1)];
        case 'week': return [weekStart(t), t];
        case 'last7': return [addD(t, -6), t];
        case 'month': return [m + '-01', t];
        case 'lastmonth': var lm = addD(m + '-01', -1).slice(0, 7); return [lm + '-01', monthEnd(lm)];
        case 'quarter': var qm = Math.floor((+t.slice(5, 7) - 1) / 3) * 3 + 1; return [t.slice(0, 4) + '-' + ('0' + qm).slice(-2) + '-01', t];
        case 'year': return [t.slice(0, 4) + '-01-01', t];
        default: return [from || m + '-01', to || t];
      }
    }
    function prevRange(from, to, p) {
      if (p === 'month' || p === 'lastmonth') {
        var pm = addD(from, -1).slice(0, 7), n = days(from, to);
        var pe = addD(pm + '-01', n);
        return [pm + '-01', pe > monthEnd(pm) ? monthEnd(pm) : pe];
      }
      if (p === 'year') { var y = +from.slice(0, 4) - 1; return [y + from.slice(4), y + to.slice(4)]; }
      var len = days(from, to) + 1;
      return [addD(from, -len), addD(from, -1)];
    }
    function perLabel(from, to) { return from === to ? N(from) : 'من ' + N(from) + ' إلى ' + N(to); }

    /* ===================== تحميل البيانات ===================== */
    function load(force) {
      if (F.loading) return F.loading;
      F.loading = (F.rows ? Promise.resolve() : Promise.all([S.get('fin:rows'), S.get('fin:rev'), S.get('fin:meta'), S.get('fin:aux')]).then(function (v) {
        F.rows = v[0] || {}; F.rev = v[1] || 0; F.meta = v[2] || null;
        if (v[3]) { F.boxes = v[3].boxes || []; F.reports = v[3].reports || []; }
        if (Object.keys(F.rows).length) build();
      })).then(function () {
        if (!navigator.onLine) throw new Error('لا يوجد اتصال بالإنترنت');
        return pull(force).then(function () { return Promise.all([call('fin_boxes'), call('fin_reports')]); }).then(function (r) {
          F.boxes = r[0].boxes; F.reports = r[1].reports; F.error = null; F.lastPull = Date.now();
          return S.set('fin:aux', { boxes: F.boxes, reports: F.reports });
        });
      }).catch(function (e) {
        if (!F.D) { F.error = e.message; throw e; }
        if (!F.quiet) toast('تعذّر تحديث البيانات المالية (' + e.message + ')، تُعرض آخر بيانات محفوظة', true);
      }).finally(function () { F.loading = null; F.progress = ''; });
      return F.loading;
    }

    function pull(force) {
      var changed = 0;
      var step = function () {
        return call('fin_pull', { since: F.rev, limit: 8000 }, { timeout: 120000 }).then(function (r) {
          F.meta = r.meta;
          r.rows.forEach(function (x) {
            var key = x[0] + ':' + x[4];
            if (x[2]) delete F.rows[key]; else F.rows[key] = [x[0], x[1]];
            changed++;
          });
          F.rev = r.next;
          if (r.more) { F.progress = 'جارٍ تحميل البيانات المالية… ' + Object.keys(F.rows).length.toLocaleString('en-US') + ' سجل'; paintProgress(); return step(); }
        });
      };
      return step().then(function () {
        if (changed || !F.D || force) { if (Object.keys(F.rows).length) build(); else F.D = null; return Promise.all([S.set('fin:rows', F.rows), S.set('fin:rev', F.rev), S.set('fin:meta', F.meta)]); }
        return S.set('fin:meta', F.meta);
      });
    }

    function paintProgress() { var el = q('#finprog'); if (el) el.textContent = F.progress; }

    /* ===================== بناء نموذج البيانات ===================== */
    var SALE = 102, SRET = 104, PUR = 105, PRET = 107;
    function build() {
      var T = { acc: {}, bt: {}, it: {}, cu: {}, ag: {}, us: {}, st: {}, item: {}, jl: [], inv: {}, invl: [] };
      Object.keys(F.rows).forEach(function (k) {
        var v = F.rows[k], d;
        try { d = JSON.parse(v[1]); } catch (e) { return; }
        if (v[0] === 'jl' || v[0] === 'invl') T[v[0]].push(d); else if (T[v[0]]) T[v[0]][d.id] = d;
      });
      // الحسابات: الشجرة والمسار والطبيعة
      var kids = {};
      Object.keys(T.acc).forEach(function (id) { var a = T.acc[id]; a.kids = []; a.lvl = Number(a.lvl) || 1; a.fin = Number(a.fin) || 0; });
      Object.keys(T.acc).forEach(function (id) { var a = T.acc[id], p = T.acc[a.parent]; if (p && a.parent !== id) p.kids.push(id); });
      Object.keys(T.acc).forEach(function (id) {
        var a = T.acc[id], r = a, guard = 0;
        while (T.acc[r.parent] && r.parent !== r.id && guard++ < 12) r = T.acc[r.parent];
        a.root = r.id; a.rootCode = String(r.code || '').charAt(0);
        a.pl = a.fin === 2 || a.fin === 3 || a.rootCode === '3' || a.rootCode === '4';
        a.leaf = !a.kids.length;
      });
      Object.keys(T.acc).forEach(function (id) { var a = T.acc[id]; a.kids.sort(function (x, y) { return String(T.acc[x].po || T.acc[x].code).localeCompare(String(T.acc[y].po || T.acc[y].code)); }); });
      // أنواع القيود
      Object.keys(T.bt).forEach(function (id) {
        var b = T.bt[id], n = String(b.name || '');
        b.kind = /قبض|مقبوضات/.test(n) ? 'r' : /دفع|مدفوعات/.test(n) ? 'p' : /افتتاح/.test(n) ? 'o' : 'j';
      });
      // أسطر القيود
      var byAcc = {}, byEntry = {};
      T.jl.forEach(function (l) {
        l.d = String(l.dt || '').slice(0, 10); l.dr = Number(l.dr) || 0; l.cr = Number(l.cr) || 0;
        var b = T.bt[l.bt];
        l.k = l.src && T.inv[l.src] ? 'i' : b ? b.kind : 'j';
        l.btn = b ? b.name : T.it[l.bt] ? T.it[l.bt].name : (l.k === 'i' ? 'قيد فاتورة' : 'قيد');
        (byAcc[l.a] = byAcc[l.a] || []).push(l);
        (byEntry[l.e] = byEntry[l.e] || []).push(l);
      });
      Object.keys(byAcc).forEach(function (a) { byAcc[a].sort(cmpLine); });
      // الفواتير وأسطرها
      Object.keys(T.inv).forEach(function (id) {
        var v = T.inv[id];
        v.d = String(v.dt || '').slice(0, 10); v.c = Number(v.c); v.net = Number(v.net) || 0; v.qty = Number(v.qty) || 0;
        v.sign = v.c === SRET || v.c === PRET ? -1 : 1;
        v.name = (T.acc[v.acc] && T.acc[v.acc].name) || (T.cu[v.cu] && T.cu[v.cu].name) || '—';
        v.lines = []; v.profit = 0; v.cost = 0;
      });
      var unitF = {};
      T.invl.forEach(function (l) {
        var v = T.inv[l.inv];
        if (!v) return;
        l.v = v; l.q = Number(l.q) || 0; l.qb = Number(l.qb) || l.q; l.tot = Number(l.tot) || 0; l.cost = Number(l.cost) || 0; l.win = Number(l.win) || (l.cost ? l.tot - l.cost : 0);   // سراج لا يملأ حقل الربح، فنحسبه من القيمة والتكلفة
        v.lines.push(l); v.profit += l.win; v.cost += l.cost;
        if (v.c === SALE && l.q) { var u = unitF[l.item] || (unitF[l.item] = {}); var f = Math.round(l.qb / l.q * 1000) / 1000; var key = f + '|' + (l.un || ''); u[key] = (u[key] || 0) + 1; }
      });
      // الوحدة الأكثر استعمالاً في البيع لكل صنف (لعرض الكميات بالصندوق بدل القطعة)
      Object.keys(T.item).forEach(function (id) {
        var it = T.item[id], u = unitF[id], best = null, n = 0;
        if (u) Object.keys(u).forEach(function (k) { if (u[k] > n) { n = u[k]; best = k; } });
        it.f = best ? Number(best.split('|')[0]) || 1 : 1; it.mu = best ? best.split('|')[1] || it.unit || '' : it.unit || '';
      });
      F.D = { T: T, byAcc: byAcc, byEntry: byEntry, accList: Object.keys(T.acc).map(function (k) { return T.acc[k]; })
        .sort(function (x, y) { return String(x.po || x.code).localeCompare(String(y.po || y.code)); }),
        maxDate: T.jl.reduce(function (m, l) { return l.d > m ? l.d : m; }, '') };
      F.D.invs = Object.keys(T.inv).map(function (k) { return T.inv[k]; });
    }
    function cmpLine(x, y) { return x.d < y.d ? -1 : x.d > y.d ? 1 : (Number(x.e) - Number(y.e)) || (Number(x.so) - Number(y.so)); }

    /* ---------- استعلامات الحسابات ---------- */
    function T() { return F.D.T; }
    function acc(id) { return T().acc[id]; }
    function accName(id) { var a = acc(id); return a ? a.name : '—'; }
    function descend(id) {
      var out = [], seen = {};
      (function walk(x) { if (seen[x]) return; seen[x] = 1; out.push(x); var a = acc(x); if (a) a.kids.forEach(walk); })(id);
      return out;
    }
    function byCodes(codes) {
      var ids = [];
      String(codes || '').split(',').map(function (c) { return c.trim(); }).filter(String).forEach(function (c) {
        F.D.accList.forEach(function (a) { if (String(a.code) === c) ids = ids.concat(descend(a.id)); });
      });
      return ids;
    }
    function leavesOf(ids) { return ids.filter(function (id) { var a = acc(id); return a && a.leaf; }); }
    // رصيد مجموعة حسابات: قبل الفترة، وحركتها، وبعدها. الحسابات الختامية تبدأ من بداية السنة
    function balance(ids, from, to) {
      var r = { open: 0, dr: 0, cr: 0, close: 0, last: '', lastCr: '' };
      var ys = yearStart();
      ids.forEach(function (id) {
        var a = acc(id), ls = F.D.byAcc[id];
        if (!ls) return;
        var pl = a && a.pl;
        for (var i = 0; i < ls.length; i++) {
          var l = ls[i];
          if (to && l.d > to) break;
          if (from && l.d < from) { if (!pl || l.d >= ys) r.open += l.dr - l.cr; continue; }
          r.dr += l.dr; r.cr += l.cr;
          if (l.d > r.last) r.last = l.d;
          if (l.cr && l.d > r.lastCr) r.lastCr = l.d;
        }
      });
      r.close = r.open + r.dr - r.cr;
      return r;
    }
    function yearStart() { return (F.meta && F.meta.settings && F.meta.settings.year_start) || today().slice(0, 4) + '-01-01'; }
    function recvIds() { return leavesOf(byCodes((F.meta && F.meta.settings && F.meta.settings.recv) || '1601')); }
    function payIds() { return leavesOf(byCodes((F.meta && F.meta.settings && F.meta.settings.pay) || '261')); }
    function boxIds() { return F.boxes.filter(function (b) { return b.active; }).map(function (b) { return b.acc; }); }
    function counterpart(l, ids) {
      var others = (F.D.byEntry[l.e] || []).filter(function (x) { return ids.indexOf(x.a) < 0 && (l.dr ? x.cr : x.dr); });
      if (!others.length) others = (F.D.byEntry[l.e] || []).filter(function (x) { return ids.indexOf(x.a) < 0; });
      var names = [];
      others.forEach(function (x) { var n = accName(x.a); if (names.indexOf(n) < 0) names.push(n); });
      return names.length > 2 ? names[0] + ' و' + (names.length - 1) + ' أخرى' : names.join('، ');
    }
    function entryTotal(lines) { return lines.reduce(function (s, l) { return s + l.dr; }, 0); }

    /* ---------- الفواتير ---------- */
    function invsIn(types, from, to) {
      return F.D.invs.filter(function (v) { return types.indexOf(v.c) >= 0 && v.d >= from && v.d <= to; });
    }
    function salesStats(from, to) {
      var s = { sales: 0, ret: 0, net: 0, n: 0, nr: 0, profit: 0, cost: 0, purch: 0, pret: 0 };
      F.D.invs.forEach(function (v) {
        if (v.d < from || v.d > to) return;
        if (v.c === SALE) { s.sales += v.net; s.n++; s.profit += v.profit; s.cost += v.cost; }
        else if (v.c === SRET) { s.ret += v.net; s.nr++; s.profit -= v.profit; s.cost -= v.cost; }
        else if (v.c === PUR) s.purch += v.net;
        else if (v.c === PRET) s.pret += v.net;
      });
      s.net = s.sales - s.ret;
      return s;
    }
    function cashStats(from, to) {
      var r = { rec: 0, pay: 0, recN: 0, payN: 0 }, seen = {};
      T().jl.forEach(function (l) {
        if (l.d < from || l.d > to || (l.k !== 'r' && l.k !== 'p') || seen[l.e]) return;
        seen[l.e] = 1;
        var tot = entryTotal(F.D.byEntry[l.e]);
        if (l.k === 'r') { r.rec += tot; r.recN++; } else { r.pay += tot; r.payN++; }
      });
      var b = boxIds();
      if (b.length) { var bb = balance(b, from, to); r.boxIn = bb.dr; r.boxOut = bb.cr; r.boxNet = bb.dr - bb.cr; r.boxClose = bb.close; }
      return r;
    }

    /* ===================== تعريف التقارير الجاهزة ===================== */
    var CATS = [['exec', 'تنفيذية'], ['sales', 'المبيعات'], ['debts', 'المديونيات'], ['fin', 'مالية ومحاسبية'], ['purch', 'المشتريات'], ['admin', 'إدارية'], ['mine', 'تقاريري المخصصة']];
    var GRAN = [['day', 'يومي'], ['week', 'أسبوعي'], ['month', 'شهري']];
    var R = {};

    function C(k, l, t) { return { k: k, l: l, t: t || 'text' }; }

    R.exec_summary = { cat: 'exec', name: 'الملخص التنفيذي', desc: 'أهم المؤشرات للفترة مقارنة بالفترة السابقة', params: ['period'],
      run: function (p) {
        var pr = prevRange(p.from, p.to, p.preset);
        var a = salesStats(p.from, p.to), b = salesStats(pr[0], pr[1]), ca = cashStats(p.from, p.to), cb = cashStats(pr[0], pr[1]);
        var ra = balance(recvIds(), null, p.to).close, rb = balance(recvIds(), null, pr[1]).close;
        var rows = [
          ['صافي المبيعات', a.net, b.net], ['المبيعات', a.sales, b.sales], ['المرتجعات', a.ret, b.ret],
          ['نسبة المرتجعات %', pct(a.ret, a.sales), pct(b.ret, b.sales), 'p'], ['عدد فواتير المبيع', a.n, b.n, 'n'],
          ['مجمل الربح', a.profit, b.profit], ['هامش الربح %', pct(a.profit, a.net), pct(b.profit, b.net), 'p'],
          ['المشتريات (صافي)', a.purch - a.pret, b.purch - b.pret], ['المقبوضات', ca.rec, cb.rec], ['المدفوعات', ca.pay, cb.pay],
          ['صافي المقبوضات والمدفوعات', ca.rec - ca.pay, cb.rec - cb.pay], ['مديونية العملاء في نهاية الفترة', ra, rb]];
        if (ca.boxNet !== undefined) rows.push(['صافي حركة الصناديق والبنوك', ca.boxNet, cb.boxNet], ['أرصدة الصناديق والبنوك في نهاية الفترة', ca.boxClose, cb.boxClose]);
        return { cols: [C('m', 'المؤشر'), C('a', 'الفترة الحالية', 'money'), C('b', 'الفترة السابقة', 'money'), C('ch', 'التغيّر %', 'pct')],
          rows: rows.map(function (r) { return { m: r[0], a: r[1], b: r[2], ch: r[2] ? (r[1] - r[2]) / Math.abs(r[2]) * 100 : null, _fmt: r[3] }; }),
          note: 'الفترة السابقة: ' + perLabel(pr[0], pr[1]) };
      } };

    R.income = { cat: 'exec', name: 'قائمة الدخل (الأرباح والخسائر)', desc: 'الموارد والاستخدامات من دليل حسابات سراج للفترة', params: ['period', 'level'],
      run: function (p) {
        var depth = Number(p.level || 3), rows = [], tot = { r: 0, u: 0 };
        var roots = F.D.accList.filter(function (a) { return a.lvl === 1 && (a.rootCode === '4' || a.rootCode === '3'); });
        roots.sort(function (x, y) { return x.rootCode === '4' ? -1 : 1; });
        roots.forEach(function (r) {
          var res = r.rootCode === '4';
          (function walk(id, lv) {
            var a = acc(id), b = balance(descend(id), p.from, p.to), v = res ? b.cr - b.dr : b.dr - b.cr;
            if (Math.abs(v) < 0.0005 && lv > 1) return;
            rows.push({ code: a.code, name: a.name, v: v, _lvl: lv - 1, _b: lv === 1, _acc: id });
            if (lv === 1) tot[res ? 'r' : 'u'] = v;
            if (lv < depth) a.kids.forEach(function (k) { walk(k, lv + 1); });
          })(r.id, 1);
        });
        var net = tot.r - tot.u;
        rows.push({ code: '', name: net >= 0 ? 'صافي الربح' : 'صافي الخسارة', v: net, _b: true, _hl: true });
        return { cols: [C('code', 'الرمز'), C('name', 'الحساب'), C('v', 'المبلغ', 'money')], rows: rows,
          note: 'الموارد (4) بطبيعة دائنة، والاستخدامات (3) بطبيعة مدينة، كما في دليل حسابات سراج' };
      } };

    R.balance_sheet = { cat: 'exec', name: 'المركز المالي (الميزانية)', desc: 'الأصول والخصوم وحقوق الملكية في تاريخ محدد', params: ['asof', 'level'],
      run: function (p) {
        var depth = Number(p.level || 3), rows = [], tot = {};
        ['1', '2'].forEach(function (rc) {
          var asset = rc === '1';
          F.D.accList.filter(function (a) { return a.lvl === 1 && a.rootCode === rc && !a.pl; }).forEach(function (r) {
            (function walk(id, lv) {
              var a = acc(id), b = balance(descend(id).filter(function (x) { return !acc(x).pl; }), null, p.asof), v = asset ? b.close : -b.close;
              if (Math.abs(v) < 0.0005 && lv > 1) return;
              rows.push({ code: a.code, name: a.name, v: v, _lvl: lv - 1, _b: lv === 1, _acc: id });
              if (lv === 1) tot[rc] = (tot[rc] || 0) + v;
              if (lv < depth) a.kids.forEach(function (k) { walk(k, lv + 1); });
            })(r.id, 1);
          });
        });
        var plIds = F.D.accList.filter(function (a) { return a.pl; }).map(function (a) { return a.id; });
        var plb = balance(plIds, yearStart(), p.asof), profit = plb.cr - plb.dr;
        rows.push({ code: '', name: 'صافي ربح (خسارة) السنة حتى التاريخ', v: profit, _b: true });
        var liab = (tot['2'] || 0) + profit;
        rows.push({ code: '', name: 'إجمالي الخصوم وحقوق الملكية والنتيجة', v: liab, _b: true, _hl: true });
        var diff = (tot['1'] || 0) - liab;
        return { cols: [C('code', 'الرمز'), C('name', 'الحساب'), C('v', 'الرصيد', 'money')], rows: rows,
          note: Math.abs(diff) < 1 ? 'الميزانية متوازنة: إجمالي الأصول = الخصوم وحقوق الملكية والنتيجة' : 'فرق التوازن: ' + fm(diff) + ' (حسابات خارج الأصول والخصوم، مثل الحساب الختامي)' };
      } };

    function salesRowsBy(p, keyFn, labelFn) {
      var g = {};
      invsIn([SALE, SRET], p.from, p.to).forEach(function (v) {
        var k = keyFn(v), r = g[k] || (g[k] = { k: k, name: labelFn(v, k), n: 0, sales: 0, ret: 0, net: 0, profit: 0 });
        if (v.c === SALE) { r.n++; r.sales += v.net; r.profit += v.profit; } else { r.ret += v.net; r.profit -= v.profit; }
        r.net = r.sales - r.ret;
      });
      var list = Object.keys(g).map(function (k) { return g[k]; });
      var totNet = list.reduce(function (s, r) { return s + r.net; }, 0);
      list.forEach(function (r) { r.share = pct(r.net, totNet); r.margin = pct(r.profit, r.net); r.rp = pct(r.ret, r.sales); });
      return list;
    }
    var SALES_COLS = [C('n', 'عدد الفواتير', 'int'), C('sales', 'المبيعات', 'money'), C('ret', 'المرتجعات', 'money'), C('net', 'الصافي', 'money'),
      C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'), C('share', 'الحصة', 'pct')];

    R.sales_trend = { cat: 'sales', name: 'المبيعات اليومية والأسبوعية والشهرية', desc: 'المبيعات والمرتجعات والربح لكل يوم أو أسبوع أو شهر', params: ['period', 'gran'],
      run: function (p) {
        var g = p.gran || 'day';
        var list = salesRowsBy(p, function (v) { return bucket(v.d, g); }, function (v, k) { return bucketLabel(k, g); });
        list.sort(function (a, b) { return a.k < b.k ? -1 : 1; });
        return { cols: [C('name', g === 'day' ? 'اليوم' : g === 'week' ? 'الأسبوع' : 'الشهر')].concat(SALES_COLS), rows: list, total: sumRow(list, SALES_COLS),
          chart: { type: 'bar', x: 'name', y: ['net', 'profit'], yl: ['صافي المبيعات', 'مجمل الربح'] } };
      } };
    R.sales_cust = { cat: 'sales', name: 'المبيعات حسب العميل', desc: 'صافي المبيعات والمرتجعات والربح لكل عميل', params: ['period', 'top'],
      run: function (p) {
        var list = salesRowsBy(p, function (v) { return v.acc || v.cu; }, function (v) { return v.name; }).sort(function (a, b) { return b.net - a.net; });
        return topN({ cols: [C('name', 'العميل')].concat(SALES_COLS, [C('rp', 'نسبة المرتجع', 'pct')]), rows: list, total: sumRow(list, SALES_COLS),
          chart: { type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المبيعات'], limit: 12 } }, p);
      } };
    R.sales_item = { cat: 'sales', name: 'المبيعات حسب الصنف وربحيته', desc: 'الكميات والقيم والتكلفة والربح لكل صنف', params: ['period', 'top'],
      run: function (p) {
        var g = {};
        invsIn([SALE, SRET], p.from, p.to).forEach(function (v) {
          v.lines.forEach(function (l) {
            var it = T().item[l.item] || { name: 'صنف ' + l.item, f: 1, mu: l.un };
            var r = g[l.item] || (g[l.item] = { name: it.name, unit: it.mu, q: 0, sales: 0, ret: 0, net: 0, cost: 0, profit: 0, gift: 0 });
            var s = v.c === SALE ? 1 : -1;
            r.q += s * l.qb / (it.f || 1); r.gift += s * (Number(l.g) || 0);
            if (s > 0) r.sales += l.tot; else r.ret += l.tot;
            r.cost += s * l.cost; r.profit += s * l.win; r.net = r.sales - r.ret;
          });
        });
        var list = Object.keys(g).map(function (k) { var r = g[k]; r.margin = pct(r.profit, r.net); return r; }).sort(function (a, b) { return b.net - a.net; });
        var cols = [C('name', 'الصنف'), C('q', 'صافي الكمية', 'qty'), C('unit', 'الوحدة'), C('sales', 'المبيعات', 'money'), C('ret', 'المرتجعات', 'money'),
          C('net', 'الصافي', 'money'), C('cost', 'التكلفة', 'money'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct')];
        return topN({ cols: cols, rows: list, total: sumRow(list, cols.filter(function (c) { return c.t === 'money'; })),
          chart: { type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المبيعات'], limit: 12 } }, p);
      } };
    R.sales_rep = { cat: 'sales', name: 'المبيعات حسب المندوب والمخزن', desc: 'توزيع المبيعات على المناديب أو المخازن', params: ['period', 'by'],
      run: function (p) {
        var by = p.by || 'ag';
        var list = salesRowsBy(p, function (v) { return v[by] || '0'; }, function (v, k) {
          var src = by === 'ag' ? T().ag : by === 'st' ? T().st : T().us; return (src[k] && src[k].name) || (k === '0' ? 'بدون' : k);
        }).sort(function (a, b) { return b.net - a.net; });
        return { cols: [C('name', by === 'ag' ? 'المندوب' : by === 'st' ? 'المخزن' : 'المستخدم')].concat(SALES_COLS), rows: list, total: sumRow(list, SALES_COLS) };
      } };
    R.sales_returns = { cat: 'sales', name: 'مرتجعات المبيعات', desc: 'المرتجعات حسب العميل أو الصنف ونسبتها من المبيعات', params: ['period', 'rby'],
      run: function (p) {
        if (p.rby === 'item') {
          var res = R.sales_item.run(Object.assign({}, p, { top: 0 }));
          var rows = res.rows.filter(function (r) { return r.ret; }).map(function (r) { return { name: r.name, sales: r.sales, ret: r.ret, rp: pct(r.ret, r.sales) }; }).sort(function (a, b) { return b.ret - a.ret; });
          return { cols: [C('name', 'الصنف'), C('sales', 'المبيعات', 'money'), C('ret', 'المرتجعات', 'money'), C('rp', 'نسبة المرتجع', 'pct')], rows: rows, total: sumRow(rows, [C('sales', '', 'money'), C('ret', '', 'money')]) };
        }
        var list = salesRowsBy(p, function (v) { return v.acc || v.cu; }, function (v) { return v.name; }).filter(function (r) { return r.ret; }).sort(function (a, b) { return b.ret - a.ret; });
        var cols = [C('name', 'العميل'), C('sales', 'المبيعات', 'money'), C('ret', 'المرتجعات', 'money'), C('rp', 'نسبة المرتجع', 'pct')];
        var tot = sumRow(list, cols); tot.rp = pct(tot.ret, tot.sales);
        return { cols: cols, rows: list, total: tot };
      } };
    R.sales_invoices = { cat: 'sales', name: 'تفاصيل فواتير المبيع والمرتجع', desc: 'كل فاتورة برقمها وعميلها وقيمتها', params: ['period', 'search'],
      run: function (p) {
        var s = String(p.search || '').trim();
        var list = invsIn([SALE, SRET], p.from, p.to).filter(function (v) { return !s || (v.no + ' ' + v.name + ' ' + (v.note || '')).indexOf(s) >= 0; })
          .sort(function (a, b) { return a.dt < b.dt ? -1 : 1; }).map(function (v) {
            return { d: v.d, no: v.no, type: v.c === SALE ? 'مبيع' : 'مرتجع', name: v.name, st: (T().st[v.st] || {}).name || '', qty: v.sign * v.qty, net: v.sign * v.net, profit: v.sign * v.profit, note: v.note || '' };
          });
        var cols = [C('d', 'التاريخ'), C('no', 'الرقم'), C('type', 'النوع'), C('name', 'العميل'), C('st', 'المخزن'), C('qty', 'الكمية', 'qty'), C('net', 'الصافي', 'money'), C('profit', 'الربح', 'money'), C('note', 'البيان')];
        return { cols: cols, rows: list, total: sumRow(list, [C('qty', '', 'qty'), C('net', '', 'money'), C('profit', '', 'money')]) };
      } };

    /* ---------- المديونيات ---------- */
    function custLimit(accId) {
      var cu = T().cu, lim = 0;
      Object.keys(cu).forEach(function (k) { if (String(cu[k].acc) === String(accId)) lim = Number(cu[k].lim) || 0; });
      return lim;
    }
    R.recv_balances = { cat: 'debts', name: 'أرصدة العملاء (المديونيات)', desc: 'ما على كل عميل في تاريخ محدد مع آخر حركة وآخر تحصيل', params: ['asof', 'nonzero'],
      run: function (p) { return partyBalances(recvIds(), p, 1, 'العميل'); } };
    R.pay_balances = { cat: 'debts', name: 'أرصدة الموردين', desc: 'ما للموردين على الشركة في تاريخ محدد', params: ['asof', 'nonzero'],
      run: function (p) { return partyBalances(payIds(), p, -1, 'المورد'); } };
    function partyBalances(ids, p, sign, label) {
      var rows = [];
      ids.forEach(function (id) {
        var b = balance([id], null, p.asof), v = sign * b.close;
        if (p.nonzero !== 'all' && Math.abs(v) < 0.0005) return;
        var lim = sign > 0 ? custLimit(id) : 0;
        rows.push({ code: acc(id).code, name: accName(id), v: v, last: b.last || lastMove(id, p.asof), lastCr: sign > 0 ? (b.lastCr || lastCredit(id, p.asof)) : '', lim: lim || '', over: lim && v > lim ? 'تجاوز الحد' : '', _acc: id });
      });
      rows.sort(function (a, b) { return b.v - a.v; });
      var cols = [C('code', 'الرمز'), C('name', label), C('v', 'الرصيد', 'money'), C('last', 'آخر حركة'), C('lastCr', sign > 0 ? 'آخر تحصيل' : '')];
      if (sign > 0) cols.push(C('lim', 'حد الائتمان', 'money'), C('over', 'تنبيه'));
      return { cols: cols.filter(function (c) { return c.l; }), rows: rows, total: sumRow(rows, [C('v', '', 'money')]),
        chart: { type: 'hbar', x: 'name', y: ['v'], yl: ['الرصيد'], limit: 12 }, note: 'مجموعة الحسابات تُضبط من «الإعدادات المالية»' };
    }
    function lastMove(id, asof) { var ls = F.D.byAcc[id] || [], d = ''; ls.forEach(function (l) { if (l.d <= asof) d = l.d; }); return d; }
    function lastCredit(id, asof) { var ls = F.D.byAcc[id] || [], d = ''; ls.forEach(function (l) { if (l.d <= asof && l.cr) d = l.d; }); return d; }

    R.recv_aging = { cat: 'debts', name: 'أعمار الديون', desc: 'توزيع مديونية كل عميل حسب عمرها (يُخصم التحصيل من أقدم دين)', params: ['asof'],
      run: function (p) {
        var B = [[0, 30, 'b1', '0-30 يوماً'], [31, 60, 'b2', '31-60'], [61, 90, 'b3', '61-90'], [91, 120, 'b4', '91-120'], [121, 1e9, 'b5', 'أكثر من 120']];
        var rows = [];
        recvIds().forEach(function (id) {
          var ls = (F.D.byAcc[id] || []).filter(function (l) { return l.d <= p.asof; });
          var debts = [], credit = 0;
          ls.forEach(function (l) { if (l.dr) debts.push({ d: l.d, v: l.dr }); credit += l.cr; });
          debts.forEach(function (x) { var u = Math.min(x.v, credit); x.v -= u; credit -= u; });
          var r = { code: acc(id).code, name: accName(id), tot: 0, _acc: id };
          B.forEach(function (b) { r[b[2]] = 0; });
          debts.forEach(function (x) { if (x.v < 0.0005) return; var age = days(x.d, p.asof); B.forEach(function (b) { if (age >= b[0] && age <= b[1]) r[b[2]] += x.v; }); r.tot += x.v; });
          if (credit > 0.0005) r.adv = credit;
          if (r.tot > 0.0005 || r.adv) rows.push(r);
        });
        rows.sort(function (a, b) { return b.tot - a.tot; });
        var cols = [C('code', 'الرمز'), C('name', 'العميل'), C('tot', 'إجمالي الدين', 'money')].concat(B.map(function (b) { return C(b[2], b[3], 'money'); }), [C('adv', 'رصيد دائن (مقدّم)', 'money')]);
        return { cols: cols, rows: rows, total: sumRow(rows, cols.filter(function (c) { return c.t === 'money'; })) };
      } };

    R.debt_movement = { cat: 'debts', name: 'حركة المديونيات اليومية والأسبوعية والشهرية', desc: 'رصيد أول المدة والزيادة والتحصيل ورصيد آخر المدة لمجموع العملاء', params: ['period', 'gran'],
      run: function (p) {
        var g = p.gran || 'day', ids = recvIds(), set = {};
        ids.forEach(function (i) { set[i] = 1; });
        var open = balance(ids, p.from, p.to).open, buckets = {};
        T().jl.forEach(function (l) {
          if (!set[l.a] || l.d < p.from || l.d > p.to) return;
          var k = bucket(l.d, g), b = buckets[k] || (buckets[k] = { k: k, inc: 0, dec: 0, rec: 0 });
          b.inc += l.dr; b.dec += l.cr; if (l.k === 'r') b.rec += l.cr;
        });
        var keys = Object.keys(buckets).sort(), bal = open, rows = [];
        keys.forEach(function (k) { var b = buckets[k]; rows.push({ name: bucketLabel(k, g), open: bal, inc: b.inc, dec: b.dec, rec: b.rec, close: bal + b.inc - b.dec }); bal += b.inc - b.dec; });
        var cols = [C('name', g === 'day' ? 'اليوم' : g === 'week' ? 'الأسبوع' : 'الشهر'), C('open', 'رصيد أول المدة', 'money'), C('inc', 'زيادة (مبيعات آجلة وغيرها)', 'money'),
          C('dec', 'نقص (تحصيل ومرتجعات وتسويات)', 'money'), C('rec', 'منها سندات قبض', 'money'), C('close', 'رصيد آخر المدة', 'money')];
        var tot = sumRow(rows, [C('inc', '', 'money'), C('dec', '', 'money'), C('rec', '', 'money')]); tot.open = open; tot.close = bal;
        return { cols: cols, rows: rows, total: tot, chart: { type: 'line', x: 'name', y: ['close'], yl: ['رصيد المديونية'] } };
      } };

    /* ---------- المالية والمحاسبة ---------- */
    function vouchers(kind, p) {
      var seen = {}, rows = [], bx = boxIds();
      T().jl.forEach(function (l) {
        if (l.k !== kind || l.d < p.from || l.d > p.to || seen[l.e]) return;
        seen[l.e] = 1;
        var ls = F.D.byEntry[l.e], tot = entryTotal(ls);
        var cashSide = ls.filter(function (x) { return kind === 'r' ? x.dr : x.cr; }), other = ls.filter(function (x) { return kind === 'r' ? x.cr : x.dr; });
        var boxL = cashSide.filter(function (x) { return bx.indexOf(x.a) >= 0; })[0] || cashSide[0] || {};
        rows.push({ d: l.d, no: l.no, type: l.btn, box: accName(boxL.a), boxId: boxL.a, party: other.map(function (x) { return accName(x.a); }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join('، '),
          partyId: (other[0] || {}).a, v: tot, desc: l.ed || l.ld || '' });
      });
      rows.sort(function (a, b) { return a.d < b.d ? -1 : 1; });
      if (p.vby && p.vby !== 'none') {
        var g = {}, keyF = p.vby === 'box' ? 'box' : p.vby === 'party' ? 'party' : 'd';
        rows.forEach(function (r) { var k = keyF === 'd' ? bucket(r.d, 'day') : r[keyF]; var x = g[k] || (g[k] = { name: k, n: 0, v: 0 }); x.n++; x.v += r.v; });
        var list = Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return keyF === 'd' ? (a.name < b.name ? -1 : 1) : b.v - a.v; });
        return { cols: [C('name', keyF === 'box' ? (kind === 'r' ? 'الصندوق أو البنك المستلم' : 'الصندوق أو البنك الدافع') : keyF === 'party' ? (kind === 'r' ? 'المصدر' : 'الجهة') : 'اليوم'), C('n', 'عدد السندات', 'int'), C('v', 'المبلغ', 'money')],
          rows: list, total: sumRow(list, [C('n', '', 'int'), C('v', '', 'money')]), chart: { type: keyF === 'd' ? 'bar' : 'hbar', x: 'name', y: ['v'], yl: ['المبلغ'], limit: 12 } };
      }
      return { cols: [C('d', 'التاريخ'), C('no', 'رقم السند'), C('type', 'النوع'), C('box', kind === 'r' ? 'إلى (الصندوق/البنك)' : 'من (الصندوق/البنك)'), C('party', kind === 'r' ? 'من' : 'إلى'), C('v', 'المبلغ', 'money'), C('desc', 'البيان')],
        rows: rows, total: sumRow(rows, [C('v', '', 'money')]) };
    }
    R.receipts = { cat: 'fin', name: 'سندات القبض', desc: 'كل سند قبض بمبلغه ومصدره، أو مجمّعة', params: ['period', 'vby'], run: function (p) { return vouchers('r', p); } };
    R.payments = { cat: 'fin', name: 'سندات الدفع', desc: 'كل سند دفع بمبلغه وجهته، أو مجمّعة', params: ['period', 'vby'], run: function (p) { return vouchers('p', p); } };

    R.boxes = { cat: 'fin', name: 'حركة الصناديق والبنوك', desc: 'رصيد أول المدة والمقبوضات والمدفوعات والرصيد لكل صندوق وبنك معرّف', params: ['period', 'box'],
      run: function (p) {
        var bx = F.boxes.filter(function (b) { return b.active; });
        if (!bx.length) return { cols: [C('m', '')], rows: [], empty: 'لم تُعرّف صناديق أو بنوك بعد. عرّفها من «الصناديق والإعدادات».' };
        if (p.box && p.box !== 'all') {
          var b = bx.filter(function (x) { return x.acc === p.box; })[0];
          return statement([p.box], p, (b ? b.name : accName(p.box)));
        }
        var rows = bx.map(function (b) { var r = balance([b.acc], p.from, p.to); return { name: b.name, kind: b.kind, open: r.open, inn: r.dr, out: r.cr, close: r.close, _box: b.acc }; });
        var cols = [C('name', 'الاسم'), C('kind', 'النوع'), C('open', 'رصيد أول المدة', 'money'), C('inn', 'المقبوضات (مدين)', 'money'), C('out', 'المدفوعات (دائن)', 'money'), C('close', 'الرصيد', 'money')];
        return { cols: cols, rows: rows, total: sumRow(rows, cols.filter(function (c) { return c.t === 'money'; })), chart: { type: 'hbar', x: 'name', y: ['close'], yl: ['الرصيد'] },
          note: 'اضغط على أي صندوق أو بنك لعرض حركته التفصيلية برصيد تراكمي' };
      } };

    function statement(ids, p, title) {
      var all = [];
      ids.forEach(function (id) { (F.D.byAcc[id] || []).forEach(function (l) { if (l.d >= p.from && l.d <= p.to) all.push(l); }); });
      all.sort(cmpLine);
      var b = balance(ids, p.from, p.to), bal = b.open;
      var rows = [{ d: '', no: '', type: '', desc: 'رصيد أول المدة', cp: '', dr: '', cr: '', bal: b.open, _b: true }];
      all.forEach(function (l) {
        bal += l.dr - l.cr;
        rows.push({ d: l.d, no: l.no, type: l.btn, desc: l.ld || l.ed || '', cp: counterpart(l, ids), dr: l.dr || '', cr: l.cr || '', bal: bal, _acc: ids.length > 1 ? l.a : null });
      });
      return { title: title, cols: [C('d', 'التاريخ'), C('no', 'رقم القيد'), C('type', 'النوع'), C('desc', 'البيان'), C('cp', 'الحساب المقابل'), C('dr', 'مدين', 'money'), C('cr', 'دائن', 'money'), C('bal', 'الرصيد', 'money')],
        rows: rows, total: { desc: 'الإجمالي ورصيد آخر المدة', dr: b.dr, cr: b.cr, bal: b.close } };
    }
    R.statement = { cat: 'fin', name: 'كشف حساب', desc: 'حركة عميل أو مورد أو أي حساب برصيد افتتاحي وتراكمي', params: ['period', 'account'],
      run: function (p) {
        if (!p.account) return { cols: [C('m', '')], rows: [], empty: 'اختر الحساب من الأعلى' };
        return statement(descend(p.account), p, 'كشف حساب: ' + accName(p.account));
      } };
    R.ledger = { cat: 'fin', name: 'دفتر الأستاذ', desc: 'القيود على حساب رئيسي وكل فروعه مع اسم الحساب الفرعي', params: ['period', 'account'],
      run: function (p) {
        if (!p.account) return { cols: [C('m', '')], rows: [], empty: 'اختر الحساب الرئيسي من الأعلى' };
        var res = statement(descend(p.account), p, 'دفتر الأستاذ: ' + accName(p.account));
        res.cols.splice(4, 0, C('sub', 'الحساب الفرعي'));
        res.rows.forEach(function (r) { r.sub = r._acc ? accName(r._acc) : ''; });
        return res;
      } };
    R.trial = { cat: 'fin', name: 'ميزان المراجعة', desc: 'الأرصدة الافتتاحية والحركة والأرصدة الختامية حسب المستوى', params: ['period', 'level'],
      run: function (p) {
        var lvl = Number(p.level || 3), rows = [];
        F.D.accList.forEach(function (a) {
          if (!(a.lvl === lvl || (a.leaf && a.lvl < lvl))) return;
          var b = balance(descend(a.id), p.from, p.to);
          if (!b.open && !b.dr && !b.cr) return;
          rows.push({ code: a.code, name: a.name, odr: b.open > 0 ? b.open : 0, ocr: b.open < 0 ? -b.open : 0, dr: b.dr, cr: b.cr, cdr: b.close > 0 ? b.close : 0, ccr: b.close < 0 ? -b.close : 0, _acc: a.id });
        });
        var cols = [C('code', 'الرمز'), C('name', 'الحساب'), C('odr', 'أول المدة مدين', 'money'), C('ocr', 'أول المدة دائن', 'money'), C('dr', 'الحركة مدين', 'money'), C('cr', 'الحركة دائن', 'money'), C('cdr', 'الرصيد مدين', 'money'), C('ccr', 'الرصيد دائن', 'money')];
        var tot = sumRow(rows, cols.filter(function (c) { return c.t === 'money'; }));
        return { cols: cols, rows: rows, total: tot, note: Math.abs(tot.dr - tot.cr) < 0.01 ? 'الميزان متوازن: إجمالي الحركة المدينة = الدائنة' : 'تنبيه: الميزان غير متوازن بفرق ' + fm(tot.dr - tot.cr) };
      } };

    /* ---------- المشتريات ---------- */
    R.purch = { cat: 'purch', name: 'المشتريات حسب المورد', desc: 'قيمة المشتريات ومرتجعاتها لكل مورد', params: ['period'],
      run: function (p) {
        var g = {};
        invsIn([PUR, PRET], p.from, p.to).forEach(function (v) {
          var k = v.acc || v.cu, r = g[k] || (g[k] = { name: v.name, n: 0, pur: 0, ret: 0, net: 0 });
          if (v.c === PUR) { r.n++; r.pur += v.net; } else r.ret += v.net;
          r.net = r.pur - r.ret;
        });
        var list = Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.net - a.net; });
        var cols = [C('name', 'المورد'), C('n', 'عدد الفواتير', 'int'), C('pur', 'المشتريات', 'money'), C('ret', 'المرتجعات', 'money'), C('net', 'الصافي', 'money')];
        return { cols: cols, rows: list, total: sumRow(list, cols.slice(1)), chart: { type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المشتريات'], limit: 12 } };
      } };
    R.purch_item = { cat: 'purch', name: 'المشتريات حسب الصنف', desc: 'الكميات والقيم المشتراة لكل صنف', params: ['period'],
      run: function (p) {
        var g = {};
        invsIn([PUR, PRET], p.from, p.to).forEach(function (v) {
          v.lines.forEach(function (l) {
            var it = T().item[l.item] || { name: 'صنف ' + l.item, f: 1, mu: l.un }, s = v.c === PUR ? 1 : -1;
            var r = g[l.item] || (g[l.item] = { name: it.name, unit: it.mu, q: 0, v: 0 });
            r.q += s * l.qb / (it.f || 1); r.v += s * l.tot;
          });
        });
        var list = Object.keys(g).map(function (k) { var r = g[k]; r.avg = r.q ? r.v / r.q : 0; return r; }).sort(function (a, b) { return b.v - a.v; });
        return { cols: [C('name', 'الصنف'), C('q', 'صافي الكمية', 'qty'), C('unit', 'الوحدة'), C('v', 'صافي القيمة', 'money'), C('avg', 'متوسط السعر', 'money')], rows: list, total: sumRow(list, [C('v', '', 'money')]) };
      } };

    /* ---------- إدارية ---------- */
    R.users_activity = { cat: 'admin', name: 'نشاط المستخدمين في سراج', desc: 'عدد الفواتير والقيود التي أدخلها كل مستخدم في الفترة', params: ['period'],
      run: function (p) {
        var g = {}, get = function (u) { return g[u] || (g[u] = { name: (T().us[u] || {}).name || 'مستخدم ' + u, sale: 0, ret: 0, pur: 0, other: 0, vr: 0, vp: 0, je: 0 }); };
        F.D.invs.forEach(function (v) { if (v.d < p.from || v.d > p.to) return; var r = get(v.u || '0'); if (v.c === SALE) r.sale++; else if (v.c === SRET) r.ret++; else if (v.c === PUR || v.c === PRET) r.pur++; else r.other++; });
        var seen = {};
        T().jl.forEach(function (l) { if (l.d < p.from || l.d > p.to || seen[l.e] || l.k === 'i') return; seen[l.e] = 1; var r = get(l.u || '0'); if (l.k === 'r') r.vr++; else if (l.k === 'p') r.vp++; else r.je++; });
        var list = Object.keys(g).map(function (k) { var r = g[k]; r.tot = r.sale + r.ret + r.pur + r.other + r.vr + r.vp + r.je; return r; }).sort(function (a, b) { return b.tot - a.tot; });
        var cols = [C('name', 'المستخدم'), C('sale', 'فواتير مبيع', 'int'), C('ret', 'مرتجعات', 'int'), C('pur', 'مشتريات', 'int'), C('other', 'فواتير أخرى', 'int'), C('vr', 'سندات قبض', 'int'), C('vp', 'سندات دفع', 'int'), C('je', 'قيود يدوية', 'int'), C('tot', 'الإجمالي', 'int')];
        return { cols: cols, rows: list, total: sumRow(list, cols.slice(1)) };
      } };
    R.data_check = { cat: 'admin', name: 'سلامة البيانات والمزامنة', desc: 'آخر مزامنة، وعدد السجلات، وتوازن القيود، وتطابق الفواتير مع القيود', params: [],
      run: function () {
        var m = F.meta || {}, ck = m.check || {}, Tt = T();
        var rows = [
          { m: 'آخر استلام بيانات مالية من الوكيل', v: m.last || '—' }, { m: 'آخر نبضة من الوكيل', v: (m.agent && m.agent.last_beat) || '—' },
          { m: 'أسطر القيود', v: fk(Tt.jl.length) }, { m: 'الفواتير (كل الأنواع)', v: fk(Object.keys(Tt.inv).length) }, { m: 'أسطر الفواتير', v: fk(Tt.invl.length) },
          { m: 'الحسابات', v: fk(Object.keys(Tt.acc).length) }, { m: 'آخر تاريخ في القيود', v: F.D.maxDate || '—' },
          { m: 'إجمالي المدين في سراج', v: fm(ck.debit) }, { m: 'إجمالي الدائن في سراج', v: fm(ck.credit) },
          { m: 'توازن القيود في سراج', v: ck.balanced === false ? 'غير متوازنة ✗' : ck.balanced ? 'متوازنة ✓' : '—' }];
        var dr = 0, cr = 0; Tt.jl.forEach(function (l) { dr += l.dr; cr += l.cr; });
        rows.push({ m: 'إجمالي المدين على هذا الجهاز', v: fm(dr) }, { m: 'تطابق الجهاز مع سراج', v: ck.debit !== undefined && Math.abs(dr - ck.debit) < 0.01 ? 'مطابق ✓' : 'غير مطابق، اضغط «تحديث البيانات»' });
        return { cols: [C('m', 'البند'), C('v', 'القيمة')], rows: rows };
      } };

    function sumRow(rows, cols) {
      var t = { name: 'الإجمالي', _b: true };
      cols.forEach(function (c) { if (['money', 'int', 'qty'].indexOf(c.t) >= 0) t[c.k] = rows.reduce(function (s, r) { return s + (Number(r[c.k]) || 0); }, 0); });
      if (t.net !== undefined && t.profit !== undefined) t.margin = pct(t.profit, t.net);
      if (t.sales !== undefined && t.ret !== undefined) t.rp = pct(t.ret, t.sales);
      if (t.share !== undefined || cols.some(function (c) { return c.k === 'share'; })) t.share = 100;
      return t;
    }
    function topN(res, p) {
      var n = Number(p.top || 0);
      if (n && res.rows.length > n) { res.note = 'أعلى ' + n + ' من ' + res.rows.length + ' (الإجمالي يشمل الجميع)'; res.rows = res.rows.slice(0, n); }
      return res;
    }

    /* ===================== منشئ التقارير المخصصة ===================== */
    var DIMS = {
      day: ['اليوم', function (r) { return r.d; }], week: ['الأسبوع', function (r) { return weekStart(r.d); }], month: ['الشهر', function (r) { return r.d.slice(0, 7); }],
      year: ['السنة', function (r) { return r.d.slice(0, 4); }],
      cust: ['العميل/المورد', function (r) { return r.v ? r.v.name : r.name; }], rep: ['المندوب', function (r) { var v = r.v || r; return (T().ag[v.ag] || {}).name || 'بدون'; }],
      store: ['المخزن', function (r) { var v = r.v || r; return (T().st[v.st] || {}).name || 'بدون'; }],
      type: ['نوع الفاتورة', function (r) { var v = r.v || r; return (T().it[v.t] || {}).name || String(v.c); }],
      user: ['المستخدم', function (r) { var v = r.v || r; return (T().us[v.u] || {}).name || 'غير معروف'; }],
      item: ['الصنف', function (r) { return (T().item[r.item] || {}).name || 'صنف ' + r.item; }],
      acc: ['الحساب', function (r) { return accName(r.a); }],
      acc2: ['الحساب (مستوى 2)', function (r) { return ancestorAt(r.a, 2); }], acc3: ['الحساب (مستوى 3)', function (r) { return ancestorAt(r.a, 3); }],
      acc4: ['الحساب (مستوى 4)', function (r) { return ancestorAt(r.a, 4); }],
      etype: ['نوع القيد', function (r) { return r.btn; }]
    };
    function ancestorAt(id, lvl) { var a = acc(id), g = 0; while (a && a.lvl > lvl && acc(a.parent) && g++ < 10) a = acc(a.parent); return a ? a.name : '—'; }
    var DS = {
      sinv: { name: 'فواتير المبيع والمرتجع', dims: ['day', 'week', 'month', 'year', 'cust', 'rep', 'store', 'type', 'user'],
        rows: function () { return F.D.invs.filter(function (v) { return v.c === SALE || v.c === SRET; }); },
        meas: { count: ['عدد الفواتير', function (r) { return 1; }], sales: ['المبيعات', function (r) { return r.c === SALE ? r.net : 0; }], ret: ['المرتجعات', function (r) { return r.c === SRET ? r.net : 0; }],
          net: ['صافي المبيعات', function (r) { return r.sign * r.net; }], profit: ['مجمل الربح', function (r) { return r.sign * r.profit; }], qty: ['الكمية', function (r) { return r.sign * r.qty; }] } },
      slines: { name: 'أصناف المبيع والمرتجع (أسطر)', dims: ['day', 'week', 'month', 'year', 'item', 'cust', 'rep', 'store', 'user'],
        rows: function () { var out = []; F.D.invs.forEach(function (v) { if (v.c === SALE || v.c === SRET) v.lines.forEach(function (l) { l.d = v.d; out.push(l); }); }); return out; },
        meas: { q: ['الكمية (الوحدة الشائعة)', function (l) { var it = T().item[l.item] || { f: 1 }; return l.v.sign * l.qb / (it.f || 1); }], value: ['القيمة الصافية', function (l) { return l.v.sign * l.tot; }],
          cost: ['التكلفة', function (l) { return l.v.sign * l.cost; }], profit: ['الربح', function (l) { return l.v.sign * l.win; }], lines: ['عدد الأسطر', function () { return 1; }] } },
      pinv: { name: 'فواتير المشتريات ومرتجعاتها', dims: ['day', 'week', 'month', 'year', 'cust', 'store', 'type', 'user'],
        rows: function () { return F.D.invs.filter(function (v) { return v.c === PUR || v.c === PRET; }); },
        meas: { count: ['عدد الفواتير', function () { return 1; }], net: ['صافي المشتريات', function (r) { return r.sign * r.net; }], qty: ['الكمية', function (r) { return r.sign * r.qty; }] } },
      jl: { name: 'القيود المحاسبية (أسطر)', dims: ['day', 'week', 'month', 'year', 'acc', 'acc2', 'acc3', 'acc4', 'etype', 'user'],
        rows: function () { return T().jl; },
        meas: { dr: ['مدين', function (l) { return l.dr; }], cr: ['دائن', function (l) { return l.cr; }], net: ['الصافي (مدين - دائن)', function (l) { return l.dr - l.cr; }], count: ['عدد الأسطر', function () { return 1; }] } }
    };
    function runCustom(def, p) {
      var ds = DS[def.ds];
      if (!ds) return { cols: [C('m', '')], rows: [], empty: 'مصدر البيانات غير معروف' };
      var dimR = DIMS[def.row] || DIMS.month, dimC = def.col ? DIMS[def.col] : null;
      var meas = (def.meas && def.meas.length ? def.meas : Object.keys(ds.meas).slice(0, 2)).filter(function (m) { return ds.meas[m]; });
      var flt = String(def.filter || '').trim(), fdim = def.fdim ? DIMS[def.fdim] : null;
      var g = {}, colKeys = {};
      ds.rows().forEach(function (r) {
        if (r.d < p.from || r.d > p.to) return;
        if (flt && fdim && String(fdim[1](r)).indexOf(flt) < 0) return;
        var rk = dimR[1](r), x = g[rk] || (g[rk] = { name: rk });
        meas.forEach(function (m) { x[m] = (x[m] || 0) + ds.meas[m][1](r); });
        if (dimC) { var ck = dimC[1](r); colKeys[ck] = 1; x['c_' + ck] = (x['c_' + ck] || 0) + ds.meas[meas[0]][1](r); }
      });
      var list = Object.keys(g).map(function (k) { return g[k]; });
      var timeDim = ['day', 'week', 'month', 'year'].indexOf(def.row) >= 0;
      var sortK = def.sort || (timeDim ? '_name' : meas[0]);
      list.sort(function (a, b) { return sortK === '_name' ? (a.name < b.name ? -1 : 1) : (b[sortK] || 0) - (a[sortK] || 0); });
      if (def.row === 'month') list.forEach(function (r) { r.name = monthLabel(r.name); });
      var cols = [C('name', dimR[0])];
      if (dimC) {
        var ck = Object.keys(colKeys).sort().slice(0, 24);
        ck.forEach(function (k) { cols.push(C('c_' + k, def.col === 'month' ? monthLabel(k) : k, 'money')); });
        cols.push(C(meas[0], 'الإجمالي: ' + ds.meas[meas[0]][0], 'money'));
      } else meas.forEach(function (m) { cols.push(C(m, ds.meas[m][0], /count|lines/.test(m) ? 'int' : /^q/.test(m) ? 'qty' : 'money')); });
      var total = sumRow(list, cols.slice(1));
      var res = { cols: cols, rows: list, total: total };
      if (def.top) topN(res, { top: def.top });
      if (def.chart && !dimC) res.chart = { type: def.chart, x: 'name', y: [meas[0]], yl: [ds.meas[meas[0]][0]], limit: def.chart === 'hbar' ? 15 : 0 };
      return res;
    }

    /* ===================== الواجهة ===================== */
    var SUBS = [['dash', 'لوحة المؤشرات'], ['reports', 'التقارير'], ['builder', 'تقرير مخصص'], ['settings', 'الصناديق والإعدادات']];

    A.VIEWS.fin = {
      load: function (quiet) {
        var had = !!F.D, rev = F.rev, nb = JSON.stringify([F.boxes, F.reports]);
        // التحديث التلقائي كل دقيقة لا يعيد رسم الشاشة إلا إذا وصل جديد، حتى لا يقطع ما يكتبه المستخدم
        if (quiet && had && F.lastPull && Date.now() - F.lastPull < 180000) return Promise.resolve(false);
        F.quiet = quiet;
        return load(false).then(function () { return !had || F.rev !== rev || nb !== JSON.stringify([F.boxes, F.reports]); });
      },
      html: function () {
        var h = '<div class="chips fin-sub">' + SUBS.map(function (s) { return '<button class="chip' + (F.sub === s[0] ? ' on' : '') + '" data-fsub="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div>';
        if (!F.D && F.error && !F.loading) return h + '<div class="card empty"><p>' + (F.error === 'طلب غير معروف' ? 'المنظومة المالية لم تُفعّل على الخادم بعد. ستعمل تلقائياً بعد تحديث الخادم.' : 'تعذّر تحميل البيانات المالية: ' + esc(F.error)) + '</p><button class="btn primary" data-frefresh>' + ICON.refresh + ' إعادة المحاولة</button></div>';
        if (!F.D && F.rows && !Object.keys(F.rows).length && !F.loading && F.meta) return h + '<div class="card empty"><p>لم تصل بيانات مالية من الوكيل بعد.</p><p class="small muted">بعد تحديث الوكيل على جهاز سراج سيرسل القيود والفواتير تلقائياً خلال دقائق.</p><button class="btn primary" data-frefresh>' + ICON.refresh + ' تحقق الآن</button></div>';
        if (!F.D) return h + '<div class="card loading"><span class="spin"></span> <span id="finprog">' + esc(F.progress || 'جارٍ تحميل البيانات المالية… أول مرة قد تستغرق دقيقة') + '</span></div>';
        h += syncLine();
        if (F.sub === 'dash') h += dashHTML();
        else if (F.sub === 'reports') h += F.cur ? reportHTML() : catalogHTML();
        else if (F.sub === 'builder') h += builderHTML();
        else h += settingsHTML();
        return h;
      },
      bind: function (m) {
        qa('[data-fsub]', m).forEach(function (b) { b.onclick = function () { F.sub = b.dataset.fsub; if (F.sub !== 'reports') F.cur = null; A.render(); }; });
        var rf = q('[data-frefresh]', m);
        if (rf) rf.onclick = function () { busy(rf, true); load(true).then(function () { toast('حُدّثت البيانات المالية'); A.render(); }).catch(function (e) { busy(rf, false); toast(e.message, true); }); };
        if (!F.D) return;
        if (F.sub === 'dash') bindDash(m);
        else if (F.sub === 'reports') (F.cur ? bindReport : bindCatalog)(m);
        else if (F.sub === 'builder') bindBuilder(m);
        else bindSettings(m);
      }
    };

    function syncLine() {
      var m = F.meta || {}, ck = m.check || {};
      var lb = m.agent && m.agent.last_beat;
      return '<div class="row small muted fin-sync"><span>آخر بيانات مالية من سراج: ' + (m.last ? N(String(m.last).slice(0, 16)) : '—') + '</span>' +
        (ck.balanced === false ? '<span class="badge b-flag">القيود غير متوازنة في سراج</span>' : ck.balanced ? '<span class="badge b-delivered">القيود متوازنة ✓</span>' : '') +
        (lb ? '<span>الوكيل: ' + N(String(lb).slice(11, 16)) + '</span>' : '') + '<button class="btn sm ghost" data-frefresh>' + ICON.refresh + ' تحديث البيانات</button></div>';
    }

    /* ---------- لوحة المؤشرات ---------- */
    function dashHTML() {
      var r = presetRange(F.dashPer, F.dashFrom, F.dashTo), pr = prevRange(r[0], r[1], F.dashPer);
      var a = salesStats(r[0], r[1]), b = salesStats(pr[0], pr[1]), ca = cashStats(r[0], r[1]), cb = cashStats(pr[0], pr[1]);
      var recv = balance(recvIds(), null, r[1]).close, recvP = balance(recvIds(), null, pr[1]).close;
      var kpi = function (label, v, pv, opts) {
        opts = opts || {};
        var ch = pv ? (v - pv) / Math.abs(pv) * 100 : null, good = opts.inverse ? ch < 0 : ch > 0;
        return '<div class="kpi fin-kpi"><span>' + esc(label) + '</span><b class="num">' + (opts.pct ? fp(v) : fk(v)) + '</b>' +
          (ch !== null && isFinite(ch) ? '<small class="' + (Math.abs(ch) < 0.05 ? '' : good ? 'up' : 'down') + '">' + (ch > 0 ? '▲ ' : ch < 0 ? '▼ ' : '') + fp(Math.abs(ch)) + ' عن الفترة السابقة</small>' : '<small>&nbsp;</small>') +
          (opts.sub ? '<small class="muted">' + opts.sub + '</small>' : '') + '</div>';
      };
      var h = '<div class="card"><div class="chips">' + PRESETS.map(function (pp) { return '<button class="chip' + (F.dashPer === pp[0] ? ' on' : '') + '" data-dper="' + pp[0] + '">' + pp[1] + '</button>'; }).join('') + '</div>' +
        (F.dashPer === 'custom' ? '<div class="row" style="margin-top:10px"><input type="date" class="input num" id="dfrom" value="' + r[0] + '" style="max-width:180px"><input type="date" class="input num" id="dto" value="' + r[1] + '" style="max-width:180px"></div>' : '') +
        '<div class="small muted" style="margin-top:6px">' + perLabel(r[0], r[1]) + ' · مقارنة بـ ' + perLabel(pr[0], pr[1]) + '</div></div>';
      h += '<div class="kpis fin-kpis">' + kpi('صافي المبيعات', a.net, b.net, { sub: fk(a.n) + ' فاتورة مبيع' }) + kpi('مجمل الربح', a.profit, b.profit, { sub: 'هامش ' + fp(pct(a.profit, a.net)) }) +
        kpi('نسبة المرتجعات', pct(a.ret, a.sales), pct(b.ret, b.sales), { pct: 1, inverse: 1, sub: fk(a.ret) + ' د.ل' }) + kpi('المقبوضات', ca.rec, cb.rec, { sub: fk(ca.recN) + ' سند قبض' }) +
        kpi('المدفوعات', ca.pay, cb.pay, { inverse: 1, sub: fk(ca.payN) + ' سند دفع' }) +
        (ca.boxNet !== undefined ? kpi('صافي حركة الصناديق والبنوك', ca.boxNet, cb.boxNet, { sub: 'الأرصدة ' + fk(ca.boxClose) }) : kpi('صافي المقبوضات والمدفوعات', ca.rec - ca.pay, cb.rec - cb.pay)) +
        kpi('صافي المشتريات', a.purch - a.pret, b.purch - b.pret) + kpi('مديونية العملاء', recv, recvP, { inverse: 1, sub: 'في ' + r[1] }) + '</div>';
      // منحنى آخر 6 أشهر
      var months = [], t = today(), m0 = t.slice(0, 7);
      for (var i = 5; i >= 0; i--) { var mm = m0, k = i; while (k-- > 0) mm = addD(mm + '-01', -1).slice(0, 7); months.push(mm); }
      var series = months.map(function (mm) { var s = salesStats(mm + '-01', monthEnd(mm)), c = cashStats(mm + '-01', monthEnd(mm)); return { name: MONTHS[+mm.slice(5, 7) - 1], net: s.net, profit: s.profit, rec: c.rec }; });
      h += '<div class="grid2"><div class="card"><h3>صافي المبيعات والربح والمقبوضات · آخر 6 أشهر</h3>' + chartSVG({ type: 'bar', x: 'name', y: ['net', 'profit', 'rec'], yl: ['صافي المبيعات', 'مجمل الربح', 'المقبوضات'] }, series) + '</div>';
      var top = R.sales_cust.run({ from: r[0], to: r[1], top: 7 }).rows;
      h += '<div class="card"><h3>أعلى العملاء مبيعاً في الفترة</h3>' + (top.length ? chartSVG({ type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المبيعات'] }, top) : '<p class="muted">لا مبيعات في الفترة</p>') + '</div></div>';
      var items = R.sales_item.run({ from: r[0], to: r[1], top: 7 }).rows;
      var boxes = F.boxes.filter(function (x) { return x.active; });
      h += '<div class="grid2"><div class="card"><h3>أعلى الأصناف مبيعاً</h3>' + (items.length ? chartSVG({ type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المبيعات'] }, items) : '<p class="muted">لا مبيعات في الفترة</p>') + '</div>' +
        '<div class="card"><h3>أرصدة الصناديق والبنوك الآن</h3>' + (boxes.length ? '<table class="tbl">' + boxes.map(function (x) { return '<tr><td>' + esc(x.name) + ' <span class="badge">' + esc(x.kind) + '</span></td><td class="num" style="text-align:left">' + fm(balance([x.acc], null, null).close) + '</td></tr>'; }).join('') + '</table>'
          : '<p class="muted" style="margin:0 0 10px">لم تُعرّف صناديق أو بنوك بعد.</p><button class="btn sm primary" data-fsub2="settings">تعريف الصناديق والبنوك</button>') + '</div></div>';
      var aging = R.recv_aging.run({ asof: r[1] }), at = aging.total || {};
      h += '<div class="card"><h3>أعمار ديون العملاء في ' + N(r[1]) + '</h3>' + (at.tot ? chartSVG({ type: 'bar', x: 'name', y: ['v'], yl: ['المبلغ'] }, [['b1', '0-30 يوماً'], ['b2', '31-60'], ['b3', '61-90'], ['b4', '91-120'], ['b5', '+120']].map(function (b) { return { name: b[1], v: at[b[0]] || 0 }; })) : '<p class="muted">لا ديون</p>') +
        '<button class="btn sm ghost" data-open="recv_aging">التفاصيل لكل عميل</button></div>';
      return h;
    }
    function bindDash(m) {
      qa('[data-dper]', m).forEach(function (b) { b.onclick = function () { F.dashPer = b.dataset.dper; A.render(); }; });
      var df = q('#dfrom', m), dt = q('#dto', m);
      if (df) df.onchange = dt.onchange = function () { F.dashFrom = df.value; F.dashTo = dt.value; A.render(); };
      qa('[data-fsub2]', m).forEach(function (b) { b.onclick = function () { F.sub = b.dataset.fsub2; A.render(); }; });
      qa('[data-open]', m).forEach(function (b) { b.onclick = function () { openReport(b.dataset.open); }; });
    }

    /* ---------- الرسوم ---------- */
    var COLORS = ['#0C4CA2', '#F15C22', '#2E9E6A', '#7A5AF8', '#C2410C'];
    function chartSVG(ch, rows) {
      rows = rows.slice(0, ch.limit || rows.length);
      if (!rows.length) return '';
      var vals = []; rows.forEach(function (r) { ch.y.forEach(function (k) { vals.push(Number(r[k]) || 0); }); });
      var max = Math.max.apply(null, vals.concat([0])), min = Math.min.apply(null, vals.concat([0])), span = (max - min) || 1;
      var legend = ch.y.length > 1 ? '<div class="legend">' + ch.y.map(function (k, i) { return '<span><i style="background:' + COLORS[i] + '"></i>' + esc(ch.yl[i]) + '</span>'; }).join('') + '</div>' : '';
      if (ch.type === 'hbar') {
        var hh = rows.length * 30 + 6;
        return legend + '<svg class="chart hb" viewBox="0 0 600 ' + hh + '" role="img" direction="rtl">' + rows.map(function (r, i) {
          var v = Number(r[ch.y[0]]) || 0, w = Math.max(1, Math.abs(v) / (Math.max(Math.abs(max), Math.abs(min)) || 1) * 280);
          var lb = String(r[ch.x]); if (lb.length > 24) lb = lb.slice(0, 23) + '…';
          return '<text x="596" y="' + (i * 30 + 20) + '" text-anchor="start" class="cl">' + esc(lb) + '<title>' + esc(r[ch.x]) + '</title></text>' +
            '<rect x="' + (370 - w) + '" y="' + (i * 30 + 6) + '" width="' + w + '" height="18" rx="4" fill="' + (v < 0 ? COLORS[1] : COLORS[0]) + '"></rect>' +
            '<text x="' + (366 - w) + '" y="' + (i * 30 + 19) + '" text-anchor="end" class="cv">' + fk(v) + '</text>';
        }).join('') + '</svg>';
      }
      var W = 600, H = 230, pl = 56, pb = 34, pt = 10, iw = W - pl - 10, ih = H - pb - pt;
      var y = function (v) { return pt + ih - (v - min) / span * ih; };
      var ticks = [min, min + span / 2, max].map(function (v) { return '<line x1="' + pl + '" x2="' + (W - 10) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="gl"></line><text x="' + (pl - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" class="cv">' + short(v) + '</text>'; }).join('');
      var n = rows.length, bw = iw / n, lblEvery = Math.ceil(n / 12);
      var xl = rows.map(function (r, i) { return i % lblEvery ? '' : '<text x="' + (pl + bw * i + bw / 2) + '" y="' + (H - 12) + '" text-anchor="middle" class="cl">' + esc(String(r[ch.x]).replace(/^أسبوع /, '').slice(0, 12)) + '</text>'; }).join('');
      var body = '';
      if (ch.type === 'line') {
        ch.y.forEach(function (k, j) {
          var pts = rows.map(function (r, i) { return (pl + bw * i + bw / 2) + ',' + y(Number(r[k]) || 0); }).join(' ');
          body += '<polyline points="' + pts + '" fill="none" stroke="' + COLORS[j] + '" stroke-width="2.5"></polyline>';
          if (n <= 40) rows.forEach(function (r, i) { body += '<circle cx="' + (pl + bw * i + bw / 2) + '" cy="' + y(Number(r[k]) || 0) + '" r="3" fill="' + COLORS[j] + '"></circle>'; });
        });
      } else {
        var gw = bw * 0.78, sw = gw / ch.y.length;
        rows.forEach(function (r, i) {
          ch.y.forEach(function (k, j) {
            var v = Number(r[k]) || 0, y0 = y(Math.max(0, min)), y1 = y(v);
            body += '<rect x="' + (pl + bw * i + (bw - gw) / 2 + sw * j) + '" y="' + Math.min(y0, y1) + '" width="' + Math.max(1, sw - 1) + '" height="' + Math.max(1, Math.abs(y1 - y0)) + '" rx="2" fill="' + COLORS[j] + '"><title>' + esc(r[ch.x]) + ': ' + fk(v) + '</title></rect>';
          });
        });
      }
      return legend + '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" direction="ltr">' + ticks + body + xl + '</svg>';
    }
    function short(v) { var a = Math.abs(v); return (a >= 1e6 ? (v / 1e6).toFixed(1) + 'م' : a >= 1e3 ? (v / 1e3).toFixed(0) + 'أ' : fk(v)); }

    /* ---------- فهرس التقارير ---------- */
    function catalogHTML() {
      var h = '';
      CATS.forEach(function (c) {
        var list = c[0] === 'mine' ? F.reports.map(function (r) { return { id: 'c:' + r.id, name: r.name, desc: (DS[r.def.ds] || {}).name || '', by: r.by }; })
          : Object.keys(R).filter(function (k) { return R[k].cat === c[0]; }).map(function (k) { return { id: k, name: R[k].name, desc: R[k].desc }; });
        if (!list.length && c[0] !== 'mine') return;
        h += '<div class="sec-title"><h2>' + c[1] + '</h2></div><div class="fin-cat">' + (list.length ? list.map(function (r) {
          return '<button class="item tap fin-rep" data-open="' + esc(r.id) + '"><div class="main"><b>' + esc(r.name) + '</b><div class="small muted">' + esc(r.desc || '') + (r.by ? ' · أنشأه ' + esc(r.by) : '') + '</div></div></button>';
        }).join('') : '<div class="card empty small">لا توجد تقارير مخصصة بعد. أنشئ تقريرك من «تقرير مخصص».</div>') + '</div>';
      });
      return h;
    }
    function bindCatalog(m) { qa('[data-open]', m).forEach(function (b) { b.onclick = function () { openReport(b.dataset.open); }; }); }

    function openReport(id, params) {
      var def = id.indexOf('c:') === 0 ? F.reports.filter(function (r) { return 'c:' + r.id === id; })[0] : null;
      var t = today();
      var base = { preset: 'month', from: t.slice(0, 7) + '-01', to: t, asof: t, gran: 'day', level: 3, top: 0, by: 'ag', rby: 'cust', vby: 'none', box: 'all', nonzero: 'nz' };
      var saved = (st.finParams || {})[id] || {};
      F.cur = { id: id, custom: def, p: Object.assign(base, saved, params || {}) };
      F.sub = 'reports';
      A.render();
      window.scrollTo(0, 0);
    }

    function curDef() { var c = F.cur; return c.custom ? { name: c.custom.name, desc: (DS[c.custom.def.ds] || {}).name, params: ['period'] } : R[c.id]; }
    function runCur() {
      var c = F.cur, p = c.p;
      if (p.preset && p.preset !== 'custom') { var r = presetRange(p.preset); p.from = r[0]; p.to = r[1]; }
      return c.custom ? runCustom(c.custom.def, p) : R[c.id].run(p);
    }

    function paramsHTML(def, p) {
      var h = '';
      var has = function (k) { return def.params.indexOf(k) >= 0; };
      if (has('period')) {
        h += '<div class="chips">' + PRESETS.map(function (pp) { return '<button class="chip' + (p.preset === pp[0] ? ' on' : '') + '" data-pp="' + pp[0] + '">' + pp[1] + '</button>'; }).join('') + '</div>';
        if (p.preset === 'custom') h += '<div class="row"><label class="small">من <input type="date" class="input num" data-pk="from" value="' + p.from + '"></label><label class="small">إلى <input type="date" class="input num" data-pk="to" value="' + p.to + '"></label></div>';
      }
      var sel = function (k, label, opts) { return '<label class="field fin-param"><span class="lbl">' + label + '</span><select class="input" data-pk="' + k + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(p[k]) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>'; };
      var row = '';
      if (has('asof')) row += '<label class="field fin-param"><span class="lbl">في تاريخ</span><input type="date" class="input num" data-pk="asof" value="' + p.asof + '"></label>';
      if (has('gran')) row += sel('gran', 'التجميع', GRAN);
      if (has('level')) row += sel('level', 'المستوى', [[1, 'المستوى 1'], [2, 'المستوى 2'], [3, 'المستوى 3'], [4, 'المستوى 4'], [5, 'المستوى 5'], [6, 'كل المستويات']]);
      if (has('top')) row += sel('top', 'العرض', [[0, 'الكل'], [10, 'أعلى 10'], [20, 'أعلى 20'], [50, 'أعلى 50']]);
      if (has('by')) row += sel('by', 'حسب', [['ag', 'المندوب'], ['st', 'المخزن'], ['u', 'المستخدم']]);
      if (has('rby')) row += sel('rby', 'حسب', [['cust', 'العميل'], ['item', 'الصنف']]);
      if (has('vby')) row += sel('vby', 'العرض', [['none', 'كل سند (تفصيلي)'], ['box', 'مجمّع حسب الصندوق/البنك'], ['party', 'مجمّع حسب الطرف'], ['day', 'مجمّع حسب اليوم']]);
      if (has('nonzero')) row += sel('nonzero', 'الأرصدة', [['nz', 'غير الصفرية فقط'], ['all', 'الكل']]);
      if (has('box')) row += sel('box', 'الصندوق/البنك', [['all', 'كل الصناديق والبنوك (ملخص)']].concat(F.boxes.filter(function (b) { return b.active; }).map(function (b) { return [b.acc, b.name]; })));
      if (has('search')) row += '<label class="field fin-param"><span class="lbl">بحث</span><input class="input" data-pk="search" value="' + esc(p.search || '') + '" placeholder="رقم أو اسم عميل"></label>';
      if (has('account')) row += '<div class="field fin-param" style="flex:2"><span class="lbl">الحساب</span><button class="input" data-accpick style="text-align:start">' + (p.account ? esc(acc(p.account) ? acc(p.account).code + ' · ' + acc(p.account).name : '—') : 'اختر الحساب…') + '</button></div>';
      if (row) h += '<div class="row fin-params">' + row + '</div>';
      return h;
    }

    function reportHTML() {
      var c = F.cur, def = curDef();
      if (!def) { F.cur = null; return catalogHTML(); }
      var res;
      try { res = runCur(); } catch (e) { res = { cols: [], rows: [], empty: 'تعذّر إعداد التقرير: ' + e.message }; if (window.console) console.error(e); }
      c.res = res;
      var p = c.p;
      var h = '<div class="card"><div class="row fin-head"><button class="btn sm ghost" data-back>→ التقارير</button><div class="grow"><h2 style="margin:0">' + esc(res.title || def.name) + '</h2><div class="small muted">' + esc(def.desc || '') + '</div></div>' +
        '<button class="btn sm" data-xls>Excel</button><button class="btn sm" data-prt>' + ICON.print + ' طباعة / PDF</button>' + (c.custom ? '<button class="btn sm ghost" data-edit>تعديل</button>' : '') + '</div>' +
        '<div style="margin-top:10px">' + paramsHTML(def, p) + '</div>' +
        '<div class="small muted">' + (def.params.indexOf('asof') >= 0 ? 'في ' + N(p.asof) : def.params.indexOf('period') >= 0 ? perLabel(p.from, p.to) : '') + (res.note ? ' · ' + esc(res.note) : '') + '</div></div>';
      if (res.empty) return h + '<div class="card empty">' + esc(res.empty) + '</div>';
      if (res.chart && res.rows.length > 1) h += '<div class="card">' + chartSVG(res.chart, res.chart.type === 'hbar' ? res.rows : res.rows) + '</div>';
      h += '<div class="card scroll-x fin-table">' + tableHTML(res) + '</div>';
      return h;
    }
    function cell(c, v, r) {
      if (v === '' || v === undefined || v === null) return '';
      var t = r && r._fmt === 'p' && c.t === 'money' ? 'pct' : r && r._fmt === 'n' && c.t === 'money' ? 'int' : c.t;
      if (t === 'money') return fm(v);
      if (t === 'int') return fk(v);
      if (t === 'qty') return fq(v);
      if (t === 'pct') return v === null ? '' : fp(v);
      return esc(v);
    }
    function tableHTML(res) {
      var num = function (c) { return ['money', 'int', 'qty', 'pct'].indexOf(c.t) >= 0; };
      var sk = F.cur && F.cur.sort;
      var rows = res.rows.slice();
      if (sk) { var col = res.cols.filter(function (c) { return c.k === sk.k; })[0]; if (col) rows.sort(function (a, b) { var x = a[sk.k], y = b[sk.k]; if (num(col)) { x = Number(x) || 0; y = Number(y) || 0; } return (x < y ? -1 : x > y ? 1 : 0) * sk.dir; }); }
      if (!rows.length) return '<p class="muted" style="margin:0">لا توجد حركة في هذه الفترة</p>';
      var clickable = rows.some(function (r) { return r._acc || r._box; });
      return '<table class="tbl fin"><thead><tr>' + res.cols.map(function (c) { return '<th class="' + (num(c) ? 'n' : '') + '" data-sort="' + c.k + '">' + esc(c.l) + (sk && sk.k === c.k ? (sk.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>'; }).join('') + '</tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr class="' + (r._b ? 'b ' : '') + (r._hl ? 'hl ' : '') + ((r._acc || r._box) && clickable ? 'tap' : '') + '"' + (r._acc ? ' data-acc="' + esc(r._acc) + '"' : r._box ? ' data-box="' + esc(r._box) + '"' : '') + '>' +
            res.cols.map(function (c, i) { return '<td class="' + (num(c) ? 'n' : '') + '"' + (i === 1 && r._lvl ? ' style="padding-inline-start:' + (6 + r._lvl * 18) + 'px"' : '') + '>' + cell(c, r[c.k], r) + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody>' + (res.total ? '<tfoot><tr>' + res.cols.map(function (c, i) { return '<td class="' + (num(c) ? 'n' : '') + '">' + (i === 0 ? esc(res.total[c.k] || res.total.name || res.total.desc || 'الإجمالي') : cell(c, res.total[c.k], res.total)) + '</td>'; }).join('') + '</tr></tfoot>' : '') + '</table>' +
        '<p class="small muted" style="margin:8px 0 0">' + fk(rows.length) + ' سطر' + (clickable ? ' · اضغط على أي حساب لفتح كشف حسابه' : '') + ' · اضغط على عنوان أي عمود للترتيب</p>';
    }

    function bindReport(m) {
      var c = F.cur, p = c.p;
      var save = function () { st.finParams = st.finParams || {}; st.finParams[c.id] = Object.assign({}, p); try { localStorage.setItem('rk.finParams', JSON.stringify(st.finParams)); } catch (e) {} };
      q('[data-back]', m).onclick = function () { F.cur = null; A.render(); };
      qa('[data-pp]', m).forEach(function (b) { b.onclick = function () { p.preset = b.dataset.pp; save(); A.render(); }; });
      qa('[data-pk]', m).forEach(function (el) {
        var ev = el.tagName === 'INPUT' && el.type !== 'date' ? 'change' : 'change';
        el.addEventListener(ev, function () { p[el.dataset.pk] = el.value; if (el.dataset.pk === 'from' || el.dataset.pk === 'to') p.preset = 'custom'; save(); A.render(); });
      });
      var ap = q('[data-accpick]', m);
      if (ap) ap.onclick = function () { pickAccount({ title: 'اختر الحساب', any: true }).then(function (id) { if (id) { p.account = id; save(); A.render(); } }); };
      qa('th[data-sort]', m).forEach(function (th) { th.onclick = function () { var k = th.dataset.sort; c.sort = c.sort && c.sort.k === k ? { k: k, dir: -c.sort.dir } : { k: k, dir: -1 }; A.render(); }; });
      qa('tr[data-acc]', m).forEach(function (tr) { tr.onclick = function () { openReport('statement', { account: tr.dataset.acc, preset: p.preset, from: p.from, to: p.asof && !p.from ? p.asof : p.to }); }; });
      qa('tr[data-box]', m).forEach(function (tr) { tr.onclick = function () { p.box = tr.dataset.box; save(); A.render(); }; });
      q('[data-xls]', m).onclick = function () { exportXLSX(c.res, curDef().name, p); };
      q('[data-prt]', m).onclick = function () { printReport(c.res, curDef().name, p); };
      var ed = q('[data-edit]', m);
      if (ed) ed.onclick = function () { F.custom = JSON.parse(JSON.stringify(c.custom)); F.sub = 'builder'; F.cur = null; A.render(); };
    }

    /* ---------- التصدير والطباعة ---------- */
    function periodText(p, def) { return def.params.indexOf('asof') >= 0 ? 'في ' + p.asof : def.params.indexOf('period') >= 0 ? (p.from === p.to ? p.from : 'من ' + p.from + ' إلى ' + p.to) : ''; }
    function exportXLSX(res, name, p) {
      A.withXLSX().then(function (X) {
        var def = curDef();
        var aoa = [['شركة راكان لاستيراد المواد الغذائية والتوزيع'], [res.title || name], [periodText(p, def)], ['آخر بيانات من سراج: ' + ((F.meta && F.meta.last) || '')], []];
        aoa.push(res.cols.map(function (c) { return c.l; }));
        res.rows.forEach(function (r) { aoa.push(res.cols.map(function (c, i) { var v = r[c.k]; if (i === 1 && r._lvl) v = new Array(r._lvl + 1).join('   ') + v; return v === undefined ? '' : (['money', 'int', 'qty', 'pct'].indexOf(c.t) >= 0 && v !== '' ? Math.round(Number(v) * 1000) / 1000 : v); })); });
        if (res.total) aoa.push(res.cols.map(function (c, i) { var v = res.total[c.k]; return i === 0 ? 'الإجمالي' : (v === undefined ? '' : (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)); }));
        var wb = A.saveBook(X, aoa, '', 'التقرير', res.cols.map(function (c) { return c.t === 'text' ? 28 : 16; }));
        X.writeFile(wb, 'rakan-' + (res.title || name).replace(/[\\/:*?"<>|]/g, '').slice(0, 40) + '-' + today() + '.xlsx');
      }).catch(function (e) { toast(e.message, true); });
    }
    function printReport(res, name, p) {
      var def = curDef(), P = document.getElementById('print');
      var num = function (c) { return ['money', 'int', 'qty', 'pct'].indexOf(c.t) >= 0; };
      P.innerHTML = '<div class="p-rep"><div class="p-head"><img src="logo.png" alt=""><div class="t"><b>' + esc(res.title || name) + '</b><span>شركة راكان لاستيراد المواد الغذائية والتوزيع · ' + esc(periodText(p, def)) + '</span></div><span class="p-copy">' +
        esc('طُبع ' + RK.nowStr().slice(0, 16)) + '</span></div>' + (res.note ? '<p class="p-note">' + esc(res.note) + '</p>' : '') +
        '<table class="p-tbl"><thead><tr>' + res.cols.map(function (c) { return '<th>' + esc(c.l) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        res.rows.map(function (r) { return '<tr' + (r._b ? ' style="font-weight:800"' : '') + '>' + res.cols.map(function (c, i) { return '<td class="' + (num(c) ? 'n' : '') + '"' + (i === 1 && r._lvl ? ' style="padding-inline-start:' + (2 + r._lvl * 4) + 'mm"' : '') + '>' + cell(c, r[c.k], r) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody>' +
        (res.total ? '<tfoot><tr>' + res.cols.map(function (c, i) { return '<td class="' + (num(c) ? 'n' : '') + '"><b>' + (i === 0 ? 'الإجمالي' : cell(c, res.total[c.k], res.total)) + '</b></td>'; }).join('') + '</tr></tfoot>' : '') + '</table>' +
        '<p class="p-note">آخر بيانات من سراج: ' + esc((F.meta && F.meta.last) || '') + ' · تقارير راكان تقرأ من سراج ولا تعدّل فيه</p></div>';
      setTimeout(function () { window.print(); }, 150);
    }

    /* ---------- اختيار حساب ---------- */
    function pickAccount(opts) {
      opts = opts || {};
      return new Promise(function (res) {
        var sel = opts.multi ? (opts.value || []).slice() : null;
        var s = sheet(opts.title || 'اختر الحساب', '<input class="input" id="aq" placeholder="ابحث بالرمز أو الاسم">' + (opts.hint ? '<div class="msg info">' + esc(opts.hint) + '</div>' : '') +
          '<div class="list acc-list" id="al"></div>' + (opts.multi ? '<button class="btn primary big" data-ok>حفظ الاختيار</button>' : ''), function (s) {
          var inp = q('#aq', s.el), al = q('#al', s.el);
          function draw() {
            var t = inp.value.trim();
            var list = F.D.accList.filter(function (a) { return (!opts.filter || opts.filter(a)) && (!t || (a.code + ' ' + a.name).indexOf(t) >= 0); }).slice(0, 300);
            al.innerHTML = list.map(function (a) {
              var on = sel && sel.indexOf(String(a.code)) >= 0;
              return '<button class="item tap acc-it' + (on ? ' sel' : '') + '" data-a="' + esc(a.id) + '" style="padding-inline-start:' + (8 + (t ? 0 : (a.lvl - 1) * 14)) + 'px"><div class="main"><b>' + esc(a.name) + '</b><div class="meta"><span class="num">' + esc(a.code) + '</span><span>مستوى ' + a.lvl + '</span>' + (a.leaf ? '' : '<span>رئيسي · ' + a.kids.length + ' فرع</span>') + '</div></div>' + (on ? '✓' : '') + '</button>';
            }).join('') || '<p class="muted">لا نتائج</p>';
            qa('[data-a]', al).forEach(function (b) {
              b.onclick = function () {
                var a = acc(b.dataset.a);
                if (!sel) { s.done = true; s.close(); res(a.id); return; }
                var c = String(a.code), i = sel.indexOf(c); if (i >= 0) sel.splice(i, 1); else sel.push(c); draw();
              };
            });
          }
          inp.oninput = draw; draw(); setTimeout(function () { inp.focus(); }, 50);
          var ok = q('[data-ok]', s.el);
          if (ok) ok.onclick = function () { s.done = true; s.close(); res(sel); };
          s.onclose = function () { if (!s.done) res(null); };
        });
      });
    }

    /* ---------- منشئ التقرير المخصص ---------- */
    function builderHTML() {
      var d = F.custom || (F.custom = { name: '', cat: 'تقاريري', def: { ds: 'sinv', row: 'month', col: '', meas: ['net', 'profit'], chart: 'bar', top: 0, fdim: '', filter: '' } });
      var df = d.def, ds = DS[df.ds];
      var opt = function (list, v) { return list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(v) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); };
      var dims = ds.dims.map(function (k) { return [k, DIMS[k][0]]; });
      var h = '<div class="card"><h2>تقرير مخصص</h2><p class="small muted" style="margin:0 0 12px">اختر مصدر البيانات وطريقة التجميع والأرقام المطلوبة، ثم احفظه باسم ليظهر في «تقاريري المخصصة» للمدير والمحاسب.</p><div class="form">' +
        '<div class="field"><label class="lbl" for="bds">مصدر البيانات</label><select id="bds" class="input">' + opt(Object.keys(DS).map(function (k) { return [k, DS[k].name]; }), df.ds) + '</select></div>' +
        '<div class="row"><div class="field grow"><label class="lbl" for="brow">الصفوف حسب</label><select id="brow" class="input">' + opt(dims, df.row) + '</select></div>' +
        '<div class="field grow"><label class="lbl" for="bcol">الأعمدة حسب (اختياري)</label><select id="bcol" class="input"><option value="">بدون</option>' + opt(dims.filter(function (x) { return x[0] !== df.row; }), df.col) + '</select></div></div>' +
        '<div class="field"><span class="lbl">الأرقام</span><div class="chips">' + Object.keys(ds.meas).map(function (k) { return '<label class="chip' + (df.meas.indexOf(k) >= 0 ? ' on' : '') + '"><input type="checkbox" hidden value="' + k + '"' + (df.meas.indexOf(k) >= 0 ? ' checked' : '') + '>' + esc(ds.meas[k][0]) + '</label>'; }).join('') + '</div>' +
        (df.col ? '<span class="small muted">مع «الأعمدة حسب» يُعرض الرقم الأول فقط موزعاً على الأعمدة</span>' : '') + '</div>' +
        '<div class="row"><div class="field grow"><label class="lbl" for="bfd">تصفية حسب (اختياري)</label><select id="bfd" class="input"><option value="">بدون</option>' + opt(dims, df.fdim) + '</select></div>' +
        '<div class="field grow"><label class="lbl" for="bfv">يحتوي على</label><input id="bfv" class="input" value="' + esc(df.filter || '') + '" placeholder="مثل: طرابلس"></div></div>' +
        '<div class="row"><div class="field grow"><label class="lbl" for="btop">العرض</label><select id="btop" class="input">' + opt([[0, 'الكل'], [10, 'أعلى 10'], [20, 'أعلى 20'], [50, 'أعلى 50']], df.top) + '</select></div>' +
        '<div class="field grow"><label class="lbl" for="bch">الرسم</label><select id="bch" class="input">' + opt([['', 'بدون'], ['bar', 'أعمدة'], ['line', 'خط'], ['hbar', 'أشرطة أفقية']], df.chart) + '</select></div></div>' +
        '<div class="row"><div class="field grow"><label class="lbl" for="bname">اسم التقرير</label><input id="bname" class="input" value="' + esc(d.name || '') + '" placeholder="مثل: مبيعات العملاء شهرياً"></div></div>' +
        '<div class="row"><button class="btn primary" data-brun>معاينة</button><button class="btn accent" data-bsave>' + (d.id ? 'حفظ التعديل' : 'حفظ التقرير') + '</button>' +
        (d.id ? '<button class="btn danger" data-bdel>حذف</button>' : '') + '<button class="btn ghost" data-bnew>جديد</button></div></div></div>';
      if (F.preview) {
        var t = today(), p = F.previewP || { preset: 'year', from: t.slice(0, 4) + '-01-01', to: t };
        var res = runCustom(df, p);
        h += '<div class="card"><div class="small muted">معاينة: ' + perLabel(p.from, p.to) + ' (يمكن تغيير الفترة بعد الحفظ)</div></div>' + (res.chart && res.rows.length > 1 ? '<div class="card">' + chartSVG(res.chart, res.rows) + '</div>' : '') + '<div class="card scroll-x fin-table">' + tableHTML(res) + '</div>';
      }
      return h;
    }
    function bindBuilder(m) {
      var d = F.custom, df = d.def;
      var upd = function (rerender) {
        df.ds = q('#bds', m).value;
        var dsd = DS[df.ds];
        if (dsd.dims.indexOf(df.row) < 0) df.row = dsd.dims[2];
        df.row = q('#brow', m).value && dsd.dims.indexOf(q('#brow', m).value) >= 0 ? q('#brow', m).value : df.row;
        df.col = q('#bcol', m).value; if (df.col === df.row || dsd.dims.indexOf(df.col) < 0) df.col = '';
        df.meas = qa('.chips input:checked', m).map(function (c) { return c.value; }).filter(function (k) { return dsd.meas[k]; });
        if (!df.meas.length) df.meas = [Object.keys(dsd.meas)[0]];
        df.fdim = q('#bfd', m).value; df.filter = q('#bfv', m).value.trim(); df.top = Number(q('#btop', m).value) || 0; df.chart = q('#bch', m).value;
        d.name = q('#bname', m).value.trim();
        if (rerender) A.render();
      };
      ['#bds', '#brow', '#bcol', '#bfd', '#btop', '#bch'].forEach(function (s) { q(s, m).onchange = function () { if (s === '#bds') { df.meas = []; df.row = 'month'; df.col = ''; df.fdim = ''; } upd(true); }; });
      qa('.chips label', m).forEach(function (l) { l.onclick = function (e) { e.preventDefault(); var c = q('input', l); c.checked = !c.checked; upd(true); }; });
      q('#bfv', m).onchange = function () { upd(F.preview); };
      q('#bname', m).oninput = function () { d.name = this.value; };
      q('[data-brun]', m).onclick = function () { upd(false); F.preview = true; A.render(); };
      q('[data-bnew]', m).onclick = function () { F.custom = null; F.preview = false; A.render(); };
      q('[data-bsave]', m).onclick = function () {
        upd(false);
        if (!d.name) { toast('اكتب اسم التقرير', true); q('#bname', m).focus(); return; }
        var b = this; busy(b, true);
        call('fin_report_save', { report: { id: d.id, name: d.name, cat: d.cat, def: df } }).then(function (r) {
          F.reports = r.reports; var saved = r.reports.filter(function (x) { return x.name === d.name; }).pop();
          toast('حُفظ التقرير في «تقاريري المخصصة»'); F.custom = null; F.preview = false;
          if (saved) openReport('c:' + saved.id); else { F.sub = 'reports'; A.render(); }
        }).catch(function (e) { busy(b, false); toast(e.message, true); });
      };
      var del = q('[data-bdel]', m);
      if (del) del.onclick = function () {
        A.confirmBox('حذف التقرير', 'حذف «' + esc(d.name) + '» من التقارير المخصصة؟', 'حذف').then(function (y) {
          if (!y) return;
          call('fin_report_delete', { id: d.id }).then(function (r) { F.reports = r.reports; F.custom = null; F.preview = false; toast('حُذف التقرير'); F.sub = 'reports'; A.render(); }).catch(function (e) { toast(e.message, true); });
        });
      };
    }

    /* ---------- الصناديق والإعدادات المالية ---------- */
    function boxSuggestions() {
      var defined = {}; F.boxes.forEach(function (b) { if (b.active) defined[b.acc] = 1; });
      return F.D.accList.filter(function (a) {
        if (!a.leaf || defined[a.id]) return false;
        var anc = acc(a.parent), names = a.name, g = 0;
        while (anc && g++ < 6) { names += ' ' + anc.name; anc = acc(anc.parent); }
        return /الصناديق|خزين|صندوق|المصارف|مصرف|بنك/.test(names) && !/معلق|حوالات|البطاقات/.test(a.name);
      }).map(function (a) { return { acc: a.id, name: a.name.trim(), kind: /مصرف|بنك/.test(a.name + ' ' + (acc(a.parent) || {}).name) ? 'بنك' : 'صندوق', bal: balance([a.id], null, null).close, n: (F.D.byAcc[a.id] || []).length }; })
        .filter(function (x) { return x.n > 0; }).sort(function (x, y) { return y.n - x.n; });
    }
    function settingsHTML() {
      var s = (F.meta && F.meta.settings) || {};
      var bx = F.boxes.slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
      var sug = boxSuggestions();
      var h = '<div class="card"><h2>الصناديق والبنوك</h2><p class="small muted" style="margin:0 0 10px">عرّف الصناديق والحسابات المصرفية التي تريد متابعة أرصدتها وحركتها. كل واحد مربوط بحساب في دليل حسابات سراج.</p>' +
        (bx.length ? '<div class="list">' + bx.map(function (b) {
          return '<div class="item' + (b.active ? '' : ' muted') + '"><div class="main"><b>' + esc(b.name) + ' <span class="badge">' + esc(b.kind) + '</span>' + (b.active ? '' : ' <span class="badge">موقوف</span>') + '</b><div class="meta"><span class="num">' + esc((acc(b.acc) || {}).code || '') + '</span><span>' + esc(accName(b.acc)) + '</span><span>الرصيد الآن: <b class="num">' + fm(balance([b.acc], null, null).close) + '</b></span></div></div><button class="btn sm ghost" data-bedit="' + esc(b.id) + '">تعديل</button></div>';
        }).join('') + '</div>' : '<div class="msg info">لم يُعرّف أي صندوق أو بنك بعد.</div>') +
        '<div class="row" style="margin-top:10px"><button class="btn primary" data-badd>+ تعريف صندوق أو بنك</button></div></div>';
      if (sug.length) h += '<div class="card"><h3>حسابات مقترحة من دليل حسابات سراج (' + sug.length + ')</h3><p class="small muted" style="margin:0 0 8px">حسابات تحت «الصناديق» و«المصارف» عليها حركة ولم تُعرّف بعد. يمكنك تعريفها بضغطة، وتعديل اسمها لاحقاً.</p><div class="list">' +
        sug.map(function (x, i) { return '<label class="item tap"><input type="checkbox" data-sug="' + i + '" checked><div class="main"><b>' + esc(x.name) + '</b><div class="meta"><span class="badge">' + x.kind + '</span><span>' + fk(x.n) + ' حركة</span><span>الرصيد ' + fm(x.bal) + '</span></div></div></label>'; }).join('') +
        '</div><button class="btn accent" data-sugadd style="margin-top:10px">تعريف المحدد</button></div>';
      h += '<div class="card"><h2>مجموعات الحسابات</h2><div class="form">' +
        '<div class="field"><span class="lbl">حسابات العملاء (للمديونيات وأعمار الديون)</span><button class="input" data-grp="recv" style="text-align:start">' + esc(grpLabel(s.recv || '1601')) + '</button><span class="small muted">' + fk(recvIds().length) + ' حساب عميل</span></div>' +
        '<div class="field"><span class="lbl">حسابات الموردين</span><button class="input" data-grp="pay" style="text-align:start">' + esc(grpLabel(s.pay || '261')) + '</button><span class="small muted">' + fk(payIds().length) + ' حساب مورد</span></div>' +
        '<div class="field"><label class="lbl" for="fys">بداية السنة المالية</label><input type="date" class="input num" id="fys" value="' + esc(s.year_start || '2026-01-01') + '" style="max-width:200px"></div></div></div>';
      h += '<div class="card"><h3>البيانات على هذا الجهاز</h3><p class="small" style="margin:0">' + fk(Object.keys(F.rows || {}).length) + ' سجل · آخر مزامنة ' + esc((F.meta && F.meta.last) || '—') + '</p><p class="small muted">تُحفظ البيانات المالية على هذا الجهاز لتعمل التقارير بسرعة وبلا إنترنت، وتُمسح عند الخروج من التطبيق.</p><button class="btn sm ghost" data-open="data_check">فحص سلامة البيانات</button></div>';
      return h;
    }
    function grpLabel(codes) { return String(codes).split(',').map(function (c) { var a = F.D.accList.filter(function (x) { return String(x.code) === c; })[0]; return a ? c + ' · ' + a.name : c; }).join('، '); }
    function bindSettings(m) {
      q('[data-badd]', m).onclick = function () { boxForm(null); };
      qa('[data-bedit]', m).forEach(function (b) { b.onclick = function () { boxForm(F.boxes.filter(function (x) { return x.id === b.dataset.bedit; })[0]); }; });
      qa('[data-open]', m).forEach(function (b) { b.onclick = function () { openReport(b.dataset.open); }; });
      var sa = q('[data-sugadd]', m);
      if (sa) sa.onclick = function () {
        var sug = boxSuggestions(), pick = qa('[data-sug]', m).filter(function (c) { return c.checked; }).map(function (c) { return sug[Number(c.dataset.sug)]; });
        if (!pick.length) return;
        busy(sa, true);
        var chain = Promise.resolve();
        pick.forEach(function (x, i) { chain = chain.then(function () { return call('fin_box_save', { box: { acc: x.acc, name: x.name, kind: x.kind, sort: F.boxes.length + i } }).then(function (r) { F.boxes = r.boxes; }); }); });
        chain.then(function () { toast('عُرّف ' + pick.length + ' صندوق/بنك'); A.render(); }).catch(function (e) { busy(sa, false); toast(e.message, true); A.render(); });
      };
      qa('[data-grp]', m).forEach(function (b) {
        b.onclick = function () {
          var k = b.dataset.grp, cur = String(((F.meta && F.meta.settings) || {})[k] || (k === 'recv' ? '1601' : '261')).split(',');
          pickAccount({ multi: true, value: cur, title: k === 'recv' ? 'حسابات العملاء' : 'حسابات الموردين', hint: 'اختر الحسابات الرئيسية التي تحتها العملاء أو الموردون. كل الحسابات الفرعية تحتها تُحسب تلقائياً.', filter: function (a) { return !a.leaf || a.lvl <= 4; } })
            .then(function (codes) {
              if (!codes || !codes.length) return;
              var body = {}; body[k] = codes.join(',');
              call('fin_settings_save', { settings: body }).then(function (r) { F.meta.settings = r.settings; S.set('fin:meta', F.meta); toast('حُفظت'); A.render(); }).catch(function (e) { toast(e.message, true); });
            });
        };
      });
      q('#fys', m).onchange = function () { call('fin_settings_save', { settings: { year_start: this.value } }).then(function (r) { F.meta.settings = r.settings; S.set('fin:meta', F.meta); toast('حُفظت'); A.render(); }).catch(function (e) { toast(e.message, true); }); };
    }
    function boxForm(b) {
      var d = b ? Object.assign({}, b) : { acc: '', name: '', kind: 'صندوق', active: true, sort: F.boxes.length };
      var s = sheet(b ? 'تعديل ' + b.name : 'تعريف صندوق أو بنك', '<div class="form"><div class="field"><span class="lbl">الحساب في دليل سراج</span><button class="input" id="bacc" style="text-align:start">' + (d.acc ? esc(((acc(d.acc) || {}).code || '') + ' · ' + accName(d.acc)) : 'اختر الحساب…') + '</button></div>' +
        '<div class="field"><label class="lbl" for="bnm">الاسم في التقارير</label><input id="bnm" class="input" value="' + esc(d.name) + '"></div>' +
        '<div class="field"><span class="lbl">النوع</span><div class="chips">' + ['صندوق', 'بنك'].map(function (k) { return '<button class="chip' + (d.kind === k ? ' on' : '') + '" data-k="' + k + '">' + k + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><label class="lbl" for="bso">الترتيب</label><input id="bso" type="number" class="input num" value="' + esc(d.sort) + '" style="max-width:120px"></div>' +
        (b ? '<label class="chk"><input type="checkbox" id="bac"' + (d.active ? ' checked' : '') + '> نشط (يظهر في التقارير)</label>' : '') +
        '<div id="berr"></div><button class="btn primary big" id="bsv">حفظ</button></div>', function (s) {
        q('#bacc', s.el).onclick = function () {
          pickAccount({ title: 'حساب الصندوق أو البنك', filter: function (a) { return a.leaf; } }).then(function (id) {
            if (!id) return; d.acc = id; q('#bacc', s.el).textContent = acc(id).code + ' · ' + acc(id).name;
            if (!q('#bnm', s.el).value) q('#bnm', s.el).value = acc(id).name.trim();
          });
        };
        qa('[data-k]', s.el).forEach(function (c) { c.onclick = function () { d.kind = c.dataset.k; qa('[data-k]', s.el).forEach(function (x) { x.classList.toggle('on', x === c); }); }; });
        q('#bsv', s.el).onclick = function () {
          var btn = this; busy(btn, true);
          d.name = q('#bnm', s.el).value.trim(); d.sort = Number(q('#bso', s.el).value) || 0; if (b) d.active = q('#bac', s.el).checked;
          call('fin_box_save', { box: d }).then(function (r) { F.boxes = r.boxes; s.close(); toast('حُفظ'); A.render(); })
            .catch(function (e) { busy(btn, false); q('#berr', s.el).innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; });
        };
      });
      return s;
    }

    // عند الخروج: مسح البيانات المالية من الجهاز
    A.onLogout(function () { F.rows = null; F.D = null; F.rev = 0; F.meta = null; F.cur = null; return Promise.all([S.del('fin:rows'), S.del('fin:rev'), S.del('fin:meta'), S.del('fin:aux')]); });
    try { st.finParams = JSON.parse(localStorage.getItem('rk.finParams') || '{}'); } catch (e) { st.finParams = {}; }

    // للاختبارات: الوصول للمحرّك
    window.__rkfin = { F: F, R: R, runCustom: runCustom, build: build, balance: balance, salesStats: salesStats };
  };
})();
