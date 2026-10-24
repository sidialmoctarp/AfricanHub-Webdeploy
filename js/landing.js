/* ==========================================================================
   AfricaHub – landing page behaviour
   Sections: 1 nav · 2 hero effects · 3 auth (tabs, validation, login) ·
             4 scroll reveal + counters · 5 services · 6 how-it-works timeline
   ========================================================================== */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------------- DATA -- */
const SERVICES = [
  { id: 'lst', tag: 'Core', title: 'Land Surface Temperature (LST) Extraction', img: 'svc-lst.jpg',
    short: 'Automated retrieval of surface temperature from thermal satellite imagery.',
    long: 'Thermal bands are calibrated, cloud-masked and converted to surface temperature in °C for your area of interest, with no manual pre-processing.',
    points: ['Thermal infrared calibration (Landsat TIRS, MODIS, Sentinel-based)', 'Cloud and cirrus shadow masking', 'Emissivity from fractional vegetation cover', 'Per-scene results at native resolution'] },
  { id: 'uhi', tag: 'Core', title: 'Urban Heat Island (UHI) Mapping', img: 'svc-uhi.jpg',
    short: 'Urban-rural thermal contrast derived from a dynamic rural baseline.',
    long: 'The rural reference is derived automatically around each city, so UHI intensity reflects the real contrast between built-up land and its surroundings.',
    points: ['Auto baseline from vegetated buffer (NDVI > 0.4)', 'Dynamic radial ring (5-10 km) alternative', 'Manual agricultural polygon option', 'UHI intensity in °C versus the baseline'] },
  { id: 'stats', tag: 'Analysis', title: 'Statistical Thermal Analysis', img: 'svc-stats.jpg',
    short: 'Descriptive statistics and distribution of LST over the area of interest.',
    long: 'Understand the thermal profile of a city at a glance: central tendency, extremes and how temperature is distributed across the territory.',
    points: ['Mean and peak LST scorecards', 'LST, UHI, NDBI and NDVI histograms', 'Urban versus rural comparison chart', 'Export-ready statistics (CSV)'] },
  { id: 'hotspot', tag: 'Analysis', title: 'Hotspot Cluster Detection', img: 'svc-hotspot.jpg',
    short: 'Critical (μ + 2σ), moderate (μ + 1σ) and top 10th percentile hotspots.',
    long: 'Hotspots are identified with three complementary thresholds and listed as an inventory you can locate on the map.',
    points: ['Critical hotspots at μ + 2σ', 'Moderate hotspots at μ + 1σ', 'Top 10th percentile ranking', 'Cluster area, peak temperature and centroid coordinates'] },
  { id: 'trees', tag: 'Decision support', title: 'AI Tree Greening Recommendations', img: 'svc-trees.jpg',
    short: 'Species-specific cooling intervention plans tailored to the selected area.',
    long: 'Get a shortlist of native, drought-tolerant species ranked by cooling capacity and growth velocity for the region you analyse.',
    points: ['Botanical and common names', 'Cooling capacity and drought tolerance', 'Growth velocity for planning horizons', 'Adapted to the selected country or city'] },
  { id: 'forestry', tag: 'Decision support', title: 'Urban Forestry Strategy', img: 'svc-forestry.jpg',
    short: 'Planning guidance for long-term heat mitigation through green infrastructure.',
    long: 'Turn hotspots and species into a coherent strategy: where to plant first, which corridors to prioritise and how to sustain canopy over time.',
    points: ['Prioritisation guided by hotspot inventory', 'Street, park and corridor greening guidance', 'Long-term canopy objectives', 'Aligned with UN SDG 3 and SDG 13'] },
  { id: 'report', tag: 'Deliverable', title: 'Automated Strategy Report', img: 'svc-report.jpg',
    short: 'Generated report documenting the analysis, strategy and decisions taken.',
    long: 'A Word report is assembled for you, with a preview before download, so findings and decisions are documented for stakeholders.',
    points: ['Preview inside the app', 'Editable Word (.docx) output', 'Methods, results and recommendations', 'Ready to share with decision makers'] },
  { id: 'geotiff', tag: 'Deliverable', title: 'GeoTIFF Export', img: 'svc-geotiff.jpg',
    short: 'Download analysis-ready rasters for ArcGIS and QGIS.',
    long: 'Take the analysed area into your own GIS workflow with georeferenced rasters that open directly in desktop GIS software.',
    points: ['Georeferenced GeoTIFF of the analysed area', 'Opens in ArcGIS and QGIS', 'CSV and DOCX exports alongside', 'No re-projection needed for typical workflows'] },
];

