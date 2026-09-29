// Componentes compartidos de la tienda: carrito, selector de presentación,
// acceso con celular, avisos, notificaciones simuladas y seguimiento.
import {subscribe, getSession, getProducts, getProduct, cartQuote, addToCart, setLineQty, firstName} from './store.js';
import * as api from './api.js';
import {packs, packQuote, beerById, bottleImage, bottlesLabel, statusFlow, SHIPPING, DEFAULT_PACK, MAX_LINE_QTY, STATUS, BOTTLE_ML} from './data.js';
import {money, esc, plural, displayPhone, formatPhone, normalizePhone, isValidPhone, onlyDigits, formatTime} from './util.js';

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

export const svg = paths => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
export const icons = {
  bag: svg('<path d="M5.5 8.5h13l-1 11.5h-11z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>'),
  close: svg('<path d="m6 6 12 12M18 6 6 18"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  user: svg('<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>'),
  whatsapp: svg('<path d="M20 11.6a8 8 0 0 1-11.9 7l-4.1 1.1 1.1-3.9A8 8 0 1 1 20 11.6z"/><path d="M9.2 8.6c.3 2.4 1.9 4.4 4.6 5.4l1.1-1.1 1.6.8-.4 1.4c-3.5.2-7.2-3.3-7.3-6.9l1.4-.4.8 1.6z"/>'),
  sms: svg('<path d="M4 5.5h16v11H9.5L5 20v-3.5H4z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/>'),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  truck: svg('<path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3.2v2.8h-7"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/>'),
  store: svg('<path d="M4 10v10h16V10M3 10l1.8-5.5h14.4L21 10z"/><path d="M10 20v-5h4v5"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  back: svg('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  card: svg('<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>'),
  phone: svg('<path d="M7 3.5h10v17H7z"/><path d="M11 17.5h2"/>')
};

// --- Capas flotantes -------------------------------------------------------
// Toasts y notificaciones usan la API Popover para quedar por encima de un
// <dialog> modal abierto (ambos viven en la top layer).

const supportsPopover = typeof HTMLElement.prototype.showPopover === 'function';

function layer(className, live) {
  let host = $(`.${className}`);
  if (!host) {
    host = document.createElement('div');
    host.className = className;
    host.setAttribute('aria-live', live);
    if (supportsPopover) host.popover = 'manual';
    document.body.append(host);
  }
  return host;
}

// Un popover abierto antes que un diálogo queda debajo; se vuelve a abrir
// para subirlo.
function raise(host) {
  if (!supportsPopover) return;
  if (!host.matches(':popover-open')) host.showPopover();
  else if ($('dialog[open]')) { host.hidePopover(); host.showPopover(); }
}

function settle(host) {
  if (!host.children.length && supportsPopover && host.matches(':popover-open')) host.hidePopover();
}

function dismissLater(el, host, ms) {
  let timer = setTimeout(dismiss, ms);
  function dismiss() {
    clearTimeout(timer);
    if (!el.isConnected) return;
    el.classList.add('is-leaving');
    setTimeout(() => { el.remove(); settle(host); }, reducedMotion.matches ? 0 : 220);
  }
  el.addEventListener('pointerenter', () => clearTimeout(timer));
  el.addEventListener('pointerleave', () => { timer = setTimeout(dismiss, 2500); });
  return dismiss;
}

export function toast(message, {action, tone} = {}) {
  const host = layer('toasts', 'polite');
  const el = document.createElement('div');
  el.className = `toast${tone ? ` is-${tone}` : ''}`;
  el.innerHTML = `<p>${esc(message)}</p>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  raise(host);
  host.append(el);
  const dismiss = dismissLater(el, host, action ? 6000 : 4000);
  el.querySelector('button')?.addEventListener('click', () => { dismiss(); action.onClick(); });
}

// Simula el mensaje que llegaría al celular por WhatsApp o SMS.
export function phoneNotice({channel = 'whatsapp', body, action, duration = 12000}) {
  const host = layer('phone-notices', 'polite');
  const sms = channel === 'sms';
  const el = document.createElement('div');
  el.className = `phone-notice is-${sms ? 'sms' : 'whatsapp'}`;
  el.innerHTML = `
    <span class="notice-app">${sms ? icons.sms : icons.whatsapp}</span>
    <div class="notice-text">
      <p class="notice-meta"><strong>${sms ? 'Mensajes' : 'WhatsApp'}</strong><span>ahora</span><em>Simulación</em></p>
      <p class="notice-title">Cerveza Delicia</p>
      <p class="notice-body">${esc(body)}</p>
      ${action ? `<button type="button" class="notice-action">${esc(action.label)}</button>` : ''}
    </div>
    <button type="button" class="notice-close" aria-label="Cerrar notificación">${icons.close}</button>`;
  raise(host);
  host.prepend(el);
  const dismiss = dismissLater(el, host, duration);
  el.querySelector('.notice-close').addEventListener('click', dismiss);
  el.querySelector('.notice-action')?.addEventListener('click', () => { dismiss(); action.onClick(); });
  return dismiss;
}

// --- Diálogos ----------------------------------------------------------------

const returnFocus = new WeakMap();

export function openDialog(dialog) {
  if (dialog.open) return;
  returnFocus.set(dialog, document.activeElement);
  dialog.showModal();
}

export function closeDialog(dialog) {
  if (!dialog.open || dialog.classList.contains('is-closing')) return;
  const finish = () => {
    dialog.classList.remove('is-closing');
    dialog.close();
    const target = returnFocus.get(dialog);
    if (target?.isConnected) target.focus({preventScroll: true});
  };
  if (reducedMotion.matches) return finish();
  dialog.classList.add('is-closing');
  setTimeout(finish, 180);
}

export function makeDialog(id, className, label) {
  let dialog = document.getElementById(id);
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = id;
  dialog.className = className;
  dialog.setAttribute('aria-labelledby', label);
  document.body.append(dialog);
  // Clic en el fondo o Esc cierran con la misma animación.
  dialog.addEventListener('click', event => {
    if (event.target === dialog || event.target.closest('[data-close]')) closeDialog(dialog);
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(dialog); });
  // Chrome puede ignorar preventDefault en un segundo Esc seguido.
  dialog.addEventListener('close', () => dialog.classList.remove('is-closing'));
  return dialog;
}

// Conserva el foco al volver a pintar un contenedor (p. ej. el botón "+").
export function rerender(root, html) {
  const key = root.contains(document.activeElement) ? document.activeElement.dataset.focus : null;
  root.innerHTML = html;
  if (!key) return;
  // Si el control quedó deshabilitado (p. ej. "−" en 1), pasa al vecino.
  const target = root.querySelector(`[data-focus="${key}"]`);
  const next = target && !target.disabled ? target
    : target?.parentElement.querySelector('button:not(:disabled)') ?? root.querySelector('[data-focus-fallback]');
  next?.focus();
}

// --- Piezas de interfaz ------------------------------------------------------

export function stepper(qty, {key, label = 'Cantidad', max = MAX_LINE_QTY, min = 1, disabled = false} = {}) {
  return `<div class="stepper" role="group" aria-label="${esc(label)}">
    <button type="button" data-step="-1" data-focus="${key}-minus" aria-label="Quitar uno" ${disabled || qty <= min ? 'disabled' : ''}>${icons.minus}</button>
    <output aria-live="polite">${qty}</output>
    <button type="button" data-step="1" data-focus="${key}-plus" aria-label="Agregar uno" ${disabled || qty >= max ? 'disabled' : ''}>${icons.plus}</button>
  </div>`;
}

export function packPicker(product, selected, name, {compact = false} = {}) {
  return `<fieldset class="pack-picker${compact ? ' is-compact' : ''}">
    <legend>${compact ? 'Botellas por presentación' : 'Presentación'}</legend>
    <div class="pack-options">
    ${packs.map(pack => {
      const quote = packQuote(product.price, pack.size);
      const detail = compact
        ? `<span class="pack-size" aria-hidden="true">${pack.size}</span><span class="sr-only">${pack.name}, ${bottlesLabel(pack.size)}:</span>`
        : `<span class="pack-name">${pack.name}</span>
          <span class="pack-meta">${bottlesLabel(pack.size)}${pack.size > 1 ? ` · ${money(quote.perBottle)} c/u` : ''}</span>`;
      return `<label class="pack-option">
        <input type="radio" name="${name}" value="${pack.size}" data-focus="${name}-${pack.size}" ${pack.size === selected ? 'checked' : ''} ${product.available ? '' : 'disabled'}>
        ${detail}
        <span class="pack-price">${money(quote.price)}</span>
        ${compact ? '' : `<span class="pack-save">${quote.savings ? `Ahorras ${money(quote.savings)}` : ''}</span>`}
      </label>`;
    }).join('')}
    </div>
  </fieldset>`;
}

export function packSummary(product, size) {
  const quote = packQuote(product.price, size);
  return `<strong>${quote.name}</strong> · ${bottlesLabel(quote.size)}${quote.size > 1 ? ` · ${money(quote.perBottle)} c/u` : ''}${quote.savings ? ` · <span class="pack-save">ahorras ${money(quote.savings)}</span>` : ''}`;
}

export const thumb = (product, className = 'thumb') =>
  `<span class="${className}" style="--p-bg:${product.bg}"><img src="${bottleImage(product.id)}" alt="" width="190" height="720" loading="lazy"></span>`;

// Lista de artículos (del carrito o de un pedido ya pagado).
export const itemsList = items => `<ul class="summary-lines">${items.map(item => `<li>
    ${thumb(beerById(item.id))}
    <p>${esc(item.name)}<small>${item.qty} × ${item.packName} · ${bottlesLabel(item.size * item.qty)}</small></p>
    <span class="qty">${money(item.total)}</span>
  </li>`).join('')}</ul>`;

export function totalsList({subtotal, bottles, shipping, total}) {
  return `<dl class="totals">
    <div><dt>Subtotal <small>${bottlesLabel(bottles)}</small></dt><dd>${money(subtotal)}</dd></div>
    <div><dt>Envío</dt><dd>${shipping ? money(shipping) : 'Gratis'}</dd></div>
    <div class="total"><dt>Total</dt><dd>${money(total)}</dd></div>
  </dl>`;
}

export const cardLabel = payment => `${api.brandName(payment.brand)} •••• ${esc(payment.last4)}`;

export function orderTracker(order) {
  if (order.status === 'cancelado') {
    const refund = order.payment.refund;
    return `<p class="tracker-cancelled">${icons.close}<span>Pedido cancelado${refund ? ` · reembolso de ${money(refund.amount)} a tu ${cardLabel(order.payment)}` : ''}</span></p>`;
  }
  const flow = statusFlow(order.delivery.method);
  const current = flow.indexOf(order.status);
  return `<ol class="tracker">${flow.map((status, index) => {
    const at = order.history.find(step => step.status === status)?.at;
    const state = index < current ? 'is-done' : index === current ? 'is-current' : '';
    return `<li class="${state}" ${index === current ? 'aria-current="step"' : ''}>
      <span class="tracker-dot">${index <= current ? icons.check : ''}</span>
      <span class="tracker-label">${STATUS[status].customer}</span>
      ${at ? `<time datetime="${at}">${formatTime(at)}</time>` : ''}
    </li>`;
  }).join('')}</ol>`;
}

export function deliveryText(delivery) {
  if (delivery.method === 'recoger') return 'Recoger en la cervecería · Ciudad Delicias';
  return `${esc(delivery.street)}, ${esc(delivery.colonia)}, ${esc(delivery.city)}${delivery.references ? ` · ${esc(delivery.references)}` : ''}`;
}

// Mensajes que recibiría el cliente en cada cambio de estado.
const STATUS_MESSAGES = {
  preparando: order => `Ya estamos preparando tu pedido ${order.id}. Te avisamos cuando esté listo.`,
  en_camino: order => `¡Tu pedido ${order.id} va en camino! Ten a la mano una identificación oficial.`,
  listo: order => `Tu pedido ${order.id} está listo para recoger en la cervecería. Trae una identificación oficial.`,
  entregado: order => `Pedido ${order.id} entregado. ¡Salud! Gracias por elegir Delicia.`,
  cancelado: order => `Tu pedido ${order.id} fue cancelado. El reembolso de ${money(order.total)} se reflejará en tu tarjeta.`
};
export const confirmationMessage = order =>
  `Recibimos tu pedido ${order.id} por ${money(order.total)}. Te escribiremos por aquí cada vez que avance.`;

// --- Carrito -----------------------------------------------------------------

let cartDialog;

export function openCart() {
  renderCart();
  openDialog(cartDialog);
}

function cartLine(line) {
  const key = `${line.id}-${line.size}`;
  return `<li class="cart-line" data-line="${line.id}:${line.size}">
    ${thumb(line.product, 'thumb cart-thumb')}
    <div class="cart-line-info">
      <p class="cart-line-name">${esc(line.product.name)}</p>
      <p class="cart-line-pack">${line.packName} · ${bottlesLabel(line.size)} · ${money(line.price)}</p>
      ${line.available ? '' : '<p class="cart-line-alert">Agotada por ahora. Quítala para continuar.</p>'}
      <div class="cart-line-actions">
        ${stepper(line.qty, {key, label: `Cantidad de ${line.product.name} ${line.packName}`})}
        <button type="button" class="link-button" data-remove data-focus="${key}-remove">Quitar</button>
      </div>
    </div>
    <p class="cart-line-total">${money(line.total)}</p>
  </li>`;
}

function renderCart() {
  const quote = cartQuote();
  const remaining = SHIPPING.freeFrom - quote.subtotal;
  const blocked = quote.unavailable.length > 0;
  const scroll = cartDialog.querySelector('.cart-lines')?.scrollTop ?? 0;
  rerender(cartDialog, `<div class="dialog-body drawer-body">
    <header class="drawer-head">
      <h2 id="cart-title">Tu carrito${quote.items ? ` <span>${plural(quote.items, 'artículo')}</span>` : ''}</h2>
      <button type="button" class="icon-button" data-close data-focus-fallback aria-label="Cerrar carrito">${icons.close}</button>
    </header>
    ${quote.lines.length ? `
      <div class="ship-meter">
        <p>${remaining > 0 ? `Te faltan <strong>${money(remaining)}</strong> para envío gratis a domicilio.` : `${icons.truck} Tu pedido ya tiene <strong>envío gratis</strong> a domicilio.`}</p>
        <span class="meter"><span style="width:${Math.min(100, quote.subtotal / SHIPPING.freeFrom * 100)}%"></span></span>
      </div>
      <ul class="cart-lines">${quote.lines.map(cartLine).join('')}</ul>
      <div class="drawer-foot">
        <dl class="totals">
          <div><dt>Subtotal <small>${bottlesLabel(quote.bottles)}</small></dt><dd>${money(quote.subtotal)}</dd></div>
          <div><dt>Envío</dt><dd>${remaining > 0 ? `${money(SHIPPING.fee)} o gratis al recoger` : 'Gratis'}</dd></div>
        </dl>
        ${quote.savings ? `<p class="savings-note">Ahorras ${money(quote.savings)} por comprar en presentación.</p>` : ''}
        ${blocked
          ? '<button class="btn btn-primary btn-block" type="button" disabled>Quita lo agotado para pagar</button>'
          : `<a class="btn btn-primary btn-block" href="/checkout/">Continuar al pago ${icons.arrow}</a>`}
        <button type="button" class="btn btn-link btn-block" data-close>Seguir comprando</button>
      </div>` : `
      <div class="empty-state">
        <span class="empty-icon">${icons.bag}</span>
        <p><strong>Tu carrito está vacío.</strong><br>Elige tus cervezas por unidad, six, 12, 18 o caja de 24.</p>
        <a class="btn btn-primary" href="/tienda/">Ver cervezas</a>
      </div>`}
  </div>`);
  const lines = cartDialog.querySelector('.cart-lines');
  if (lines) lines.scrollTop = scroll;
}

function bindCart() {
  cartDialog = makeDialog('cart-drawer', 'drawer', 'cart-title');
  cartDialog.addEventListener('click', event => {
    const line = event.target.closest('[data-line]');
    if (!line) return;
    const [id, size] = line.dataset.line.split(':');
    const current = cartQuote().lines.find(item => item.id === id && item.size === Number(size));
    if (!current) return;
    const step = event.target.closest('[data-step]');
    if (step) setLineQty(id, Number(size), current.qty + Number(step.dataset.step));
    if (event.target.closest('[data-remove]')) {
      setLineQty(id, Number(size), 0);
      toast(`${current.product.name} (${current.packName}) salió del carrito.`, {
        action: {label: 'Deshacer', onClick: () => addToCart(id, Number(size), current.qty)}
      });
    }
  });
}

// --- Agregar rápido (landing) ------------------------------------------------

let quickDialog;

export function openQuickAdd(id) {
  const product = getProduct(id);
  if (!product) return;
  let qty = 1;
  quickDialog.innerHTML = `<form class="dialog-body quick-add" style="--p-bg:${product.bg};--p-fg:${product.fg}">
    <button type="button" class="icon-button dialog-x" data-close aria-label="Cerrar">${icons.close}</button>
    <header class="quick-add-head">
      <span class="quick-add-art"><img src="${bottleImage(product.id)}" alt="" width="190" height="720"></span>
      <div>
        <p class="eyebrow">${esc(product.style)} · ${product.abv}% alc. vol. · ${BOTTLE_ML} ml</p>
        <h2 id="quick-add-title">${esc(product.name)}</h2>
        <p class="quick-add-unit">${money(product.price)} por botella</p>
      </div>
    </header>
    <div class="quick-add-body">
      ${product.available ? '' : '<p class="alert">Esta cerveza está agotada por ahora.</p>'}
      ${packPicker(product, DEFAULT_PACK, 'quick-pack')}
      <div class="buy-row">
        <div data-qty>${stepper(qty, {key: 'quick', disabled: !product.available})}</div>
        <button class="btn btn-primary" type="submit" ${product.available ? '' : 'disabled'}>Agregar · <span data-total></span></button>
      </div>
    </div>
  </form>`;
  const form = quickDialog.querySelector('form');
  const update = () => {
    const size = Number(form.elements['quick-pack'].value);
    form.querySelector('[data-total]').textContent = money(packQuote(product.price, size).price * qty);
    rerender(form.querySelector('[data-qty]'), stepper(qty, {key: 'quick', disabled: !product.available}));
  };
  form.addEventListener('change', update);
  form.addEventListener('click', event => {
    const step = event.target.closest('[data-step]');
    if (!step) return;
    qty = Math.min(MAX_LINE_QTY, Math.max(1, qty + Number(step.dataset.step)));
    update();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const size = Number(form.elements['quick-pack'].value);
    addToCart(product.id, size, qty);
    closeDialog(quickDialog);
    announceAdded(product, size, qty);
  });
  update();
  openDialog(quickDialog);
  form.querySelector('input[type=radio]:checked')?.focus();
}

export function announceAdded(product, size, qty) {
  const pack = packs.find(item => item.size === size);
  toast(`${qty > 1 ? `${qty} × ` : ''}${pack.name} de ${product.name} en tu carrito.`, {
    action: {label: 'Ver carrito', onClick: openCart}
  });
}

// --- Acceso con celular -------------------------------------------------------

export function mountPhoneAuth(container, {onDone, title = 'Entra con tu celular', lead = 'Sin correo ni contraseña: te enviamos un código para confirmar tu número.'} = {}) {
  const state = {step: 'phone', phone: '', channel: 'whatsapp', resendAt: 0, token: null};
  let timer = 0;
  let closeNotice = null;

  const views = {
    phone: () => `<form class="auth" novalidate>
      <h2 class="auth-title">${esc(title)}</h2>
      <p class="auth-lead">${esc(lead)}</p>
      <div class="field">
        <label class="field-label" for="auth-phone">Número de celular</label>
        <div class="phone-input"><span aria-hidden="true">+52</span><input class="input" id="auth-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="639 123 4567" value="${esc(formatPhone(state.phone))}" aria-describedby="auth-phone-hint auth-phone-error" required></div>
        <p class="field-hint" id="auth-phone-hint">10 dígitos. Solo celulares de México.</p>
        <p class="field-error" id="auth-phone-error" hidden></p>
      </div>
      <fieldset class="channel-choice">
        <legend class="field-label">Recibir el código por</legend>
        <label class="choice"><input type="radio" name="channel" value="whatsapp" ${state.channel === 'whatsapp' ? 'checked' : ''}><span>${icons.whatsapp} WhatsApp</span></label>
        <label class="choice"><input type="radio" name="channel" value="sms" ${state.channel === 'sms' ? 'checked' : ''}><span>${icons.sms} SMS</span></label>
      </fieldset>
      <button class="btn btn-primary btn-block" type="submit">Enviar código</button>
      <p class="auth-legal">${icons.lock} Solo usamos tu número para tus pedidos y avisos de entrega.</p>
    </form>`,
    code: () => `<form class="auth" novalidate>
      <button type="button" class="link-button auth-back" data-back>${icons.back} Cambiar número</button>
      <h2 class="auth-title">Escribe el código</h2>
      <p class="auth-lead">Lo enviamos por <strong>${state.channel === 'sms' ? 'SMS' : 'WhatsApp'}</strong> al <strong>${displayPhone(state.phone)}</strong>. Vence en 5 minutos.</p>
      <div class="field">
        <label class="field-label" for="auth-code">Código de 6 dígitos</label>
        <input class="input otp-input" id="auth-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-describedby="auth-code-error" required>
        <p class="field-error" id="auth-code-error" hidden></p>
      </div>
      <button class="btn btn-primary btn-block" type="submit">Verificar</button>
      <div class="auth-resend">
        <button type="button" class="link-button" data-resend></button>
        <button type="button" class="link-button" data-switch>Enviar por ${state.channel === 'sms' ? 'WhatsApp' : 'SMS'}</button>
      </div>
    </form>`,
    profile: () => `<form class="auth" novalidate>
      <p class="auth-verified">${icons.check} ${displayPhone(state.phone)} verificado</p>
      <h2 class="auth-title">¡Bienvenido a Delicia!</h2>
      <p class="auth-lead">Es tu primera vez. Solo falta tu nombre para preparar tus pedidos.</p>
      <div class="field">
        <label class="field-label" for="auth-name">Nombre y apellido</label>
        <input class="input" id="auth-name" name="name" autocomplete="name" maxlength="60" aria-describedby="auth-name-error" required>
        <p class="field-error" id="auth-name-error" hidden></p>
      </div>
      <label class="check"><input type="checkbox" name="adult" aria-describedby="auth-adult-error"><span>Soy mayor de 18 años. Al recibir mi pedido mostraré una identificación oficial.</span></label>
      <p class="field-error" id="auth-adult-error" hidden></p>
      <button class="btn btn-primary btn-block" type="submit">Crear mi cuenta</button>
    </form>`
  };

  function render(focus = true) {
    clearInterval(timer);
    container.innerHTML = views[state.step]();
    const form = container.querySelector('form');
    binders[state.step](form);
    if (focus) form.querySelector('input:not([type=radio]):not([type=checkbox])')?.focus({preventScroll: true});
  }

  function showError(form, name, message) {
    const input = form.elements[name];
    const error = form.querySelector(`#auth-${name}-error`);
    if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
    error.hidden = !message;
    error.textContent = message ?? '';
  }

  async function busy(button, label, task) {
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span> ${label}`;
    try { return await task(); } finally { if (button.isConnected) { button.disabled = false; button.innerHTML = original; } }
  }

  async function send() {
    const result = await api.sendCode(state.phone, state.channel);
    state.resendAt = result.resendAt;
    closeNotice?.();
    closeNotice = phoneNotice({
      channel: state.channel,
      body: `${result.code} es tu código de verificación. Por tu seguridad, no lo compartas.`,
      action: {label: 'Usar código', onClick: () => {
        const input = container.querySelector('#auth-code');
        if (!input) return;
        input.value = result.code;
        input.form.requestSubmit();
      }}
    });
    return result;
  }

  const binders = {
    phone(form) {
      const input = form.elements.phone;
      input.addEventListener('input', () => {
        const atEnd = input.selectionStart === input.value.length;
        const digits = normalizePhone(input.value).slice(0, 10);
        if (atEnd) input.value = formatPhone(digits);
        showError(form, 'phone', null);
      });
      form.addEventListener('submit', async event => {
        event.preventDefault();
        state.phone = normalizePhone(input.value);
        state.channel = form.elements.channel.value;
        if (!isValidPhone(state.phone)) return showError(form, 'phone', 'Escribe tu celular a 10 dígitos, por ejemplo 639 123 4567.');
        try {
          await busy(event.submitter ?? form.querySelector('[type=submit]'), 'Enviando…', send);
          state.step = 'code';
          render();
        } catch (error) {
          if (error.code === 'too_soon') { state.step = 'code'; render(); return; }
          showError(form, 'phone', error.message);
        }
      });
    },
    code(form) {
      const input = form.elements.code;
      const resend = form.querySelector('[data-resend]');
      const tick = () => {
        const left = Math.ceil((state.resendAt - Date.now()) / 1000);
        resend.disabled = left > 0;
        resend.textContent = left > 0 ? `Reenviar código en 0:${String(left).padStart(2, '0')}` : 'Reenviar código';
      };
      tick();
      timer = setInterval(tick, 1000);
      input.addEventListener('input', () => {
        input.value = onlyDigits(input.value).slice(0, 6);
        showError(form, 'code', null);
        if (input.value.length === 6) form.requestSubmit();
      });
      form.querySelector('[data-back]').addEventListener('click', () => { closeNotice?.(); state.step = 'phone'; render(); });
      resend.addEventListener('click', async () => {
        try { await busy(resend, 'Enviando…', send); tick(); input.value = ''; input.focus(); }
        catch (error) { showError(form, 'code', error.message); }
      });
      form.querySelector('[data-switch]').addEventListener('click', async event => {
        state.channel = state.channel === 'sms' ? 'whatsapp' : 'sms';
        try { await busy(event.currentTarget, 'Enviando…', send); render(); }
        catch (error) { showError(form, 'code', error.message); }
      });
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (form.dataset.pending) return;
        const code = onlyDigits(input.value);
        if (code.length !== 6) return showError(form, 'code', 'El código tiene 6 dígitos.');
        form.dataset.pending = '1';
        try {
          const result = await busy(form.querySelector('[type=submit]'), 'Verificando…', () => api.verifyCode(state.phone, code));
          closeNotice?.();
          if (result.isNew) { state.token = result.token; state.step = 'profile'; render(); }
          else finish(result.user);
        } catch (error) {
          showError(form, 'code', error.message);
          input.select();
        } finally {
          delete form.dataset.pending;
        }
      });
    },
    profile(form) {
      form.addEventListener('submit', async event => {
        event.preventDefault();
        showError(form, 'name', null);
        showError(form, 'adult', null);
        try {
          const user = await busy(form.querySelector('[type=submit]'), 'Creando cuenta…', () =>
            api.register({token: state.token, name: form.elements.name.value, adult: form.elements.adult.checked}));
          finish(user);
        } catch (error) {
          if (error.code === 'expired') { state.step = 'phone'; render(); toast(error.message); return; }
          showError(form, error.field ?? 'name', error.message);
          form.elements[error.field ?? 'name']?.focus();
        }
      });
    }
  };

  function finish(user) {
    clearInterval(timer);
    toast(`Hola, ${firstName(user.name)}. Tu número quedó verificado.`, {tone: 'ok'});
    onDone?.(user);
  }

  render(false);
  return {destroy: () => { clearInterval(timer); closeNotice?.(); }};
}

// --- Montaje en cada página ----------------------------------------------------

function renderBadges() {
  const {items} = cartQuote();
  for (const badge of $$('[data-cart-count]')) {
    badge.textContent = items;
    badge.hidden = items === 0;
  }
  for (const button of $$('[data-cart-open]')) {
    button.setAttribute('aria-label', items ? `Abrir carrito, ${plural(items, 'artículo')}` : 'Abrir carrito, está vacío');
  }
  document.documentElement.classList.toggle('has-cart-items', items > 0);
}

function renderAccount() {
  const session = getSession();
  for (const label of $$('[data-account-label]')) label.textContent = session ? firstName(session.name) : 'Entrar';
}

function renderPriceTags() {
  const products = Object.fromEntries(getProducts().map(product => [product.id, product]));
  for (const tag of $$('[data-price-for]')) {
    const product = products[tag.dataset.priceFor];
    tag.innerHTML = product.available
      ? `<strong>${money(product.price)}</strong> por botella · six ${money(packQuote(product.price, 6).price)}`
      : '<strong>Agotada</strong> por ahora';
  }
  for (const button of $$('[data-quick-add]')) {
    const product = products[button.dataset.quickAdd];
    button.disabled = !product.available;
    const label = button.querySelector('[data-buy-label]');
    if (label) label.textContent = product.available ? 'Comprar' : 'Agotada';
  }
}

// Notifica al cliente (en cualquier pestaña de la tienda) cuando el back
// office cambia el estado de uno de sus pedidos.
function watchMyOrders() {
  const mine = () => {
    const session = getSession();
    return session ? api.ordersSnapshot().filter(order => order.customer.phone === session.phone) : [];
  };
  let known = new Map(mine().map(order => [order.id, order.status]));
  subscribe((key, external) => {
    if (key !== 'db.orders' && key !== 'session' && key !== '*') return;
    const orders = mine();
    const session = getSession();
    if (external && key !== 'session') {
      for (const order of orders) {
        const before = known.get(order.id);
        if (before && before !== order.status && STATUS_MESSAGES[order.status]) {
          phoneNotice({channel: session?.channel ?? order.channel, body: STATUS_MESSAGES[order.status](order)});
        }
      }
    }
    known = new Map(orders.map(order => [order.id, order.status]));
  });
}

// Iconos y montos de envío declarados en el HTML estático.
function hydrateStatic() {
  for (const el of $$('[data-icon]')) el.outerHTML = icons[el.dataset.icon] ?? '';
  for (const el of $$('[data-ship]')) el.textContent = money(el.dataset.ship === 'free' ? SHIPPING.freeFrom : SHIPPING.fee);
}

export function initShopChrome({floatingCart = false} = {}) {
  hydrateStatic();
  bindCart();
  quickDialog = makeDialog('quick-add', 'sheet', 'quick-add-title');
  if (floatingCart) {
    document.body.insertAdjacentHTML('beforeend', `<button type="button" class="cart-fab" data-cart-open>${icons.bag}<span class="cart-count" data-cart-count hidden>0</span></button>`);
    const header = $('header');
    if (header) new IntersectionObserver(([entry]) => document.documentElement.classList.toggle('header-offscreen', !entry.isIntersecting)).observe(header);
  }
  document.addEventListener('click', event => {
    const opener = event.target.closest('[data-cart-open]');
    if (opener) { event.preventDefault(); openCart(); return; }
    const quick = event.target.closest('[data-quick-add]');
    if (quick) { event.preventDefault(); openQuickAdd(quick.dataset.quickAdd); }
  });
  renderBadges();
  renderAccount();
  renderPriceTags();
  subscribe(key => {
    if (key === 'cart' || key === 'catalog' || key === '*') {
      renderBadges();
      if (cartDialog.open) renderCart();
      renderPriceTags();
    }
    if (key === 'session' || key === '*') renderAccount();
  });
  watchMyOrders();
}
