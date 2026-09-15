/* PREVIEW overlay — see preview.css for the list. Runs after the live
   homepage script, so window.REVEAL and the --fade custom property exist. */
(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const R = window.REVEAL || { fadeFrames: 25, staggerFrames: 4, fps: 24 };
  const ms = f => Math.round(f / R.fps * 1000);

  /* ------------------------------------------------ 2. films grow on scroll */
  if (!reduced) {
    const embeds = [...document.querySelectorAll('.film .embed')];
    const live = new Set();
    const io = new IntersectionObserver(es => es.forEach(e =>
      e.isIntersecting ? live.add(e.target) : live.delete(e.target)), { rootMargin: '20% 0px' });
    embeds.forEach(e => io.observe(e));
    let ticking = false;
    const paint = () => {
      ticking = false;
      const vh = window.innerHeight;
      const min = window.innerWidth < 700 ? 0.92 : 0.84;
      live.forEach(e => {
        /* scaling about the centre leaves the centre where it was, so the
           transformed rect is safe to measure */
        const r = e.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
        let p = Math.min(1, Math.max(0, (1 - d) * 1.7));   /* full size a little before centre */
        p = p * p * (3 - 2 * p);
        e.style.setProperty('--s', (min + (1 - min) * p).toFixed(4));
        e.style.setProperty('--r', (18 * (1 - p)).toFixed(1) + 'px');
      });
    };
    const kick = () => { if (!ticking) { ticking = true; requestAnimationFrame(paint); } };
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', kick);
    kick();
  }

  /* ------------------------------------------------ 3. lines rise out of a mask */
  if (reduced || !window.IntersectionObserver) return;
  const root = document.documentElement;
  root.classList.add('rise-pending');
  const failsafe = setTimeout(() => root.classList.remove('rise-pending'), 3000);

  /* whole-element rise: headings and kickers (their links must stay intact) */
  const wrapWhole = el => {
    el.innerHTML = '<span class="rise-line"><span class="rise-inner">' + el.innerHTML + '</span></span>';
    return [el.firstChild];
  };
  /* line-by-line rise: split top-level text into word spans, group by the
     line each word lands on, rebuild as one masked block per line. Inline
     elements (links, <strong>) travel as single words. */
  const splitLines = el => {
    const words = [];
    const frag = document.createDocumentFragment();
    [...el.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        n.textContent.split(/\s+/).filter(Boolean).forEach(w => {
          const s = document.createElement('span'); s.textContent = w;
          frag.append(s, ' '); words.push(s);
        });
      } else if (n.nodeName === 'BR') {
        const b = document.createElement('br'); frag.append(b); words.push(b);
      } else {
        const s = document.createElement('span'); s.appendChild(n.cloneNode(true));
        frag.append(s, ' '); words.push(s);
      }
    });
    el.textContent = ''; el.appendChild(frag);
    const lines = []; let cur = null, top = null;
    words.forEach(w => {
      if (w.nodeName === 'BR') { cur = null; return; }
      const t = Math.round(w.getBoundingClientRect().top);
      if (!cur || Math.abs(t - top) > 3) { cur = []; lines.push(cur); top = t; }
      cur.push(w);
    });
    el.textContent = '';
    return lines.map(ws => {
      const line = document.createElement('span'); line.className = 'rise-line';
      const inner = document.createElement('span'); inner.className = 'rise-inner';
      ws.forEach((w, i) => { if (i) inner.append(' '); inner.append(...w.childNodes); });
      line.appendChild(inner); el.appendChild(line);
      return line;
    });
  };

  const film = [...document.querySelectorAll('.film .text')];
  const about = [...document.querySelectorAll('#about .inner > p')];
  const originals = new Map();
  [...film.flatMap(b => [...b.children]), ...about].forEach(el => originals.set(el, el.innerHTML));

  const split = el => (el.matches('h2, .kicker') ? wrapWhole(el) : splitLines(el));
  const groups = new Map();   /* observed element -> its line elements, in order */
  const buildAll = () => {
    groups.forEach((_, g) => {
      if (g.dataset.risen) return;
      const kids = g.matches('.film .text') ? [...g.children] : [g];
      kids.forEach(k => { k.innerHTML = originals.get(k); });
      groups.set(g, kids.flatMap(split));
    });
  };

  const reveal = batch => {
    let i = 0;
    batch.forEach(g => {
      const lines = groups.get(g) || [];
      lines.forEach(l => { l.firstChild.style.transitionDelay = (Math.min(i++, 10) * ms(R.staggerFrames)) + 'ms'; });
      g.dataset.risen = '1';
      requestAnimationFrame(() => requestAnimationFrame(() => lines.forEach(l => l.classList.add('risen'))));
      /* once risen, put the original markup back so later resizes rewrap normally */
      setTimeout(() => {
        const kids = g.matches('.film .text') ? [...g.children] : [g];
        kids.forEach(k => { k.innerHTML = originals.get(k); });
      }, ms(R.fadeFrames) + Math.min(i, 10) * ms(R.staggerFrames) + 150);
    });
  };

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    [...film, ...about].forEach(g => groups.set(g, []));
    buildAll();
    clearTimeout(failsafe);
    root.classList.remove('rise-pending');
    const io = new IntersectionObserver(es => {
      const batch = es.filter(e => e.isIntersecting).map(e => e.target);
      batch.forEach(g => io.unobserve(g));
      if (batch.length) reveal(batch);
    }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
    groups.forEach((_, g) => io.observe(g));
    let t;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(buildAll, 200); });
  });
})();
