// Back office de Cervecería Backhoff: pedidos en vivo, catálogo y clientes.
import * as api from '../shop/api.js';
import {subscribe, getProducts, read, write} from '../shop/store.js';
import {beers, packs, packQuote, STATUS, nextStatus, isOpenOrder, bottlesLabel, PRICE_RANGE} from '../shop/data.js';
import {money, esc, plural, displayPhone, formatDateTime, formatDay, formatWeekday, formatLongDay, timeAgo, startOfDay, sameDay} from '../shop/util.js';
import {svg, icons, toast, thumb, itemsList, totalsList, deliveryText, cardLabel, makeDialog, openDialog, closeDialog, $, $$} from '../shop/ui.js';

const app = $('#app');
const adminIcons = {
  resumen: svg('<rect x="3.5" y="3.5" width="7" height="8" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.5"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.5"/><rect x="3.5" y="14.5" width="7" height="6" rx="1.5"/>'),
  pedidos: svg('<path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z"/><path d="M9 8.5h6M9 12h6"/>'),
  productos: svg('<path d="M10 2.5h4v4l1.5 3v11h-7v-11L10 6.5z"/><path d="M8.5 13h7"/>'),
  clientes: svg('<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5a6 6 0 0 1 12 0"/><path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14a6 6 0 0 1 3.5 5.5"/>'),
  sound: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  mute: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>'),
  external: svg('<path d="M14 4.5h5.5V10M19.5 4.5 11 13"/><path d="M18 14v5.5H4.5V6H10"/>'),
  reset: svg('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4v5h5"/>'),
  logout: svg('<path d="M14 4.5h4.5v15H14"/><path d="M10 8l-4 4 4 4M6 12h9"/>'),
  more: svg('<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>'),
  print: svg('<path d="M7 8.5V3.5h10v5"/><rect x="3.5" y="8.5" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/>'),
  call: svg('<path d="M5 4h3.5l1.5 4.5-2 1.5a11 11 0 0 0 6 6l1.5-2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>')
};

const VIEWS = {
  resumen: 'Resumen',
  pedidos: 'Pedidos',
  productos: 'Productos',
  clientes: 'Clientes'
};
const FILTERS = [
  ['abiertos', 'Por atender'], ['todos', 'Todos'], ['nuevo', 'Nuevos'], ['preparando', 'En preparación'],
  ['en_camino', 'En camino'], ['listo', 'Listos para recoger'], ['entregado', 'Entregados'], ['cancelado', 'Cancelados']
];
const OPEN_LABELS = {
  nuevo: n => n === 1 ? 'nuevo' : 'nuevos',
  preparando: () => 'en preparación',
  en_camino: () => 'en camino',
  listo: n => n === 1 ? 'listo para recoger' : 'listos para recoger'
};
const NEXT_LABEL = {
  preparando: 'Empezar a preparar',
  en_camino: 'Salió a entrega',
  listo: 'Listo para recoger',
  entregado: 'Marcar como entregado'
};

const state = {view: 'resumen', filter: 'abiertos', search: '', customerSearch: '', orders: [], customers: [], fresh: new Set(), known: null, openId: null};
let sound = read('admin.sound', true);
let orderDialog;
let confirmDialog;
let clock = 0;

// --- Sonido de alerta (Web Audio, sin archivos) ------------------------------

let audio = null;
const unlockAudio = () => {
  try { audio ??= new AudioContext(); if (audio.state === 'suspended') audio.resume(); } catch { /* sin audio */ }
};
addEventListener('pointerdown', unlockAudio, {once: true});
addEventListener('keydown', unlockAudio, {once: true});

function chime() {
  if (!sound) return;
  try {
    unlockAudio();
    const start = audio.currentTime;
    [[784, 0], [1175, .14], [1568, .28]].forEach(([frequency, delay]) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, start + delay);
      gain.gain.exponentialRampToValueAtTime(.22, start + delay + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, start + delay + .5);
      osc.connect(gain).connect(audio.destination);
      osc.start(start + delay);
      osc.stop(start + delay + .55);
    });
  } catch { /* el navegador bloqueó el audio */ }
}

// --- Acceso ------------------------------------------------------------------

function renderLogin() {
  clearInterval(clock);
  document.title = 'Back office · Delicia';
  app.innerHTML = `<main class="admin-login">
    <form class="login-card" novalidate>
      <a class="shop-wordmark" href="/">delicia<span>BACK OFFICE</span></a>
      <h1>Pedidos de la tienda en línea</h1>
      <p>Acceso para el equipo de Cervecería Backhoff. Aquí llegan las compras en cuanto se pagan.</p>
      <div class="field">
        <label class="field-label" for="pin">PIN de acceso</label>
        <input class="input pin-input" id="pin" name="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="4" aria-describedby="pin-hint pin-error">
        <p class="field-hint" id="pin-hint">Demostración: el PIN es <strong>2020</strong>, el año en que nació Delicia.</p>
        <p class="field-error" id="pin-error" hidden></p>
      </div>
      <button class="btn btn-primary btn-block" type="submit">Entrar</button>
      <a class="login-store" href="/tienda/">Ir a la tienda ${icons.arrow}</a>
    </form>
  </main>`;
  const form = app.querySelector('form');
  form.elements.pin.focus();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('[type=submit]');
    button.disabled = true;
    try {
      await api.adminLogin(form.elements.pin.value);  // la suscripción arranca el panel
      unlockAudio();
    } catch (error) {
      const message = form.querySelector('#pin-error');
      message.hidden = false;
      message.textContent = error.message;
      form.elements.pin.setAttribute('aria-invalid', 'true');
      form.elements.pin.select();
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  });
}

