/* Today follow-ups for a small shop. No new vendors.
   Unsigned estimates, next-morning review asks, and members due.
   Texts open the phone's Messages app (sms:) or Mail (mailto:). Nothing sends by itself.
   Saved in mt_follow, which the full JSON backup includes. */
(function () {
  const KEY = 'mt_follow';
  const PAST = ['Approved', 'Sold', 'Job done', 'Repaired', 'Invoiced', 'Paid', 'Won', 'Installed', 'Lost'];
  const QUOTE_FORMS = { estimate: 1, 'hvac-quote': 1 };
  const QUOTE_STAGES = { 'Estimate sent': 1, Quoted: 1, Proposal: 1 };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function digits(s) { return String(s || '').replace(/\D/g, '').slice(-10); }
  function firstName(n) {
    const s = String(n || '').replace(/^Demo:\s*/, '').trim().split(/\s+/)[0];
    return s || 'there';
  }
  function initials(n) {
    const p = String(n || '?').replace(/^Demo:\s*/, '').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
    return p || '?';
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function today() {
    try { if (window.CRM && CRM.today) return CRM.today(); } catch (e) {}
    const p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day;
  }
  function stamp() {
    try { if (window.CRM && CRM.stamp) return CRM.stamp(); } catch (e) {}
    return today();
  }
  function addDays(ymd, n) {
    const [y, m, d] = String(ymd || today()).slice(0, 10).split('-').map(Number);
    const t = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + n));
    return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
  }
  function daysBetween(a, b) {
    if (!a || !b) return 0;
    const p = s => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
    return Math.round((p(b) - p(a)) / 86400000);
  }
  function monthDay(d) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return '';
    return MONTHS[+d.slice(5, 7) - 1] + ' ' + (+d.slice(8));
  }
  function whenLabel(d) {
    const t = today();
    if (!d) return 'No date yet';
    if (d === t) return 'Today';
    if (d === addDays(t, 1)) return 'Tomorrow';
    if (d < t) return 'Overdue · ' + monthDay(d);
    return monthDay(d);
  }
  function money(v) {
    const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.]/g, ''));
    if (!isFinite(n) || n <= 0) return '';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function cleanup(s) {
    return String(s || '').replace(/[ \t]{2,}/g, ' ').replace(/\s+([.,!?])/g, '$1').replace(/\s+\./g, '.').trim();
  }
  function clip(s, n) { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; }
  function toast(m) { try { window.CORE.toast(m); } catch (e) {} }
  function closeSheet() { try { window.CORE.closeSheet(); } catch (e) {} }
  function openSheet(html, bind) { window.CORE.sheet(html, bind); }

  function defaultTexts() {
    return {
      estimate: "Hey {f}, it's {me} with {biz}. Checking in on your estimate{what}. {options} Happy to answer any questions. Reply STOP to opt out.",
      review: "Hey {f}, it's {me} with {biz}. Thanks for having us out.{work} If we did right by you, a Google review helps a local shop a lot. {link} Reply STOP to opt out.",
      season: "Hey {f}, it's {me} with {biz}. {season} is a good time for your {plan}. Want me to set a day? Reply STOP to opt out.",
      filter: "Hey {f}, it's {me} with {biz}. It's time for the filter change you asked us to remind you about. Want me to set a day? Reply STOP to opt out."
    };
  }
  function blank() {
    return { v: 1, days: 2, reviewUrl: '', updatedAt: '', texts: defaultTexts(), estimates: [], reviews: [], members: [] };
  }
  function load() {
    let o = blank();
    try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && typeof v === 'object') o = Object.assign(blank(), v); } catch (e) {}
    o.texts = Object.assign(defaultTexts(), o.texts || {});
    o.estimates = Array.isArray(o.estimates) ? o.estimates : [];
    o.reviews = Array.isArray(o.reviews) ? o.reviews : [];
    o.members = Array.isArray(o.members) ? o.members : [];
    let days = parseInt(o.days, 10);
    if (!isFinite(days)) days = 2;
    o.days = Math.max(0, Math.min(90, days));
    o.reviewUrl = String(o.reviewUrl || '').trim();
    return o;
  }
  function save(o) {
    o.updatedAt = new Date().toISOString();
    try { localStorage.setItem(KEY, JSON.stringify(o)); return true; }
    catch (e) { try { if (window.CORE) window.CORE.toast('Phone storage is full. Download a backup, then free some space.'); } catch (e2) {} return false; }
  }
  function crm() {
    try { return window.CRM && CRM.db ? CRM.db() : { leads: {}, checks: [], docs: [] }; } catch (e) { return { leads: {}, checks: [], docs: [] }; }
  }
  function recent() {
    try { const v = JSON.parse(localStorage.getItem('mtf_recent') || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function leadOf(id) { const d = crm(); return id && d.leads ? d.leads[id] : null; }
  function who(pack) {
    let me = 'your tech', biz = 'us', phone = '';
    try {
      const id = pack && window.MT && MT.isOn && MT.isOn(pack) ? pack : (MT.primary ? MT.primary() : '');
      const n = String((MT.me(id).name || '')).trim().split(/\s+/)[0];
      if (n) me = n;
      const L = MT.look(id);
      if (L && L.name) biz = L.name;
      phone = (MT.me(id).phone || (L && L.phone) || '');
    } catch (e) {}
    return { me: me, biz: biz, phone: phone };
  }

  function seasonName(day) {
    const m = +(String(day || today()).slice(5, 7));
    if (m >= 3 && m <= 4) return 'Spring';
    if (m >= 10 && m <= 11) return 'Fall';
    if (m >= 5 && m <= 9) return 'Fall';
    return 'Spring';
  }
  function nextSeason(day, which) {
    const t = String(day || today()).slice(0, 10);
    const y = +t.slice(0, 4);
    const spring = y + '-03-01', springEnd = y + '-04-30', fall = y + '-10-01', fallEnd = y + '-11-30';
    const opts = [];
    const pushSpring = () => { if (t <= springEnd) opts.push(t >= spring ? t : spring); else opts.push((y + 1) + '-03-01'); };
    const pushFall = () => { if (t <= fallEnd) opts.push(t >= fall ? t : fall); else opts.push((y + 1) + '-10-01'); };
    if (which !== 'fall') pushSpring();
    if (which !== 'spring') pushFall();
    opts.sort();
    return opts[0] || t;
  }
  /* The next season window after a reminder already went out. */
  function seasonAfter(day, which) {
    const t = String(day || today()).slice(0, 10);
    const m = +t.slice(5, 7), y = +t.slice(0, 4);
    if (which === 'spring') return (m < 3 ? y : y + 1) + '-03-01';
    if (which === 'fall') return (m < 10 ? y : y + 1) + '-10-01';
    if (m <= 4) return y + '-10-01';
    if (m < 10) return y + '-10-01';
    return (y + 1) + '-03-01';
  }
  function everyDays(start, step, day) {
    let d = String(start || '').slice(0, 10);
    const t = String(day || today()).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return t;
    let guard = 0;
    while (addDays(d, step) <= t && guard < 40) { d = addDays(d, step); guard++; }
    return d;
  }
  function anniversary(start, day) {
    const s = String(start || '').slice(0, 10);
    const t = String(day || today()).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
    let y = +t.slice(0, 4);
    let d = y + s.slice(4);
    if (d < t) d = (y + 1) + s.slice(4);
    return d;
  }

  function quoteBits(vals) {
    const ov = (vals && vals.options) || {};
    const bits = ['Good', 'Better', 'Best'].map(n => {
      const o = ov[n] || {};
      const price = money(o.price);
      const desc = clip(o.desc, 42);
      if (!price && !desc) return '';
      return n + (price ? ' ' + price : '') + (desc ? ' (' + desc + ')' : '');
    }).filter(Boolean);
    const problem = clip((vals && (vals.problem || vals.old_sys)) || '', 80);
    return { picked: (vals && vals.picked) || 'Not yet', what: problem, options: bits.length ? bits.join(', ') + '. ' : '' };
  }
  function planPick(vals) {
    const pg = vals && (vals.plan || vals.ai_plan) || {};
    return String(pg.pick || '').toLowerCase();
  }
  function upsert(list, rec) {
    const i = list.findIndex(x => x && x.id === rec.id);
    if (i < 0) { list.push(rec); return; }
    Object.keys(rec).forEach(k => {
      if (list[i][k] == null || list[i][k] === '') list[i][k] = rec[k];
    });
  }

  let absorbed = false;
  function absorb() {
    if (absorbed) return load();
    const s = load();
    const before = fingerprint(s);
    const d = crm();
    const leads = d.leads || {};
    const docs = d.docs || [];
    const recs = recent();
    docs.forEach(doc => {
      if (!doc || !doc.id) return;
      const lead = leads[doc.lead_id] || null;
      const rec = recs.find(r => r && r.id === doc.id) || {};
      const sent = String(doc.ts || rec.when || '').slice(0, 10);
      const person = {
        customer: (lead && lead.name) || rec.customer || '',
        phone: (lead && lead.phone) || rec.phone || '',
        email: (lead && lead.email) || rec.email || '',
        pack: (lead && (lead.pack || '')) || rec.pack || '',
        leadId: doc.lead_id || rec.leadId || ''
      };
      if (QUOTE_FORMS[doc.formId]) {
        const open = !lead || PAST.indexOf(lead.stage) < 0;
        upsert(s.estimates, Object.assign({
          id: doc.id, formId: doc.formId, title: doc.title || 'Estimate', sent: sent,
          what: (lead && lead.need) || '', options: '', total: doc.total || rec.total || '',
          picked: open ? 'Not yet' : 'Sold', closed: !open, nudged: ''
        }, person));
      } else if (doc.formId === 'signoff') {
        if (sent && daysBetween(sent, today()) <= 21) {
          upsert(s.reviews, Object.assign({
            id: doc.id, sent: sent, due: addDays(sent, 1), work: '', happy: '', done: ''
          }, person));
        }
      } else if (doc.formId === 'hvac-plan') {
        upsert(s.members, Object.assign({
          id: 'doc-' + doc.id, kind: 'club', plan: (window.BEES && BEES.club) || 'Comfort Club',
          which: 'both', freq: '', start: sent, next: '', renew: (lead && lead.hv_renew) || '', sms: true, source: 'Comfort Club'
        }, person));
      } else if (doc.formId === 'wh-agreement') {
        upsert(s.members, Object.assign({
          id: 'doc-' + doc.id, kind: 'water', plan: 'Water heater plan', which: 'year', freq: '',
          start: sent, next: '', renew: '', sms: true, source: 'Water heater plan'
        }, person));
      }
    });
    Object.keys(leads).forEach(id => {
      const l = leads[id];
      if (!l) return;
      if (QUOTE_STAGES[l.stage] && !s.estimates.some(e => e && e.leadId === id && !e.closed)) {
        upsert(s.estimates, {
          id: 'stage-' + id, leadId: id, formId: 'estimate', title: 'Estimate',
          customer: l.name || '', phone: l.phone || '', email: l.email || '', pack: l.pack || '',
          sent: String(l.updated || l.created || '').slice(0, 10), what: l.need || '', options: '',
          total: '', picked: 'Not yet', closed: false, nudged: ''
        });
      }
      if (l.hv_member === 'Active') {
        upsert(s.members, {
          id: 'lead-club-' + id, leadId: id, kind: 'club', plan: l.hv_plan || ((window.BEES && BEES.club) || 'Comfort Club'),
          which: 'both', freq: '', customer: l.name || '', phone: l.phone || '', email: l.email || '', pack: l.pack || 'hvac',
          start: l.hv_joined || String(l.created || '').slice(0, 10), next: '', renew: l.hv_renew || '', sms: true, source: 'Comfort Club'
        });
      }
      if (l.next_step === 'Annual inspection due' && l.next_date) {
        upsert(s.members, {
          id: 'lead-insp-' + id, leadId: id, kind: 'inspection', plan: 'Yearly inspection', which: 'year', freq: '',
          customer: l.name || '', phone: l.phone || '', email: l.email || '', pack: l.pack || 'plumbing',
          start: String(l.updated || '').slice(0, 10), next: l.next_date, renew: '', sms: true, source: 'Yearly inspection'
        });
      }
    });
    (d.checks || []).forEach(c => {
      if (!c || c.reminders !== 'yes') return;
      if (c.consent_text === 'no') return;
      const lead = leads[c.lead_id] || null;
      const freq = c.reminder_freq || 'spring+fall';
      const which = freq === 'spring' ? 'spring' : freq === 'fall' ? 'fall' : freq === '90d' ? '90d' : 'both';
      upsert(s.members, {
        id: 'check-' + (c.check_id || c.lead_id || c.ts),
        leadId: c.lead_id || '', kind: 'check', plan: freq === '90d' ? 'Filter reminder' : 'Tune-up reminder',
        which: which, freq: freq, customer: (lead && lead.name) || c.first || '',
        phone: (lead && lead.phone) || c.mobile || '', email: (lead && lead.email) || c.email || '',
        pack: 'hvac', start: String(c.ts || '').slice(0, 10), next: '', renew: '',
        sms: true, source: 'Energy Check'
      });
    });
    s.estimates.forEach(e => {
      const l = e.leadId && leads[e.leadId];
      if (l && PAST.indexOf(l.stage) >= 0) e.closed = true;
      if (e.picked && e.picked !== 'Not yet') e.closed = true;
    });
    const after = fingerprint(s);
    if (after !== before) save(s);
    absorbed = true;
    return s;
  }
  function fingerprint(o) {
    return JSON.stringify({ days: o.days, reviewUrl: o.reviewUrl || '', texts: o.texts, estimates: o.estimates, reviews: o.reviews, members: o.members });
  }
  function refresh() { absorbed = false; return absorb(); }

  function ageOf(e) {
    const from = e.nudged && e.nudged > (e.sent || '') ? e.nudged : e.sent;
    return daysBetween(from, today());
  }
  function waiting() {
    const s = absorb();
    const n = s.days;
    const t = today();
    return s.estimates.filter(e => e && !e.closed && e.sent && e.nudged !== t && ageOf(e) >= n).sort((a, b) => String(a.sent).localeCompare(String(b.sent)));
  }
  function dueReviews() {
    const s = absorb();
    const t = today();
    return s.reviews.filter(r => r && !r.done && r.due && r.due <= t && daysBetween(r.due, t) <= 21)
      .sort((a, b) => String(a.due).localeCompare(String(b.due)));
  }
  function upcomingReviews() {
    const s = absorb();
    const t = today();
    return s.reviews.filter(r => r && !r.done && r.due && r.due > t).sort((a, b) => String(a.due).localeCompare(String(b.due)));
  }
  function visitOf(m) {
    const t = today();
    const which = m.which || 'both';
    let next = m.next || '';
    if (!next) {
      if (m.freq === '90d' || which === '90d') next = everyDays(m.start || t, 90, t);
      else if (which === 'spring' || which === 'fall' || which === 'both') next = nextSeason(t, which === 'both' ? 'both' : which);
      else next = anniversary(m.start, t) || nextSeason(t, 'both');
    }
    if (m.reminded && next <= t) {
      const from = m.reminded.slice(0, 10);
      if (m.freq === '90d' || which === '90d') next = addDays(from, 90);
      else if (which === 'year') next = addDays(from, 365);
      else next = seasonAfter(t, which === 'spring' || which === 'fall' ? which : 'both');
    }
    return next;
  }
  function allMembers() {
    const s = absorb();
    const rank = k => ({ club: 0, water: 1, inspection: 2, check: 3 }[k] == null ? 4 : { club: 0, water: 1, inspection: 2, check: 3 }[k]);
    const best = new Map();
    s.members.forEach(m => {
      if (!m || !(m.customer || m.phone)) return;
      const key = digits(m.phone).length >= 7 ? 'p:' + digits(m.phone) : (m.leadId ? 'l:' + m.leadId : 'i:' + m.id);
      const cur = best.get(key);
      const row = Object.assign({}, m, { nextVisit: visitOf(m) });
      if (!cur) { best.set(key, row); return; }
      const betterPlan = rank(row.kind) < rank(cur.kind);
      const sooner = (row.nextVisit || '9') < (cur.nextVisit || '9');
      const keep = betterPlan ? Object.assign(cur, row, { nextVisit: sooner ? row.nextVisit : (cur.nextVisit || row.nextVisit) }) : cur;
      if (!betterPlan && sooner && (!cur.nextVisit || cur.nextVisit <= today())) keep.nextVisit = row.nextVisit;
      if (!keep.phone && row.phone) keep.phone = row.phone;
      if (!keep.email && row.email) keep.email = row.email;
      best.set(key, keep);
    });
    const list = Array.from(best.values());
    list.sort((a, b) => String(a.nextVisit || '9').localeCompare(String(b.nextVisit || '9')) || String(a.customer).localeCompare(String(b.customer)));
    return list;
  }
  function membersDue() {
    const t = today();
    const ym = t.slice(0, 7);
    return allMembers().filter(m => {
      const n = m.nextVisit || '';
      if (!n) return true;
      return n <= t || n.slice(0, 7) === ym;
    });
  }
  function counts() {
    return { estimates: waiting().length, reviews: dueReviews().length, members: membersDue().length, allMembers: allMembers().length };
  }

  function fill(tpl, map) {
    let s = String(tpl || '');
    Object.keys(map).forEach(k => { s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), map[k] == null ? '' : String(map[k])); });
    return cleanup(s);
  }
  function textFor(kind, item) {
    const s = load();
    const w = who(item.pack);
    const base = { f: firstName(item.customer), me: w.me, biz: w.biz, phone: w.phone };
    if (kind === 'est') {
      const what = item.what && !/^estimate$/i.test(item.what) ? ' for ' + item.what : '';
      let options = item.options || '';
      if (!options && item.total) options = item.total + '. ';
      if (options && !/\s$/.test(options) && !/[.!?]$/.test(options)) options += '. ';
      if (options && !/\s$/.test(options)) options += ' ';
      return fill(s.texts.estimate, Object.assign(base, { what: what, options: options }));
    }
    if (kind === 'rev') {
      let work = clip(item.work, 80);
      if (work) {
        work = work.charAt(0).toUpperCase() + work.slice(1);
        if (!/[.!?]$/.test(work)) work += '.';
        work = ' ' + work;
      }
      const link = s.reviewUrl || '';
      return fill(s.texts.review, Object.assign(base, { work: work, link: link }));
    }
    if (item.freq === '90d') return fill(s.texts.filter, base);
    const season = item.which === 'spring' ? 'Spring' : item.which === 'fall' ? 'Fall' : seasonName(today());
    if (item.which === 'year') {
      const plan = item.kind === 'water' ? 'water heater visit' : 'yearly inspection';
      return fill("Hey {f}, it's {me} with {biz}. It's time for your {plan}. Want me to set a day? Reply STOP to opt out.", Object.assign(base, { plan: plan }));
    }
    const plan = item.kind === 'club' ? (item.plan || 'Comfort Club')
      : item.kind === 'water' ? 'water heater plan'
      : item.kind === 'inspection' ? 'yearly inspection'
      : season === 'Spring' ? 'AC tune-up' : season === 'Fall' ? 'furnace tune-up' : (item.plan || 'visit');
    return fill(s.texts.season, Object.assign(base, { season: season, plan: plan }));
  }
  function smsHref(phone, body) {
    try { if (window.MT && MT.smsHref) return MT.smsHref(phone, body); } catch (e) {}
    const d = digits(phone);
    return 'sms:' + d + '?&body=' + encodeURIComponent(body || '');
  }
  function mailHref(email, subject, body) {
    return 'mailto:' + String(email || '').trim() + '?subject=' + encodeURIComponent(subject || '') + '&body=' + encodeURIComponent(body || '');
  }
  function channel(item, kind) {
    const body = textFor(kind, item);
    const phone = digits(item.phone);
    const email = String(item.email || '').trim();
    if (phone.length >= 7) return { href: smsHref(item.phone, body), kind: 'sms', body: body };
    if (email) {
      const w = who(item.pack);
      const subject = kind === 'rev' ? 'Thanks from ' + w.biz : (w.biz + ' reminder');
      return { href: mailHref(email, subject, body), kind: 'mail', body: body };
    }
    return { href: '', kind: '', body: body };
  }
  function buttonLabel(item, kind, ch) {
    if (!ch.href) return 'No number';
    if (kind === 'est') return 'Text';
    if (kind === 'rev') return ch.kind === 'mail' ? 'Email' : 'Text';
    if (item.freq === '90d') return 'Filter text';
    if (item.which === 'spring') return 'Spring text';
    if (item.which === 'fall') return 'Fall text';
    if (item.which === 'year') return 'Visit text';
    return seasonName(today()) + ' text';
  }

  function find(kind, id) {
    const s = load();
    const list = kind === 'est' ? s.estimates : kind === 'rev' ? s.reviews : s.members;
    return { store: s, list: list, item: list.find(x => x && x.id === id) || null };
  }
  function touch(kind, id) {
    const f = find(kind, id);
    if (!f.item) return;
    const t = today();
    if (kind === 'est') f.item.nudged = t;
    else if (kind === 'rev') f.item.done = t;
    else {
      f.item.reminded = t;
      const which = f.item.which || 'both';
      f.item.next = (which === '90d' || f.item.freq === '90d') ? addDays(t, 90) : which === 'year' ? addDays(t, 365) : seasonAfter(t, which === 'spring' || which === 'fall' ? which : 'both');
    }
    save(f.store);
    try {
      if (f.item.leadId && window.CRM && CRM.updateLead) {
        const line = kind === 'est' ? 'Estimate follow-up' : kind === 'rev' ? 'Review request' : 'Member reminder';
        CRM.updateLead(f.item.leadId, { _note: stamp() + ' · Text · ' + line }, null, false);
      }
    } catch (e) {}
  }
  function done(kind, id) {
    const f = find(kind, id);
    if (!f.item) return;
    if (kind === 'rev') f.item.done = today();
    else f.item.closed = true;
    save(f.store);
    try { if (window.CRM && CRM.render) CRM.render(); } catch (e) {}
  }

  function noteForm(rec, vals, leadId) {
    if (!rec || !rec.id) return null;
    const s = load();
    const sent = today();
    const person = {
      customer: rec.customer || (vals && vals.c_name) || '',
      phone: rec.phone || (vals && vals.c_phone) || '',
      email: rec.email || (vals && vals.c_email) || '',
      pack: rec.pack || '',
      leadId: leadId || ''
    };
    const leadPatch = {};
    if (QUOTE_FORMS[rec.formId]) {
      const bits = quoteBits(vals || {});
      const unsigned = !bits.picked || bits.picked === 'Not yet';
      const prev = s.estimates.find(e => e.id === rec.id) || {};
      const recEst = Object.assign({
        id: rec.id, formId: rec.formId, title: rec.title || 'Estimate', sent: sent,
        what: bits.what, options: bits.options, total: rec.total || '',
        picked: bits.picked || 'Not yet', closed: !unsigned, nudged: prev.nudged || ''
      }, person);
      const i = s.estimates.findIndex(e => e.id === rec.id);
      if (i >= 0) s.estimates[i] = Object.assign(s.estimates[i], recEst);
      else s.estimates.push(recEst);
    } else if (rec.formId === 'signoff') {
      const happy = (vals && vals.happy) || 'Yes';
      if (happy !== 'Not yet, see notes') {
        const work = clip((vals && vals.work_done) || '', 80);
        const i = s.reviews.findIndex(r => r.id === rec.id);
        const row = Object.assign({ id: rec.id, sent: sent, due: addDays(sent, 1), work: work, happy: happy, done: '' }, person);
        if (i >= 0) s.reviews[i] = Object.assign(s.reviews[i], row, { done: s.reviews[i].done || '' });
        else s.reviews.push(row);
      }
    } else if (rec.formId === 'hvac-plan') {
      const plan = (vals && vals.club_plan) || ((window.BEES && BEES.club) || 'Comfort Club');
      const sms = !vals || vals.sms_ok !== 'No';
      const row = Object.assign({
        id: 'form-' + rec.id, kind: 'club', plan: plan, which: 'both', freq: '',
        start: (vals && vals.c_date) || sent, next: '', renew: (vals && vals.renew) || '',
        sms: sms, source: 'Comfort Club'
      }, person);
      const i = s.members.findIndex(m => m.id === row.id);
      if (i >= 0) s.members[i] = Object.assign(s.members[i], row); else s.members.push(row);
      leadPatch.hv_member = 'Active';
      leadPatch.hv_plan = plan;
      if (vals && vals.renew) leadPatch.hv_renew = vals.renew;
      leadPatch.hv_joined = (vals && vals.c_date) || sent;
      if (vals && vals.sys_count) leadPatch.hv_systems = String(vals.sys_count);
    } else if (rec.formId === 'wh-agreement') {
      const pick = planPick(vals);
      const which = pick === 'plus' ? 'both' : 'year';
      const row = Object.assign({
        id: 'form-' + rec.id, kind: 'water', plan: pick === 'plus' ? 'Water heater plan, Plus' : 'Water heater plan',
        which: which, freq: '', start: (vals && vals.c_date) || sent, next: '', renew: '', sms: true, source: 'Water heater plan'
      }, person);
      const i = s.members.findIndex(m => m.id === row.id);
      if (i >= 0) s.members[i] = Object.assign(s.members[i], row); else s.members.push(row);
    } else if (rec.formId === 'inspection' && vals && /^yes/i.test(String(vals.ai_want || ''))) {
      const pick = planPick(vals);
      const which = pick === 'plus' ? 'both' : 'year';
      const next = (vals.next_date && /^\d{4}-\d{2}-\d{2}$/.test(vals.next_date)) ? vals.next_date : addDays(sent, 365);
      const row = Object.assign({
        id: 'form-' + rec.id, kind: 'inspection', plan: pick === 'plus' ? 'Yearly inspection, Plus' : 'Yearly inspection',
        which: which, freq: '', start: (vals && vals.c_date) || sent, next: next, renew: '', sms: true, source: 'Yearly inspection'
      }, person);
      const i = s.members.findIndex(m => m.id === row.id);
      if (i >= 0) s.members[i] = Object.assign(s.members[i], row); else s.members.push(row);
    }
    save(s);
    return { lead: leadPatch };
  }

  function rowHtml(item, kind) {
    const ch = channel(item, kind);
    const label = buttonLabel(item, kind, ch);
    let line = '', flag = '';
    if (kind === 'est') {
      const age = daysBetween(item.sent, today());
      const price = item.total || (item.options ? item.options.replace(/\s+/g, ' ').trim() : '');
      line = [item.title || 'Estimate', price, age + ' day' + (age === 1 ? '' : 's')].filter(Boolean).join(' · ');
      flag = 'Unsigned estimate';
    } else if (kind === 'rev') {
      line = item.work ? clip(item.work, 60) : 'Job signed off';
      flag = !load().reviewUrl ? 'Add your Google review link in Settings'
        : (item.due > today() ? 'Tomorrow morning' : (item.due === today() ? 'This morning' : 'Ready to send'));
    } else {
      line = (item.plan || item.source || 'Member');
      flag = 'Next visit ' + whenLabel(item.nextVisit || visitOf(item));
    }
    const late = kind === 'est' ? ' late' : '';
    const btn = ch.href
      ? '<a class="btn pri tap fusend" data-fu-send="1" href="' + esc(ch.href) + '" aria-label="' + esc(label + ' ' + firstName(item.customer)) + '">' + esc(label) + '</a>'
      : '<button type="button" class="btn soft tap fusend" data-fu-send="1">' + esc(label) + '</button>';
    return '<div class="lead fu ' + kind + '" data-fu-kind="' + kind + '" data-fu-id="' + esc(item.id) + '"><div class="av">' + esc(initials(item.customer)) + '</div><div class="mid"><div class="nm">' + esc(item.customer || 'No name') + '</div><div class="meta">' + esc(line) + '</div><div class="nx' + late + '">' + esc(flag) + '</div></div>' + btn + '</div>';
  }
  function section(title, kind, rows, note) {
    if (!rows.length && !note) return '';
    return '<div class="sec" data-keep="1"><span>' + esc(title) + '</span><a data-fu-all="' + kind + '">See all</a></div>' +
      (note ? '<div class="fu-note">' + note + '</div>' : '') +
      rows.map(item => rowHtml(item, kind)).join('');
  }
  function todayHtml() {
    try {
      const est = waiting();
      const rev = dueReviews();
      const mem = membersDue();
      let h = '';
      if (est.length) h += section('Follow up', 'est', est.slice(0, 3), '');
      if (rev.length) h += section('Ask for a review', 'rev', rev.slice(0, 3), '');
      if (mem.length) h += section('Members due', 'mem', mem.slice(0, 3), '');
      return h;
    } catch (e) { return ''; }
  }

  function bind(root) {
    if (!root) return;
    root.querySelectorAll('[data-fu-all]').forEach(a => a.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); openList(a.dataset.fuAll); });
    root.querySelectorAll('[data-fu-settings]').forEach(b => b.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); openSettings(); });
    root.querySelectorAll('.lead.fu').forEach(row => {
      row.onclick = ev => {
        if (ev.target.closest('[data-fu-send],[data-fu-settings],a')) return;
        openEdit(row.dataset.fuKind, row.dataset.fuId);
      };
      const send = row.querySelector('[data-fu-send]');
      if (send) send.addEventListener('click', ev => {
        ev.stopPropagation();
        if (!send.getAttribute('href')) { ev.preventDefault(); openEdit(row.dataset.fuKind, row.dataset.fuId); return; }
        touch(row.dataset.fuKind, row.dataset.fuId);
      });
    });
  }

  function listItems(kind) {
    if (kind === 'est') return waiting();
    if (kind === 'rev') return dueReviews().concat(upcomingReviews());
    return allMembers();
  }
  function listTitle(kind) {
    return kind === 'est' ? 'Follow up' : kind === 'rev' ? 'Ask for a review' : 'Members';
  }
  function openList(kind) {
    const rows = listItems(kind);
    const intro = kind === 'est'
      ? 'Unsigned estimates that have been quiet. Text opens Messages. You still hit send. Tap a name to change the words.'
      : kind === 'rev'
      ? 'Thank-yous from yesterday’s sign-offs, ready this morning. The text includes your Google review link.'
      : 'Comfort Club, water heater plans, yearly inspections, and people who asked for Energy Check reminders. Next visit is on each row.';
    const html = '<h3>' + esc(listTitle(kind)) + '</h3><p class="hint">' + intro + '</p>' +
      (kind === 'rev' && !load().reviewUrl ? '<p class="fu-note">No Google review link yet. <button type="button" class="linkbtn" id="fuSet" style="padding:0">Add it in Settings</button></p>' : '') +
      (rows.length ? '<div id="fuList">' + rows.map(item => rowHtml(item, kind)).join('') + '</div>' : '<div class="empty"><div class="e">✅</div><b>Nothing waiting</b>You are caught up on this list.</div>') +
      '<button class="linkbtn" type="button" id="fuClose" style="display:block;margin:12px auto 0">Close</button>';
    openSheet(html, sh => {
      bind(sh);
      const c = sh.querySelector('#fuClose'); if (c) c.onclick = () => closeSheet();
      const st = sh.querySelector('#fuSet'); if (st) st.onclick = () => { closeSheet(); setTimeout(openSettings, 280); };
    });
  }

  function itemBy(kind, id) {
    if (kind === 'mem') return allMembers().find(m => m.id === id) || find(kind, id).item;
    return find(kind, id).item;
  }
  function openEdit(kind, id) {
    const item = itemBy(kind, id);
    if (!item) return;
    const body = textFor(kind, item);
    const ch = channel(item, kind);
    const label = buttonLabel(item, kind, ch);
    const phone = digits(item.phone);
    const email = String(item.email || '').trim();
    const w = who(item.pack);
    const subject = kind === 'rev' ? 'Thanks from ' + w.biz : (w.biz + ' reminder');
    openSheet(
      '<h3>' + esc(label) + ' ' + esc(firstName(item.customer)) + '</h3>' +
      '<p class="hint">Change the words if you want. Opening Messages does not send it. You hit send.</p>' +
      '<div class="fld"><label for="fuBody">Message</label><textarea id="fuBody" class="fubody" rows="5">' + esc(body) + '</textarea></div>' +
      (phone.length >= 7 ? '<a class="btn pri full tap" id="fuGo" href="#">' + ((window.KI && window.KI.text) || '') + ' Open Messages</a>' : '') +
      (email ? '<a class="btn soft full tap" id="fuMail" href="#" style="margin-top:8px">Email instead</a>' : '') +
      (!phone && !email ? '<p class="fu-note">No phone or email on this customer yet. Add one on their lead, then come back.</p>' : '') +
      '<button class="linkbtn" type="button" id="fuDone" style="display:block;margin:14px auto 0">' + (kind === 'mem' ? 'Skip this season' : 'Done, take them off the list') + '</button>',
      sh => {
        const ta = sh.querySelector('#fuBody');
        const go = sh.querySelector('#fuGo');
        const mail = sh.querySelector('#fuMail');
        const sync = () => {
          const v = ta.value;
          if (go) go.href = smsHref(item.phone, v);
          if (mail) mail.href = mailHref(email, subject, v);
        };
        ta.addEventListener('input', sync); sync();
        const sent = () => { touch(kind, id); closeSheet(); try { if (window.CRM && CRM.render) CRM.render(); } catch (e) {} };
        if (go) go.addEventListener('click', sent);
        if (mail) mail.addEventListener('click', sent);
        sh.querySelector('#fuDone').onclick = () => { closeSheet(); done(kind, id); toast('Taken off the list.'); };
        setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 350);
      }
    );
  }

  function openSettings() {
    const s = load();
    openSheet(
      '<h3>Follow-ups and reviews</h3><p class="hint">These lists show on Today. A text opens the phone’s Messages app. You still hit send.</p>' +
      '<div class="fld"><label for="fuDays">Show unsigned estimates after (days)</label><input id="fuDays" class="fudays" type="number" min="0" max="90" inputmode="numeric" value="' + esc(s.days) + '"></div>' +
      '<div class="fld"><label for="fuLink">Google review link</label><input id="fuLink" type="url" inputmode="url" placeholder="https://g.page/r/…" value="' + esc(s.reviewUrl) + '" autocapitalize="off" spellcheck="false"></div>' +
      '<div class="fld"><label for="fuEst">Estimate follow-up</label><textarea id="fuEst" class="fubody" rows="4">' + esc(s.texts.estimate) + '</textarea></div>' +
      '<div class="fld"><label for="fuRev">Review thank-you</label><textarea id="fuRev" class="fubody" rows="4">' + esc(s.texts.review) + '</textarea></div>' +
      '<div class="fld"><label for="fuSea">Spring / fall reminder</label><textarea id="fuSea" class="fubody" rows="4">' + esc(s.texts.season) + '</textarea></div>' +
      '<p class="meta2">Placeholders: {f} first name, {me} you, {biz} shop, {what} the job, {options} the estimate, {link} review link, {season} Spring or Fall, {plan} their plan.</p>' +
      '<button class="btn pri full tap" id="fuSave" type="button">Save</button>' +
      '<button class="linkbtn" type="button" id="fuReset" style="display:block;margin:12px auto 0">Reset the texts</button>' +
      '<button class="linkbtn" type="button" id="fuMembers" style="display:block;margin:4px auto 0">See members</button>',
      sh => {
        sh.querySelector('#fuSave').onclick = () => {
          const cur = load();
          let days = parseInt(sh.querySelector('#fuDays').value, 10);
          if (!isFinite(days)) days = 2;
          cur.days = Math.max(0, Math.min(90, days));
          const link = sh.querySelector('#fuLink').value.trim();
          if (link && !/^https?:\/\//i.test(link)) { toast('The review link needs to start with https://'); return; }
          cur.reviewUrl = link;
          cur.texts = Object.assign(defaultTexts(), cur.texts, {
            estimate: sh.querySelector('#fuEst').value.trim(),
            review: sh.querySelector('#fuRev').value.trim(),
            season: sh.querySelector('#fuSea').value.trim()
          });
          if (!cur.texts.estimate || !cur.texts.review || !cur.texts.season) { toast('Keep all three texts filled in.'); return; }
          save(cur);
          closeSheet();
          toast('Saved.');
          try { if (window.CRM && CRM.render) CRM.render(); } catch (e) {}
        };
        sh.querySelector('#fuReset').onclick = () => {
          const cur = load();
          cur.texts = defaultTexts();
          save(cur);
          closeSheet();
          setTimeout(openSettings, 280);
          toast('Texts reset.');
        };
        sh.querySelector('#fuMembers').onclick = () => { closeSheet(); setTimeout(() => openList('mem'), 280); };
      }
    );
  }

  window.FOLLOW = {
    load: load, save: save, absorb: absorb, refresh: refresh, noteForm: noteForm,
    waiting: waiting, dueReviews: dueReviews, upcomingReviews: upcomingReviews,
    allMembers: allMembers, membersDue: membersDue, counts: counts,
    textFor: textFor, smsHref: smsHref, mailHref: mailHref, channel: channel,
    todayHtml: todayHtml, bind: bind, openList: openList, openEdit: openEdit, openSettings: openSettings,
    touch: touch, done: done, visitOf: visitOf, seasonName: seasonName
  };
})();
