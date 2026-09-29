// Pago: verificación del celular, entrega o recolección y tarjeta.
import {initShopChrome, mountPhoneAuth, orderTracker, itemsList, totalsList, deliveryText, cardLabel, phoneNotice, confirmationMessage, icons, $, $$} from './ui.js';
import {cartQuote, getCart, clearCart, getSession, subscribe, firstName} from './store.js';
import * as api from './api.js';
import {shippingCost, SHIPPING, bottlesLabel} from './data.js';
import {money, esc, plural, displayPhone, formatCardNumber, formatExpiry, cardBrand, cardLength, cvcLength, luhn, onlyDigits, parseExpiry, formatDateTime, BRAND_NAMES} from './util.js';

initShopChrome();

const main = $('#main');
const TEST_CARDS = [
  ['4242424242424242', 'Visa · aprobada'],
  ['5555555555554444', 'Mastercard · aprobada'],
  ['4000000000000002', 'Visa · rechazada']
];
let auth = null;
let form = null;
let placing = false;
let confirmed = null;  // pedido recién pagado; la vista ya no sigue al carrito

const channelName = channel => channel === 'sms' ? 'SMS' : 'WhatsApp';
const field = (name, label, input, {wide = false, hint = ''} = {}) => `
  <div class="field${wide ? ' is-wide' : ''}">
    <label class="field-label" for="${name}">${label}</label>
    ${input}
    ${hint ? `<p class="field-hint">${hint}</p>` : ''}
    <p class="field-error" id="${name}-error" hidden></p>
  </div>`;

function renderPage() {
  main.innerHTML = `
  <div class="checkout-top">
    <div><a class="back-link" href="/tienda/">${icons.back} Seguir comprando</a><h1>Finaliza tu pedido</h1></div>
    <p class="secure">${icons.lock} Pago protegido · Venta solo a mayores de 18 años</p>
  </div>
  <div class="checkout-grid">
    <div class="checkout-steps">
      <section class="step" aria-labelledby="step-account">
        <div class="step-head"><span class="step-num" data-account-num>1</span><h2 id="step-account">Tu celular</h2></div>
        <div data-account></div>
      </section>
      <form id="checkout-form" novalidate>
        <section class="step" data-lockable aria-labelledby="step-delivery">
          <div class="step-head"><span class="step-num">2</span><h2 id="step-delivery">Entrega</h2></div>
          <p class="step-lock">${icons.lock} Primero verifica tu celular.</p>
          <fieldset aria-labelledby="step-delivery">
            <div class="method-options">
              <label class="method"><input type="radio" name="method" value="domicilio" checked>${icons.truck}<strong>Envío a domicilio</strong><small>${SHIPPING.cities.join(' y ')} · gratis desde ${money(SHIPPING.freeFrom)}</small><span class="method-price" data-home-price></span></label>
              <label class="method"><input type="radio" name="method" value="recoger">${icons.store}<strong>Recoger en la cervecería</strong><small>Ciudad Delicias · te enviamos la ubicación</small><span class="method-price">Gratis</span></label>
            </div>
            <div class="address" data-address>
              ${field('street', 'Calle y número', '<input class="input" id="street" name="street" autocomplete="address-line1" maxlength="90" aria-describedby="street-error">', {wide: true})}
              ${field('colonia', 'Colonia', '<input class="input" id="colonia" name="colonia" autocomplete="address-level3" maxlength="60" aria-describedby="colonia-error">')}
              ${field('city', 'Ciudad', `<select class="input" id="city" name="city" autocomplete="address-level2" aria-describedby="city-error">${SHIPPING.cities.map(city => `<option>${city}</option>`).join('')}</select>`)}
              ${field('references', 'Referencias <small>(opcional)</small>', '<input class="input" id="references" name="references" maxlength="140" placeholder="Entre calles, color de la fachada…">', {wide: true})}
            </div>
            <p class="pickup-note" data-pickup hidden>Te avisaremos cuando tu pedido esté listo y te compartiremos la ubicación de la cervecería. Presenta una identificación oficial al recoger.</p>
          </fieldset>
        </section>
        <section class="step" data-lockable aria-labelledby="step-payment">
          <div class="step-head"><span class="step-num">3</span><h2 id="step-payment">Pago con tarjeta</h2></div>
          <p class="step-lock">${icons.lock} Primero verifica tu celular.</p>
          <fieldset aria-labelledby="step-payment">
            <div class="demo-cards">
              <p><strong>Modo demostración:</strong> no se hace ningún cargo y el número completo nunca se guarda. Usa una tarjeta de prueba (vencimiento futuro y cualquier CVV):</p>
              <ul>${TEST_CARDS.map(([number, label]) => `<li><button type="button" data-test-card="${number}">${formatCardNumber(number)}<span>${label}</span></button></li>`).join('')}</ul>
            </div>
            <div class="card-grid">
              ${field('cardNumber', 'Número de tarjeta', `<div class="card-input"><input class="input" id="cardNumber" name="cardNumber" inputmode="numeric" autocomplete="off" placeholder="1234 5678 9012 3456" maxlength="19" aria-describedby="cardNumber-error"><span class="card-brand" data-card-brand>Tarjeta</span></div>`, {wide: true})}
              ${field('cardName', 'Nombre en la tarjeta', '<input class="input" id="cardName" name="cardName" autocomplete="off" maxlength="60" aria-describedby="cardName-error">', {wide: true})}
              ${field('cardExpiry', 'Vencimiento', '<input class="input" id="cardExpiry" name="cardExpiry" inputmode="numeric" autocomplete="off" placeholder="MM/AA" maxlength="5" aria-describedby="cardExpiry-error">')}
              ${field('cardCvc', 'Código de seguridad', '<input class="input" id="cardCvc" name="cardCvc" inputmode="numeric" autocomplete="off" placeholder="123" maxlength="3" aria-describedby="cardCvc-error">')}
            </div>
            <p class="form-error" role="alert" data-form-error hidden></p>
            <button class="btn btn-primary btn-block btn-pay" type="submit">${icons.lock} Pagar <span data-pay-total></span></button>
            <p class="pay-note">Tu pedido se confirma en cuanto se aprueba el pago. Al recibir se pedirá una identificación oficial.</p>
          </fieldset>
        </section>
      </form>
    </div>
    <aside class="summary" aria-labelledby="summary-title">
      <button type="button" class="summary-toggle" aria-expanded="false" aria-controls="summary-body"><span>Resumen · <span data-summary-count></span></span><strong data-summary-total></strong>${icons.arrow}</button>
      <div class="summary-body" id="summary-body" hidden>
        <h2 id="summary-title">Tu pedido</h2>
        <div data-summary-lines></div>
        <button type="button" class="link-button" data-cart-open>Editar carrito</button>
        <div data-totals></div>
        <p class="savings-note" data-savings hidden></p>
        <p class="alert" data-summary-alert hidden></p>
      </div>
    </aside>
  </div>`;
  form = $('#checkout-form');
  bindForm();
  renderAccount();
  renderSummary();
}