const STEPS = [
  { title: 'Area of Interest', tag: 'Select any of 54 African nations',
    desc: 'Start by choosing where to look. Pick a capital or metropolis from any of the 54 African nations, or draw or upload your own boundary.',
    points: ['54 African nations with GADM administrative boundaries', 'Or draw a polygon directly on the map', 'Or upload a GeoJSON / zipped Shapefile', 'Area is computed instantly in km²'] },
  { title: 'Satellite Acquisition & Dates', tag: 'Dataset constellation & seasonal presets',
    desc: 'Choose which sensor family feeds the analysis and the time window that matters for your climate.',
    points: ['Constellation: Landsat 8/9 (30 m), Sentinel-2 (10/20 m) or MODIS (1 km)', 'Seasonal presets: Sahel dry season, Mediterranean summer, Southern African summer or full year', 'Fine-tune start and end dates', 'Maximum cloud cover slider'] },
  { title: 'Scene Calibrator', tag: 'Scene quality & cloud filtering',
    desc: 'Query the archive and pick the cleanest acquisition. Each scene is listed with its date, product and cloud percentage so you can choose with confidence.',
    points: ['Archive query filtered by your dates and cloud limit', 'Scenes ranked by date with cloud cover shown', 'Cloud and shadow masking applied before analysis'] },
  { title: 'Analysis Parameters', tag: 'Rural baseline & thermal anomaly threshold',
    desc: 'Tell the engine how to define "normal" and what counts as abnormal heat.',
    points: ['Rural baseline: auto NDVI > 0.4, radial ring (5-10 km) or manual polygon', 'Threshold: μ + 2σ critical, μ + 1σ moderate or top 10th percentile', 'Both feed the UHI intensity and hotspot detection'] },
  { title: 'Results', tag: 'Statistics, hotspots, greening plan, report & GeoTIFF',
    desc: 'Run the pipeline and review everything in one results window, then export what you need.',
    points: ['Statistical analysis results with charts', 'Hotspot cluster inventory you can locate on the map', 'AI tree greening recommendations and forestry strategy', 'AI heat prediction, driver analysis and cooling scenarios', 'Written report (DOCX) and GeoTIFF download'] },
];

/* ------------------------------------------------------------ 1. NAV -- */
const nav = $('#nav'), navLinks = $('#nav-links'), navToggle = $('#nav-toggle');

function onScrollNav() { nav.classList.toggle('scrolled', window.scrollY > 40); }
navToggle.addEventListener('click', () => {
  const open = navToggle.getAttribute('aria-expanded') !== 'true';
  navToggle.setAttribute('aria-expanded', open);
  navLinks.classList.toggle('open', open);
});
$$('a', navLinks).forEach(a => a.addEventListener('click', () => { navLinks.classList.remove('open'); navToggle.setAttribute('aria-expanded', false); }));

// Scroll-spy: highlight the link of the section in view
const spyTargets = $$('[data-spy]').map(a => ({ a, el: document.getElementById(a.dataset.spy) })).filter(x => x.el);
function spy() {
  const y = window.scrollY + window.innerHeight * 0.35;
  let current = spyTargets[0];
  spyTargets.forEach(t => { if (t.el.offsetTop <= y) current = t; });
  spyTargets.forEach(t => t.a.classList.toggle('active', t === current));
}

// Signed-in visitors get a shortcut into the app
if (UHIAuth.getSession()) $('#nav-open').hidden = false;

$('#year').textContent = new Date().getFullYear();

/* ---------------------------------------------------- 2. HERO EFFECTS -- */
const heroBg = $('#hero-bg'), hero = $('#home'), glow = $('#hero-glow');
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const y = window.scrollY;
    if (!reduceMotion && y < window.innerHeight * 1.2) heroBg.style.transform = `translate3d(0, ${y * 0.35}px, 0) scale(1.05)`;  // parallax
    onScrollNav(); spy();
    ticking = false;
  });
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Heat glow follows the cursor over the hero
hero.addEventListener('pointermove', e => {
  const r = hero.getBoundingClientRect();
  glow.style.setProperty('--mx', (e.clientX - r.left) + 'px');
  glow.style.setProperty('--my', (e.clientY - r.top) + 'px');
});

