// Estado del navegador: almacenamiento, avisos entre pestañas, catálogo,
// carrito y sesión. Las pestañas abiertas (tienda y back office) se enteran de
// cada cambio mediante el evento `storage`, así la demo funciona en vivo sin
// servidor.
import {beers, packBySize, quoteLines, MAX_LINE_QTY} from './data.js';

const NS = 'delicia.v1.';

// localStorage puede no existir (Node) o estar bloqueado (modo privado
// estricto); en ese caso la demo sigue funcionando en memoria.
const storage = (() => {
  try {
    const probe = `${NS}probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    const data = new Map();
    return {
      getItem: key => data.has(key) ? data.get(key) : null,
      setItem: (key, value) => data.set(key, String(value)),
      removeItem: key => data.delete(key)
    };
  }
})();

export function read(key, fallback) {
  try {
    const raw = storage.getItem(NS + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  try { storage.setItem(NS + key, JSON.stringify(value)); } catch { /* cuota llena: se conserva el estado previo */ }
  notify(key, false);
}

export function remove(key) {
  storage.removeItem(NS + key);
  notify(key, false);
}

const listeners = new Set();

// fn(key, external): external es true cuando el cambio vino de otra pestaña.
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(key, external) {
  for (const fn of [...listeners]) fn(key, external);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key === null) notify('*', true);
    else if (event.key.startsWith(NS)) notify(event.key.slice(NS.length), true);
  });
}

// Catálogo: datos base + ajustes de precio y disponibilidad del back office.
export function getProducts() {
  const overrides = read('catalog', {});
  return beers.map(beer => ({
    ...beer,
    price: overrides[beer.id]?.price ?? beer.price,
    available: overrides[beer.id]?.available ?? true
  }));
}

export const getProduct = id => getProducts().find(product => product.id === id);
export const productsById = () => Object.fromEntries(getProducts().map(product => [product.id, product]));

// Carrito: [{id, size, qty}], precios siempre calculados al vuelo.
export function getCart() {
  const cart = read('cart', []);
  if (!Array.isArray(cart)) return [];
  return cart.filter(line => beers.some(beer => beer.id === line?.id) && packBySize(line.size) && line.qty > 0);
}

export function addToCart(id, size, qty = 1) {
  const cart = getCart();
  const line = cart.find(item => item.id === id && item.size === size);
  if (line) line.qty = Math.min(MAX_LINE_QTY, line.qty + qty);
  else cart.push({id, size, qty: Math.min(MAX_LINE_QTY, qty)});
  write('cart', cart);
}

export function setLineQty(id, size, qty) {
  const cart = getCart();
  const next = qty > 0
    ? cart.map(line => line.id === id && line.size === size ? {...line, qty: Math.min(MAX_LINE_QTY, qty)} : line)
    : cart.filter(line => !(line.id === id && line.size === size));
  write('cart', next);
}

export const clearCart = () => write('cart', []);
export const cartQuote = () => quoteLines(getCart(), productsById());

// Sesión del cliente: {phone, name, channel, since}.
export const getSession = () => read('session', null);
export const setSession = user => write('session', {phone: user.phone, name: user.name, channel: user.channel, since: new Date().toISOString()});
export const clearSession = () => remove('session');
export const firstName = name => String(name ?? '').trim().split(/\s+/)[0] ?? '';