// --- Paso 1: cuenta -------------------------------------------------------------

function renderAccount() {
  const holder = $('[data-account]');
  if (!holder) return;
  const session = getSession();
  auth?.destroy();
  auth = null;
  $('[data-account-num]').classList.toggle('is-done', Boolean(session));
  $('[data-account-num]').innerHTML = session ? icons.check : '1';
  for (const step of $$('[data-lockable]')) {
    step.classList.toggle('is-locked', !session);
    step.querySelector('fieldset').disabled = !session;
  }
  if (!session) {
    auth = mountPhoneAuth(holder, {
      title: 'Tu celular',
      lead: 'Lo usamos como tu cuenta: te enviamos un código para confirmarlo y ahí te avisamos del pedido. Sin correo ni contraseña.',
      onDone: () => { renderAccount(); form.elements.street.focus(); }
    });
    return;
  }
  holder.innerHTML = `<div class="account-summary">
    <p><strong>${esc(session.name)}</strong><br>${displayPhone(session.phone)} · avisos por ${channelName(session.channel)}</p>
    <button type="button" class="link-button" data-switch-account>Usar otro número</button>
  </div>`;
  holder.querySelector('[data-switch-account]').addEventListener('click', () => api.signOut());
  // Dirección de su pedido anterior, si los campos siguen vacíos.
  const address = api.getProfile()?.address;
  if (address && !form.elements.street.value) {
    form.elements.street.value = address.street;
    form.elements.colonia.value = address.colonia;
    form.elements.city.value = address.city;
    form.elements.references.value = address.references ?? '';
  }
  if (!form.elements.cardName.value) form.elements.cardName.value = session.name;
}

// --- Resumen y totales ------------------------------------------------------------

const method = () => form?.elements.method.value ?? 'domicilio';

function renderSummary() {
  const quote = cartQuote();
  if (!quote.lines.length) return renderEmpty();
  const shipping = shippingCost(quote.subtotal, method());
  const total = quote.subtotal + shipping;
  $('[data-summary-lines]').innerHTML = itemsList(quote.lines.map(line => ({...line, name: line.product.name})));
  $('[data-totals]').innerHTML = totalsList({subtotal: quote.subtotal, bottles: quote.bottles, shipping, total});
  $('[data-summary-count]').textContent = plural(quote.items, 'artículo');
  $('[data-summary-total]').textContent = money(total);
  $('[data-pay-total]').textContent = money(total);
  const homeShipping = shippingCost(quote.subtotal, 'domicilio');
  $('[data-home-price]').textContent = homeShipping ? money(homeShipping) : 'Gratis';
  const savings = $('[data-savings]');
  savings.hidden = !quote.savings;
  savings.textContent = `Ahorras ${money(quote.savings)} por comprar en presentación.`;
  const alert = $('[data-summary-alert]');
  alert.hidden = !quote.unavailable.length;
  alert.textContent = quote.unavailable.length
    ? `${quote.unavailable.map(line => line.product.name).join(', ')} se agotó. Quítala del carrito para poder pagar.` : '';
}

