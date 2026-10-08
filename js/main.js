/* НАХЛЕБНИКИ — загрузка, HUD, параллакс, игра «5 секунд» */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const body = document.body;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = ms => { const s = Math.max(0, ms) / 1000; return (s < 10 ? '0' : '') + s.toFixed(2); };

  /* ---------- ЗАГРУЗКА ---------- */
  const loader = $('#loader'), lt = $('#loaderTime'), verdict = $('#loaderVerdict');
  // пока идёт показ клиенту — загрузка проигрывается при каждом заходе.
  // Чтобы показывать её один раз за визит, верните чтение sessionStorage 'nah-intro'.
  const seen = false;
  const pageLoaded = new Promise(r => (document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true })));
  const maxWait = new Promise(r => setTimeout(r, 4500));
  let finished = false;

  function reveal() {
    if (finished) return; finished = true;
    loader.classList.add('is-out');
    body.classList.remove('is-loading');
    body.classList.add('is-ready');
    try { sessionStorage.setItem('nah-intro', '1'); } catch (e) {}
    setTimeout(() => loader.remove(), 1100);
  }

  function runTimer() {
    const DUR = 1900, start = performance.now();
    // кривая: быстро в начале, медленно у финиша — чтобы 04.9x «тянулось»
    const ease = t => 1 - Math.pow(1 - t, 2.4);
    return new Promise(done => {
      const tick = now => {
        if (finished) return done();
        const t = Math.min(1, (now - start) / DUR);
        lt.textContent = fmt(ease(t) * 5000);
        if (t < 1) requestAnimationFrame(tick); else { lt.textContent = '05.00'; done(); }
      };
      requestAnimationFrame(tick);
    });
  }

  async function intro() {
    if (seen || reduce) { await Promise.race([pageLoaded, maxWait]); lt.textContent = '05.00'; setTimeout(reveal, 250); return; }
    // ждём шрифт таймера, чтобы цифры не мигнули запасным шрифтом (не дольше 700 мс)
    await Promise.race([document.fonts.load('700 100px Oswald'), new Promise(r => setTimeout(r, 700))]);
    await runTimer();
    await Promise.race([pageLoaded, maxWait]);
    if (finished) return;
    loader.classList.add('is-hit');
    verdict.hidden = false;
    setTimeout(reveal, 1250);
  }
  loader.addEventListener('click', reveal);
  addEventListener('keydown', e => { if (!finished && (e.key === 'Escape' || e.key === 'Enter')) reveal(); });
  intro();

  /* ---------- HUD: часы и «открыто/закрыто» (время Смоленска = МСК) ---------- */
  const clock = $('#hudClock'), open = $('#hudOpen');
  function mskNow() {
    const parts = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const h = +parts.find(p => p.type === 'hour').value, m = +parts.find(p => p.type === 'minute').value;
    return { h, m };
  }
  function updClock() {
    const { h, m } = mskNow();
    clock.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    const mins = h * 60 + m, OPEN = 12 * 60, CLOSE = 23 * 60;
    if (mins >= OPEN && mins < CLOSE) {
      const left = CLOSE - mins;
      open.innerHTML = left <= 60 ? `<b>открыто</b> · закроемся через ${left} мин` : '<b>открыто</b> до 23:00';
    } else {
      open.innerHTML = 'закрыто · откроемся в <b>12:00</b>';
    }
    const ct = document.getElementById('ctNow');
    if (ct) { const isOpen = mins >= OPEN && mins < CLOSE; ct.textContent = isOpen ? 'сейчас открыто' : 'сейчас закрыто'; ct.classList.toggle('is-closed', !isOpen); }
  }
  updClock(); setInterval(updClock, 15000);

  /* ---------- HUD: погода в Смоленске (Open-Meteo, без ключа) ---------- */
  const temp = $('#hudTemp'), note = $('#hudTempNote');
  const lines = [
    [-99, -10, 'грейся путином'], [-10, 0, 'день для горячего какао'], [0, 8, 'погода для путина'],
    [8, 16, 'самое время для сэндвича'], [16, 24, 'идеально для пива'], [24, 99, 'нужен холодный лагер']
  ];
  fetch('https://api.open-meteo.com/v1/forecast?latitude=54.7826&longitude=32.0453&current=temperature_2m&timezone=Europe%2FMoscow')
    .then(r => r.json())
    .then(d => {
      const t = Math.round(d.current.temperature_2m);
      temp.innerHTML = `за окном <b>${t > 0 ? '+' : ''}${t}°</b>`;
      note.textContent = (lines.find(([a, b]) => t >= a && t < b) || lines[3])[2];
    })
    .catch(() => { temp.textContent = 'Смоленск'; note.textContent = 'самое время для сэндвича'; });

  /* ---------- HUD: что на кране (сменяется) ---------- */
  const taps = ['Лагер-НАХ', 'Вайс-НАХ'], tapEl = $('#hudTap'); let ti = 0;
  setInterval(() => { ti = (ti + 1) % taps.length; tapEl.textContent = taps[ti]; }, 4000);

  /* ---------- маркерные линии: подчёркивания в меню и обводка «Первый» ---------- */
  document.querySelectorAll('.hud__top a[data-mark]').forEach(a => {
    a.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><path d="M2 6 C 25 2, 55 9, 98 4"/></svg>');
  });
  const mc = $('.marker-circle');
  if (mc) mc.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 200 80" preserveAspectRatio="none" aria-hidden="true"><path d="M150 12 C 110 2, 30 4, 10 30 C -4 52, 40 74, 110 72 C 170 70, 200 50, 190 28 C 182 12, 150 6, 120 8"/></svg>');

  /* ---------- параллакс объектов за мышью ---------- */
  if (!reduce) {
    const items = [...document.querySelectorAll('[data-depth]')];
    let tx = 0, ty = 0, cx = 0, cy = 0;
    addEventListener('mousemove', e => { tx = (e.clientX / innerWidth - .5) * 2; ty = (e.clientY / innerHeight - .5) * 2; });
    (function loop() {
      cx += (tx - cx) * .06; cy += (ty - cy) * .06;
      const sy = Math.min(scrollY, innerHeight);
      items.forEach(el => {
        const d = +el.dataset.depth;
        el.style.transform = `translate3d(${(-cx * 28 * d).toFixed(1)}px, ${(-cy * 22 * d - sy * d * .35).toFixed(1)}px, 0)`;
      });
      requestAnimationFrame(loop);
    })();
  }


  /* ---------- СЭНДВИЧИ: смена по скроллу ---------- */
  const scroller = $('.menu__scroll');
  if (scroller) {
    const slides = [...document.querySelectorAll('.sw')];
    const btns = [...document.querySelectorAll('.menu__index button')];
    const col = $('.roll__col'), count = $('#menuCount'), bar = $('#menuBar');
    const N = slides.length;
    let cur = 0;
    const setActive = i => {
      if (i === cur) return;
      const prev = slides[cur];
      prev.classList.remove('is-active'); prev.classList.add('is-leaving');
      setTimeout(() => prev.classList.remove('is-leaving'), 500);
      slides[i].classList.add('is-active');
      btns.forEach((b, k) => b.toggleAttribute('aria-current', k === i));
      if (btns[i]) btns[i].setAttribute('aria-current', 'true');
      col.style.transform = `translateY(${-i * 1.14}em)`;
      count.textContent = String(i + 1).padStart(2, '0');
      bar.style.width = ((i + 1) / N * 100) + '%';
      cur = i;
    };
    const onScroll = () => {
      const r = scroller.getBoundingClientRect();
      const total = r.height - innerHeight;
      const p = Math.min(.9999, Math.max(0, -r.top / total));
      setActive(Math.floor(p * N));
    };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    onScroll();
    btns.forEach((b, i) => b.addEventListener('click', () => {
      const top = scroller.getBoundingClientRect().top + scrollY;
      const total = scroller.offsetHeight - innerHeight;
      scrollTo({ top: top + total * (i + .5) / N, behavior: reduce ? 'auto' : 'smooth' });
    }));
  }

  /* помехи кинескопа вместо фото, пока его нет */
  document.querySelectorAll('canvas.static').forEach(cv => {
    const ctx = cv.getContext('2d'); cv.width = 160; cv.height = 200;
    const img = ctx.createImageData(cv.width, cv.height);
    (function noise() {
      for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255 | 0; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      ctx.putImageData(img, 0, 0);
      if (!reduce) setTimeout(() => requestAnimationFrame(noise), 70);
    })();
  });

  /* ---------- HUD темнеет над светлыми секциями ---------- */
  const hud = $('#hud'), lights = [...document.querySelectorAll('[data-light]')];
  const overLight = y => lights.some(el => { const r = el.getBoundingClientRect(); return r.top <= y && r.bottom >= y; });
  const updHud = () => {
    hud.classList.toggle('on-light-top', overLight(70));
    hud.classList.toggle('on-light-bot', overLight(innerHeight - 50));
  };
  addEventListener('scroll', updHud, { passive: true }); updHud();


  /* ---------- БАР: налив по клику и фильтр холодильника ---------- */
  document.querySelectorAll('.tap').forEach(t => t.addEventListener('click', () => {
    t.classList.add('is-pouring');
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('is-pouring'), 2600);
  }));
  const fbtns = [...document.querySelectorAll('.filters button')], beers = [...document.querySelectorAll('.beer')];
  fbtns.forEach(b => b.addEventListener('click', () => {
    const f = b.dataset.f;
    fbtns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    beers.forEach(el => el.classList.toggle('is-dim', f !== 'all' && el.dataset.cat !== f));
  }));


  /* ---------- КОМБО: конструктор и чек ---------- */
  const builder = $('#builder');
  if (builder) {
    // цены комбо из приложения (с колой); батат дороже, пиво вместо колы +60 ₽
    const PRICE = { mort: { fries: 730, batat: 820 }, shn: { fries: 710, batat: 780 }, buzh: { fries: 820, batat: 910 } };
    const NAME = { mort: '#2 Мортаделла', shn: '#5 Шницель', buzh: '#1 Буженина', fries: 'Картофель фри', batat: 'Батат фри', cola: 'Кола', beer: 'Пиво 0,4' };
    const PHOTO = { mort: 'assets/sandwich/s2.webp', shn: 'assets/sandwich/s5.webp', buzh: 'assets/sandwich/s1.webp', fries: 'assets/combo/fries.webp', batat: 'assets/combo/batat.webp' };
    const total = $('#rTotal'), totalB = total.parentElement;
    const lines = { sw: $('#rSw'), side: $('#rSide'), drink: $('#rDrink') };
    const swapImg = (img, src) => { if (img.getAttribute('src') === src) return; img.classList.add('is-swap'); setTimeout(() => { img.src = src; img.classList.remove('is-swap'); }, 220); };
    let last = {};
    const upd = () => {
      const f = new FormData(builder), v = { sw: f.get('sw'), side: f.get('side'), drink: f.get('drink') };
      const sum = PRICE[v.sw][v.side] + (v.drink === 'beer' ? 60 : 0);
      if (+total.textContent !== sum) { total.textContent = sum; totalB.classList.remove('bump'); void totalB.offsetWidth; totalB.classList.add('bump'); }
      Object.keys(lines).forEach(k => {
        lines[k].textContent = NAME[v[k]];
        if (last[k] && last[k] !== v[k]) { const li = lines[k].parentElement; li.classList.add('flash'); setTimeout(() => li.classList.remove('flash'), 700); }
      });
      swapImg($('#rpSw'), PHOTO[v.sw]); swapImg($('#rpSide'), PHOTO[v.side]);
      last = v;
    };
    builder.addEventListener('change', upd); upd();
    const d = new Date(Date.now() + 3 * 3600e3), z = n => String(n).padStart(2, '0');
    $('#rDate').textContent = `${z(d.getUTCDate())}.${z(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${z(d.getUTCHours())}:${z(d.getUTCMinutes())}`;
  }

  /* ---------- ОБЕД: живой отсчёт по московскому времени ---------- */
  const lState = $('#lunchState'), lTime = $('#lunchTime'), lSub = $('#lunchSub');
  if (lState) {
    const DAY = 864e5, OPEN = 12 * 3600e3, CLOSE = 16 * 3600e3;
    const dayNames = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу'];
    const hms = ms => { const t = Math.max(0, Math.floor(ms / 1000)); return [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60].map(n => String(n).padStart(2, '0')).join(':'); };
    const tickLunch = () => {
      const now = Date.now() + 3 * 3600e3;               // МСК = UTC+3 круглый год
      const d = new Date(now), wd = d.getUTCDay(), msOfDay = now % DAY, dayStart = now - msOfDay;
      const weekday = wd >= 1 && wd <= 5;
      if (weekday && msOfDay >= OPEN && msOfDay < CLOSE) {
        lState.innerHTML = '<span class="dot"></span>Сейчас обед — успевай';
        lTime.textContent = hms(dayStart + CLOSE - now);
        lSub.textContent = 'столько ещё кофе идёт в подарок к любому сэндвичу';
        return;
      }
      // следующий будний день с 12:00
      let add = weekday && msOfDay < OPEN ? 0 : 1, nd = (wd + add) % 7;
      while (nd === 0 || nd === 6) { add++; nd = (wd + add) % 7; }
      const target = dayStart + add * DAY + OPEN;
      lState.textContent = weekday && msOfDay < OPEN ? 'До обеда' : (weekday ? 'Обед закончился · до следующего' : 'В выходные обеда нет · до понедельника');
      lTime.textContent = hms(target - now);
      lSub.textContent = add === 0 ? 'в 12:00 открываемся — и сразу обед' : (add === 1 ? 'следующий обед — завтра в 12:00' : `следующий обед — ${dayNames[nd]} в 12:00`);
    };
    tickLunch(); setInterval(tickLunch, 1000);
  }


  /* ---------- СОБЫТИЯ: акция «12 карточек» и веер ---------- */
  const fujiLeft = $('#fujiLeft');
  if (fujiLeft) {
    const END = Date.UTC(2026, 9, 31, 21, 0, 0);      // 1 ноября 00:00 МСК = 31.10 21:00 UTC
    const left = END - Date.now(), days = Math.ceil(left / 864e5);
    const unit = n => (n % 10 === 1 && n % 100 !== 11) ? 'день остался' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? 'дня осталось' : 'дней осталось';
    if (left > 0) { fujiLeft.textContent = days; $('#fujiUnit').textContent = unit(days); }
    else { fujiLeft.textContent = '✓'; $('#fujiUnit').textContent = 'акция завершилась'; $('.now__live').lastChild.textContent = 'акция завершилась · следи за новыми'; }
  }
  const fan = $('#fan');
  if (fan) {
    new IntersectionObserver(([e]) => fan.classList.toggle('is-open', e.isIntersecting), { threshold: .5 }).observe(fan);
  }


  /* ---------- ПРИЛОЖЕНИЕ: уровни и калькулятор бонусов ---------- */
  const lvls = [...document.querySelectorAll('.lvl')], range = $('#calcSum');
  if (range) {
    let pct = 7;
    const nf = n => n.toLocaleString('ru-RU');
    const calc = () => {
      const sum = +range.value;
      $('#calcSumOut').textContent = nf(sum);
      $('#calcBack').textContent = '+' + nf(Math.round(sum * pct / 100));
      $('#calcHalf').textContent = 'до ' + nf(Math.floor(sum / 2)) + ' ₽';
      range.style.setProperty('--p', ((sum - range.min) / (range.max - range.min) * 100) + '%');
    };
    lvls.forEach((b, i) => {
      b.addEventListener('click', () => { pct = +b.dataset.pct; lvls.forEach(x => x.setAttribute('aria-checked', String(x === b))); calc(); });
      b.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const n = lvls[(i + (e.key === 'ArrowRight' ? 1 : lvls.length - 1)) % lvls.length]; n.focus(); n.click();
      });
    });
    range.addEventListener('input', calc); calc();
    // свой номер билета для каждого гостя
    let no = null; try { no = localStorage.getItem('nah-pass'); } catch (e) {}
    if (!no) { no = String(Math.floor(Math.random() * 999999)).padStart(6, '0'); try { localStorage.setItem('nah-pass', no); } catch (e) {} }
    $('#passNo').textContent = no;
  }


  /* ---------- КОНТАКТЫ и ПОДВАЛ ---------- */
  document.querySelectorAll('.ct__copy').forEach(btn => btn.addEventListener('click', () => {
    const v = btn.dataset.copy, old = btn.textContent;
    const ok = () => { btn.textContent = 'скопировано'; setTimeout(() => (btn.textContent = old), 1400); };
    try { navigator.clipboard.writeText(v).then(ok, () => (btn.textContent = v)); } catch (e) { btn.textContent = v; }
  }));
  const up = $('#toTop');
  if (up) up.addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));


  /* ---------- мобильное меню ---------- */
  const burger = $('#burger'), mnav = $('#mnav');
  if (burger) {
    const setNav = open => {
      mnav.hidden = !open; burger.setAttribute('aria-expanded', String(open));
      body.classList.toggle('nav-open', open);
      if (open) mnav.querySelector('a').focus();
    };
    burger.addEventListener('click', () => setNav(mnav.hidden));
    mnav.addEventListener('click', e => { if (e.target.closest('a')) setNav(false); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && !mnav.hidden) { setNav(false); burger.focus(); } });
  }


  /* ---------- билеты: ширина корешка по содержимому ---------- */
  const fitStubs = () => document.querySelectorAll('.ticket').forEach(t => {
    const st = t.querySelector('.ticket__stub'); if (!st) return;
    t.style.removeProperty('--stub'); st.style.width = 'max-content';
    const w = Math.ceil(st.getBoundingClientRect().width); st.style.width = '';
    const min = matchMedia('(max-width:760px)').matches ? 104 : 118;
    t.style.setProperty('--stub', Math.max(min, w) + 'px');
  });
  document.fonts.ready.then(fitStubs); addEventListener('resize', fitStubs);

  /* ---------- архив афиш: лента едет сама, её можно тянуть мышью ---------- */
  document.querySelectorAll('.wall__row').forEach((row, ri) => {
    const track = row.querySelector('.wall__track');
    const dir = row.classList.contains('wall__row--rev') ? 1 : -1;
    const auto = 32 * dir;                 // px/с — фоновая скорость
    let x = 0, v = auto, half = 0, drag = false, lastX = 0, lastT = 0, hover = false, pid = null;
    const measure = () => { half = track.scrollWidth / 2; };
    measure(); addEventListener('resize', measure); addEventListener('load', measure);
    const wrap = () => { if (!half) return; while (x <= -half) x += half; while (x > 0) x -= half; };
    let prev = performance.now();
    (function tick(now) {
      const dt = Math.min(.05, (now - prev) / 1000); prev = now;
      if (!drag) {
        const target = hover ? 0 : (reduce ? 0 : auto);
        v += (target - v) * Math.min(1, dt * 2.2);     // инерция плавно возвращается к фоновой скорости
        x += v * dt;
      }
      wrap(); track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
      requestAnimationFrame(tick);
    })(prev);
    row.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hover = true; });
    row.addEventListener('pointerleave', () => { hover = false; });
    row.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      drag = true; pid = e.pointerId; lastX = e.clientX; lastT = performance.now(); v = 0;
      row.setPointerCapture(pid); row.classList.add('is-drag');
    });
    row.addEventListener('pointermove', e => {
      if (!drag) return;
      const now = performance.now(), dx = e.clientX - lastX, dt = Math.max(1, now - lastT) / 1000;
      x += dx; v = v * .6 + (dx / dt) * .4;            // сглаженная скорость для броска
      lastX = e.clientX; lastT = now;
    });
    const end = () => {
      if (!drag) return; drag = false; row.classList.remove('is-drag');
      if (performance.now() - lastT > 80) v = 0;       // отпустили без движения — без броска
      v = Math.max(-2600, Math.min(2600, v));
    };
    row.addEventListener('pointerup', end); row.addEventListener('pointercancel', end);
  });

  /* ---------- карта: метка-логотип привязана к координатам бара ---------- */
  const mapEl = $('#map');
  if (mapEl && window.L) {
    const pos = [54.778397, 32.047997];
    const map = L.map(mapEl, { center: pos, zoom: 16, scrollWheelZoom: false, zoomControl: true, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">участники OpenStreetMap</a>'
    }).addTo(map);
    L.marker(pos, { icon: L.divIcon({ className: 'nah-icon', html: '<span class="nah-pin">НА<span class="x">Х</span></span>', iconSize: [0, 0] }), keyboard: false, title: 'Нахлебники, Дзержинского, 4' }).addTo(map);
    mapEl.addEventListener('click', () => map.scrollWheelZoom.enable(), { once: true });
  }


  /* ---------- крупные заголовки ужимаются, если не влезают в ширину ---------- */
  const fitSel = '.menu__title,.bar__title,.combo__title,.lunch__title,.ev__title,.ar__title,.app__title,.dl__title,.ct__addr,.fridge-title,.ev__h3,.app__h3';
  const fitTitles = () => document.querySelectorAll(fitSel).forEach(el => {
    el.style.fontSize = '';
    if (!matchMedia('(max-width:760px)').matches) return;   // на ПК размеры заданы вёрсткой
    const box = el.parentElement.clientWidth - parseFloat(getComputedStyle(el.parentElement).paddingLeft) - parseFloat(getComputedStyle(el.parentElement).paddingRight);
    let fs = parseFloat(getComputedStyle(el).fontSize), guard = 0;
    const wide = () => Math.max(el.scrollWidth, ...[...el.querySelectorAll('*')].map(c => c.getBoundingClientRect().right - el.getBoundingClientRect().left)) > box + 1;
    while (wide() && guard++ < 40) { fs *= .96; el.style.fontSize = fs + 'px'; }
  });
  document.fonts.ready.then(fitTitles); addEventListener('resize', fitTitles);

  /* появление блоков при скролле */
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: .25 });
  document.querySelectorAll('.combo, .lunch, .app').forEach(el => io.observe(el));

  /* ---------- ИГРА «5 СЕКУНД» ---------- */
  const modal = $('#gameModal'), gt = $('#gameTime'), gb = $('#gameBtn'), gr = $('#gameRes');
  let running = false, t0 = 0, raf = 0, lastFocus = null;
  const openGame = () => { lastFocus = document.activeElement; modal.hidden = false; resetGame(); gb.focus(); };
  const closeGame = () => { stop(true); modal.hidden = true; lastFocus && lastFocus.focus(); };
  function resetGame() { running = false; gt.textContent = '00.00'; gb.textContent = 'Старт'; gr.innerHTML = ''; }
  function frame() { const e = performance.now() - t0; gt.textContent = e < 1000 ? fmt(e) : '??.??'; raf = requestAnimationFrame(frame); }
  function stop(silent) {
    if (!running) return; running = false; cancelAnimationFrame(raf);
    const e = performance.now() - t0, d = Math.abs(e - 5000);
    gt.textContent = fmt(e); gb.textContent = 'Ещё раз';
    if (silent) return;
    gr.innerHTML = d < 5 ? '<b>Ровно 05.00!</b> В зале этот заказ был бы бесплатным.'
      : d < 100 ? `Почти! Мимо на <b>${(d / 1000).toFixed(2)} с</b>. Ещё чуть-чуть.`
      : `Мимо на ${(d / 1000).toFixed(2)} с. Удача — дама капризная.`;
  }
  gb.addEventListener('click', () => { if (running) stop(); else { running = true; gr.innerHTML = ''; t0 = performance.now(); gb.textContent = 'Стоп'; frame(); } });
  $('#gameClose').addEventListener('click', closeGame);
  modal.addEventListener('click', e => { if (e.target === modal) closeGame(); });

  /* ---------- АВТОМАТ «НАХЛЕБНИКАНАТОР» в блоке игры ---------- */
  const arcade = $('#game'), cab = $('#cab'), arBtn = $('#arBtn');
  const arTime = $('#arTime'), arMsg = $('#arMsg'), arTry = $('#arTry'), arMode = $('#arMode');
  const arBest = $('#arBest'), arBestNote = $('#arBestNote'), arHist = $('#arHist'), arShare = $('#arShare'), arShared = $('#arShared');
  let arRun = false, arT0 = 0, arRaf = 0, mode = 'hall', tries = 0, lastRes = null, best = null, hist = [];
  try { const sv = JSON.parse(localStorage.getItem('nah-arcade') || '{}'); best = sv.best ?? null; tries = sv.tries || 0; hist = sv.hist || []; } catch (e) {}
  const save = () => { try { localStorage.setItem('nah-arcade', JSON.stringify({ best, tries, hist: hist.slice(0, 5) })); } catch (e) {} };
  const devTxt = d => (d < 0 ? '−' : '+') + (Math.abs(d) / 1000).toFixed(2) + ' с';
  function renderStats() {
    arTry.textContent = 'попытка ' + tries;
    if (best == null) { arBest.textContent = '—'; arBestNote.textContent = 'ещё не играл'; }
    else { arBest.textContent = fmt(best); const d = best - 5000; arBestNote.textContent = Math.abs(d) < 5 ? 'ровно в цель. Ты готов к залу.' : 'мимо на ' + (Math.abs(d) / 1000).toFixed(2) + ' с'; }
    arHist.innerHTML = hist.length ? hist.map(v => { const d = v - 5000, a = Math.abs(d); return `<li class="${a < 5 ? 'win' : a < 100 ? 'good' : ''}"><b>${fmt(v)}</b><span>${a < 5 ? 'в цель!' : devTxt(d)}</span></li>`; }).join('') : '<li class="empty">пока пусто</li>';
    arShare.disabled = lastRes == null;
  }
  function arFrame() {
    const e = performance.now() - arT0;
    if (mode === 'hall' && e >= 1000) { arTime.textContent = '--.--'; arTime.classList.add('is-hidden'); }
    else arTime.textContent = fmt(e);
    if (e > 15000) { arStop(); return; }   // забыл нажать
    arRaf = requestAnimationFrame(arFrame);
  }
  function arStart() {
    arRun = true; cab.classList.remove('is-win'); arT0 = performance.now();
    arBtn.classList.add('is-run'); arBtn.firstElementChild.textContent = 'стоп'; arBtn.setAttribute('aria-label', 'Стоп');
    arMsg.textContent = 'считай про себя…'; arMsg.classList.remove('blink'); arFrame();
  }
  function arStop() {
    arRun = false; cancelAnimationFrame(arRaf);
    const e = performance.now() - arT0, d = e - 5000, a = Math.abs(d);
    arTime.classList.remove('is-hidden'); arTime.textContent = fmt(e);
    arBtn.classList.remove('is-run'); arBtn.firstElementChild.textContent = 'ещё'; arBtn.setAttribute('aria-label', 'Ещё раз');
    tries++; lastRes = e; hist.unshift(e); hist = hist.slice(0, 5);
    if (best == null || a < Math.abs(best - 5000)) best = e;
    if (a < 5) { cab.classList.add('is-win'); arMsg.textContent = 'РОВНО 05.00! В ЗАЛЕ — БЕСПЛАТНО'; }
    else if (a < 100) arMsg.textContent = 'почти! ' + devTxt(d);
    else if (e > 15000) arMsg.textContent = 'уснул? жми ещё раз';
    else arMsg.textContent = (d < 0 ? 'рано: ' : 'поздно: ') + devTxt(d);
    save(); renderStats();
  }
  const press = () => { arBtn.classList.add('is-down'); setTimeout(() => arBtn.classList.remove('is-down'), 120); arRun ? arStop() : arStart(); };
  arBtn.addEventListener('click', press);
  document.querySelectorAll('.modes button').forEach(b => b.addEventListener('click', () => {
    if (arRun) return;
    mode = b.dataset.mode;
    document.querySelectorAll('.modes button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    arMode.textContent = 'режим: ' + (mode === 'hall' ? 'как в зале' : 'тренировка');
  }));
  arShare.addEventListener('click', () => {
    if (lastRes == null) return;
    const txt = `Я остановил таймер на ${fmt(lastRes)} в «Нахлебниках». Цель — ровно 05.00. Сможешь точнее?`;
    const done = () => { arShared.textContent = 'Скопировано — отправь другу.'; };
    try { navigator.clipboard.writeText(txt).then(done, () => { arShared.textContent = txt; }); } catch (e) { arShared.textContent = txt; }
  });
  renderStats(); arMsg.classList.add('blink');

  const arcadeVisible = () => { const r = arcade.getBoundingClientRect(); return r.top < innerHeight * .6 && r.bottom > innerHeight * .4; };
  const goArcade = e => { e && e.preventDefault(); $('.ar__grid').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); setTimeout(() => arBtn.focus({ preventScroll: true }), 700); };
  $('#hudPlay').addEventListener('click', goArcade);
  $('.hero__hint').addEventListener('click', goArcade);

  addEventListener('keydown', e => {
    if (!finished) return;
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (e.key === 'Escape' && !modal.hidden) closeGame();
    // на сфокусированной кнопке пробел нажимает её сам — не дублируем
    if (e.code === 'Space' && !typing && document.activeElement.tagName !== 'BUTTON') {
      e.preventDefault();
      if (!modal.hidden) gb.click();
      else if (arcadeVisible()) { if (!e.repeat) press(); }
      else openGame();
    }
  });
})();
