// Mis pedidos: acceso con celular y seguimiento en vivo de cada pedido.
import {initShopChrome, mountPhoneAuth, orderTracker, itemsList, totalsList, deliveryText, cardLabel, $} from './ui.js';
import {getSession, subscribe, firstName} from './store.js';
import * as api from './api.js';
import {STATUS} from './data.js';
import {esc, plural, displayPhone, formatDateTime} from './util.js';

initShopChrome();

const main = $('#main');
let auth = null;
let view = null;  // 'auth' | 'orders'

function orderCard(order, open) {
  const count = order.items.reduce((total, item) => total + item.qty, 0);
  return `<article class="order-card" data-order="${order.id}" aria-labelledby="title-${order.id}">
    <header>
      <div><h2 id="title-${order.id}">Pedido ${order.id}</h2><p>${formatDateTime(order.createdAt)} · ${plural(count, 'artículo')} · ${cardLabel(order.payment)}</p></div>
      <span class="status-pill is-${order.status}">${STATUS[order.status].customer}</span>
    </header>
    ${orderTracker(order)}
    <details${open ? ' open' : ''}>
      <summary>Ver detalle</summary>
      <div class="order-detail">
        <div>${itemsList(order.items)}</div>
        <div>
          <h3>${order.delivery.method === 'recoger' ? 'Recolección' : 'Entrega a domicilio'}</h3>
          <p>${deliveryText(order.delivery)}</p>
          <h3>Pago</h3>
          <p>${cardLabel(order.payment)} · Autorización ${esc(order.payment.authCode)}</p>
          ${totalsList(order)}
        </div>
      </div>
    </details>
  </article>`;
}

async function renderOrders() {
  const session = getSession();
  const opened = new Set([...main.querySelectorAll('.order-card details[open]')].map(el => el.closest('[data-order]').dataset.order));
  const orders = await api.myOrders();
  if (getSession()?.phone !== session?.phone) return;  // cambió la sesión mientras cargaba
  const activeId = orders.find(api.isOpenOrder)?.id;
  main.innerHTML = `<div class="account-head">
      <div><p class="kicker">Mi cuenta</p><h1>Hola, ${esc(firstName(session.name))}</h1><p>${displayPhone(session.phone)} · avisos por ${session.channel === 'sms' ? 'SMS' : 'WhatsApp'}</p></div>
      <button type="button" class="btn btn-ghost" data-sign-out>Cerrar sesión</button>
    </div>
    ${orders.length ? `<div class="order-list">${orders.map(order => orderCard(order, opened.size ? opened.has(order.id) : order.id === activeId)).join('')}</div>` : `
    <div class="checkout-empty">
      <h2>Aún no tienes pedidos</h2>
      <p>Cuando compres, aquí verás en qué va cada uno: preparación, envío y entrega.</p>
      <a class="btn btn-primary" href="/tienda/">Ir a la tienda</a>
    </div>`}`;
  main.querySelector('[data-sign-out]').addEventListener('click', () => api.signOut());
}

function render() {
  const session = getSession();
  if (!session) {
    if (view === 'auth') return;
    view = 'auth';
    main.innerHTML = '<section class="account-auth"></section>';
    auth = mountPhoneAuth(main.firstElementChild, {
      title: 'Mis pedidos',
      lead: 'Entra con tu celular para ver y seguir tus pedidos. Te enviamos un código por WhatsApp o SMS.'
    });
    return;
  }
  auth?.destroy();
  auth = null;
  view = 'orders';
  renderOrders();
}

subscribe(key => {
  if (key === 'session' || key === '*') render();
  else if (key === 'db.orders' && view === 'orders') renderOrders();
});
render();