function renderEmpty() {
  auth?.destroy();
  auth = null;
  form = null;
  main.innerHTML = `<div class="checkout-empty">
    <h2>Tu carrito está vacío</h2>
    <p>Elige tus cervezas por unidad, six, 12, 18 o caja de 24.</p>
    <a class="btn btn-primary" href="/tienda/">Ir a la tienda</a>
    ${getSession() ? '<a class="btn btn-ghost" href="/cuenta/">Ver mis pedidos</a>' : ''}
  </div>`;
}

// --- Formulario ------------------------------------------------------------------

function setError(name, message) {
  const input = form.elements[name];
  const error = $(`#${name}-error`);
  if (input instanceof HTMLElement) input.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (error) { error.hidden = !message; error.textContent = message ?? ''; }
}

function formError(message) {
  const box = $('[data-form-error]');
  box.hidden = !message;
  box.textContent = message ?? '';
}

function updateBrand() {
  const brand = cardBrand(form.elements.cardNumber.value);
  const badge = $('[data-card-brand]');
  badge.textContent = brand ? BRAND_NAMES[brand] : 'Tarjeta';
  badge.classList.toggle('is-known', Boolean(brand));
  form.elements.cardNumber.maxLength = brand === 'amex' ? 17 : 19;
  form.elements.cardCvc.maxLength = cvcLength(brand);
  form.elements.cardCvc.placeholder = brand === 'amex' ? '1234' : '123';
}

// Revisión en el navegador; el "servidor" vuelve a validar al cobrar.
function validate() {
  const errors = [];
  const values = form.elements;
  if (method() === 'domicilio') {
    if (values.street.value.trim().length < 5) errors.push(['street', 'Escribe calle y número.']);
    if (values.colonia.value.trim().length < 3) errors.push(['colonia', 'Escribe tu colonia.']);
  }
  const number = onlyDigits(values.cardNumber.value);
  const brand = cardBrand(number);
  if (!number) errors.push(['cardNumber', 'Escribe el número de tu tarjeta.']);
  else if (!brand) errors.push(['cardNumber', 'Aceptamos Visa, Mastercard y American Express.']);
  else if (number.length !== cardLength(brand) || !luhn(number)) errors.push(['cardNumber', 'Revisa el número de tu tarjeta.']);
  if (values.cardName.value.trim().length < 3) errors.push(['cardName', 'Escribe el nombre como aparece en la tarjeta.']);
  const expiry = parseExpiry(values.cardExpiry.value);
  if (!expiry.valid) errors.push(['cardExpiry', expiry.reason === 'expired' ? 'Esta tarjeta ya venció.' : 'Usa el formato MM/AA.']);
  if (onlyDigits(values.cardCvc.value).length !== cvcLength(brand)) errors.push(['cardCvc', `Son ${cvcLength(brand)} dígitos.`]);
  return errors;
}

function bindForm() {
  const values = form.elements;
  form.addEventListener('change', event => {
    if (event.target.name !== 'method') return;
    const pickup = method() === 'recoger';
    $('[data-address]').hidden = pickup;
    $('[data-pickup]').hidden = !pickup;
    renderSummary();
  });
  form.addEventListener('input', event => {
    const input = event.target;
    if (input.type === 'radio') return;
    if (input.name) setError(input.name, null);
    const atEnd = input.selectionStart === input.value.length;
    if (input.name === 'cardNumber') {
      if (atEnd) input.value = formatCardNumber(input.value);
      updateBrand();
    }
    if (input.name === 'cardExpiry' && atEnd && event.inputType !== 'deleteContentBackward') input.value = formatExpiry(input.value);
    if (input.name === 'cardCvc') input.value = onlyDigits(input.value);
  });
  form.addEventListener('click', event => {
    const test = event.target.closest('[data-test-card]');
    if (!test) return;
    values.cardNumber.value = formatCardNumber(test.dataset.testCard);
    updateBrand();
    if (!values.cardExpiry.value) values.cardExpiry.value = '12/30';
    if (!values.cardCvc.value) values.cardCvc.value = '123';
    for (const name of ['cardNumber', 'cardExpiry', 'cardCvc']) setError(name, null);
    formError(null);
  });
  $('.summary-toggle').addEventListener('click', event => {
    const open = event.currentTarget.getAttribute('aria-expanded') !== 'true';
    event.currentTarget.setAttribute('aria-expanded', String(open));
    $('#summary-body').hidden = !open;
  });
  form.addEventListener('submit', pay);
}

