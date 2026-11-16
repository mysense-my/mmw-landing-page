/* MMW x Metony landing page: motion and interactions (vanilla JS, no dependencies). */
(function () {
  'use strict';
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mqDesk = window.matchMedia('(min-width: 1200px)');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- spring curves (Framer physics) sampled into CSS linear() */
  function springCurve(stiffness, damping, mass) {
    mass = mass || 1;
    var w = Math.sqrt(stiffness / mass), z = damping / (2 * Math.sqrt(stiffness * mass));
    function x(t) {
      if (z < 1) { var wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t)); }
      if (z === 1) return 1 - (1 + w * t) * Math.exp(-w * t);
      var r1 = -w * (z - Math.sqrt(z * z - 1)), r2 = -w * (z + Math.sqrt(z * z - 1));
      return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
    }
    var T = 0.05; while (T < 4 && Math.abs(1 - x(T)) > 0.002) T += 0.05;
    var pts = []; for (var i = 0; i <= 32; i++) pts.push(+x(T * i / 32).toFixed(4));
    pts[32] = 1;
    return { ease: 'linear(' + pts.join(', ') + ')', dur: T };
  }
  var SP_APPEAR = springCurve(400, 60);      // fade-ups (stiffness 400, damping 53-96 in the template)
  var SP_HERO = springCurve(400, 80);

  /* ---------- 1. appear effects (opacity + y, once, at 50% in view) */
  function show(el) {
    if (el.classList.contains('vis')) return;
    var d = parseFloat(el.getAttribute('data-delay') || '0');
    var sp = el.getAttribute('data-appear') === 'hero' ? SP_HERO : SP_APPEAR;
    el.style.transition = 'opacity ' + sp.dur + 's ' + sp.ease + ' ' + d + 's, transform ' + sp.dur + 's ' + sp.ease + ' ' + d + 's';
    el.classList.add('vis');
  }
  var appearIO = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { show(e.target); appearIO.unobserve(e.target); } });
  }, { threshold: 0.5 }) : null;
  $$('[data-appear]').forEach(function (el) {
    var k = el.getAttribute('data-appear');
    if (REDUCE || !appearIO) { el.classList.add('vis'); return; }
    if (k === 'hero' || k === 'pill') return;            // load sequence below
    if (k === '400') {                                   // CTA photos start clipped below the panel: trigger from the panel
      var panel = el.closest('.cta-panel') || el.parentElement;
      new IntersectionObserver(function (es, o) { es.forEach(function (e) { if (e.isIntersecting) { show(el); o.disconnect(); } }); }, { threshold: 0.5 }).observe(panel);
      return;
    }
    // tall elements can never be 50% visible on a short screen: lower their threshold
    if (el.getBoundingClientRect().height > window.innerHeight * 0.9) {
      new IntersectionObserver(function (es, o) { es.forEach(function (e) { if (e.isIntersecting) { show(e.target); o.unobserve(e.target); } }); }, { threshold: 0.15 }).observe(el);
    } else appearIO.observe(el);
  });
  // hero load sequence: wordmark + intro, button, bottom row, then the menu pill
  window.addEventListener('load', function () {
    $$('[data-appear="hero"]').forEach(function (el, i) {
      if (!el.getAttribute('data-delay')) el.setAttribute('data-delay', '0');
      setTimeout(function () { show(el); }, 150);
    });
    var pill = $('[data-appear="pill"]'); if (pill) setTimeout(function () { show(pill); }, 900);
  });

  /* ---------- 2. text reveal: split into lines, blur 10 -> 0, y 10 -> 0, .05 s between lines */
  function splitLines(el) {
    var txt = el.textContent.replace(/\s+/g, ' ').trim();
    el.setAttribute('aria-label', txt);
    el.innerHTML = txt.split(' ').map(function (w) { return '<span class="rw">' + w.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>'; }).join(' ');
    var words = $$('.rw', el), lines = [], top = null;
    words.forEach(function (w) { var t = w.offsetTop; if (top === null || Math.abs(t - top) > 2) { lines.push([]); top = t; } lines[lines.length - 1].push(w.textContent); });
    el.innerHTML = lines.map(function (l) { return '<span class="ln" aria-hidden="true">' + l.join(' ').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>'; }).join(' ');
    el._mmwText = txt;
  }
  function reveal(el) {
    var start = el.getAttribute('data-reveal') === 'title' ? 0.2 : 0.5;
    $$('.ln', el).forEach(function (ln, i) { ln.style.transitionDelay = (start + i * 0.05) + 's'; ln.classList.add('in'); });
    var n = $$('.ln', el).length;
    setTimeout(function () { el.textContent = el._mmwText; el.removeAttribute('aria-label'); el.classList.add('revealed'); }, (start + n * 0.05 + 0.6) * 1000);
  }
  function initReveal() {
    if (REDUCE) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.3 });
    $$('[data-reveal]').forEach(function (el) { splitLines(el); io.observe(el); });
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(initReveal);

  /* ---------- 3. scroll text: letters grey -> ink as the paragraph scrolls ("start 0.75" -> "start 0.15") */
  var st = $('.scroll-text');
  var chars = [];
  if (st) {
    var startIdx = parseInt(st.getAttribute('data-start') || '0', 10), idx = 0, words = st.textContent.trim().split(/\s+/);
    st.setAttribute('aria-label', st.textContent.trim());
    st.innerHTML = words.map(function (w) {
      return '<span class="w" aria-hidden="true">' + w.split('').map(function (c) { var s = '<span class="ch' + (idx < startIdx ? ' k' : '') + '">' + c + '</span>'; idx++; return s; }).join('') + '</span>';
    }).join(' ');
    idx = 0;
    var nW = words.length;
    $$('.w', st).forEach(function (w, wi) {
      var cs = $$('.ch', w), a = wi / nW, b = (wi + 1) / nW, f = (b - a) / cs.length;
      cs.forEach(function (c, ci) { chars.push({ el: c, a: a + f * ci, b: a + f * (ci + 1), fixed: idx++ < startIdx, on: false }); });
    });
  }
  function scrollText() {
    if (!st) return;
    var r = st.getBoundingClientRect(), vh = window.innerHeight;
    var p = (vh * 0.75 - r.top) / (vh * 0.6); p = Math.max(0, Math.min(1, p));
    for (var i = 0; i < chars.length; i++) {
      var c = chars[i]; if (c.fixed) continue;
      var on = p >= (c.a + c.b) / 2;
      if (on !== c.on) { c.on = on; c.el.classList.toggle('k', on); }
    }
  }

  /* ---------- 4. count-up stats */
  function fmt(v, dec) { return dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US'); }
  var cIO = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return; cIO.unobserve(e.target);
      var el = e.target, to = parseFloat(el.getAttribute('data-to')), dec = parseInt(el.getAttribute('data-dec') || '0', 10), t0 = null, D = 1600;
      if (REDUCE) { el.textContent = fmt(to, dec); return; }
      function step(now) { if (t0 === null) t0 = now; var t = Math.min(1, (now - t0) / D), k = 1 - Math.pow(1 - t, 3); el.textContent = fmt(to * k, dec); if (t < 1) requestAnimationFrame(step); }
      requestAnimationFrame(step);
    });
  }, { threshold: 0.5 });
  $$('.count').forEach(function (el) { cIO.observe(el); });

  /* ---------- 5. marquees (30 px/s, leftward, seamless) */
  $$('.marquee').forEach(function (mq) {
    var track = $('.mq-track', mq), speed = parseFloat(mq.getAttribute('data-speed') || '30');
    var html = track.innerHTML; track.innerHTML = html + html;
    $$(':scope > *', track).slice(track.children.length / 2).forEach(function (n) { n.setAttribute('aria-hidden', 'true'); });
    var x = 0, last = null, visible = true, half = 0;
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(mq);
    function measure() { half = track.scrollWidth / 2 + parseFloat(getComputedStyle(track).columnGap || 0) / 2; }
    measure(); window.addEventListener('resize', measure);
    function loop(now) {
      if (last !== null && visible && !REDUCE) { x -= speed * Math.min(0.05, (now - last) / 1000); if (-x >= half) x += half; track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)'; }
      last = now; requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  });

  /* ---------- 6. projects: each next card grows in from the left when its scroll trigger is half way up */
  var trigs = $$('.proj-trig'), stacked = $$('.proj[data-stack]');
  function projects() {
    if (!mqDesk.matches) return;
    var vh = window.innerHeight;
    trigs.forEach(function (t, i) { var card = stacked[i]; if (!card) return; card.classList.toggle('in', t.getBoundingClientRect().top < vh * 0.55); });
  }

  // fallback: anything already in (or scrolled past) the viewport is shown, even if a fast jump skipped its observer
  var pending = $$('[data-appear]').filter(function (el) { var k = el.getAttribute('data-appear'); return k !== 'hero' && k !== 'pill'; });
  function sweepAppear() {
    if (!pending.length) return;
    var vh = window.innerHeight;
    pending = pending.filter(function (el) {
      if (el.classList.contains('vis')) return false;
      var r = (el.getAttribute('data-appear') === '400' ? (el.closest('.cta-panel') || el) : el).getBoundingClientRect();
      if (r.top < vh * 0.85 || r.bottom < 0) { show(el); return false; }
      return true;
    });
  }
  var ticking = false;
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; scrollText(); projects(); }); }
    clearTimeout(onScroll._t); onScroll._t = setTimeout(sweepAppear, 120);
  }
  window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll); onScroll();

  /* ---------- spring height helper (bounce .2 / .4 s) */
  var SPR = springCurve(246.7, 25.1);  // = Framer { bounce: .2, duration: .4 } (damping ratio .8, natural freq 15.7)
  function animateHeight(el, from, to, done) {
    if (REDUCE || Math.abs(from - to) < 1) { el.style.height = ''; if (done) done(); return; }
    el.style.transition = 'none'; el.style.height = from + 'px'; el.style.overflow = 'hidden';
    void el.offsetHeight;
    el.style.transition = 'height ' + SPR.dur + 's ' + SPR.ease; el.style.height = to + 'px';
    clearTimeout(el._hT);
    el._hT = setTimeout(function () { el.style.height = ''; el.style.overflow = ''; el.style.transition = ''; if (done) done(); }, SPR.dur * 1000 + 30);
  }

  /* ---------- 7. services rows: open on hover (desktop) */
  $$('.svc').forEach(function (row) {
    function set(open) {
      if (!mqDesk.matches || row.classList.contains('open') === open) return;
      var from = row.offsetHeight; row.classList.toggle('open', open); var to = row.offsetHeight; animateHeight(row, from, to);
    }
    row.addEventListener('mouseenter', function () { set(true); });
    row.addEventListener('mouseleave', function () { set(false); });
    row.addEventListener('focus', function () { set(true); });
    row.addEventListener('blur', function () { set(false); });
  });

  /* ---------- 8. process: steps advance every 5 s, click to jump */
  var pb = $('.pr-body');
  if (pb) {
    var cur = 0, timer = null, prVisible = false, N = $$('.pr-item', pb).length;
    function go(i) {
      cur = (i + N) % N;
      $$('[data-step]', pb).forEach(function (el) { el.classList.toggle('on', +el.getAttribute('data-step') === cur); });
    }
    function arm() { clearInterval(timer); timer = setInterval(function () { if (prVisible && !document.hidden) go(cur + 1); }, parseInt(pb.getAttribute('data-auto') || '5000', 10)); }
    $$('.pr-item, .pr-num', pb).forEach(function (el) {
      el.addEventListener('click', function () { go(+el.getAttribute('data-step')); arm(); });
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(+el.getAttribute('data-step')); arm(); } });
    });
    new IntersectionObserver(function (es) { prVisible = es[0].isIntersecting; }, { threshold: 0.3 }).observe(pb);
    arm();
  }

  /* ---------- 9. offers toggle */
  var tg = $('.toggle');
  if (tg) {
    var knob = $('.tg-knob', tg), btns = $$('.tg', tg), rows = $$('.pc-row');
    function place(b) { knob.style.width = b.offsetWidth + 'px'; knob.style.transform = 'translateX(' + (b.offsetLeft - 4) + 'px)'; }
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var i = +b.getAttribute('data-tab');
        btns.forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on ? 'true' : 'false'); });
        rows.forEach(function (r) { var on = +r.getAttribute('data-set') === i; r.hidden = !on; r.classList.toggle('in', on); });
        place(b);
      });
    });
    var placeNow = function () { place($('.tg.on', tg)); };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(placeNow); window.addEventListener('resize', placeNow);
  }

  /* ---------- 10. testimonial stack (desktop) */
  var tcs = $$('.tc');
  if (tcs.length) {
    var order = tcs.map(function (_, i) { return i; });
    function layout() {
      order.forEach(function (ci, pos) {
        var c = tcs[ci];
        c.style.zIndex = String(10 - pos);
        if (!mqDesk.matches) { c.style.transform = ''; c.style.opacity = ''; return; }
        var p = Math.min(pos, 2);
        c.style.transform = 'translateY(' + (p * 37) + 'px) scale(' + (1 - p * 0.05) + ')';
        c.style.opacity = pos > 2 ? '0' : '1';
        c.style.filter = pos ? 'brightness(' + (1 - pos * 0.02) + ')' : '';
        c.setAttribute('aria-hidden', pos ? 'true' : 'false');
      });
    }
    function next(dir) {
      if (dir > 0) order.push(order.shift()); else order.unshift(order.pop());
      layout();
    }
    var dn = $('.tm-down'), up = $('.tm-up');
    if (dn) dn.addEventListener('click', function () { next(1); });
    if (up) up.addEventListener('click', function () { next(-1); });
    layout(); mqDesk.addEventListener ? mqDesk.addEventListener('change', layout) : mqDesk.addListener(layout);
  }

  /* ---------- 11. blogs: hovered card widens (desktop) */
  $$('.bc').forEach(function (card) {
    card.addEventListener('mouseenter', function () {
      if (!mqDesk.matches) return;
      $$('.bc').forEach(function (c) { c.classList.toggle('bc-lg', c === card); });
    });
  });

  /* ---------- 12. team slideshow */
  var car = $('.team-car');
  if (car) {
    var sl = $$('.tm-sl', car), act = 0, M = sl.length;
    var POS = { 0: [0, 299, 343, 0], 1: [221, 238, 288, 30], '-1': [-215, 238, 288, 30], 2: [414, 207, 250, 49], '-2': [-398, 207, 250, 49] };
    function lay() {
      sl.forEach(function (s, i) {
        var o = ((i - act) % M + M) % M; if (o > M / 2) o -= M;
        s.classList.toggle('on', o === 0);
        if (!mqDesk.matches) { s.style.transform = ''; s.style.width = ''; s.style.zIndex = ''; s.style.opacity = ''; $('.tm-ph', s).style.height = ''; return; }
        var p = POS[o] || POS[o > 0 ? 2 : -2];
        s.style.width = p[1] + 'px'; $('.tm-ph', s).style.height = p[2] + 'px';
        s.style.transform = 'translate(calc(-50% + ' + p[0] + 'px), ' + p[3] + 'px)';
        s.style.zIndex = String(5 - Math.abs(o)); s.style.opacity = Math.abs(o) > 2 ? '0' : '1';
      });
    }
    function step(d) {
      if (mqDesk.matches) { act = (act + d + M) % M; lay(); return; }
      var tr = $('.team-track', car), w = sl[0].offsetWidth + 10; tr.scrollBy({ left: d * w, behavior: 'smooth' });
    }
    $('.tm-prev', car).addEventListener('click', function () { step(-1); });
    $('.tm-next', car).addEventListener('click', function () { step(1); });
    sl.forEach(function (s, i) { s.addEventListener('click', function () { if (mqDesk.matches) { act = i; lay(); } }); });
    lay(); window.addEventListener('resize', lay);
  }

  /* ---------- 13. FAQ: one open at a time */
  var fqs = $$('.fq');
  fqs.forEach(function (f) {
    var q = $('.fq-q', f), a = $('.fq-a', f);
    q.addEventListener('click', function () {
      var opening = !f.classList.contains('open');
      fqs.forEach(function (o) {
        var want = o === f ? opening : false;
        if (o.classList.contains('open') === want) return;
        var from = o.offsetHeight;
        o.classList.toggle('open', want); $('.fq-a', o).hidden = !want; $('.fq-q', o).setAttribute('aria-expanded', want ? 'true' : 'false');
        animateHeight(o, from, o.offsetHeight);
      });
    });
  });

  /* ---------- 14. menu: pill opens a full-screen card; hovering a link slides the photo stack */
  var pillBtn = $('.pill'), menu = $('#menu');
  if (pillBtn && menu) {
    var stack = $('.menu-stack', menu);
    function openMenu(open) {
      pillBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.documentElement.style.overflow = open ? 'hidden' : '';
      if (open) { menu.hidden = false; void menu.offsetWidth; menu.classList.add('open'); }
      else { menu.classList.remove('open'); setTimeout(function () { if (!menu.classList.contains('open')) menu.hidden = true; }, 320); }
    }
    pillBtn.addEventListener('click', function () { openMenu(pillBtn.getAttribute('aria-expanded') !== 'true'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pillBtn.getAttribute('aria-expanded') === 'true') openMenu(false); });
    $$('.mlink', menu).forEach(function (l) {
      l.addEventListener('mouseenter', function () { stack.style.transform = 'translateY(' + (-100 * +l.getAttribute('data-i')) + '%)'; $$('.mlink', menu).forEach(function (x) { x.classList.toggle('on', x === l); }); });
      l.addEventListener('click', function () { openMenu(false); });
    });
  }
})();
