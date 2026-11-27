/*
 * motion.js — a tiny, dependency-free, seekable animation timeline.
 *
 * Why not GSAP/CSS animations? Rendering to video needs every frame to be
 * reproducible: the renderer calls MS.seek(t) for each frame and screenshots.
 * This runtime is pure "state at time t", so frames never drop or drift.
 *
 * API (all times in seconds):
 *   MS.to(target, props, at, dur, ease?)     animate from current/previous value to props
 *   MS.fromTo(target, from, to, at, dur, ease?)
 *   MS.set(target, props, at)                 jump at time `at`
 *   MS.stagger(targets, from, to, at, dur, each, ease?)
 *   MS.count(target, from, to, at, dur, ease?, fmt?)   number counter in textContent
 *   MS.type(target, text, at, dur)            typewriter (reveals characters)
 *   MS.countSound(at, dur, ease?, opts?)      ticks timed to a counter's easing + a landing sound (use with MS.count)
 *   MS.cue(at, sfx, gain?)                    sound cue: a library name like 'whoosh/whoosh_cinematic_fast' or an alias like 'pop'
 *   MS.captions(target, words, opts?)         word-by-word captions synced to speech (words from scripts/transcribe.py)
 *   MS.footage(videoSelector)                 preview helper: keeps a .preview-only <video> in sync with the timeline
 *   MS.cutout(imgSelector, dir)               the person cut out of each footage frame (scripts/matte.py), so .ms-behind text sits behind them
 *   MS.keywords(target, words, opts?)         one big keyword at a time (luxe real-estate style), usually inside .ms-behind
 *   MS.duration(sec | 'auto') / MS.size(w, h) / MS.fps(n)   ('auto' = length of the --background footage)
 *   MS.seek(t)  MS.play()  (play() previews in a browser in real time)
 *
 * target: CSS selector, Element, or array/NodeList of Elements.
 * props: x, y (px), scale, scaleX, scaleY, rotate (deg), skewX (deg), opacity,
 *        blur (px), clip (0..1 left-to-right reveal), width, height (px),
 *        and any numeric CSS custom property written as "--name".
 */