async function pay(event) {
  event.preventDefault();
  if (placing) return;
  formError(null);
  const session = getSession();
  if (!session) {
    $('[data-account]').scrollIntoView({behavior: 'smooth', block: 'center'});
    return;
  }
  const errors = validate();
  for (const [name, message] of errors) setError(name, message);
  if (errors.length) {
    form.elements[errors[0][0]].focus();
    return;
  }
  const quote = cartQuote();
  if (quote.unavailable.length) return formError('Hay cervezas agotadas en tu carrito. Quítalas para continuar.');

  const values = form.elements;
  const delivery = method() === 'recoger' ? {method: 'recoger'} : {
    method: 'domicilio', city: values.city.value, street: values.street.value, colonia: values.colonia.value, references: values.references.value
  };
  const card = {number: values.cardNumber.value, name: values.cardName.value, expiry: values.cardExpiry.value, cvc: values.cardCvc.value};
  placing = true;
  const overlay = document.createElement('div');
  overlay.className = 'processing';
  overlay.setAttribute('role', 'status');
  overlay.innerHTML = `<span class="spinner" aria-hidden="true"></span><strong>Procesando pago</strong><p>Confirmando ${money(quote.subtotal + shippingCost(quote.subtotal, delivery.method))} con tu banco…</p>`;
  document.body.append(overlay);
  const header = $('.shop-header');
  main.inert = header.inert = true;
  try {
    const order = await api.placeOrder({items: getCart(), delivery, card});
    confirmed = order;
    clearCart();
    renderConfirmation(order);
    phoneNotice({channel: session.channel, body: confirmationMessage(order)});
  } catch (error) {
    if (error.code === 'auth') renderAccount();
    if (error.code === 'card_declined') {
      formError(`Pago rechazado. ${error.message}`);
      form.elements.cardNumber.focus();
    } else if (error.field && form.elements[error.field]) {
      setError(error.field, error.message);
      form.elements[error.field].focus();
    } else {
      formError(error.message);
    }
  } finally {
    placing = false;
    overlay.remove();
    main.inert = header.inert = false;
    // Nunca dejes el número completo en el formulario tras un intento.
    if (form && !confirmed) form.elements.cardCvc.value = '';
  }
}

// --- Confirmación -------------------------------------------------------------------

function renderConfirmation(order) {
  auth?.destroy();
  const count = order.items.reduce((total, item) => total + item.qty, 0);
  main.innerHTML = `<section class="confirmation" aria-labelledby="confirm-title">
    <span class="confirm-icon">${icons.check}</span>
    <p class="kicker">Pago aprobado · ${cardLabel(order.payment)}</p>
    <h1 id="confirm-title" tabindex="-1">¡Salud, ${esc(firstName(order.customer.name))}!<br>Tu pedido está confirmado.</h1>
    <p class="confirm-id">Pedido <strong>${order.id}</strong> · ${formatDateTime(order.createdAt)} · ${plural(count, 'artículo')} · ${bottlesLabel(order.bottles)}</p>
    <div data-tracker>${orderTracker(order)}</div>
    <div class="confirm-grid">
      <div><h3>Entrega</h3><p>${deliveryText(order.delivery)}</p></div>
      <div><h3>Pago</h3><p>${cardLabel(order.payment)}<br>Autorización ${esc(order.payment.authCode)}</p></div>
      <div><h3>Avisos</h3><p>Por ${channelName(order.channel)} al ${displayPhone(order.customer.phone)}</p></div>
    </div>
    ${itemsList(order.items)}
    ${totalsList(order)}
    <div class="confirm-actions"><a class="btn btn-primary" href="/cuenta/">Seguir mi pedido</a><a class="btn btn-ghost" href="/tienda/">Volver a la tienda</a></div>
  </section>`;
  scrollTo({top: 0});
  $('#confirm-title').focus({preventScroll: true});
}

subscribe(key => {
  if (confirmed) {
    // El seguimiento avanza en vivo cuando el back office cambia el estado.
    if (key === 'db.orders' || key === '*') {
      const order = api.ordersSnapshot().find(item => item.id === confirmed.id);
      const tracker = $('[data-tracker]');
      if (order && tracker) tracker.innerHTML = orderTracker(order);
    }
    return;
  }
  if (key === 'cart' || key === 'catalog' || key === '*') {
    if (!form && cartQuote().lines.length) renderPage();
    else if (form) renderSummary();
  }
  if ((key === 'session' || key === '*') && form) renderAccount();
});

if (cartQuote().lines.length) renderPage();
else renderEmpty();