// --- Estructura ------------------------------------------------------------------

function renderShell() {
  app.innerHTML = `<div class="admin-shell">
    <aside class="admin-side">
      <a class="shop-wordmark" href="#resumen">delicia<span>BACK OFFICE</span></a>
      <nav class="admin-nav" aria-label="Secciones">
        ${Object.entries(VIEWS).map(([id, label]) => `<a href="#${id}" data-view="${id}">${adminIcons[id]}<span>${label}</span>${id === 'pedidos' ? '<span class="nav-badge" data-new-badge hidden></span>' : ''}</a>`).join('')}
      </nav>
      <p class="live"><span class="live-dot" aria-hidden="true"></span>En vivo</p>
      <button type="button" class="icon-button menu-button" aria-expanded="false" aria-controls="admin-menu" aria-label="Más opciones">${adminIcons.more}</button>
      <div class="admin-menu" id="admin-menu">
        <button type="button" class="side-action" data-sound></button>
        <a class="side-action" href="/tienda/" target="_blank" rel="noopener">${adminIcons.external}<span>Abrir la tienda</span></a>
        <button type="button" class="side-action" data-reset>${adminIcons.reset}<span>Restablecer demo</span></button>
        <button type="button" class="side-action" data-logout>${adminIcons.logout}<span>Cerrar sesión</span></button>
      </div>
    </aside>
    <main class="admin-main" id="main" tabindex="-1">
      <header class="admin-top">
        <div><p class="kicker" data-today></p><h1 data-title></h1></div>
        <p class="admin-note">Datos de esta demostración guardados en este navegador</p>
      </header>
      <div data-root></div>
    </main>
  </div>`;
  renderSoundButton();
  const menuButton = $('.menu-button');
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    $('.admin-side').classList.toggle('is-menu-open', open);
  });
  $('.admin-menu').addEventListener('click', event => {
    if (event.target.closest('[data-sound]')) {
      sound = !sound;
      write('admin.sound', sound);
      renderSoundButton();
      if (sound) chime();
    }
    if (event.target.closest('[data-reset]')) confirmReset();
    if (event.target.closest('[data-logout]')) api.adminLogout();
    menuButton.setAttribute('aria-expanded', 'false');
    $('.admin-side').classList.remove('is-menu-open');
  });
}

function renderSoundButton() {
  const button = $('[data-sound]');
  if (!button) return;
  button.setAttribute('aria-pressed', String(sound));
  button.innerHTML = `${sound ? adminIcons.sound : adminIcons.mute}<span>Sonido de alertas: ${sound ? 'activado' : 'apagado'}</span>`;
}