/* ------------------------------------------------------------ 3. AUTH -- */
const card = $('#auth-card'), tabsEl = $('.auth-tabs', card);
const panels = { login: $('#login-form'), signup: $('#signup-form'), forgot: $('#forgot-form') };
let currentPanel = 'login';

function showPanel(name) {
  if (name === currentPanel) return;
  const order = { login: 0, signup: 1, forgot: 2 };
  const back = order[name] < order[currentPanel];
  Object.entries(panels).forEach(([k, el]) => {
    el.classList.remove('active', 'from-left');
    if (k === name) { el.classList.toggle('from-left', back); void el.offsetWidth; el.classList.add('active'); }
  });
  currentPanel = name;
  tabsEl.classList.toggle('signup', name === 'signup');
  tabsEl.classList.toggle('hide', name === 'forgot');
  $$('.auth-tab', card).forEach(t => { const on = t.dataset.tab === name; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); });
}
$$('.auth-tab', card).forEach(t => t.addEventListener('click', () => showPanel(t.dataset.tab)));
$('#forgot-open').addEventListener('click', () => showPanel('forgot'));
$('#forgot-back').addEventListener('click', () => showPanel('login'));
$$('a[href="#home"]').forEach(a => a.addEventListener('click', () => setTimeout(() => $('#login-id').focus({ preventScroll: true }), 600)));

// show/hide password
$$('.pw-eye').forEach(b => b.addEventListener('click', () => {
  const input = document.getElementById(b.dataset.eye);
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  b.classList.toggle('on', show);
  b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
}));

// inline form message helper
function setMsg(el, text, kind) {
  el.textContent = text || '';
  el.className = 'form-msg' + (text ? ' show ' + kind : '');
}
function setBusy(btn, busy) { btn.classList.toggle('loading', busy); btn.disabled = busy; }
function failShake() { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); }

/* ---- Login ---- */
$('#fill-demo').addEventListener('click', () => { $('#login-id').value = 'sidi'; $('#login-pw').value = 'sidi'; setMsg($('#login-msg'), ''); });

panels.login.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('#login-btn'), msg = $('#login-msg');
  setMsg(msg, '');
  setBusy(btn, true);
  await new Promise(r => setTimeout(r, 450));            // brief delay so the loading state is visible
  const res = await UHIAuth.login($('#login-id').value, $('#login-pw').value, $('#login-remember').checked);
  if (!res.ok) {
    setBusy(btn, false);
    setMsg(msg, res.error, 'err');
    failShake();
    $('#login-pw').select();
    return;
  }
  enterApp(res.session.name, btn);
});
['login-id', 'login-pw'].forEach(id => $('#' + id).addEventListener('input', () => setMsg($('#login-msg'), '')));

/* ---- Sign up: live validation ---- */
const su = { user: $('#su-user'), email: $('#su-email'), pw: $('#su-pw'), pw2: $('#su-pw2') };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const touched = {};

function mark(input, msgEl, ok, text) {
  const t = touched[input.id];
  input.classList.toggle('valid', t && ok);
  input.classList.toggle('invalid', t && !ok);
  if (msgEl) { msgEl.textContent = t ? text : msgEl.dataset.default || ''; msgEl.className = 'field-msg' + (t ? (ok ? ' good' : ' bad') : ''); }
  return ok;
}
function scorePassword(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 14) s++;
  return p.length ? Math.max(1, s) : 0;
}
const STRENGTH = ['', 'Weak', 'Fair', 'Good', 'Strong'];
$('#su-pw-msg').dataset.default = $('#su-pw-msg').textContent;

