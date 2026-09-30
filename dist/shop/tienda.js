// Página de la tienda: las cinco cervezas con su selector de presentación.
import {initShopChrome, packPicker, packSummary, stepper, announceAdded, rerender, $} from './ui.js';
import {getProducts, getProduct, addToCart, subscribe} from './store.js';
import {bottleImage, packQuote, DEFAULT_PACK, MAX_LINE_QTY, BOTTLE_ML} from './data.js';
import {money, esc} from './util.js';

initShopChrome();

const list = $('#productos');
const picks = {};  // id -> {size, qty} elegido por el visitante

function productHTML(product, index, all) {
  const pick = picks[product.id] ??= {size: DEFAULT_PACK, qty: 1};
  const total = packQuote(product.price, pick.size).price * pick.qty;
  return `<article class="product${product.available ? '' : ' is-sold-out'}" id="${product.id}" style="--p-bg:${product.bg};--p-fg:${product.fg}" aria-labelledby="name-${product.id}">
    <span class="product-index">0${index + 1} / 0${all.length}</span>
    <span class="product-word" aria-hidden="true">${product.word}</span>
    ${product.available ? '' : '<span class="sold-badge">Agotada</span>'}
    <div class="product-visual"><img class="product-photo" src="${bottleImage(product.id)}" alt="Botella de ${esc(product.name)}, ${BOTTLE_ML} ml" width="190" height="720"${index > 1 ? ' loading="lazy"' : ''}></div>
    <div class="product-copy">
      <p class="eyebrow"><span>${esc(product.style)}</span><span><strong>${product.abv}%</strong> alc. vol.</span><span>${BOTTLE_ML} ml</span></p>
      <h2 id="name-${product.id}">${esc(product.name)}</h2>
      <p class="product-desc">${esc(product.description)}</p>
      <ul class="product-notes" aria-label="Perfil de sabor">${product.notes.map(note => `<li>${esc(note)}</li>`).join('')}</ul>
      <p class="product-pairing"><span>VA MUY BIEN CON</span>${esc(product.pairing)}</p>
    </div>
    <form class="product-buy" data-product="${product.id}" aria-label="Comprar ${esc(product.name)}">
      <div class="product-buy-head"><p>Precio por botella</p><strong>${money(product.price)}</strong></div>
      ${packPicker(product, pick.size, `pack-${product.id}`, {compact: true})}
      <p class="pack-summary" data-summary>${packSummary(product, pick.size)}</p>
      <div class="buy-row">
        <div data-qty>${stepper(pick.qty, {key: `qty-${product.id}`, label: `Cantidad de ${product.name}`, disabled: !product.available})}</div>
        <button class="btn btn-primary" type="submit" data-focus="add-${product.id}" ${product.available ? '' : 'disabled'}>${product.available ? `Agregar · <span data-total>${money(total)}</span>` : 'Agotada por ahora'}</button>
      </div>
      ${product.available ? '' : '<p class="sold-out">La estamos reponiendo. Mientras tanto, prueba otro estilo de la casa.</p>'}
    </form>
  </article>`;
}

function render() {
  const products = getProducts();
  rerender(list, products.map((product, index) => productHTML(product, index, products)).join(''));
}

function refresh(form) {
  const product = getProduct(form.dataset.product);
  const pick = picks[product.id];
  form.querySelector('[data-summary]').innerHTML = packSummary(product, pick.size);
  const total = form.querySelector('[data-total]');
  if (total) total.textContent = money(packQuote(product.price, pick.size).price * pick.qty);
  rerender(form.querySelector('[data-qty]'), stepper(pick.qty, {key: `qty-${product.id}`, label: `Cantidad de ${product.name}`, disabled: !product.available}));
}

list.addEventListener('change', event => {
  const form = event.target.closest('[data-product]');
  if (!form || event.target.type !== 'radio') return;
  picks[form.dataset.product].size = Number(event.target.value);
  refresh(form);
});

list.addEventListener('click', event => {
  const step = event.target.closest('[data-step]');
  const form = step?.closest('[data-product]');
  if (!form) return;
  const pick = picks[form.dataset.product];
  pick.qty = Math.min(MAX_LINE_QTY, Math.max(1, pick.qty + Number(step.dataset.step)));
  refresh(form);
});

list.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  const product = getProduct(form.dataset.product);
  if (!product?.available) return;
  const pick = picks[product.id];
  addToCart(product.id, pick.size, pick.qty);
  announceAdded(product, pick.size, pick.qty);
  pick.qty = 1;
  refresh(form);
});

render();
// Precios y disponibilidad cambian en vivo desde el back office.
subscribe(key => { if (key === 'catalog' || key === '*') render(); });
if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