function route() {
  const [view, id] = decodeURIComponent(location.hash.slice(1)).split('/');
  state.view = VIEWS[view] ? view : 'resumen';
  for (const link of $$('[data-view]')) {
    if (link.dataset.view === state.view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  $('[data-title]').textContent = VIEWS[state.view];
  renderView({keepScroll: false});
  if (state.view === 'pedidos' && id) openOrder(id, false);
}

async function load() {
  [state.orders, state.customers] = await Promise.all([api.listOrders(), api.listCustomers()]);
}

async function refresh() {
  if (!api.isAdmin()) return;
  await load();
  detectNewOrders();
  renderView();
  renderBadges();
  if (orderDialog?.open && state.openId) renderOrderDetail(state.openId);
}

// Vuelve a pintar la vista sin perder lo que se está escribiendo (un precio,
// una búsqueda) cuando llega un pedido o pasa el refresco de cada minuto.
function renderView({keepScroll = true} = {}) {
  const root = $('[data-root]');
  if (!root) return;
  $('[data-today]').textContent = formatLongDay(new Date());
  const active = root.contains(document.activeElement) && document.activeElement.id ? document.activeElement : null;
  const typing = active?.matches('input') ? {id: active.id, value: active.value, start: active.selectionStart, end: active.selectionEnd} : null;
  const scroll = keepScroll ? scrollY : 0;
  ({resumen: renderDashboard, pedidos: renderOrders, productos: renderProducts, clientes: renderCustomers})[state.view](root);
  scrollTo({top: scroll});
  const input = typing && document.getElementById(typing.id);
  if (input) {
    input.value = typing.value;
    input.focus({preventScroll: true});
    try { input.setSelectionRange(typing.start, typing.end); } catch { /* type=number */ }
  }
}

function renderBadges() {
  const fresh = state.orders.filter(order => order.status === 'nuevo').length;
  const badge = $('[data-new-badge]');
  if (badge) { badge.hidden = !fresh; badge.textContent = fresh; }
  document.title = fresh ? `(${fresh}) Back office · Delicia` : 'Back office · Delicia';
}

// Un pedido que no conocíamos llega desde otra pestaña: aviso, sonido y resalte.
function detectNewOrders() {
  const ids = new Set(state.orders.map(order => order.id));
  if (state.known) {
    for (const order of state.orders) {
      if (state.known.has(order.id)) continue;
      state.fresh.add(order.id);
      setTimeout(() => { state.fresh.delete(order.id); renderView(); }, 12000);
      chime();
      toast(`Nuevo pedido ${order.id} · ${order.customer.name} · ${money(order.total)}`, {
        tone: 'ok', action: {label: 'Ver pedido', onClick: () => openOrder(order.id)}
      });
    }
  }
  state.known = ids;
}

// --- Resumen ----------------------------------------------------------------------

const sum = (list, pick) => list.reduce((total, item) => total + pick(item), 0);

function metrics(now = new Date()) {
  const paid = state.orders.filter(order => order.status !== 'cancelado');
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const from = startOfDay(now);
  from.setDate(from.getDate() - 6);
  const week = paid.filter(order => new Date(order.createdAt) >= from);
  const today = paid.filter(order => sameDay(order.createdAt, now));
  const days = Array.from({length: 7}, (_, index) => {
    const date = new Date(from);
    date.setDate(from.getDate() + index);
    const list = week.filter(order => sameDay(order.createdAt, date));
    return {date, total: sum(list, order => order.total), orders: list.length};
  });
  const items = week.flatMap(order => order.items);
  return {
    today, week, days,
    todaySales: sum(today, order => order.total),
    yesterdaySales: sum(paid.filter(order => sameDay(order.createdAt, yesterday)), order => order.total),
    open: state.orders.filter(isOpenOrder).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    average: week.length ? sum(week, order => order.total) / week.length : 0,
    byBeer: beers.map(beer => ({beer, value: sum(items.filter(item => item.id === beer.id), item => item.bottles)})).sort((a, b) => b.value - a.value),
    byPack: packs.map(pack => ({pack, value: sum(items.filter(item => item.size === pack.size), item => item.qty)}))
  };
}

function statusCounts(list) {
  const counts = {};
  for (const order of list) counts[order.status] = (counts[order.status] ?? 0) + 1;
  return counts;
}

const pill = order => `<span class="status-pill is-${order.status}">${STATUS[order.status].label}</span>`;

function queueItem(order) {
  const next = nextStatus(order);
  return `<li class="queue-item${state.fresh.has(order.id) ? ' is-fresh' : ''}">
    <button type="button" class="queue-open" data-open-order="${order.id}">
      <span class="queue-who"><strong>${order.id}</strong> · ${esc(order.customer.name)}</span>
      <span class="queue-total">${money(order.total)}</span>
      <span class="queue-meta">${timeAgo(order.createdAt)} · ${order.delivery.method === 'recoger' ? 'Recoger' : esc(order.delivery.city)} · ${bottlesLabel(order.bottles)}</span>
      ${pill(order)}
    </button>
    ${next ? `<button type="button" class="btn btn-ghost queue-next" data-advance="${order.id}:${next}">${NEXT_LABEL[next]}</button>` : ''}
  </li>`;
}

function renderDashboard(root) {
  const data = metrics();
  const counts = statusCounts(data.open);
  const openDetail = Object.entries(OPEN_LABELS).filter(([status]) => counts[status])
    .map(([status, label]) => `${counts[status]} ${label(counts[status])}`).join(' · ');
  const hideHelp = read('admin.helpHidden', false);
  root.innerHTML = `
    ${hideHelp ? '' : `<section class="demo-help" aria-labelledby="help-title">
      <div><h2 id="help-title">Cómo probar la demo</h2>
      <ol>
        <li>Abre la <a href="/tienda/" target="_blank" rel="noopener">tienda</a> en otra pestaña de este mismo navegador.</li>
        <li>Compra: verifica un celular con el código simulado y paga con la tarjeta <strong>4242 4242 4242 4242</strong>.</li>
        <li>Vuelve aquí: el pedido llega al instante con sonido. Cambia su estado y el cliente recibe su aviso por WhatsApp o SMS.</li>
      </ol></div>
      <button type="button" class="icon-button" data-hide-help aria-label="Ocultar instrucciones">${icons.close}</button>
    </section>`}
    <div class="kpis">
      <article class="kpi"><h2 class="kpi-label">Ventas de hoy</h2><p class="kpi-value">${money(data.todaySales)}</p><p class="kpi-sub">Ayer: ${money(data.yesterdaySales)}</p></article>
      <article class="kpi"><h2 class="kpi-label">Pedidos de hoy</h2><p class="kpi-value">${data.today.length}</p><p class="kpi-sub">${bottlesLabel(sum(data.today, order => order.bottles))}</p></article>
      <article class="kpi${data.open.length ? ' is-alert' : ''}"><h2 class="kpi-label">Por atender</h2><p class="kpi-value">${data.open.length}</p><p class="kpi-sub">${openDetail || 'Todo al día'}</p></article>
      <article class="kpi"><h2 class="kpi-label">Ticket promedio · 7 días</h2><p class="kpi-value">${money(Math.round(data.average))}</p><p class="kpi-sub">${plural(data.week.length, 'pedido')} pagados</p></article>
    </div>
    <div class="dash-grid">
      <section class="card queue-card" aria-labelledby="queue-title">
        <header class="card-head"><h2 id="queue-title">Por atender</h2><a href="#pedidos" class="link-button">Ver pedidos</a></header>
        ${data.open.length ? `<p class="card-note">Del más antiguo al más reciente.</p><ul class="queue">${data.open.slice(0, 6).map(queueItem).join('')}</ul>` : `<p class="empty-note">${icons.check} Todo al día: no hay pedidos pendientes.</p>`}
      </section>
      <section class="card chart-card" aria-labelledby="sales-title">
        <header class="card-head"><h2 id="sales-title">Ventas · últimos 7 días</h2><button type="button" class="link-button" data-table-toggle aria-pressed="false">Ver tabla</button></header>
        <figure class="chart" data-sales-chart></figure>
        <table class="chart-table" data-sales-table hidden>
          <thead><tr><th scope="col">Día</th><th scope="col">Pedidos</th><th scope="col">Ventas</th></tr></thead>
          <tbody>${data.days.map(day => `<tr><th scope="row">${formatLongDay(day.date)}</th><td>${day.orders}</td><td>${money(day.total)}</td></tr>`).join('')}</tbody>
        </table>
      </section>
      <section class="card" aria-labelledby="beers-title">
        <header class="card-head"><h2 id="beers-title">Más vendidas · botellas, 7 días</h2></header>
        ${barList(data.byBeer.map(({beer, value}) => ({label: `${thumb(beer, 'thumb bar-thumb')}<span>${esc(beer.name)}</span>`, value, text: bottlesLabel(value)})))}
      </section>
      <section class="card" aria-labelledby="packs-title">
        <header class="card-head"><h2 id="packs-title">Presentaciones vendidas · 7 días</h2></header>
        ${barList(data.byPack.map(({pack, value}) => ({label: `<span>${pack.name}</span><small>${bottlesLabel(pack.size)}</small>`, value, text: `${value} ${value === 1 ? 'vendido' : 'vendidos'}`})))}
      </section>
    </div>`;
  root.querySelector('[data-hide-help]')?.addEventListener('click', () => { write('admin.helpHidden', true); renderView(); });
  root.querySelector('[data-table-toggle]').addEventListener('click', event => {
    const showTable = event.currentTarget.getAttribute('aria-pressed') !== 'true';
    event.currentTarget.setAttribute('aria-pressed', String(showTable));
    event.currentTarget.textContent = showTable ? 'Ver gráfica' : 'Ver tabla';
    root.querySelector('[data-sales-table]').hidden = !showTable;
    root.querySelector('[data-sales-chart]').hidden = showTable;
  });
  drawSales(root.querySelector('[data-sales-chart]'), data.days);
}

// Barras horizontales de una sola serie: el valor va en texto, no en color.
function barList(rows) {
  const max = Math.max(1, ...rows.map(row => row.value));
  return `<ol class="bar-list">${rows.map(row => `<li>
    <span class="bar-label">${row.label}</span>
    <span class="bar-track"><span class="bar-fill" style="width:${row.value / max * 100}%"></span></span>
    <span class="bar-value">${row.text}</span>
  </li>`).join('')}</ol>`;
}

function niceTicks(max, target = 5) {
  if (max <= 0) return [0, 500, 1000];
  const raw = max / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(factor => factor * power).find(value => value >= raw);
  return Array.from({length: Math.ceil(max / step) + 1}, (_, index) => index * step);
}

function columnPath(x, y, width, height, radius = 4) {
  if (height <= 0) return '';
  const r = Math.min(radius, width / 2, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

let chartObserver = null;
function drawSales(figure, days) {
  chartObserver?.disconnect();
  const draw = () => {
    const width = Math.max(280, figure.clientWidth);
    const height = 250;
    const margin = {top: 26, right: 8, bottom: 40, left: 58};
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;
    const ticks = niceTicks(Math.max(...days.map(day => day.total)));
    const top = ticks.at(-1);
    const band = plotW / days.length;
    const barW = Math.min(24, band * .55);
    const y = value => margin.top + plotH - value / top * plotH;
    const maxIndex = days.reduce((best, day, index) => day.total > days[best].total ? index : best, 0);
    const todayIndex = days.length - 1;
    figure.innerHTML = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Ventas por día de los últimos 7 días. Los valores también están en la tabla.">
      <g class="grid">${ticks.map(tick => `<line x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick)}" y2="${y(tick)}" class="${tick ? '' : 'baseline'}"/><text x="${margin.left - 10}" y="${y(tick)}" dy="0.32em" text-anchor="end">${money(tick)}</text>`).join('')}</g>
      <g role="list">${days.map((day, index) => {
        const cx = margin.left + band * index + band / 2;
        const barH = plotH * day.total / top;
        const label = index === todayIndex ? 'Hoy' : `${formatWeekday(day.date)} ${day.date.getDate()}`;
        const showValue = day.total > 0 && (index === todayIndex || index === maxIndex);
        return `<g class="col${index === todayIndex ? ' is-today' : ''}" role="listitem" tabindex="0" data-index="${index}" aria-label="${formatLongDay(day.date)}: ${money(day.total)} en ${plural(day.orders, 'pedido')}">
          <rect class="hit" x="${margin.left + band * index}" y="${margin.top}" width="${band}" height="${plotH + margin.bottom}"/>
          <path class="bar" d="${columnPath(cx - barW / 2, y(day.total), barW, barH)}"/>
          ${showValue ? `<text class="cap" x="${cx}" y="${y(day.total) - 8}" text-anchor="middle">${money(day.total)}</text>` : ''}
          <text class="x" x="${cx}" y="${height - 14}" text-anchor="middle">${label}</text>
        </g>`;
      }).join('')}</g>
    </svg>
    <div class="chart-tip" hidden></div>`;
    const tip = figure.querySelector('.chart-tip');
    const show = col => {
      const day = days[col.dataset.index];
      for (const other of figure.querySelectorAll('.col')) other.classList.toggle('is-active', other === col);
      tip.innerHTML = `<strong>${money(day.total)}</strong><span>${plural(day.orders, 'pedido')}</span><em>${formatLongDay(day.date)}</em>`;
      tip.hidden = false;
      const cx = margin.left + band * Number(col.dataset.index) + band / 2;
      tip.style.left = `${Math.min(width - tip.offsetWidth / 2 - 4, Math.max(tip.offsetWidth / 2 + 4, cx))}px`;
      tip.style.top = `${Math.max(4, y(day.total) - tip.offsetHeight - 12)}px`;
    };
    const hide = () => { tip.hidden = true; figure.querySelectorAll('.col').forEach(col => col.classList.remove('is-active')); };
    for (const col of figure.querySelectorAll('.col')) {
      col.addEventListener('pointerenter', () => show(col));
      col.addEventListener('focus', () => show(col));
      col.addEventListener('blur', hide);
    }
    figure.querySelector('svg').addEventListener('pointerleave', hide);
  };
  draw();
  let lastWidth = figure.clientWidth;
  chartObserver = new ResizeObserver(() => {
    if (Math.abs(figure.clientWidth - lastWidth) < 2) return;
    lastWidth = figure.clientWidth;
    draw();
  });
  chartObserver.observe(figure);
}

// --- Pedidos -------------------------------------------------------------------------

function filteredOrders() {
  const query = state.search.trim().toLowerCase();
  const digits = query.replace(/\D/g, '');
  let list = state.orders.filter(order =>
    state.filter === 'todos' ? true : state.filter === 'abiertos' ? isOpenOrder(order) : order.status === state.filter);
  if (query) {
    list = list.filter(order => order.id.toLowerCase().includes(query)
      || order.customer.name.toLowerCase().includes(query)
      || (digits.length >= 3 && order.customer.phone.includes(digits)));
  }
  // La cola de trabajo va del más antiguo al más reciente.
  return state.filter === 'abiertos' ? [...list].reverse() : list;
}

function orderRow(order) {
  const first = order.items[0];
  const more = order.items.length > 1 ? ` y ${plural(order.items.length - 1, 'más', 'más')}` : '';
  return `<tr data-order-row="${order.id}" class="${state.fresh.has(order.id) ? 'is-fresh' : ''}">
    <td data-label="Pedido"><button type="button" class="order-link" data-open-order="${order.id}">${order.id}</button>${order.demo ? '<span class="demo-tag">Ejemplo</span>' : ''}</td>
    <td data-label="Fecha">${formatDateTime(order.createdAt)}<small>${timeAgo(order.createdAt)}</small></td>
    <td data-label="Cliente">${esc(order.customer.name)}<small>${displayPhone(order.customer.phone)}</small></td>
    <td data-label="Entrega">${order.delivery.method === 'recoger' ? 'Recoger' : 'Domicilio'}<small>${order.delivery.method === 'recoger' ? 'En cervecería' : esc(order.delivery.city)}</small></td>
    <td data-label="Artículos">${bottlesLabel(order.bottles)}<small>${first.qty} × ${first.packName} ${esc(first.name)}${more}</small></td>
    <td data-label="Total" class="num">${money(order.total)}</td>
    <td data-label="Estado">${pill(order)}</td>
  </tr>`;
}

function renderOrders(root) {
  const counts = statusCounts(state.orders);
  counts.todos = state.orders.length;
  counts.abiertos = state.orders.filter(isOpenOrder).length;
  const list = filteredOrders();
  root.innerHTML = `<div class="filters">
      <div class="filter-chips" role="group" aria-label="Filtrar por estado">
        ${FILTERS.map(([id, label]) => `<button type="button" class="chip" data-filter="${id}" aria-pressed="${state.filter === id}">${label} <span>${counts[id] ?? 0}</span></button>`).join('')}
      </div>
      <label class="search">${adminIcons.search}<span class="sr-only">Buscar pedidos</span><input type="search" class="input" id="order-search" data-order-search placeholder="Buscar por pedido, cliente o celular" value="${esc(state.search)}"></label>
    </div>
    ${list.length ? `<div class="table-wrap"><table class="orders-table">
      <caption class="sr-only">${FILTERS.find(([id]) => id === state.filter)[1]}: ${plural(list.length, 'pedido')}</caption>
      <thead><tr><th scope="col">Pedido</th><th scope="col">Fecha</th><th scope="col">Cliente</th><th scope="col">Entrega</th><th scope="col">Artículos</th><th scope="col" class="num">Total</th><th scope="col">Estado</th></tr></thead>
      <tbody>${list.map(orderRow).join('')}</tbody>
    </table></div>` : `<p class="empty-note">${icons.check} ${state.search ? 'Ningún pedido coincide con la búsqueda.' : 'No hay pedidos en esta vista.'}</p>`}`;
  root.querySelector('.filter-chips').addEventListener('click', event => {
    const chip = event.target.closest('[data-filter]');
    if (!chip) return;
    state.filter = chip.dataset.filter;
    renderView();
    root.querySelector(`[data-filter="${state.filter}"]`)?.focus();
  });
  const search = root.querySelector('[data-order-search]');
  search.addEventListener('input', () => {
    state.search = search.value;
    renderView();
  });
}

function contactLinks(order) {
  if (order.demo) return '<p class="card-note">Pedido de ejemplo: el contacto está deshabilitado.</p>';
  const text = encodeURIComponent(`Hola ${order.customer.name.split(' ')[0]}, te escribimos de Cerveza Delicia sobre tu pedido ${order.id}.`);
  return `<div class="contact-links">
    <a class="btn btn-ghost" href="https://wa.me/52${order.customer.phone}?text=${text}" target="_blank" rel="noopener">${icons.whatsapp} WhatsApp</a>
    <a class="btn btn-ghost" href="tel:+52${order.customer.phone}">${adminIcons.call} Llamar</a>
  </div>`;
}

function renderOrderDetail(id) {
  const order = state.orders.find(item => item.id === id);
  if (!order) return closeDialog(orderDialog);
  const next = nextStatus(order);
  const channel = order.channel === 'sms' ? 'SMS' : 'WhatsApp';
  orderDialog.innerHTML = `<div class="dialog-body drawer-body order-sheet">
    <header class="drawer-head">
      <div><p class="kicker">${formatDateTime(order.createdAt)} · ${timeAgo(order.createdAt)}</p><h2 id="order-title">${order.id}</h2></div>
      <div class="order-head-side">${pill(order)}<button type="button" class="icon-button" data-close aria-label="Cerrar detalle">${icons.close}</button></div>
    </header>
    <div class="order-scroll">
      ${isOpenOrder(order) ? `<div class="order-actions">
        ${next ? `<button type="button" class="btn btn-primary" data-advance="${order.id}:${next}">${NEXT_LABEL[next]}</button>` : ''}
        <button type="button" class="btn btn-ghost" data-cancel="${order.id}">Cancelar pedido</button>
      </div>
      <p class="card-note">Cada cambio de estado le avisa al cliente por ${channel}.</p>` : ''}
      <section class="order-section">
        <h3>Cliente</h3>
        <p><strong>${esc(order.customer.name)}</strong><br>${displayPhone(order.customer.phone)} · avisos por ${channel}</p>
        ${contactLinks(order)}
      </section>
      <section class="order-section">
        <h3>${order.delivery.method === 'recoger' ? 'Recoge en la cervecería' : 'Entrega a domicilio'}</h3>
        <p>${order.delivery.method === 'recoger' ? 'El cliente pasa por su pedido a la cervecería en Ciudad Delicias.' : deliveryText(order.delivery)}</p>
        <p class="card-note">Pedir identificación oficial al entregar: venta solo a mayores de 18 años.</p>
      </section>
      <section class="order-section">
        <h3>Preparar · ${bottlesLabel(order.bottles)}</h3>
        ${itemsList(order.items)}
      </section>
      <section class="order-section">
        <h3>Pago</h3>
        <p>${cardLabel(order.payment)} · ${order.payment.status === 'reembolsado' ? 'Reembolsado' : 'Aprobado'} · Autorización ${esc(order.payment.authCode)}</p>
        ${totalsList(order)}
        ${order.payment.refund ? `<p class="card-note">Reembolso de ${money(order.payment.refund.amount)} emitido · ${formatDateTime(order.payment.refund.at)}.</p>` : ''}
      </section>
      <section class="order-section">
        <h3>Historial</h3>
        <ol class="history">${order.history.map(step => `<li><span class="status-pill is-${step.status}">${STATUS[step.status].label}</span><time datetime="${step.at}">${formatDateTime(step.at)}</time></li>`).join('')}</ol>
      </section>
      <button type="button" class="btn btn-ghost btn-block no-print" data-print>${adminIcons.print} Imprimir comanda</button>
    </div>
  </div>`;
  orderDialog.querySelector('[data-cancel]')?.addEventListener('click', () => confirmCancel(order));
  orderDialog.querySelector('[data-print]').addEventListener('click', () => print());
}

function openOrder(id, updateHash = true) {
  if (!state.orders.some(order => order.id === id)) return;
  state.openId = id;
  renderOrderDetail(id);
  openDialog(orderDialog);
  if (updateHash && state.view === 'pedidos') history.replaceState(null, '', `#pedidos/${id}`);
}

async function advanceOrder(button) {
  if (button.disabled) return;
  const [id, status] = button.dataset.advance.split(':');
  button.disabled = true;
  try {
    const order = await api.setOrderStatus(id, status);
    toast(`${order.id}: ${STATUS[status].label}. Se avisó a ${order.customer.name.split(' ')[0]} por ${order.channel === 'sms' ? 'SMS' : 'WhatsApp'}.`);
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
  }
  refresh();
}

// Delegación única: el contenido se vuelve a pintar con cada cambio.
document.addEventListener('click', event => {
  const advance = event.target.closest('[data-advance]');
  if (advance) { advanceOrder(advance); return; }
  if (!event.target.closest('.admin-shell')) return;
  const opener = event.target.closest('[data-open-order]');
  if (opener) { event.preventDefault(); openOrder(opener.dataset.openOrder); return; }
  const row = event.target.closest('tr[data-order-row]');
  if (row && !event.target.closest('a,button')) openOrder(row.dataset.orderRow);
});

function confirmCancel(order) {
  askConfirm({
    title: `¿Cancelar ${order.id}?`,
    body: `Se reembolsarán ${money(order.total)} a ${cardLabel(order.payment)} y se avisará a ${esc(order.customer.name)}.`,
    confirm: 'Sí, cancelar pedido',
    danger: true,
    onConfirm: async () => {
      await api.setOrderStatus(order.id, 'cancelado');
      toast(`${order.id} cancelado. Reembolso de ${money(order.total)} en proceso.`);
      refresh();
    }
  });
}

function confirmReset() {
  askConfirm({
    title: '¿Restablecer la demostración?',
    body: 'Se borran los pedidos, clientes, precios y carritos de este navegador y se vuelven a cargar los pedidos de ejemplo.',
    confirm: 'Restablecer',
    onConfirm: async () => {
      await api.resetDemo();
      state.known = null;
      state.fresh.clear();
      write('admin.helpHidden', false);
      toast('Demostración restablecida con 12 pedidos de ejemplo.');
      refresh();
    }
  });
}

function askConfirm({title, body, confirm, danger = false, onConfirm}) {
  confirmDialog.innerHTML = `<form class="dialog-body confirm-body" method="dialog">
    <h2 id="confirm-title">${title}</h2>
    <p>${body}</p>
    <div class="confirm-buttons">
      <button type="button" class="btn btn-ghost" data-close>Volver</button>
      <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${confirm}</button>
    </div>
  </form>`;
  confirmDialog.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try { await onConfirm(); } catch (error) { toast(error.message); }
    closeDialog(confirmDialog);
  });
  openDialog(confirmDialog);
}

// --- Productos -------------------------------------------------------------------------

function renderProducts(root) {
  const from = startOfDay(new Date());
  from.setDate(from.getDate() - 6);
  const sold = id => sum(state.orders.filter(order => order.status !== 'cancelado' && new Date(order.createdAt) >= from)
    .flatMap(order => order.items).filter(item => item.id === id), item => item.bottles);
  root.innerHTML = `<p class="view-lead">Los cambios se ven al instante en la tienda. Las presentaciones se calculan desde el precio por botella: six −5%, 12 −8%, 18 −10% y caja de 24 −15%, redondeado a $5.</p>
  <div class="product-admin-list">${getProducts().map(product => `
    <article class="card product-admin${product.available ? '' : ' is-off'}" data-product="${product.id}" aria-labelledby="pa-${product.id}">
      ${thumb(product, 'thumb product-admin-thumb')}
      <div class="product-admin-info">
        <h2 id="pa-${product.id}">${esc(product.name)}</h2>
        <p>${esc(product.style)} · ${product.abv}% · ${bottlesLabel(sold(product.id))} vendidas en 7 días</p>
      </div>
      <div class="field price-field">
        <label class="field-label" for="price-${product.id}">Precio por botella</label>
        <div class="money-input"><span aria-hidden="true">$</span><input class="input" id="price-${product.id}" type="number" inputmode="numeric" min="${PRICE_RANGE.min}" max="${PRICE_RANGE.max}" step="1" value="${product.price}" aria-describedby="price-${product.id}-packs price-${product.id}-error"></div>
        <p class="field-error" id="price-${product.id}-error" hidden></p>
      </div>
      <p class="pack-prices" id="price-${product.id}-packs">${packPrices(product.price)}</p>
      <label class="switch"><input type="checkbox" role="switch" data-available ${product.available ? 'checked' : ''}><span class="switch-ui" aria-hidden="true"></span><span>${product.available ? 'Disponible' : 'Agotada'}</span></label>
    </article>`).join('')}
  </div>`;
  root.querySelector('.product-admin-list').addEventListener('input', event => {
    if (event.target.type !== 'number') return;
    const card = event.target.closest('[data-product]');
    const price = Number(event.target.value);
    if (Number.isInteger(price) && price >= PRICE_RANGE.min) card.querySelector('.pack-prices').innerHTML = packPrices(price);
  });
  root.querySelector('.product-admin-list').addEventListener('change', async event => {
    const card = event.target.closest('[data-product]');
    const id = card.dataset.product;
    const name = beers.find(beer => beer.id === id).name;
    try {
      if (event.target.type === 'number') {
        const product = await api.updateProduct(id, {price: event.target.value});
        toast(`${name}: ahora ${money(product.price)} por botella.`);
      } else if (event.target.matches('[data-available]')) {
        const product = await api.updateProduct(id, {available: event.target.checked});
        toast(product.available ? `${name} vuelve a estar disponible.` : `${name} marcada como agotada: ya no se puede comprar.`);
      }
    } catch (error) {
      const message = card.querySelector('.field-error');
      message.hidden = false;
      message.textContent = error.message;
      event.target.setAttribute('aria-invalid', 'true');
      return;
    }
    renderView();
  });
}

const packPrices = price => packs.filter(pack => pack.size > 1)
  .map(pack => `<span>${pack.name} <strong>${money(packQuote(price, pack.size).price)}</strong></span>`).join('');

// --- Clientes ---------------------------------------------------------------------------

function renderCustomers(root) {
  const customers = state.customers;
  const query = state.customerSearch.trim().toLowerCase();
  const digits = query.replace(/\D/g, '');
  const list = customers.filter(customer => !query || customer.name.toLowerCase().includes(query) || (digits.length >= 3 && customer.phone.includes(digits)));
  root.innerHTML = `<div class="filters">
      <p class="view-lead">${plural(customers.length, 'cliente')} · registrados con su celular, sin correo.</p>
      <label class="search">${adminIcons.search}<span class="sr-only">Buscar clientes</span><input type="search" class="input" id="customer-search" data-customer-search placeholder="Buscar por nombre o celular" value="${esc(state.customerSearch)}"></label>
    </div>
    ${list.length ? `<div class="table-wrap"><table class="orders-table customers-table">
      <caption class="sr-only">Clientes</caption>
      <thead><tr><th scope="col">Cliente</th><th scope="col">Celular</th><th scope="col" class="num">Pedidos</th><th scope="col" class="num">Botellas</th><th scope="col" class="num">Total comprado</th><th scope="col">Último pedido</th></tr></thead>
      <tbody>${list.map(customer => `<tr>
        <td data-label="Cliente"><strong>${esc(customer.name)}</strong>${customer.demo ? '<span class="demo-tag">Ejemplo</span>' : ''}<small>Cliente desde ${formatDay(customer.since)}</small></td>
        <td data-label="Celular">${displayPhone(customer.phone)}</td>
        <td data-label="Pedidos" class="num">${customer.orders}</td>
        <td data-label="Botellas" class="num">${customer.bottles}</td>
        <td data-label="Total comprado" class="num">${money(customer.spent)}</td>
        <td data-label="Último pedido">${customer.lastOrder ? formatDateTime(customer.lastOrder) : 'Sin pedidos'}</td>
      </tr>`).join('')}</tbody>
    </table></div>` : '<p class="empty-note">Ningún cliente coincide con la búsqueda.</p>'}`;
  const search = root.querySelector('[data-customer-search]');
  search.addEventListener('input', () => {
    state.customerSearch = search.value;
    renderView();
  });
}

// --- Arranque -----------------------------------------------------------------------------

async function start() {
  renderShell();
  if (!orderDialog) {
    orderDialog = makeDialog('order-dialog', 'drawer order-drawer', 'order-title');
    orderDialog.addEventListener('close', () => {
      state.openId = null;
      if (location.hash.startsWith('#pedidos/')) history.replaceState(null, '', '#pedidos');
    });
    confirmDialog = makeDialog('confirm-dialog', 'sheet confirm-dialog', 'confirm-title');
  }
  await load();
  state.known = new Set(state.orders.map(order => order.id));
  route();
  renderBadges();
  // Refresca los "hace X min" sin recargar.
  clearInterval(clock);
  clock = setInterval(() => { if (!$('dialog[open]')) renderView(); }, 60_000);
}

addEventListener('hashchange', () => { if (api.isAdmin() && $('.admin-shell')) route(); });

subscribe(key => {
  if (key === 'admin' || key === '*') {
    if (!api.isAdmin()) { $$('dialog[open]').forEach(dialog => dialog.close()); renderLogin(); return; }
    if (!$('.admin-shell')) start();
  }
  if (!api.isAdmin() || !$('.admin-shell')) return;
  if (key === 'db.orders' || key === '*') refresh();
  else if (key === 'catalog' && (state.view === 'productos' || state.view === 'resumen')) renderView();
});

if (api.isAdmin()) start();
else renderLogin();