function validateSignup() {
  const u = su.user.value.trim(), em = su.email.value.trim(), p = su.pw.value, p2 = su.pw2.value;
  const okUser  = mark(su.user, $('#su-user-msg'), /^[A-Za-z0-9._-]{3,24}$/.test(u), /^[A-Za-z0-9._-]{3,24}$/.test(u) ? 'Looks good' : '3-24 characters: letters, numbers, . _ -');
  const okEmail = mark(su.email, $('#su-email-msg'), EMAIL_RE.test(em), EMAIL_RE.test(em) ? 'Valid email address' : 'Enter a valid email, e.g. name@domain.org');
  const score = scorePassword(p);
  $('.meter').dataset.s = score;
  const okPw = mark(su.pw, $('#su-pw-msg'), p.length >= 8 && score >= 2, p.length < 8 ? 'At least 8 characters required' : `Strength: ${STRENGTH[score]}`);
  const okPw2 = mark(su.pw2, $('#su-pw2-msg'), p2.length > 0 && p === p2, p2 === p && p2 ? 'Passwords match' : 'Passwords do not match');
  $('#signup-btn').disabled = !(okUser && okEmail && okPw && okPw2);
  return okUser && okEmail && okPw && okPw2;
}
Object.values(su).forEach(inp => {
  inp.addEventListener('input', () => { touched[inp.id] = true; if (inp === su.pw && su.pw2.value) touched[su.pw2.id] = true; setMsg($('#signup-msg'), ''); validateSignup(); });
  inp.addEventListener('blur',  () => { if (inp.value) { touched[inp.id] = true; validateSignup(); } });
});

panels.signup.addEventListener('submit', async e => {
  e.preventDefault();
  Object.values(su).forEach(i => touched[i.id] = true);
  if (!validateSignup()) { failShake(); return; }
  const btn = $('#signup-btn'), msg = $('#signup-msg');
  setBusy(btn, true);
  await new Promise(r => setTimeout(r, 450));
  const res = await UHIAuth.register(su.user.value, su.email.value, su.pw.value);
  if (!res.ok) { setBusy(btn, false); validateSignup(); setMsg(msg, res.error, 'err'); failShake(); return; }
  const login = await UHIAuth.login(su.user.value, su.pw.value, false);   // sign the new user straight in
  if (login.ok) enterApp(login.session.name, btn);
  else { setBusy(btn, false); setMsg(msg, 'Account created. Please log in.', 'ok'); showPanel('login'); }
});

/* ---- Forgot password (demo: no mail server) ---- */
panels.forgot.addEventListener('submit', e => {
  e.preventDefault();
  const v = $('#forgot-email').value.trim();
  const msg = $('#forgot-msg');
  if (!EMAIL_RE.test(v)) { setMsg(msg, 'Please enter a valid email address.', 'err'); failShake(); return; }
  setMsg(msg, 'If an account exists for that email, reset instructions are on their way.', 'ok');
});

/* ---- Success: animated transition into the app ---- */
function enterApp(name, originBtn) {
  const enter = $('#enter'), sub = $('#enter-sub');
  const r = originBtn.getBoundingClientRect();                       // iris opens from the clicked button
  enter.style.setProperty('--ex', (r.left + r.width / 2) + 'px');
  enter.style.setProperty('--ey', (r.top + r.height / 2) + 'px');
  enter.classList.add('go');
  enter.setAttribute('aria-hidden', 'false');
  const lines = [`Welcome, ${name}`, 'Loading satellite catalogue…', 'Opening Spatial Parameters engine…'];
  lines.forEach((t, i) => setTimeout(() => { sub.textContent = t; }, 700 + i * 650));
  setTimeout(() => { window.location.href = UHIAuth.APP_PAGE; }, reduceMotion ? 100 : 2700);
}

