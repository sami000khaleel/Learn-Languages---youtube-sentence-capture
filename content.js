(() => {
  const { build, indexAt, targetFor, makeCue, cuesFromJson3 } = globalThis.GST;
  const GS = globalThis.GSTStore;
  const Store = GS.create(chrome.storage.local);
  const I18n = globalThis.GSTI18n;
  const { t, tn } = I18n; // every text the user reads goes through these (their own language)
  const TAG = '[GST]';
  const learn = () => st.settings.learn || 'de'; // the language being learned (the language of the video)

  const st = {
    videoId: null,
    sentences: [],
    trText: new Map(),
    trPending: new Set(),
    visible: true,
    shownIdx: -2,
    status: null, // {key, vars} of a message shown instead of a sentence
    working: false,
    ack: false,
    settings: GS.merge(GS.DEFAULT_SETTINGS, {}),
    settingsReady: false,
    // (the texts of the interface are loaded for uiLang, see applyUi)
    words: [], // my saved words (to mark them on the video)
    wordsVersion: 0,
  };

  const CSS = `
  html.gst-active .ytp-caption-window-container{display:none!important}
  #gst-overlay{position:absolute;left:50%;bottom:14%;transform:translateX(-50%);width:max-content;max-width:80%;
    padding:.5em .9em;background:rgba(0,0,0,.75);border-radius:8px;text-align:center;
    pointer-events:auto;cursor:grab;-webkit-user-select:none;user-select:none;touch-action:none;
    z-index:70;font-family:Roboto,Arial,sans-serif;direction:ltr;unicode-bidi:isolate}
  #gst-overlay.dragging{cursor:grabbing;outline:2px dashed rgba(255,255,255,.7)}
  #gst-menu{position:absolute;display:none;z-index:72;width:300px;max-width:92%;max-height:calc(100% - 16px);overflow:auto;
    box-sizing:border-box;padding:12px 14px;background:rgba(24,24,24,.97);color:#fff;border-radius:14px;
    font:500 15px/1.4 Roboto,Arial,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.6);direction:ltr;text-align:left;cursor:default}
  #gst-menu button,#gst-menu select{font:inherit;color:#fff;cursor:pointer}
  #gst-menu .gst-m-top{display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:16px}
  #gst-menu .gst-m-hint{color:#bbb;font-size:13px;margin:2px 0 4px}
  #gst-menu .gst-m-h{font-weight:700;margin:10px 0 6px}
  #gst-menu .gst-m-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px}
  #gst-menu .gst-m-b{min-width:44px;height:40px;border-radius:10px;border:2px solid #8ab4f8;background:#2b2b2b;font-size:22px;font-weight:700;line-height:1}
  #gst-menu .gst-m-b:hover,#gst-menu .gst-m-act:hover{background:#3d3d3d}
  #gst-menu .gst-m-val{min-width:60px;text-align:center;font-weight:700;font-size:17px}
  #gst-menu .gst-m-sw{width:32px;height:32px;border-radius:50%;border:3px solid #555;padding:0}
  #gst-menu .gst-m-sw[aria-pressed="true"]{border-color:#8ab4f8;box-shadow:0 0 0 2px #fff}
  #gst-menu .gst-m-sel{width:100%;height:40px;border-radius:10px;border:2px solid #8ab4f8;background:#2b2b2b;padding:0 8px}
  #gst-menu .gst-m-act{width:100%;min-height:40px;margin-top:6px;border-radius:10px;border:2px solid #666;background:#2b2b2b;font-weight:600}
  #gst-menu .gst-m-x{width:36px;height:36px;border-radius:50%;border:0;background:#383838;font-size:18px}
  #gst-overlay .gst-de{color:var(--gst-de-color,#fff);font-size:calc(clamp(16px,2.1vw,34px) * var(--gst-de-scale,1));
    font-weight:600;line-height:1.3;text-shadow:0 1px 3px #000}
  #gst-overlay .gst-en{color:var(--gst-tr-color,#ffd54f);font-size:calc(clamp(14px,1.7vw,28px) * var(--gst-tr-scale,1));
    margin-top:.3em;line-height:1.3;text-shadow:0 1px 3px #000}
  #gst-word{position:absolute;display:none;z-index:72;width:300px;max-width:92%;max-height:calc(100% - 16px);overflow:auto;
    box-sizing:border-box;padding:12px 14px;background:rgba(24,24,24,.97);color:#fff;border-radius:14px;
    font:500 15px/1.4 Roboto,Arial,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.6);direction:ltr;text-align:left;cursor:default}
  #gst-word button,#gst-word select{font:inherit;color:#fff;cursor:pointer}
  #gst-word .gst-m-top{display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:16px}
  #gst-word .gst-m-hint{color:#bbb;font-size:13px;margin:2px 0 4px}
  #gst-word .gst-m-h{font-weight:700;margin:10px 0 6px}
  #gst-word .gst-m-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px}
  #gst-word .gst-m-b{min-width:44px;height:40px;border-radius:10px;border:2px solid #8ab4f8;background:#2b2b2b;font-size:22px;font-weight:700;line-height:1}
  #gst-word .gst-m-b:hover,#gst-word .gst-m-act:hover{background:#3d3d3d}
  #gst-word .gst-m-val{min-width:60px;text-align:center;font-weight:700;font-size:17px}
  #gst-word .gst-m-sw{width:32px;height:32px;border-radius:50%;border:3px solid #555;padding:0}
  #gst-word .gst-m-sw[aria-pressed="true"]{border-color:#8ab4f8;box-shadow:0 0 0 2px #fff}
  #gst-word .gst-m-sel{width:100%;height:40px;border-radius:10px;border:2px solid #8ab4f8;background:#2b2b2b;padding:0 8px}
  #gst-word .gst-m-act{width:100%;min-height:40px;margin-top:6px;border-radius:10px;border:2px solid #666;background:#2b2b2b;font-weight:600}
  #gst-word .gst-m-x{width:36px;height:36px;border-radius:50%;border:0;background:#383838;font-size:18px}
  #gst-overlay .gst-w{cursor:pointer;border-radius:4px;padding:0 .08em;margin:0 -.08em}
  #gst-overlay .gst-w:hover{background:rgba(255,255,255,.3)}
  #gst-overlay .gst-w.saved{border-bottom:2px solid #ffd54f}
  #gst-word{z-index:73}
  #gst-menu .gst-m-note,#gst-word .gst-m-note{color:#9ae6b4;font-weight:700;margin:4px 0}
  #gst-word .gst-m-in{width:100%;height:44px;box-sizing:border-box;border-radius:10px;border:2px solid #8ab4f8;background:#2b2b2b;color:#fff;font:inherit;font-size:18px;padding:0 10px}
  #gst-word .gst-m-diff{display:flex;gap:6px;margin-bottom:6px}
  #gst-word .gst-m-d{flex:1;min-height:44px;border-radius:10px;border:2px solid #666;background:#2b2b2b;font-weight:700;white-space:nowrap;padding:0 4px;font-size:15px}
  #gst-word .gst-m-d:hover{background:#3d3d3d}
  #gst-word .gst-m-d[aria-pressed="true"]{border-color:#fff;color:#fff}
  #gst-word .gst-m-d[data-d="1"][aria-pressed="true"]{background:#1b7f3b}
  #gst-word .gst-m-d[data-d="2"][aria-pressed="true"]{background:#a16207}
  #gst-word .gst-m-d[data-d="3"][aria-pressed="true"]{background:#b42318}
  #gst-word .gst-m-save{width:100%;min-height:46px;margin-top:6px;border-radius:10px;border:2px solid #8ab4f8;background:#1557b0;font-size:17px;font-weight:700}
  #gst-word .gst-m-save:hover{background:#1e6ad6}
  #gst-toast{position:absolute;top:8%;left:50%;transform:translateX(-50%);padding:.6em 1.3em;border-radius:12px;
    font:600 clamp(16px,2vw,26px) Roboto,Arial,sans-serif;color:#fff;background:#1b7f3b;z-index:71;
    pointer-events:none;display:none;box-shadow:0 4px 16px rgba(0,0,0,.5)}
  #gst-toast.warn{background:#b45309}
  #gst-overlay .gst-gear{position:absolute;top:-12px;right:-12px;width:28px;height:28px;padding:0;border-radius:50%;
    border:2px solid rgba(255,255,255,.85);background:rgba(24,24,24,.96);color:#fff;font:16px/1 Roboto,Arial,sans-serif;
    cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;touch-action:manipulation}
  #gst-overlay:hover .gst-gear,#gst-overlay:focus-within .gst-gear,
  #gst-overlay .gst-gear:hover,#gst-overlay .gst-gear:focus-visible{opacity:1;pointer-events:auto;background:#1557b0}
  @media (hover:none){#gst-overlay .gst-gear{opacity:.9;pointer-events:auto}}
  #gst-menu[dir="rtl"],#gst-word[dir="rtl"]{direction:rtl;text-align:right}`;

  const FAILED = '\u0001failed'; // marks a translation that did not work
  const okText = (x) => (x && x !== FAILED ? x : '');
  const getVideo = () => document.querySelector('video.html5-main-video') || document.querySelector('video');
  const getVideoId = () => new URLSearchParams(location.search).get('v');
  const videoTitle = () =>
    (document.querySelector('meta[name="title"]')?.content || document.title)
      .replace(/^\(\d+\)\s*/, '')
      .replace(/\s*-\s*YouTube$/, '');

  // ---------- overlay ----------
  let box, deEl, enEl, gear, toastEl, toastTimer;
  const GEAR = 12; // the options button sticks out this far at the top right corner
  const dirOf = (code) => (GS.RTL.includes(code) ? 'rtl' : 'ltr');
  let menu = null; // the right-click settings menu
  let menuRefs = null;
  let drag = null; // a drag of the caption box in progress
  let wp = null; // the 'save this word' panel
  let wpState = null;
  let wpAnchor = null;
  let pausedByUs = false; // we paused the video when the panel opened
  function ensureOverlay() {
    const player = document.querySelector('#movie_player');
    if (!player || !document.head) return false;
    if (!box) {
      const style = document.createElement('style');
      style.textContent = CSS;
      document.head.append(style);
      box = document.createElement('div');
      box.id = 'gst-overlay';
      box.dir = 'ltr';
      deEl = document.createElement('div');
      deEl.className = 'gst-de';
      deEl.dir = 'ltr';
      deEl.lang = learn();
      enEl = document.createElement('div');
      enEl.className = 'gst-en';
      gear = document.createElement('button');
      gear.type = 'button';
      gear.className = 'gst-gear';
      gear.textContent = '⚙';
      box.append(deEl, enEl, gear);
      wireBox();
      applyStyle();
      applyLabels();
    }
    if (box.parentElement !== player) player.append(box);
    return true;
  }

  // titles and labels in the user's language
  function applyLabels() {
    if (!box) return;
    box.title = t('v.boxTip');
    deEl.title = t('v.wordTip');
    gear.title = t('m.title');
    gear.setAttribute('aria-label', t('m.title'));
    if (wp) wp.setAttribute('aria-label', t('w.aria'));
  }

  // caption size / colour / language of the translation line, from the settings
  function applyStyle() {
    if (!box) return;
    const s = st.settings;
    box.style.setProperty('--gst-de-color', s.de.color);
    box.style.setProperty('--gst-de-scale', String((Number(s.de.size) || 100) / 100));
    box.style.setProperty('--gst-tr-color', s.tr.color);
    box.style.setProperty('--gst-tr-scale', String((Number(s.tr.size) || 100) / 100));
    enEl.lang = s.lang;
    enEl.dir = dirOf(s.lang);
    deEl.lang = learn();
    applyPos(s.pos);
  }

  function toast(msg, kind = 'ok') {
    if (!ensureOverlay()) return;
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'gst-toast';
    }
    const player = box.parentElement;
    if (toastEl.parentElement !== player) player.append(toastEl);
    toastEl.textContent = msg;
    toastEl.className = kind === 'warn' ? 'warn' : '';
    toastEl.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.display = 'none'; }, 2200);
  }

  function render() {
    // hide YouTube's own subtitles while ours are showing (also while we switch them on briefly)
    document.documentElement.classList.toggle(
      'gst-active',
      !!st.videoId && st.visible && (st.sentences.length > 0 || st.working)
    );
    if (!ensureOverlay()) return;
    let de = '', en = '';
    if (!st.videoId || !st.visible) { box.style.display = 'none'; return; }
    if (st.status) de = t(st.status.key, st.status.vars);
    else if (st.shownIdx >= 0) {
      de = st.sentences[st.shownIdx].text;
      en = st.trText.get(st.shownIdx) ?? '…';
      if (en === FAILED) en = t('common.translationFailed');
    }
    // a message is in the user's language, a sentence is German
    deEl.dir = dirOf(st.status ? I18n.lang : learn());
    deEl.lang = st.status ? I18n.lang : learn();
    setDe(de, !st.status && st.shownIdx >= 0 && !!de);
    enEl.textContent = en;
    enEl.style.display = en ? '' : 'none';
    box.style.display = de ? '' : 'none';
    fitGear();
  }

  // ---------- move the captions + right-click menu ----------
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const validPos = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;

  // pos = where the CENTRE of the caption box is, as a share of the video size (null = default place)
  function applyPos(pos) {
    if (!box || (drag && drag.moved)) return;
    if (validPos(pos)) {
      box.style.left = `${pos.x * 100}%`;
      box.style.top = `${pos.y * 100}%`;
      box.style.bottom = 'auto';
      box.style.transform = 'translate(-50%,-50%)';
    } else {
      box.style.left = box.style.top = box.style.bottom = box.style.transform = '';
    }
  }

  // a position saved earlier may leave the options button outside the video: move the box in a little
  function fitGear() {
    if (!box || !box.parentElement || box.style.display === 'none' || (drag && drag.moved) || !validPos(st.settings.pos)) return;
    const r = box.getBoundingClientRect();
    const p = box.parentElement.getBoundingClientRect();
    if (!r.width || !p.width) return;
    let dx = 0, dy = 0;
    if (r.top - p.top < GEAR) dy = GEAR - (r.top - p.top);
    if (p.right - r.right < GEAR) dx = -(GEAR - (p.right - r.right));
    if (!dx && !dy) return;
    const x = clamp((r.left + r.width / 2 - p.left + dx) / p.width, 0, 1);
    const y = clamp((r.top + r.height / 2 - p.top + dy) / p.height, 0, 1);
    box.style.left = `${x * 100}%`;
    box.style.top = `${y * 100}%`;
  }

  function wireBox() {
    const stop = (e) => e.stopPropagation(); // keep YouTube from reacting to clicks on our text
    for (const type of ['mousedown', 'click', 'dblclick', 'touchstart']) box.addEventListener(type, stop);

    box.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (e.button !== 0 || !box.parentElement) return;
      if (e.target.closest && e.target.closest('.gst-w, .gst-gear')) return; // a German word or the options button: click it, do not drag
      drag = {
        id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, pos: null,
        rect: box.getBoundingClientRect(), prect: box.parentElement.getBoundingClientRect(),
      };
      try { box.setPointerCapture(e.pointerId); } catch {}
    });

    box.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;
      if (!drag.moved) {
        if (Math.hypot(dx, dy) < 5) return; // a click, not a drag
        drag.moved = true;
        box.classList.add('dragging');
        closeMenu();
      }
      const { rect, prect } = drag;
      const hw = rect.width / 2;
      const hh = rect.height / 2;
      // keep the whole box inside the video
      // (the options button sticks out GEAR px at the top and at the right: keep that inside too)
      const cx = clamp(rect.left + hw + dx - prect.left, Math.min(hw, prect.width / 2), Math.max(prect.width - hw - GEAR, prect.width / 2));
      const cy = clamp(rect.top + hh + dy - prect.top, Math.min(hh + GEAR, prect.height / 2), Math.max(prect.height - hh, prect.height / 2));
      drag.pos = { x: Math.round((cx / prect.width) * 1000) / 1000, y: Math.round((cy / prect.height) * 1000) / 1000 };
      box.style.left = `${drag.pos.x * 100}%`;
      box.style.top = `${drag.pos.y * 100}%`;
      box.style.bottom = 'auto';
      box.style.transform = 'translate(-50%,-50%)';
    });

    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      box.classList.remove('dragging');
      try { box.releasePointerCapture(e.pointerId); } catch {}
      if (e.type === 'pointercancel') return applyPos(st.settings.pos);
      if (d.moved) {
        st.settings.pos = d.pos;
        Store.setSettings({ pos: d.pos }).catch((err) => console.warn(TAG, 'could not save position', err));
      } else {
        // a plain click on the text: pause / play, like a click on the video
        const v = getVideo();
        if (v) { if (v.paused) v.play().catch(() => {}); else v.pause(); }
      }
    };
    // the options button (top right corner)
    gear.addEventListener('mousedown', (e) => e.preventDefault()); // no focus, so space / keys keep working for the video
    gear.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (menu && menu.style.display !== 'none') closeMenu();
      else openMenu(0, 0, gear.getBoundingClientRect());
    });
    deEl.addEventListener('click', (e) => {
      const w = e.target.closest && e.target.closest('.gst-w');
      if (w) { e.stopPropagation(); openWordPanel(w); }
    });
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);

    box.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openMenu(e.clientX, e.clientY);
    });
  }

  const SWATCHES = [
    ['#ffffff', 'white'], ['#ffd54f', 'yellow'], ['#9ae6b4', 'green'],
    ['#7dd3fc', 'blue'], ['#fda4af', 'pink'], ['#fdba74', 'orange'],
  ];
  function el(tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    e.append(...kids.flat().filter((x) => x != null));
    return e;
  }
  const save = (patch) => Store.setSettings(patch).then(applySettings).catch((e) => console.warn(TAG, 'settings', e));

  function buildMenu() {
    menuRefs = {};
    const section = (key, title) => {
      const val = el('span', { class: 'gst-m-val' });
      const nudge = (d) => save({ [key]: { size: clamp((Number(st.settings[key].size) || 100) + d, 60, 250) } });
      const sws = SWATCHES.map(([c, name]) =>
        el('button', { type: 'button', class: 'gst-m-sw', style: `background:${c}`, 'aria-label': t('color.' + name), title: t('color.' + name), 'data-c': c, onclick: () => save({ [key]: { color: c } }) }));
      menuRefs[key] = { val, sws };
      return el('div', { class: 'gst-m-sec' },
        el('div', { class: 'gst-m-h' }, title),
        el('div', { class: 'gst-m-row' },
          el('button', { type: 'button', class: 'gst-m-b', 'aria-label': t('common.smaller'), title: t('common.smaller'), onclick: () => nudge(-10) }, '−'),
          val,
          el('button', { type: 'button', class: 'gst-m-b', 'aria-label': t('common.bigger'), title: t('common.bigger'), onclick: () => nudge(10) }, '+')),
        el('div', { class: 'gst-m-row' }, sws));
    };
    const langOption = ([code, native, english]) => el('option', { value: code }, native === english ? english : `${native} — ${english}`);
    const sel = el('select', { class: 'gst-m-sel', 'aria-label': t('m.translateInto'), onchange: (e) => save({ lang: e.target.value }) }, GS.LANGS.map(langOption));
    menuRefs.sel = sel;
    const selLearn = el('select', { class: 'gst-m-sel', 'aria-label': t('m.learn'), onchange: (e) => save({ learn: e.target.value }) }, GS.LANGS.map(langOption));
    menuRefs.selLearn = selLearn;

    const m = el('div', { id: 'gst-menu', role: 'dialog', 'aria-label': t('m.title'), tabindex: '-1', dir: dirOf(I18n.lang) },
      el('div', { class: 'gst-m-top' }, t('m.title'), el('button', { type: 'button', class: 'gst-m-x', 'aria-label': t('common.close'), title: t('common.close'), onclick: closeMenu }, '✕')),
      el('div', { class: 'gst-m-hint' }, t('m.tip')),
      section('de', t('text.de')),
      section('tr', t('text.tr')),
      el('div', { class: 'gst-m-h' }, t('m.translateInto')),
      sel,
      el('div', { class: 'gst-m-h' }, t('m.learn')),
      selLearn,
      el('button', { type: 'button', class: 'gst-m-act', onclick: () => save({ pos: null }) }, t('m.reset')),
      el('button', { type: 'button', class: 'gst-m-act', onclick: () => chrome.runtime.sendMessage({ type: 'open-library' }).catch(() => {}) }, t('m.library')));
    // nothing in here should reach YouTube's own shortcuts / menus
    for (const type of ['mousedown', 'click', 'dblclick', 'contextmenu', 'touchstart']) m.addEventListener(type, (e) => e.stopPropagation());
    m.addEventListener('keydown', (e) => e.stopPropagation());
    return m;
  }

  function refreshMenu() {
    if (!menu || !menuRefs) return;
    for (const key of ['de', 'tr']) {
      menuRefs[key].val.textContent = `${st.settings[key].size}%`;
      for (const b of menuRefs[key].sws) {
        b.setAttribute('aria-pressed', String(b.dataset.c.toLowerCase() === String(st.settings[key].color).toLowerCase()));
      }
    }
    menuRefs.sel.value = st.settings.lang;
    menuRefs.selLearn.value = learn();
    // the two languages must differ
    for (const o of menuRefs.sel.options) o.disabled = o.value === learn();
    for (const o of menuRefs.selLearn.options) o.disabled = o.value === st.settings.lang;
  }

  // opened by a right-click (at the mouse) or by the options button (anchor = the button's rectangle)
  function openMenu(clientX, clientY, anchor) {
    if (!ensureOverlay()) return;
    closeWordPanel(false);
    if (!menu) menu = buildMenu();
    const player = box.parentElement;
    if (menu.parentElement !== player) player.append(menu);
    menu.style.display = 'block';
    refreshMenu();
    const pr = player.getBoundingClientRect();
    let left, top;
    if (anchor) {
      left = anchor.right - pr.left - menu.offsetWidth; // its right edge lines up with the button
      top = anchor.bottom - pr.top + 8; // below the button ...
      if (top + menu.offsetHeight > pr.height - 8) top = anchor.top - pr.top - menu.offsetHeight - 8; // ... or above it
      if (top < 8) {
        // neither fits (small player): put it beside the button, so the button stays reachable to close it again
        top = 8;
        left = anchor.left - pr.left - menu.offsetWidth - 8;
        if (left < 8) left = anchor.right - pr.left + 8;
      }
    } else {
      left = clientX - pr.left + 8;
      top = clientY - pr.top + 8;
    }
    menu.style.left = `${clamp(left, 8, Math.max(8, pr.width - menu.offsetWidth - 8))}px`;
    menu.style.top = `${clamp(top, 8, Math.max(8, pr.height - menu.offsetHeight - 8))}px`;
  }
  // the interface language changed: build the menu again (keeping it open and where it was)
  function rebuildMenu() {
    if (!menu) return;
    const open = menu.style.display !== 'none';
    const { left, top } = menu.style;
    const parent = menu.parentElement;
    menu.remove();
    menu = null;
    menuRefs = null;
    if (open && parent) {
      menu = buildMenu();
      parent.append(menu);
      menu.style.display = 'block';
      menu.style.left = left;
      menu.style.top = top;
      refreshMenu();
    }
  }
  function closeMenu() {
    if (menu) menu.style.display = 'none';
  }
  // a click anywhere outside the menu closes it
  document.addEventListener('pointerdown', (e) => {
    if (menu && menu.style.display !== 'none' && !menu.contains(e.target) && !(e.target.closest && e.target.closest('.gst-gear'))) closeMenu();
    if (wp && wp.style.display !== 'none' && !wp.contains(e.target) && !(e.target.closest && e.target.closest('.gst-w'))) closeWordPanel(false);
  }, true);

  // ---------- click a German word: add it to my words ----------
  // a language's name in that language
  const langName = (code) => (GS.LANGS.find((l) => l[0] === code) || [code, code, code])[1];
  const findWord = (w) => st.words.find((x) => x.lang === st.settings.lang && (x.learn || 'de') === learn() && GS.norm(x.word) === GS.norm(w));

  // the German line: every word is clickable (only while a real sentence is showing)
  function setDe(text, live) {
    const key = `${live ? 1 : 0}|${st.wordsVersion}|${st.settings.lang}|${learn()}|${text}`;
    if (deEl._key === key) return;
    deEl._key = key;
    if (!live) { deEl.textContent = text; return; }
    // every word is its own element (also for languages written without spaces)
    deEl.replaceChildren(
      ...GS.tokens(text, learn()).map((tk) => {
        if (!tk.w) return document.createTextNode(tk.t);
        const w = document.createElement('span');
        w.className = 'gst-w' + (findWord(tk.t) ? ' saved' : '');
        w.textContent = tk.t;
        return w;
      })
    );
  }

  function placeNear(pop, anchor) {
    const player = pop.parentElement;
    if (!player || !anchor) return;
    const pr = player.getBoundingClientRect();
    const mw = pop.offsetWidth;
    const mh = pop.offsetHeight;
    const left = clamp(anchor.left + anchor.width / 2 - pr.left - mw / 2, 8, Math.max(8, pr.width - mw - 8));
    let top = anchor.top - pr.top - mh - 10; // above the word if there is room
    if (top < 8) top = anchor.bottom - pr.top + 10;
    top = clamp(top, 8, Math.max(8, pr.height - mh - 8));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  function openWordPanel(wordEl) {
    const raw = wordEl.textContent.replace(/^[-'’]+|[-'’]+$/g, '');
    const s = st.sentences[st.shownIdx];
    if (!raw || !s || !ensureOverlay()) return;
    closeMenu();
    const v = getVideo();
    if (v && !v.paused) { v.pause(); pausedByUs = true; } // the sentence would move on while you read
    if (!wp) {
      wp = el('div', { id: 'gst-word', role: 'dialog', 'aria-label': t('w.aria'), tabindex: '-1' });
      for (const type of ['mousedown', 'click', 'dblclick', 'contextmenu', 'touchstart']) wp.addEventListener(type, (e) => e.stopPropagation());
      wp.addEventListener('keydown', (e) => e.stopPropagation()); // typing must not trigger YouTube shortcuts
    }
    const player = box.parentElement;
    if (wp.parentElement !== player) player.append(wp);
    const existing = findWord(raw);
    const me = (wpState = {
      word: raw, sentence: s, idx: st.shownIdx, existing,
      loading: !existing, error: false,
      translation: existing ? existing.translation : '',
      difficulty: existing ? existing.difficulty : 2,
    });
    wpAnchor = wordEl.getBoundingClientRect();
    wp.style.display = 'block';
    renderWordPanel();
    if (!existing) {
      translate(raw, st.settings.lang)
        .then((text) => { me.translation = text; me.error = !text; })
        .catch(() => { me.error = true; })
        .finally(() => { me.loading = false; if (wpState === me) renderWordPanel(); });
    }
  }

  function renderWordPanel() {
    const w = wpState;
    if (!wp || !w) return;
    const lang = st.settings.lang;
    const kids = [
      el('div', { class: 'gst-m-top' },
        el('span', null, ...tn('word.to', { word: el('b', { lang: learn(), dir: dirOf(learn()) }, w.word), lang: langName(lang) })),
        el('button', { type: 'button', class: 'gst-m-x', 'aria-label': t('common.close'), title: t('common.close'), onclick: () => closeWordPanel(true) }, '✕')),
    ];
    if (w.existing) kids.push(el('div', { class: 'gst-m-note' }, t('w.already')));
    if (w.loading) {
      kids.push(el('div', { class: 'gst-m-hint' }, t('common.translating')));
    } else {
      if (w.error) kids.push(el('div', { class: 'gst-m-hint' }, t('w.failed')));
      kids.push(el('input', {
        type: 'text', class: 'gst-m-in', value: w.translation, 'aria-label': t('common.meaning'), placeholder: t('common.meaning'),
        dir: GS.RTL.includes(lang) ? 'rtl' : 'ltr',
        oninput: (e) => { w.translation = e.target.value; },
        onkeydown: (e) => { if (e.key === 'Enter') saveWord(); },
      }));
    }
    kids.push(
      el('div', { class: 'gst-m-h' }, t('common.howHard')),
      el('div', { class: 'gst-m-diff' },
        [[1, t('diff.easy')], [2, t('diff.medium')], [3, t('diff.hard')]].map(([d, label]) =>
          el('button', { type: 'button', class: 'gst-m-d', 'data-d': String(d), 'aria-pressed': String(w.difficulty === d), onclick: () => { w.difficulty = d; renderWordPanel(); } }, label))),
      el('button', { type: 'button', class: 'gst-m-save', onclick: saveWord }, w.existing ? t('w.update') : t('word.save')),
      el('button', { type: 'button', class: 'gst-m-act', onclick: () => closeWordPanel(true) }, t('common.cancel'))
    );
    wp.dir = dirOf(I18n.lang);
    wp.replaceChildren(...kids);
    placeNear(wp, wpAnchor);
  }

  function closeWordPanel(resume) {
    if (wp) wp.style.display = 'none';
    wpState = null;
    if (resume && pausedByUs) {
      const v = getVideo();
      if (v) v.play().catch(() => {});
    }
    pausedByUs = false;
  }

  async function saveWord() {
    const w = wpState;
    if (!w) return;
    const meaning = (w.translation || '').trim();
    if (!meaning) { toast(t('word.typeFirst'), 'warn'); return; }
    const lang = st.settings.lang;
    try {
      if (w.existing) {
        await Store.updateWord(w.existing.id, { translation: meaning, difficulty: w.difficulty });
        toast(t('v.wordUpdated'));
      } else {
        const res = await Store.addWord({
          word: w.word, translation: meaning, lang, learn: learn(), difficulty: w.difficulty,
          sentenceDe: w.sentence.text, sentenceTr: okText(st.trText.get(w.idx)),
          videoTitle: videoTitle(), url: `https://www.youtube.com/watch?v=${st.videoId}&t=${Math.max(0, Math.floor(w.sentence.start - 0.3))}s`,
        });
        toast(res.added ? t('word.saved') : t('v.wordDup'), res.added ? 'ok' : 'warn');
      }
      st.words = await Store.listWords();
      st.wordsVersion++;
      render();
    } catch (e) {
      console.warn(TAG, 'save word failed', e);
      toast(t('v.saveFailed'), 'warn');
    }
    closeWordPanel(true);
  }

  // ---------- settings ----------
  function applySettings(next) {
    const prevLang = st.settings.lang;
    const prevLearn = learn();
    st.settings = GS.merge(GS.DEFAULT_SETTINGS, next || {});
    st.settingsReady = true;
    I18n.setLearn(learn());
    if (learn() !== prevLearn) { closeWordPanel(false); rebuildMenu(); } // the menu and panel name the language
    applyStyle();
    refreshMenu();
    if (st.settings.lang !== prevLang) {
      // other language: forget the old translations and fetch them again
      st.trText.clear();
      st.trPending.clear();
      st.shownIdx = -2;
    }
    ensureLoad(); // a different language to learn: load the captions of that language
    tick();
    render();
    applyUi();
  }

  // the texts of the interface (menu, panel, messages) in the user's language
  let uiLang = 'en';
  let uiRun = 0;
  async function applyUi() {
    const lang = st.settings.lang;
    if (lang === uiLang) return;
    const run = ++uiRun;
    const ok = await I18n.load(lang);
    if (run !== uiRun) return; // the language changed again meanwhile
    uiLang = lang;
    if (wpState) closeWordPanel(true); // its translation was for the old language
    applyLabels();
    rebuildMenu();
    render();
    if (!ok && lang !== 'en') toast(t('i18n.failed'), 'warn');
  }
  Store.getSettings().then(applySettings).catch(() => { st.settingsReady = true; ensureLoad(); });
  Store.listWords().then((w) => { st.words = w; st.wordsVersion++; render(); }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) applySettings(changes.settings.newValue);
    if (area === 'local' && changes.words) { st.words = changes.words.newValue || []; st.wordsVersion++; render(); }
  });

  // ---------- translation ----------
  const translate = (text, lang) =>
    chrome.runtime.sendMessage({ type: 'translate', text, sl: learn(), tl: lang }).then((r) => r?.text || '');

  function requestTranslation(i) {
    if (!st.settingsReady || i < 0 || i >= st.sentences.length || st.trText.has(i) || st.trPending.has(i)) return;
    st.trPending.add(i);
    const vid = st.videoId;
    const lang = st.settings.lang;
    const still = () => vid === st.videoId && lang === st.settings.lang;
    translate(st.sentences[i].text, lang)
      .then((text) => { if (still()) st.trText.set(i, text || FAILED); })
      .catch(() => { if (still()) st.trText.set(i, FAILED); })
      .finally(() => { if (still()) { st.trPending.delete(i); if (i === st.shownIdx) render(); } });
  }

  // ---------- saving the current sentence (key W) ----------
  async function saveCurrent() {
    const idx = st.shownIdx;
    const s = st.sentences[idx];
    if (idx < 0 || !s) return toast(t('v.noSentence'), 'warn');
    const lang = st.settings.lang;
    let tr = okText(st.trText.get(idx));
    if (!tr) {
      try { tr = await translate(s.text, lang); } catch { tr = ''; }
    }
    const vid = st.videoId;
    try {
      const res = await Store.addSentence({
        text: s.text,
        end: s.end,
        translation: tr || '',
        lang,
        learn: learn(),
        videoId: vid,
        videoTitle: videoTitle(),
        time: s.start,
        url: `https://www.youtube.com/watch?v=${vid}&t=${Math.max(0, Math.floor(s.start - 0.3))}s`,
      });
      toast(res.added ? t('v.sentenceSaved') : t('v.sentenceDup'), res.added ? 'ok' : 'warn');
    } catch (e) {
      console.warn(TAG, 'save failed', e);
      toast(t('v.saveFailed'), 'warn');
    }
  }

  // ---------- parsing the player's caption response ----------
  const unescapeHtml = (s) => {
    const ta = document.createElement('textarea');
    ta.innerHTML = s;
    return ta.value;
  };

  function parseCues(body) {
    body = body.trim();
    try {
      if (body[0] === '{') return cuesFromJson3(JSON.parse(body)); // json3, with word timing for auto-captions
      const doc = new DOMParser().parseFromString(body, 'text/xml');
      if (doc.querySelector('parsererror')) return [];
      const ps = [...doc.getElementsByTagName('p')]; // srv3 format
      if (ps.length) {
        return ps
          .map((p) => {
            const ss = [...p.getElementsByTagName('s')];
            const segs = ss.length
              ? ss.map((s) => ({ txt: s.textContent, off: s.hasAttribute('t') ? Number(s.getAttribute('t')) : undefined }))
              : [{ txt: p.textContent }];
            return makeCue(Number(p.getAttribute('t')) || 0, Number(p.getAttribute('d')) || 0, segs);
          })
          .filter((c) => c.text);
      }
      return [...doc.getElementsByTagName('text')] // classic format
        .map((x) => {
          const s = parseFloat(x.getAttribute('start')) || 0;
          const d = parseFloat(x.getAttribute('dur')) || 0;
          return makeCue(s * 1000, d * 1000, [{ txt: unescapeHtml(x.textContent) }]);
        })
        .filter((c) => c.text);
    } catch (e) {
      console.warn(TAG, 'could not parse captions', e);
      return [];
    }
  }

  function onCaptionBody({ url, body }) {
    let u;
    try { u = new URL(url, location.origin); } catch { return; }
    if (!GS.sameLang(u.searchParams.get('lang'), learn()) || u.searchParams.get('tlang')) return;
    const vid = u.searchParams.get('v');
    if (vid && vid !== st.videoId) return;
    if (st.sentences.length) return;
    const cues = parseCues(body);
    console.log(TAG, 'parsed', cues.length, 'caption cues');
    if (!cues.length) return;
    st.sentences = build(cues, learn());
    st.status = null;
    st.working = false;
    st.shownIdx = -2;
    tick();
    render();
  }

  function onResult(d) {
    if (d.stage === 'started') { st.ack = true; return; }
    if (d.ok !== false || st.sentences.length) return;
    st.working = false;
    st.status = d.reason === 'no-language' ? { key: 'v.noLearn' } : { key: 'v.failed', vars: { reason: d.reason } };
    console.warn(TAG, 'failed:', d.reason);
    render();
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (d?.source === 'gst-timedtext-body') onCaptionBody(d);
    else if (d?.source === 'gst-captions-result') onResult(d);
  });

  // load the captions once per video and language (and only after the settings are known: they say which language)
  let loadKey = null;
  function ensureLoad() {
    if (!st.videoId || !st.settingsReady) return;
    const key = `${st.videoId}|${learn()}`;
    if (key === loadKey) return;
    loadKey = key;
    st.sentences = [];
    st.trText.clear();
    st.trPending.clear();
    st.shownIdx = -2;
    startLoad();
  }

  // ask the page script to switch the subtitles of the language being learned on; it retries until the player delivers
  function startLoad() {
    st.working = true;
    st.ack = false;
    st.status = { key: 'v.loading' };
    render();
    const lang = learn();
    const ask = () => window.postMessage({ source: 'gst-enable-captions', lang }, '*');
    ask();
    // in case the page script was not listening yet
    setTimeout(() => { if (!st.ack && !st.sentences.length) ask(); }, 1500);
    setTimeout(() => { if (!st.ack && !st.sentences.length) ask(); }, 4000);
  }

  // ---------- playback sync ----------
  function tick() {
    const v = getVideo();
    if (!v || !st.sentences.length) return;
    const idx = indexAt(st.sentences, v.currentTime);
    if (idx !== st.shownIdx) {
      st.shownIdx = idx;
      for (let k = 0; k < 5; k++) requestTranslation(idx + k);
      render();
    }
  }
  setInterval(() => { tick(); fitGear(); }, 200);

  // ---------- keys ----------
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && ((menu && menu.style.display !== 'none') || (wp && wp.style.display !== 'none'))) {
        closeMenu();
        closeWordPanel(true);
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || !st.videoId) return;
      const tg = e.target;
      if (tg && (tg.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(tg.tagName))) return;
      const key = e.key.toLowerCase();
      if (!['c', 's', 'a', 'd', 'w'].includes(key)) return;
      e.preventDefault();
      e.stopImmediatePropagation(); // stops YouTube's own "c" (captions) shortcut
      if (key === 'c') { st.visible = !st.visible; render(); return; }
      if (key === 'w') { saveCurrent(); return; }
      const v = getVideo();
      if (!v || !st.sentences.length) return;
      const target = targetFor(key, st.sentences, v.currentTime);
      if (target !== null) { v.currentTime = target; tick(); }
    },
    true
  );

  // ---------- navigation ----------
  function init() {
    const id = getVideoId();
    if (id === st.videoId) return;
    window.postMessage({ source: 'gst-cancel-captions' }, '*');
    closeWordPanel(false);
    closeMenu();
    st.videoId = id;
    st.sentences = [];
    st.trText.clear();
    st.trPending.clear();
    st.shownIdx = -2;
    st.status = null;
    st.working = false;
    render();
    loadKey = null;
    ensureLoad();
  }
  window.addEventListener('yt-navigate-finish', init);
  init();
})();