(function () {
  const C1 = 1.70158, C3 = C1 + 1;
  const ease = {
    linear: t => t,
    in: t => t * t * t,
    out: t => 1 - Math.pow(1 - t, 3),
    inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    out4: t => 1 - Math.pow(1 - t, 4),
    expoOut: t => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    expoInOut: t => t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
    backOut: t => 1 + C3 * Math.pow(t - 1, 3) + C1 * Math.pow(t - 1, 2),
    backIn: t => C3 * t * t * t - C1 * t * t,
    // critically-damped-ish spring: quick, one small overshoot, settles
    spring: t => 1 - Math.exp(-6 * t) * Math.cos(9 * t) * (1 - t),
    // soft float for idle loops (use with yoyo via MS.float)
    sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  };

  const DEFAULTS = { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotate: 0, skewX: 0, opacity: 1, blur: 0, clip: 1 };
  const TRANSFORM = ['x', 'y', 'scale', 'scaleX', 'scaleY', 'rotate', 'skewX'];

  const tracks = new Map(); // el -> { prop -> [tween] }
  const pending = [];      // image decodes the renderer waits for (MS.cutout)
  const hooks = [];         // functions called with t on every seek (counters, typewriters, custom)
  const cues = [];
  const cfg = { duration: 15, fps: 30, width: 1080, height: 1920 };

  function els(target) {
    if (typeof target === 'string') return Array.from(document.querySelectorAll(target));
    if (target instanceof Element) return [target];
    return Array.from(target || []);
  }
  function getEase(e) { return typeof e === 'function' ? e : ease[e || 'out'] || ease.out; }
  function track(el, prop) {
    if (!tracks.has(el)) tracks.set(el, {});
    const t = tracks.get(el);
    return (t[prop] = t[prop] || []);
  }
  function lastValue(el, prop) {
    const tr = track(el, prop);
    if (!tr.length) return prop in DEFAULTS ? DEFAULTS[prop] : 0;
    return tr[tr.length - 1].to;
  }

  function addTween(el, prop, from, to, at, dur, e) {
    const tr = track(el, prop);
    tr.push({ from, to, at, dur: Math.max(dur, 0), ease: getEase(e) });
    tr.sort((a, b) => a.at - b.at);
  }

  const MS = {
    ease,
    cues,
    config: cfg,
    duration(s) { cfg.duration = s; return MS; },
    fps(n) { cfg.fps = n; return MS; },
    size(w, h) { cfg.width = w; cfg.height = h; return MS; },

    fromTo(target, from, to, at, dur, e) {
      els(target).forEach(el => {
        for (const p in to) addTween(el, p, p in from ? from[p] : lastValue(el, p), to[p], at, dur, e);
      });
      return MS;
    },
    to(target, to, at, dur, e) {
      els(target).forEach(el => {
        for (const p in to) addTween(el, p, lastValue(el, p), to[p], at, dur, e);
      });
      return MS;
    },
    set(target, props, at = 0) {
      els(target).forEach(el => { for (const p in props) addTween(el, p, props[p], props[p], at, 0, 'linear'); });
      return MS;
    },
    stagger(target, from, to, at, dur, each = 0.08, e) {
      els(target).forEach((el, i) => MS.fromTo(el, from, to, at + i * each, dur, e));
      return MS;
    },
    // gentle idle bobbing between two states for the whole [at, until] range
    float(target, amp = 14, period = 3, at = 0, until = null, phase = 0) {
      els(target).forEach((el, i) => {
        const end = until ?? cfg.duration;
        hooks.push(t => {
          if (t < at || t > end) { el.style.translate = ''; return; }
          const k = Math.sin(((t - at) / period + phase + i * 0.37) * Math.PI * 2);
          el.style.translate = `0px ${(k * amp).toFixed(2)}px`;
        });
      });
      return MS;
    },
    count(target, from, to, at, dur, e, fmt = v => Math.round(v).toLocaleString()) {
      const f = getEase(e);
      els(target).forEach(el => hooks.push(t => {
        const p = Math.min(Math.max((t - at) / dur, 0), 1);
        el.textContent = fmt(from + (to - from) * f(p));
      }));
      return MS;
    },
    /*
     * Sound for a number counter, timed to the SAME easing as MS.count, so ticks are fast while the
     * number races and slow down as it settles (like a real slot/score counter). Ends with a landing sound.
     *   MS.countSound(at, dur, ease, { ticks: 18, tick: 'counter/tick_single', gain: .5, land: 'counter/collect_points', landGain: .6 })
     * Use the same at/dur/ease you passed to MS.count. Set land: null for no landing sound.
     */
    countSound(at, dur, e = 'expoOut', opts = {}) {
      const o = Object.assign({ ticks: 18, tick: 'counter/tick_single', gain: 0.5, land: 'counter/collect_points', landGain: 0.6, minGap: 0.04 }, opts);
      const f = getEase(e);
      let last = -1;
      for (let k = 1; k < o.ticks; k++) {
        // find time where eased progress crosses k/ticks (binary search)
        const target = k / o.ticks;
        let lo = 0, hi = 1;
        for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (f(mid) < target) lo = mid; else hi = mid; }
        const t = at + hi * dur;
        if (t - last < o.minGap) continue;
        // alternate gain slightly so repeated ticks don't sound robotic
        MS.cue(t, o.tick, o.gain * (k % 2 ? 1 : 0.85));
        last = t;
      }
      if (o.land) MS.cue(at + dur, o.land, o.landGain);
      return MS;
    },
    type(target, text, at, dur, caret = true) {
      els(target).forEach(el => hooks.push(t => {
        const p = Math.min(Math.max((t - at) / dur, 0), 1);
        const n = Math.round(text.length * p);
        const blink = caret && (p < 1 || Math.floor(t * 2) % 2 === 0) && t >= at;
        el.innerHTML = escapeHtml(text.slice(0, n)) + (blink ? '<span class="ms-caret">|</span>' : '');
      }));
      return MS;
    },
    /*
     * Captions synced to speech. words: [{ text, start, end }] (seconds), as written by scripts/transcribe.py.
     * opts: { maxWords: 3, maxGap: .45, emphasis: ['million', 'sold'], style: 'pop' | 'karaoke' | 'plain', upper: false }
     * Renders chunks of 1–maxWords into `target`; the spoken word gets class "now", already-spoken words "said",
     * emphasis words "em". Style it with CSS (see examples/realestate-talking-head.html).
     */
    captions(target, words, opts = {}) {
      const o = Object.assign({ maxWords: 3, maxGap: 0.45, emphasis: [], style: 'pop', upper: false }, opts);
      const box = els(target)[0]; if (!box || !words || !words.length) return MS;
      const em = new Set(o.emphasis.map(w => w.toLowerCase().replace(/[^a-z0-9$%]/g, '')));
      const chunks = []; let cur = [];
      words.forEach((w, i) => {
        const prev = words[i - 1];
        const brk = cur.length >= o.maxWords || (prev && (w.start - prev.end > o.maxGap || /[.!?,;:]$/.test(prev.text)));
        if (cur.length && brk) { chunks.push(cur); cur = []; }
        cur.push(w);
      });
      if (cur.length) chunks.push(cur);
      const nodes = chunks.map((c, ci) => {
        const d = document.createElement('div'); d.className = 'ms-cap ms-cap-' + o.style;
        d.style.position = 'absolute'; d.style.left = '0'; d.style.right = '0'; d.style.opacity = '0';
        c.forEach((w, wi) => {
          const sp = document.createElement('span'); sp.className = 'ms-w';
          const clean = w.text.toLowerCase().replace(/[^a-z0-9$%]/g, '');
          if (em.has(clean)) sp.classList.add('em');
          sp.textContent = (o.upper ? w.text.toUpperCase() : w.text);
          d.appendChild(sp); if (wi < c.length - 1) d.appendChild(document.createTextNode(' '));
        });
        box.appendChild(d);
        return { el: d, words: c, start: c[0].start, end: (chunks[ci + 1] ? Math.min(chunks[ci + 1][0].start, c[c.length - 1].end + 0.6) : c[c.length - 1].end + 0.6) };
      });
      hooks.push(t => {
        nodes.forEach(n => {
          const on = t >= n.start && t < n.end;
          if (!on) { n.el.style.opacity = '0'; return; }
          const k = Math.min((t - n.start) / 0.18, 1);
          const sc = o.style === 'pop' ? 0.82 + 0.18 * ease.backOut(k) : 1;
          n.el.style.opacity = String(Math.min(1, k * 1.6));
          n.el.style.transform = `translateY(${(1 - ease.out(k)) * 18}px) scale(${sc})`;
          n.el.querySelectorAll('.ms-w').forEach((sp, i) => {
            const w = n.words[i];
            sp.classList.toggle('now', t >= w.start && t < (n.words[i + 1] ? n.words[i + 1].start : n.end));
            sp.classList.toggle('said', t >= w.start);
          });
        });
      });
      return MS;
    },
    footage(sel) {
      const v = els(sel)[0]; if (!v) return MS;
      v.muted = false;
      hooks.push(t => {
        if (/[?&]render=1/.test(location.search)) return;
        if (Math.abs(v.currentTime - t) > 0.2) v.currentTime = t;
        if (v.paused) v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
      });
      v.addEventListener('loadedmetadata', () => { if (cfg.duration === 'auto') cfg.duration = v.duration; });
      return MS;
    },
    /**
     * The person, cut out of every footage frame by scripts/matte.py (dir/f_00000.webp...). Stack order in #stage:
     * footage (under the page) -> .ms-behind layer (big keywords) -> this <img> -> everything else.
     * If the folder is missing the <img> hides itself and the keywords simply sit in front.
     */
    cutout(sel, dir, opts = {}) {
      const img = els(sel)[0]; if (!img) return MS;
      const fps = opts.fps || cfg.fps; const frames = opts.frames || Infinity;
      let ok = true, last = -1;
      img.addEventListener('error', () => { ok = false; img.style.display = 'none'; });
      hooks.push(t => {
        if (!ok) return;
        const i = Math.max(0, Math.min(frames - 1, Math.round(t * fps)));
        if (i === last) return; last = i;
        img.src = `${dir}/f_${String(i).padStart(5, '0')}.webp`;
        if (/[?&]render=1/.test(location.search)) pending.push(img.decode().catch(() => {}));
      });
      return MS;
    },
    /**
     * Luxe keyword captions: only the chosen words, one at a time, huge. Each one fades up from soft and
     * semi-transparent (the look in high-end listing reels) and holds until the next one or `hold` seconds.
     *   words: from transcribe.py; pick: words to show (case-insensitive) — or [{text, at, hold}] for manual.
     */
    keywords(target, words, opts = {}) {
      const o = Object.assign({ pick: [], hold: 1.6, inDur: 0.45, outDur: 0.35, gap: 0.15, fit: 0, maxSize: 0, titleCase: true, tops: null, frontAbove: 0.4 }, opts);
      const box = els(target)[0]; if (!box) return MS;
      let list;
      if (o.pick.length && typeof o.pick[0] === 'object') list = o.pick.map(k => ({ text: k.text, at: k.at, hold: k.hold || o.hold }));
      else {
        const want = new Set(o.pick.map(w => w.toLowerCase().replace(/[^a-z0-9$%]/g, '')));
        list = (words || []).filter(w => want.has(w.text.toLowerCase().replace(/[^a-z0-9$%]/g, '')))
          .map(w => ({ text: w.text.replace(/[.,!?;:]+$/, ''), at: w.start, hold: o.hold }))
          // the same word said again within 3s, or any keyword < 0.6s after the last one, is skipped
          .filter((k, i, a) => !a.slice(0, i).some(p => p.keep !== false && (k.at - p.at < 0.6 || (p.text.toLowerCase() === k.text.toLowerCase() && k.at - p.at < 3))) || (k.keep = false));
      }
      const nodes = list.map((k, i) => {
        const d = document.createElement('div'); d.className = 'ms-kw';
        d.textContent = o.titleCase && k.text === k.text.toLowerCase() ? k.text[0].toUpperCase() + k.text.slice(1) : k.text;
        d.style.opacity = '0'; box.appendChild(d);
        const next = list[i + 1];
        const end = Math.max(k.at + o.inDur, Math.min(k.at + k.hold, next ? next.at - o.gap - o.outDur : Infinity));
        return { el: d, at: k.at, end, fitted: !o.fit, placed: false };
      });
      // place: with cutout/cover.js loaded, put each word at the candidate top (stage px, opts.tops) where the
      // person covers it least while it is on screen; if every spot is covered more than frontAbove, the word
      // comes in front of the person (class "front") so it stays readable.
      const place = n => {
        if (n.placed || !n.fitted) return; n.placed = true;
        const C = window.MS_COVER; if (!C) return;
        const size = parseFloat(getComputedStyle(n.el).fontSize);
        const baseTop = box.offsetTop + n.el.offsetTop;
        const tops = o.tops || [baseTop];
        const f0 = Math.floor(n.at * C.fps), f1 = Math.min(C.frames.length - 1, Math.ceil(n.end * C.fps));
        // worst moment counts (the 90th-percentile frame): a word that is readable on average but hidden
        // when the agent leans in still fails
        const coverAt = top => {
          const r0 = Math.floor((top + size * 0.15) / C.row), r1 = Math.ceil((top + size * 0.85) / C.row), per = [];
          for (let f = Math.max(0, f0); f <= f1; f += 2) {
            let sum = 0, cnt = 0;
            for (let r = r0; r < r1; r++) { const v = C.frames[f] && C.frames[f][r]; if (v != null) { sum += v; cnt++; } }
            if (cnt) per.push(sum / cnt);
          }
          per.sort((a, b) => a - b);
          return per.length ? per[Math.floor(per.length * 0.9)] : 0;
        };
        let best = tops[0], bc = Infinity;
        tops.forEach(t => { const c = coverAt(t); if (c < bc) { bc = c; best = t; } });
        n.el.style.top = (best - box.offsetTop) + 'px';
        if (bc > o.frontAbove) { n.el.classList.add('front'); n.el.style.zIndex = '4'; }
      };
      // fit: shrink long words so they never run wider than `fit` px (measured once the fonts are in)
      const fit = n => {
        if (n.fitted || (document.fonts && document.fonts.status !== 'loaded')) return;
        const cs = getComputedStyle(n.el), base = parseFloat(cs.fontSize), max = o.maxSize || base;
        const ctx = (MS._cv = MS._cv || document.createElement('canvas')).getContext('2d');
        ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${base}px ${cs.fontFamily}`;
        if ('letterSpacing' in ctx) ctx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
        const w = ctx.measureText(n.el.textContent).width;
        n.el.style.fontSize = Math.min(max, base * o.fit / w) + 'px'; n.fitted = true;
      };
      hooks.push(t => {
        nodes.forEach(n => {
          fit(n); place(n);
          if (t < n.at || t > n.end + o.outDur) { n.el.style.opacity = '0'; return; }
          const a = Math.min((t - n.at) / o.inDur, 1), b = t > n.end ? Math.min((t - n.end) / o.outDur, 1) : 0;
          const ka = ease.out4(a);
          n.el.style.opacity = String((0.25 + 0.75 * ka) * (a > 0 ? 1 : 0) * (1 - b));
          n.el.style.filter = a < 1 || b > 0 ? `blur(${(1 - ka) * 10 + b * 6}px)` : 'none';
          n.el.style.transform = `translateY(${(1 - ka) * 30 - b * 16}px) scale(${1.06 - 0.06 * ka})`;
        });
      });
      return MS;
    },
    hook(fn) { hooks.push(fn); return MS; },
    cue(at, sfx, gain = 1) { cues.push({ at, sfx, gain }); return MS; },

    seek(t) {
      for (const [el, props] of tracks) {
        const v = {};
        for (const p in props) v[p] = valueAt(props[p], t);
        apply(el, v);
      }
      hooks.forEach(h => h(t));
      return MS;
    },
    play(loop = true) {
      const start = performance.now();
      const frame = now => {
        let t = (now - start) / 1000;
        const D = cfg.duration === 'auto' ? 30 : cfg.duration;
        if (loop) t %= D; else t = Math.min(t, D);
        MS.seek(t);
        if (loop || t < D) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    },
  };

  function valueAt(tr, t) {
    if (t < tr[0].at) return tr[0].from;
    let tw = tr[0];
    for (const x of tr) { if (x.at <= t) tw = x; else break; }
    const p = tw.dur === 0 ? 1 : Math.min((t - tw.at) / tw.dur, 1);
    return tw.from + (tw.to - tw.from) * tw.ease(p);
  }

  function apply(el, v) {
    const g = p => (p in v ? v[p] : DEFAULTS[p]);
    if (TRANSFORM.some(p => p in v)) {
      el.style.transform =
        `translate(${g('x')}px, ${g('y')}px) rotate(${g('rotate')}deg) skewX(${g('skewX')}deg) ` +
        `scale(${g('scale') * g('scaleX')}, ${g('scale') * g('scaleY')})`;
    }
    if ('opacity' in v) el.style.opacity = Math.max(0, Math.min(1, v.opacity));
    if ('blur' in v) el.style.filter = v.blur > 0.05 ? `blur(${v.blur}px)` : 'none';
    if ('clip' in v) el.style.clipPath = `inset(0 ${(1 - v.clip) * 100}% 0 0)`;
    if ('width' in v) el.style.width = v.width + 'px';
    if ('height' in v) el.style.height = v.height + 'px';
    for (const p in v) if (p.startsWith('--')) el.style.setProperty(p, v[p]);
  }

  function escapeHtml(s) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  window.MS = MS;
  // Renderer contract: window.__ms exposes config + cues and the seek function.
  window.__ms = { seek: async t => { MS.seek(t); const p = pending.splice(0); if (p.length) await Promise.all(p); }, config: cfg, cues };
  // Preview: open the HTML directly in a browser and it plays. The renderer adds ?render=1.
  if (/[?&]overlay=1/.test(location.search)) {
    // rendering over real footage: transparent page, hide preview-only elements (the preview <video>)
    document.documentElement.classList.add('ms-overlay');
    const st = document.createElement('style');
    st.textContent = '.ms-overlay,.ms-overlay body,.ms-overlay #stage{background:transparent!important}.ms-overlay .preview-only{display:none!important}';
    document.head.appendChild(st);
  }
  window.addEventListener('load', () => {
    MS.seek(0);
    if (!/[?&]render=1/.test(location.search)) MS.play();
  });
})();