/* -------------------------------------- 4. SCROLL REVEAL + COUNTERS -- */
const io = new IntersectionObserver(entries => {
  entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
}, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
function observeReveals(root = document) { $$('.reveal', root).forEach(el => io.observe(el)); }

function animateCount(el) {
  const target = +el.dataset.count, dur = 1800, t0 = performance.now();
  if (reduceMotion) { el.textContent = target; return; }
  (function tick(now) {
    const p = Math.min((now - t0) / dur, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));   // ease-out cubic
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}
const countIO = new IntersectionObserver(entries => {
  entries.forEach(en => { if (en.isIntersecting) { animateCount(en.target); countIO.unobserve(en.target); } });
}, { threshold: 0.6 });
$$('[data-count]').forEach(el => countIO.observe(el));

/* ------------------------------------------------------ 5. SERVICES -- */
const cardsEl = $('#cards');
cardsEl.innerHTML = SERVICES.map((s, i) => `
  <button class="card reveal" style="--d:${(i % 4) * 0.08}s" data-id="${s.id}" aria-haspopup="dialog">
    <div class="card-img"><img src="images/${s.img}" alt="" loading="lazy"><span class="card-idx">${String(i + 1).padStart(2, '0')}</span></div>
    <div class="card-body">
      <h3>${s.title}</h3>
      <p>${s.short}</p>
      <span class="card-more">Learn more</span>
    </div>
  </button>`).join('');
observeReveals();

const modal = $('#svc-modal');
let lastFocus = null;
function openModal(id) {
  const s = SERVICES.find(x => x.id === id);
  lastFocus = document.activeElement;
  $('#svc-img').style.backgroundImage = `url('images/${s.img}')`;
  $('#svc-chip').textContent = s.tag;
  $('#svc-title').textContent = s.title;
  $('#svc-desc').textContent = s.long;
  $('#svc-list').innerHTML = s.points.map(p => `<li>${p}</li>`).join('');
  modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  $('#svc-close').focus();
}
function closeModal() {
  modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (lastFocus) lastFocus.focus();
}
cardsEl.addEventListener('click', e => { const c = e.target.closest('.card'); if (c) openModal(c.dataset.id); });
$('#svc-close').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(); });
$('#svc-cta').addEventListener('click', closeModal);

/* ------------------------------------------------ 6. HOW IT WORKS -- */
const stepsEl = $('#steps'), panelBody = $('.step-panel-body');
const AUTO_MS = 6000;
let stepIdx = 0, autoTimer = null, barStart = 0, barRaf = null, autoplay = true, inView = false;

stepsEl.innerHTML = STEPS.map((s, i) => `
  <li><button class="step-item" data-i="${i}">
    <span class="step-dot">${i + 1}</span>
    <span class="step-name">${s.title}<span class="step-tag">${s.tag}</span></span>
  </button></li>`).join('');

function renderStep(i, animate = true) {
  stepIdx = (i + STEPS.length) % STEPS.length;
  const s = STEPS[stepIdx];
  $$('.step-item', stepsEl).forEach((b, k) => { b.classList.toggle('active', k === stepIdx); b.classList.toggle('done', k < stepIdx); });
  $('#sp-num').textContent = stepIdx + 1;
  $('#sp-title').textContent = s.title;
  $('#sp-desc').textContent = s.desc;
  $('#sp-list').innerHTML = s.points.map(p => `<li>${p}</li>`).join('');
  if (animate) { panelBody.classList.remove('swap'); void panelBody.offsetWidth; panelBody.classList.add('swap'); }
  restartBar();
}
function restartBar() {
  cancelAnimationFrame(barRaf); clearTimeout(autoTimer);
  const bar = $('#step-bar'); bar.style.width = '0';
  if (!autoplay || !inView) return;
  barStart = performance.now();
  (function frame(now) {
    const p = Math.min((now - barStart) / AUTO_MS, 1);
    bar.style.width = (p * 100) + '%';
    if (p < 1) barRaf = requestAnimationFrame(frame); else renderStep(stepIdx + 1);
  })(barStart);
}
function setAutoplay(on) { autoplay = on; $('#sp-auto').textContent = on ? 'Auto-play on' : 'Auto-play paused'; restartBar(); }

stepsEl.addEventListener('click', e => { const b = e.target.closest('.step-item'); if (b) { setAutoplay(false); renderStep(+b.dataset.i); } });
$('#sp-prev').addEventListener('click', () => { setAutoplay(false); renderStep(stepIdx - 1); });
$('#sp-next').addEventListener('click', () => { setAutoplay(false); renderStep(stepIdx + 1); });
$('#sp-auto').addEventListener('click', () => setAutoplay(!autoplay));
$('#sp-auto').style.cursor = 'pointer';

// Only auto-advance while the timeline is on screen
new IntersectionObserver(([en]) => { inView = en.isIntersecting; restartBar(); }, { threshold: 0.4 }).observe($('#timeline'));
renderStep(0, false);

// All reveal elements present on first load
observeReveals();
