'use strict';

/* ═══════════════════════════════════════════════════════
   VIDYA MANDIR v6 — Core Engine
   Modern · Minimal · Pro
   No Indian cultural elements
   Features: onboarding, Pomodoro timer, ads, bookmarks,
             progress tracking, streak, search, profile edit
═══════════════════════════════════════════════════════ */

const App = {
  _data: null, _loading: false,

  /* ── DATA ── */
  async loadData() {
    if (this._data) return this._data;
    if (this._loading) return new Promise(r => setTimeout(() => r(this.loadData()), 60));
    this._loading = true;
    try {
      const resp = await fetch('data/subjects.json');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      this._data = await resp.json();
    } catch(e) {
      console.warn('Data load failed:', e.message);
      this._data = { subjects: [] };
    }
    this._loading = false;
    this._mergeAdminData();
    return this._data;
  },

  _mergeAdminData() {
    if (!this._data) return;
    const ov = this._parseLS('vm_overrides', {});
    const ad = this._parseLS('vm_admin_data', { subjects:[], quiz:[], pdfs:[], ncertTopics:[], announcements:[], teachers:[] });
    this._data.subjects.forEach(s => {
      s.chapters.forEach(ch => {
        const key = `${s.id}::${ch.id}`, o = ov[key]; if (!o) return;
        if (o.videoId && ch.lessons?.length) ch.lessons[0].videoId = o.videoId;
        if (o.lesson0Title && ch.lessons?.length) ch.lessons[0].title = o.lesson0Title;
        if (o.extraLessons?.length) ch.lessons = [...(ch.lessons||[]), ...o.extraLessons];
        if (o.adminNote) ch._adminNote = o.adminNote;
        if (o.extraTopics?.length) ch.ncertTopics = [...(ch.ncertTopics||[]), ...o.extraTopics];
        if (o.extraQuiz?.length) ch.quiz = [...(ch.quiz||[]), ...o.extraQuiz];
        if (o.replaceQuiz?.length) ch.quiz = o.replaceQuiz;
      });
    });
    (ad.subjects||[]).forEach(cs => {
      if (!this._data.subjects.find(s => s.id === cs.id)) {
        this._data.subjects.push({
          id: cs.id || this._slug(cs.name), name: cs.name, icon: cs.icon||'📖',
          description: cs.desc||'', chapters: cs.chapters||[],
          color: cs.color||'#5B5BD6', bg: 'rgba(91,91,214,.07)'
        });
      }
    });
  },

  saveOverride(sid, cid, patch) {
    const ov = this._parseLS('vm_overrides', {}); const key = `${sid}::${cid}`;
    ov[key] = { ...(ov[key]||{}), ...patch }; this._saveLS('vm_overrides', ov); this._data = null;
  },
  getOverride(sid, cid) { return (this._parseLS('vm_overrides', {}))[`${sid}::${cid}`] || {}; },
  _parseLS(k, def) { try { return JSON.parse(localStorage.getItem(k)||'null') ?? def; } catch { return def; } },
  _saveLS(k, v)    { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  _slug(s)         { return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); },
  getSubject(id)      { return (this._data?.subjects||[]).find(s => s.id === id) || null; },
  getChapter(sid,cid) { return (this.getSubject(sid)?.chapters||[]).find(c => c.id === cid) || null; },
  getParam(k)         { return new URLSearchParams(location.search).get(k); },

  /* ── PROFILE / ONBOARDING ── */
  getProfile()   { return this._parseLS('vm_profile', null); },
  saveProfile(p) { this._saveLS('vm_profile', p); },
  hasProfile()   { return !!(this.getProfile()?.name); },

  showOnboarding(cb) {
    const el = document.createElement('div');
    el.className = 'wall-overlay'; el.id = 'obOverlay';
    let step = 1, selSubj = '', obName = '';
    const subs = [
      { id:'mathematics',    icon:'📐', name:'Mathematics' },
      { id:'science',        icon:'🔬', name:'Science' },
      { id:'social-science', icon:'🌍', name:'Social Science' },
      { id:'english',        icon:'📚', name:'English' },
    ];
    const render = () => {
      if (step === 1) {
        el.innerHTML = `<div class="wall-card ob-step">
          <div class="ob-dots"><div class="ob-dot active"></div><div class="ob-dot"></div></div>
          <span class="wall-icon">👋</span>
          <div class="wall-title">Welcome aboard!</div>
          <div class="wall-sub">Your Class 10 learning hub. Quick setup in 10 seconds.</div>
          <div class="fg"><label>Your First Name</label>
            <input class="fc" id="obName" placeholder="e.g. Arjun" maxlength="40" autocomplete="given-name">
          </div>
          <button class="btn btn-a btn-lg" id="obN1" style="width:100%;justify-content:center">Continue →</button>
        </div>`;
        const inp = el.querySelector('#obName');
        setTimeout(() => inp?.focus(), 80);
        el.querySelector('#obN1').addEventListener('click', () => {
          const v = VidyaSec.sanitize((inp?.value||'').trim());
          if (!v) { inp?.focus(); inp?.classList.add('fc-err'); return; }
          obName = v; step = 2; render();
        });
        inp?.addEventListener('keydown', e => { if (e.key === 'Enter') el.querySelector('#obN1')?.click(); });
      } else {
        el.innerHTML = `<div class="wall-card ob-step">
          <div class="ob-dots"><div class="ob-dot"></div><div class="ob-dot active"></div></div>
          <span class="wall-icon">🎯</span>
          <div class="wall-title">Hi, ${VidyaSec.sanitize(obName)}!</div>
          <div class="wall-sub">Pick your favourite subject — we'll prioritise it on your dashboard.</div>
          ${subs.map(s => `<div class="ob-option${selSubj===s.id?' picked':''}" data-id="${s.id}">
            <span class="ob-icon">${s.icon}</span>
            <span class="ob-label">${s.name}</span>
            <span class="ob-check">${selSubj===s.id?'✓':''}</span>
          </div>`).join('')}
          <button class="btn btn-a btn-lg" id="obDone" style="width:100%;justify-content:center;margin-top:12px"${selSubj?'':' disabled'}>
            Start Learning →
          </button>
        </div>`;
        el.querySelectorAll('.ob-option').forEach(o => o.addEventListener('click', () => { selSubj = o.dataset.id; render(); }));
        el.querySelector('#obDone')?.addEventListener('click', () => {
          this.saveProfile({ name: obName, favourite: selSubj, joinedAt: Date.now() });
          el.style.opacity = '0'; el.style.transition = 'opacity .3s';
          setTimeout(() => { el.remove(); if (cb) cb(); }, 300);
        });
      }
    };
    document.body.appendChild(el); render();
  },

  /* ── PROGRESS ── */
  getProgress()    { return this._parseLS('vm_prog', {}); },
  saveProgress(p)  { this._saveLS('vm_prog', p); },
  _ep(p, sid)      { if (!p[sid]) p[sid] = { done:[], scores:{}, last:null, watched:[] }; },
  markDone(sid,cid) { const p=this.getProgress(); this._ep(p,sid); if(!p[sid].done.includes(cid)) p[sid].done.push(cid); this.saveProgress(p); this.updateStreak(); },
  saveScore(sid,cid,score,total) { const p=this.getProgress(); this._ep(p,sid); p[sid].scores[cid]={score,total,pct:Math.round(score/total*100),ts:Date.now()}; this.saveProgress(p); },
  setLast(sid,cid,title) { const p=this.getProgress(); this._ep(p,sid); p[sid].last={cid,title,ts:Date.now()}; this.saveProgress(p); },
  markWatched(sid,cid,lid) { if(!lid)return; const p=this.getProgress(); this._ep(p,sid); const k=`${cid}::${lid}`; if(!p[sid].watched.includes(k)) p[sid].watched.push(k); this.saveProgress(p); },
  getSubjPct(sid,subj) { const p=this.getProgress()[sid]||{}; return subj.chapters.length?Math.round(((p.done||[]).length/subj.chapters.length)*100):0; },

  /* ── BOOKMARKS ── */
  getBookmarks()      { return this._parseLS('vm_bm', []); },
  toggleBookmark(s,c) { const bm=this.getBookmarks(),k=`${s}::${c}`,i=bm.indexOf(k); if(i>=0)bm.splice(i,1);else bm.push(k); this._saveLS('vm_bm',bm); return i<0; },
  isBookmarked(s,c)   { return this.getBookmarks().includes(`${s}::${c}`); },

  /* ── STREAK ── */
  updateStreak() {
    const today=new Date().toDateString(), last=localStorage.getItem('vm_sdate');
    let s=parseInt(localStorage.getItem('vm_streak')||'0');
    if(last!==today) { s=(last===new Date(Date.now()-86400000).toDateString())?s+1:1; localStorage.setItem('vm_streak',s); localStorage.setItem('vm_sdate',today); }
  },

  /* ── THEME ── */
  applyMode() { document.documentElement.setAttribute('data-mode', localStorage.getItem('vm_mode') || 'light'); },
  setMode(m) {
    document.documentElement.setAttribute('data-mode', m);
    localStorage.setItem('vm_mode', m);
    document.querySelectorAll('.mt-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
    const btn = document.getElementById('modeBtn'); if (btn) btn.innerHTML = m==='dark'?'☀️':'🌙';
  },
  toggleMode() { this.setMode((localStorage.getItem('vm_mode')||'light')==='dark'?'light':'dark'); },

  /* ── ADS ── */
  adNative(slot) {
    const ads = {
      dashboard: { logo:'📘', title:'Unlock full Board mock papers', desc:'500+ CBSE questions · Detailed solutions · Free', cta:'Try Free', href:'#' },
      subjects:  { logo:'🎯', title:'Personalised study plans', desc:'Adaptive learning · Expert teachers · Board-focused', cta:'Learn More', href:'#' }
    };
    const ad = ads[slot]||ads.dashboard;
    return `<div class="ad-native"><div class="ad-logo">${ad.logo}</div><div class="ad-body"><div class="ad-title">${ad.title}</div><div class="ad-desc">${ad.desc}</div></div><a href="${ad.href}" class="ad-cta" target="_blank" rel="noopener sponsored">${ad.cta}</a></div>`;
  },
  adBanner() {
    return `<div class="ad-banner"><div class="ad-banner-icon">🏆</div><div class="ad-banner-text"><div class="ad-banner-title">Previous Year Board Papers</div><div class="ad-banner-sub">2015–2024 · Full solutions · Free download</div></div><a href="#" class="ad-banner-btn" target="_blank" rel="noopener sponsored">View →</a></div>`;
  },

  /* ── NAVBAR ── */
  navbarHTML() {
    const profile = this.getProfile();
    const name    = VidyaSec.sanitize(profile?.name || 'Student');
    const initials = name[0]?.toUpperCase() || 'S';
    const site    = VidyaSec.sanitize(localStorage.getItem('vm_site_name') || 'Vidya Mandir');
    const mode    = localStorage.getItem('vm_mode') || 'light';
    return `<nav class="topnav" id="mainNav">
      <button class="mob-burger" onclick="App.toggleSidebar()">☰</button>
      <a href="index.html" class="nav-brand">
        <div class="nav-gem">V</div>
        <div class="nav-wordmark">
          <span class="nav-title">${site}</span>
          <span class="nav-sub">Class 10 · CBSE</span>
        </div>
      </a>
      <div class="nav-search">
        <span class="nav-sico">⌕</span>
        <input type="text" id="searchInput" placeholder="Search chapters, topics…"
          autocomplete="off" spellcheck="false"
          oninput="App.doSearch(this.value)"
          onfocus="App.showSearch()"
          onblur="setTimeout(()=>App.hideSearch(),160)">
        <div class="search-drop" id="searchDrop"></div>
      </div>
      <div class="nav-right">
        <button class="nav-ic" id="timerNavBtn" onclick="PomodoroTimer.togglePanel()" title="Focus Timer">⏱</button>
        <button class="nav-ic" onclick="TodoPanel.toggle()" id="todoNavBtn" title="Tasks">
          ✓<div class="notif-pip" id="todoNDot"></div>
        </button>
        <button class="nav-ic" onclick="ThemeEngine.toggle()" title="Appearance">🎨</button>
        <button class="nav-ic" id="modeBtn" onclick="App.toggleMode()">${mode==='dark'?'☀️':'🌙'}</button>
        <div class="user-pill" onclick="App._showProfileEdit()">
          <div class="user-av">${initials}</div>
          <span class="user-nm">${name}</span>
        </div>
      </div>
    </nav>`;
  },

  /* ── SIDEBAR ── */
  sidebarHTML(active) {
    const p = this.getProgress(), profile = this.getProfile(), bm = this.getBookmarks().length;
    const subs = [
      { id:'mathematics',    name:'Mathematics',   icon:'📐' },
      { id:'science',        name:'Science',        icon:'🔬' },
      { id:'social-science', name:'Social Science', icon:'🌍' },
      { id:'english',        name:'English',        icon:'📚' },
    ];
    if (profile?.favourite) {
      const fi = subs.findIndex(s => s.id === profile.favourite);
      if (fi > 0) { const [f] = subs.splice(fi,1); subs.unshift(f); }
    }
    return `<aside class="sidebar" id="sidebar">
      <span class="sb-lbl">Navigation</span>
      <a href="dashboard.html" class="sb-link ${active==='dashboard'?'on':''}"><div class="sb-icon">🏠</div>Dashboard</a>
      <a href="todo.html"      class="sb-link ${active==='todo'?'on':''}"><div class="sb-icon">✅</div>My Tasks</a>
      <a href="bookmarks.html" class="sb-link ${active==='bookmarks'?'on':''}"><div class="sb-icon">🔖</div>Bookmarks${bm>0?` <span class="sb-badge">${bm}</span>`:''}</a>
      <div class="sb-div"></div>
      <span class="sb-lbl">Subjects</span>
      ${subs.map(s => {
        const done = (p[s.id]?.done||[]).length;
        return `<a href="subject.html?id=${s.id}" class="sb-link ${active===s.id?'on':''}">
          <div class="sb-icon">${s.icon}</div>${s.name}${done>0?` <span class="sb-badge">${done}</span>`:''}
        </a>`;
      }).join('')}
      <div class="sb-div"></div>
      <a href="admin.html" class="sb-link ${active==='admin'?'on':''}" style="opacity:.42;font-size:.78rem">
        <div class="sb-icon" style="font-size:11px">⚙️</div>Admin
      </a>
    </aside>`;
  },

  /* ── THEME PANEL ── */
  themeHTML() {
    const mode = localStorage.getItem('vm_mode') || 'light';
    return `<div class="slide-panel" id="themePanel">
      <div class="sp-head">
        <h3>🎨 Appearance</h3>
        <button class="btn btn-gh btn-sm" onclick="ThemeEngine.toggle()">✕</button>
      </div>
      <span class="sp-lbl">Colour Mode</span>
      <div class="mode-toggle">
        <div class="mt-btn ${mode==='light'?'active':''}" data-mode="light" onclick="App.setMode('light')">☀️ Light</div>
        <div class="mt-btn ${mode==='dark'?'active':''}" data-mode="dark" onclick="App.setMode('dark')">🌙 Dark</div>
      </div>
      <span class="sp-lbl">Extract Colours from Image</span>
      <div class="upload-drop" onclick="document.getElementById('themeFileInp').click()">
        <input type="file" id="themeFileInp" accept="image/*" style="display:none" onchange="ThemeEngine.handleUpload(event)">
        <div style="font-size:22px;margin-bottom:5px">🖼️</div>
        <p style="font-size:.81rem;color:var(--s4);font-weight:600;margin-bottom:2px">Upload any image</p>
        <span style="font-size:.71rem;color:var(--s5)">Accent colours extracted automatically</span>
      </div>
      <div id="themePreviewWrap" style="display:none">
        <img id="themePreviewImg" src="" alt="" style="width:100%;height:74px;object-fit:cover;border-radius:var(--r-sm);margin-bottom:8px">
        <div class="swatches-row" id="swatchRow"></div>
        <button class="btn btn-a" style="width:100%;justify-content:center;margin-bottom:6px" onclick="ThemeEngine.applyExtracted()">✨ Apply Colours</button>
        <button class="btn btn-gh" style="width:100%;justify-content:center" onclick="ThemeEngine.reset()">↺ Reset</button>
      </div>
    </div>
    <div class="backdrop" id="themeBack" onclick="ThemeEngine.toggle()"></div>`;
  },

  todoPanelHTML() {
    return `<div class="slide-panel" id="todoPanel">
      <div class="sp-head"><h3>✅ My Tasks</h3><button class="btn btn-gh btn-sm" onclick="TodoPanel.toggle()">✕</button></div>
      <div id="todoPanelBody"></div>
    </div>
    <div class="backdrop" id="todoBack" onclick="TodoPanel.toggle()"></div>`;
  },

  /* ── PROFILE EDIT ── */
  _showProfileEdit() {
    const profile = this.getProfile() || {};
    const ov = document.createElement('div'); ov.className = 'wall-overlay';
    ov.innerHTML = `<div class="wall-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div class="wall-title" style="font-size:1.2rem">Edit Profile</div>
        <button class="btn btn-gh btn-sm" id="cpClose">✕</button>
      </div>
      <div class="fg"><label>Your Name</label>
        <input class="fc" id="cpName" value="${VidyaSec.sanitize(profile.name||'')}" maxlength="40">
      </div>
      <div class="fg"><label>Favourite Subject</label>
        <select class="fc" id="cpSubj">
          <option value="">— Select —</option>
          <option value="mathematics" ${profile.favourite==='mathematics'?'selected':''}>📐 Mathematics</option>
          <option value="science" ${profile.favourite==='science'?'selected':''}>🔬 Science</option>
          <option value="social-science" ${profile.favourite==='social-science'?'selected':''}>🌍 Social Science</option>
          <option value="english" ${profile.favourite==='english'?'selected':''}>📚 English</option>
        </select>
      </div>
      <button class="btn btn-a" id="cpSave" style="width:100%;justify-content:center">Save Changes</button>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#cpClose').addEventListener('click', () => ov.remove());
    ov.querySelector('#cpSave').addEventListener('click', () => {
      const name    = VidyaSec.sanitize((ov.querySelector('#cpName').value||'').trim());
      const fav     = ov.querySelector('#cpSubj').value;
      if (!name) return;
      this.saveProfile({ ...profile, name, favourite: fav||profile.favourite });
      ov.remove();
      const nb = document.getElementById('nb'); if (nb) nb.innerHTML = this.navbarHTML();
      App.toast('Profile updated ✅');
    });
  },

  /* ── SEARCH ── */
  async doSearch(q) {
    const drop = document.getElementById('searchDrop'); if (!drop) return;
    const sq = q.trim(); if (!sq) { drop.classList.remove('open'); return; }
    const data = await this.loadData(); const lq = sq.toLowerCase(), res = [];
    data.subjects.forEach(s => {
      if (s.name.toLowerCase().includes(lq)) res.push({ icon:s.icon, title:s.name, sub:`${s.chapters.length} chapters`, url:`subject.html?id=${s.id}` });
      s.chapters.forEach(ch => {
        if (ch.title.toLowerCase().includes(lq)) res.push({ icon:'📄', title:ch.title, sub:s.name, url:`chapter.html?subject=${s.id}&chapter=${ch.id}` });
        (ch.lessons||[]).forEach(l => { if (l.title.toLowerCase().includes(lq)) res.push({ icon:'▶️', title:l.title, sub:`${s.name} › ${ch.title}`, url:`chapter.html?subject=${s.id}&chapter=${ch.id}&lesson=${l.id}` }); });
        (ch.ncertTopics||[]).forEach(t => { if (t.text.toLowerCase().includes(lq)) res.push({ icon:'⭐', title:t.text.slice(0,55), sub:`${s.name} › ${ch.title}`, url:`chapter.html?subject=${s.id}&chapter=${ch.id}` }); });
      });
    });
    drop.innerHTML = res.length
      ? res.slice(0,9).map(r => `<a class="sd-row" href="${r.url}"><div class="sd-ico">${r.icon}</div><div><div class="sd-title">${VidyaSec.sanitize(r.title)}</div><div class="sd-sub">${VidyaSec.sanitize(r.sub)}</div></div></a>`).join('')
      : `<div class="sd-row"><div class="sd-sub">No results for "${VidyaSec.sanitize(sq)}"</div></div>`;
    drop.classList.add('open');
  },
  showSearch() { const v = document.getElementById('searchInput')?.value; if (v) this.doSearch(v); },
  hideSearch() { document.getElementById('searchDrop')?.classList.remove('open'); },
  toggleSidebar() { document.getElementById('sidebar')?.classList.toggle('open'); document.getElementById('sbBack')?.classList.toggle('on'); },

  /* ── TOAST ── */
  toast(msg, ico = '✅') {
    let t = document.getElementById('appToast');
    if (!t) { t = document.createElement('div'); t.id = 'appToast'; t.className = 'toast'; document.body.appendChild(t); }
    t.innerHTML = `<span>${ico}</span> ${VidyaSec.sanitize(msg)}`;
    t.classList.add('show'); clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), 3000);
  },

  /* ── INIT PAGE ── */
  initPage(active) {
    this.applyMode();
    const nb = document.getElementById('nb'), sb = document.getElementById('sb');
    if (nb) nb.innerHTML = this.navbarHTML();
    if (sb) sb.innerHTML = this.sidebarHTML(active);
    document.body.insertAdjacentHTML('beforeend', this.themeHTML());
    document.body.insertAdjacentHTML('beforeend', this.todoPanelHTML());
    document.body.insertAdjacentHTML('beforeend', `<div class="backdrop" id="sbBack" onclick="App.toggleSidebar()"></div>`);
    ThemeEngine.init(); TodoPanel.init();
    // Inject Pomodoro timer panel
    if (!document.getElementById('timerPanel')) {
      document.body.insertAdjacentHTML('beforeend', PomodoroTimer.panelHTML());
      PomodoroTimer.init();
    }
    const m = localStorage.getItem('vm_mode') || 'light';
    const btn = document.getElementById('modeBtn'); if (btn) btn.innerHTML = m === 'dark' ? '☀️' : '🌙';
    document.querySelectorAll('.mt-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
  }
};

/* ═══════════════════════════════════════════════════════
   POMODORO TIMER
   Full-featured: 25/5/15 min · custom · sessions · sound
═══════════════════════════════════════════════════════ */
const PomodoroTimer = {
  _interval: null,
  _seconds: 25 * 60,
  _total:   25 * 60,
  _running: false,
  _mode: 'focus',   // 'focus' | 'short' | 'long'
  _sessions: parseInt(localStorage.getItem('vm_pomo_sessions') || '0'),
  _open: false,

  _MODES: {
    focus: { label: 'Focus',       secs: 25*60, color: 'var(--a)'   },
    short: { label: 'Short Break', secs:  5*60, color: 'var(--sci)' },
    long:  { label: 'Long Break',  secs: 15*60, color: 'var(--a-2)' },
  },

  panelHTML() {
    return `<div class="slide-panel" id="timerPanel">
      <div class="sp-head">
        <h3>⏱ Focus Timer</h3>
        <button class="btn btn-gh btn-sm" onclick="PomodoroTimer.togglePanel()">✕</button>
      </div>
      <div id="timerPanelBody"></div>
    </div>
    <div class="backdrop" id="timerBack" onclick="PomodoroTimer.togglePanel()"></div>`;
  },

  init() { this._renderPanel(); },

  togglePanel() {
    this._open = !this._open;
    document.getElementById('timerPanel')?.classList.toggle('open', this._open);
    document.getElementById('timerBack')?.classList.toggle('on', this._open);
    if (this._open) {
      document.getElementById('themePanel')?.classList.remove('open');
      document.getElementById('todoPanel')?.classList.remove('open');
    }
  },

  _renderPanel() {
    const body = document.getElementById('timerPanelBody'); if (!body) return;
    const pct  = ((this._total - this._seconds) / this._total) * 100;
    const circ = 2 * Math.PI * 48;
    const offset = circ - (pct / 100) * circ;
    const m = this._MODES[this._mode];
    const mins = String(Math.floor(this._seconds / 60)).padStart(2, '0');
    const secs = String(this._seconds % 60).padStart(2, '0');

    body.innerHTML = `
      <div style="text-align:center;margin-bottom:18px">
        <div class="timer-ring" style="position:relative;width:140px;height:140px;margin:0 auto 12px">
          <svg width="140" height="140" style="transform:rotate(-90deg)">
            <circle class="ring-bg" cx="70" cy="70" r="48" fill="none" stroke="var(--n3)" stroke-width="6"/>
            <circle class="ring-fill" cx="70" cy="70" r="48" fill="none"
              stroke="${m.color}" stroke-width="6" stroke-linecap="round"
              stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
              style="transition:stroke-dashoffset .8s linear"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
            <span style="font-size:2rem;font-weight:800;font-family:var(--mono);color:${m.color};line-height:1">${mins}:${secs}</span>
            <span style="font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--s5);margin-top:2px">${m.label}</span>
          </div>
        </div>

        <div style="display:flex;gap:6px;justify-content:center;margin-bottom:10px">
          ${Object.entries(this._MODES).map(([k,v]) => `
            <button onclick="PomodoroTimer.setMode('${k}')"
              style="padding:4px 11px;border-radius:99px;font-size:.72rem;font-weight:600;cursor:pointer;border:1.5px solid ${k===this._mode?m.color:'var(--border-2)'};background:${k===this._mode?'rgba(91,91,214,.08)':'transparent'};color:${k===this._mode?m.color:'var(--s4)'};transition:all .14s">
              ${v.label}
            </button>`).join('')}
        </div>

        <div style="display:flex;gap:8px;justify-content:center;margin-bottom:12px">
          <button class="btn btn-a" onclick="PomodoroTimer.toggle()" style="min-width:90px">
            ${this._running ? '⏸ Pause' : '▶ Start'}
          </button>
          <button class="btn btn-gh" onclick="PomodoroTimer.reset()" title="Reset">↺</button>
          <button class="btn btn-gh" onclick="PomodoroTimer.skip()" title="Skip">⏭</button>
        </div>

        <div style="font-size:.74rem;color:var(--s5);margin-bottom:14px">
          Sessions today: <strong style="color:var(--a)">${this._sessions}</strong>
          &nbsp;·&nbsp; ${this._sessions * 25} min studied
        </div>

        <div class="sp-lbl">Custom Duration</div>
        <div style="display:flex;gap:7px;align-items:center;margin-bottom:14px">
          <input type="number" class="fc" id="customMins" min="1" max="120" placeholder="Min" style="flex:1">
          <button class="btn btn-gh btn-sm" onclick="PomodoroTimer.setCustom()">Set</button>
        </div>

        <div class="sp-lbl">Daily Goal</div>
        <div style="margin-bottom:4px">
          <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--s5);margin-bottom:4px">
            <span>${this._sessions} sessions</span>
            <span>Goal: 8</span>
          </div>
          <div class="pbar pbar-lg">
            <div class="pfill" style="width:${Math.min(100,(this._sessions/8)*100)}%"></div>
          </div>
        </div>
      </div>`;
  },

  toggle() {
    if (this._running) this._pause(); else this._start();
  },
  _start() {
    if (this._seconds <= 0) this.reset();
    this._running = true;
    this._interval = setInterval(() => {
      this._seconds--;
      if (this._seconds <= 0) { this._complete(); return; }
      this._renderPanel();
    }, 1000);
    this._renderPanel();
    const btn = document.getElementById('timerNavBtn');
    if (btn) btn.classList.add('active');
  },
  _pause() {
    clearInterval(this._interval); this._running = false;
    this._renderPanel();
    const btn = document.getElementById('timerNavBtn');
    if (btn) btn.classList.remove('active');
  },
  reset() {
    clearInterval(this._interval); this._running = false;
    this._seconds = this._MODES[this._mode].secs;
    this._total   = this._seconds;
    this._renderPanel();
  },
  skip() {
    this._pause();
    if (this._mode === 'focus') { this._sessions++; localStorage.setItem('vm_pomo_sessions', this._sessions); this.setMode('short'); }
    else { this.setMode('focus'); }
  },
  _complete() {
    clearInterval(this._interval); this._running = false;
    if (this._mode === 'focus') {
      this._sessions++; localStorage.setItem('vm_pomo_sessions', this._sessions);
      App.toast('Focus session complete! 🎉 Take a break.', '⏱');
      this.setMode('short');
    } else {
      App.toast('Break over — back to focus! 💪', '⏱');
      this.setMode('focus');
    }
  },
  setMode(m) { this._mode = m; this.reset(); },
  setCustom() {
    const v = parseInt(document.getElementById('customMins')?.value || '0');
    if (v < 1 || v > 120) { App.toast('Enter 1–120 minutes', '⚠️'); return; }
    this._seconds = v * 60; this._total = this._seconds;
    this._mode = 'focus'; this._renderPanel();
  },
};
