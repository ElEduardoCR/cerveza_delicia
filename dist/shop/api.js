// Backend simulado de la tienda. Todo vive en el localStorage de este
// navegador para que la demostración funcione sin servidor ni cuentas externas.
//
// Cada función es asíncrona y tiene la forma de una llamada real, de modo que
// para producción basta con sustituir su interior por fetch() a una API:
// - sendCode / verifyCode: Twilio Verify, Meta WhatsApp Cloud API o similar.
// - placeOrder: el cobro con Stripe, Conekta u Openpay (tokenizando la tarjeta
//   en el navegador con sus campos seguros) y el pedido en una base de datos.
// - funciones del back office: requieren autenticación real en el servidor.
import {read, write, remove, getSession, setSession, clearSession, productsById, getProducts} from './store.js';
import {beers, beerById, packBySize, quoteLines, shippingCost, statusFlow, canMoveTo, isOpenOrder, SHIPPING, PRICE_RANGE, STATUS} from './data.js';
import {onlyDigits, isValidPhone, luhn, cardBrand, cardLength, cvcLength, parseExpiry, BRAND_NAMES, money} from './util.js';

export class ApiError extends Error {
  constructor(code, message, field = null) {
    super(message);
    this.code = code;
    this.field = field;
  }
}

// Latencia simulada (multiplicador). Las pruebas la ponen en 0.
export const config = {latency: 1};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms * config.latency));

const randomInt = max => crypto.getRandomValues(new Uint32Array(1))[0] % max;
const randomCode = (length, alphabet = '0123456789') =>
  Array.from({length}, () => alphabet[randomInt(alphabet.length)]).join('');

// --- Verificación por SMS / WhatsApp ---------------------------------------

export const OTP = {ttl: 5 * 60_000, resend: 30_000, attempts: 5};

export async function sendCode(phone, channel) {
  await wait(800);
  if (!isValidPhone(phone)) throw new ApiError('phone', 'Escribe un celular de 10 dígitos.', 'phone');
  if (channel !== 'whatsapp' && channel !== 'sms') throw new ApiError('channel', 'Elige WhatsApp o SMS.');
  const pending = read('otp', null);
  const now = Date.now();
  if (pending?.phone === phone && pending.channel === channel && now - pending.sentAt < OTP.resend) {
    throw new ApiError('too_soon', 'Espera unos segundos para pedir otro código.');
  }
  const challenge = {phone, channel, code: randomCode(6), sentAt: now, expiresAt: now + OTP.ttl, attempts: 0};
  write('otp', challenge);
  // Solo porque es una simulación devolvemos el código: la interfaz lo muestra
  // como el mensaje que llegaría al celular. Un backend real nunca lo expone.
  return {channel, code: challenge.code, resendAt: now + OTP.resend};
}

export async function verifyCode(phone, code) {
  await wait(700);
  const pending = read('otp', null);
  if (!pending || pending.phone !== phone) throw new ApiError('no_code', 'Solicita un código nuevo.');
  if (Date.now() > pending.expiresAt) {
    remove('otp');
    throw new ApiError('expired', 'El código expiró. Solicita uno nuevo.');
  }
  if (pending.attempts >= OTP.attempts) throw new ApiError('locked', 'Demasiados intentos. Solicita un código nuevo.');
  if (onlyDigits(code) !== pending.code) {
    pending.attempts += 1;
    write('otp', pending);
    const left = OTP.attempts - pending.attempts;
    if (!left) throw new ApiError('locked', 'Demasiados intentos. Solicita un código nuevo.');
    throw new ApiError('invalid', `Código incorrecto. ${left === 1 ? 'Te queda 1 intento' : `Te quedan ${left} intentos`}.`);
  }
  remove('otp');
  const user = read('db.users', {})[phone];
  if (user) {
    const updated = {...user, channel: pending.channel};
    saveUser(updated);
    setSession(updated);
    return {user: updated, isNew: false};
  }
  // Número verificado pero sin cuenta: un token corto permite registrarlo.
  const token = randomCode(24, 'abcdefghijklmnopqrstuvwxyz0123456789');
  write('verified', {phone, channel: pending.channel, token, expiresAt: Date.now() + 15 * 60_000});
  return {isNew: true, token};
}

export async function register({token, name, adult}) {
  await wait(500);
  const verified = read('verified', null);
  if (!verified || verified.token !== token || Date.now() > verified.expiresAt) {
    throw new ApiError('expired', 'Tu verificación expiró. Vuelve a solicitar el código.');
  }
  const clean = String(name ?? '').trim().replace(/\s+/g, ' ');
  if (clean.length < 3) throw new ApiError('name', 'Escribe tu nombre y apellido.', 'name');
  if (clean.length > 60) throw new ApiError('name', 'Usa máximo 60 caracteres.', 'name');
  if (!adult) throw new ApiError('adult', 'La venta de cerveza es solo para mayores de 18 años.', 'adult');
  const user = {phone: verified.phone, name: clean, channel: verified.channel, createdAt: new Date().toISOString()};
  saveUser(user);
  remove('verified');
  setSession(user);
  return user;
}

export const signOut = () => clearSession();

function saveUser(user) {
  const users = read('db.users', {});
  users[user.phone] = {...users[user.phone], ...user};
  write('db.users', users);
}

export function getProfile() {
  const session = getSession();
  return session ? read('db.users', {})[session.phone] ?? null : null;
}

// --- Pedidos ---------------------------------------------------------------

const readOrders = () => {
  const orders = read('db.orders', []);
  return Array.isArray(orders) ? orders : [];
};

function nextOrderId() {
  const seq = read('db.seq', 1000) + 1;
  write('db.seq', seq);
  return `DEL-${seq}`;
}

// Tarjetas de prueba que el cobro simulado rechaza.
export const DECLINED_CARDS = {
  '4000000000000002': 'Tu banco rechazó el pago. Intenta con otra tarjeta.',
  '4000000000009995': 'Fondos insuficientes. Intenta con otra tarjeta.'
};

export function validateCard(card) {
  const number = onlyDigits(card.number);
  const brand = cardBrand(number);
  if (String(card.name ?? '').trim().length < 3) return new ApiError('card_name', 'Escribe el nombre como aparece en la tarjeta.', 'cardName');
  if (!brand) return new ApiError('card_brand', 'Aceptamos Visa, Mastercard y American Express.', 'cardNumber');
  if (number.length !== cardLength(brand) || !luhn(number)) return new ApiError('card_number', 'Revisa el número de tu tarjeta.', 'cardNumber');
  const expiry = parseExpiry(card.expiry);
  if (!expiry.valid) return new ApiError('card_expiry', expiry.reason === 'expired' ? 'Esta tarjeta ya venció.' : 'Usa el formato MM/AA.', 'cardExpiry');
  if (onlyDigits(card.cvc).length !== cvcLength(brand)) return new ApiError('card_cvc', `El código de seguridad tiene ${cvcLength(brand)} dígitos.`, 'cardCvc');
  return null;
}

export function validateDelivery(delivery) {
  if (delivery?.method === 'recoger') return null;
  if (delivery?.method !== 'domicilio') return new ApiError('delivery', 'Elige cómo quieres recibir tu pedido.');
  if (!SHIPPING.cities.includes(delivery.city)) return new ApiError('city', 'Por ahora entregamos en Delicias y Meoqui.', 'city');
  if (String(delivery.street ?? '').trim().length < 5) return new ApiError('street', 'Escribe calle y número.', 'street');
  if (String(delivery.colonia ?? '').trim().length < 3) return new ApiError('colonia', 'Escribe tu colonia.', 'colonia');
  return null;
}

function cleanDelivery(delivery) {
  if (delivery.method === 'recoger') return {method: 'recoger'};
  const text = (value, max) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
  return {method: 'domicilio', city: delivery.city, street: text(delivery.street, 90), colonia: text(delivery.colonia, 60), references: text(delivery.references, 140)};
}

// El "servidor" recalcula precios con su catálogo, valida y cobra.
export async function placeOrder({items, delivery, card}) {
  const session = getSession();
  if (!session) throw new ApiError('auth', 'Verifica tu celular para continuar.');
  const quote = quoteLines(items ?? [], productsById());
  if (!quote.lines.length) throw new ApiError('empty', 'Tu carrito está vacío.');
  if (quote.unavailable.length) {
    const names = quote.unavailable.map(line => line.product.name).join(', ');
    throw new ApiError('unavailable', `${names} se agotó mientras comprabas. Quítala del carrito para continuar.`);
  }
  const problem = validateDelivery(delivery) ?? validateCard(card);
  if (problem) throw problem;

  await wait(1700);
  const number = onlyDigits(card.number);
  if (DECLINED_CARDS[number]) throw new ApiError('card_declined', DECLINED_CARDS[number], 'cardNumber');

  const now = new Date().toISOString();
  const shipping = shippingCost(quote.subtotal, delivery.method);
  const order = {
    id: nextOrderId(),
    createdAt: now,
    customer: {name: session.name, phone: session.phone},
    channel: session.channel,
    items: quote.lines.map(line => ({id: line.id, name: line.product.name, size: line.size, packName: line.packName, qty: line.qty, price: line.price, total: line.total, bottles: line.bottles})),
    bottles: quote.bottles,
    subtotal: quote.subtotal,
    savings: quote.savings,
    shipping,
    total: quote.subtotal + shipping,
    delivery: cleanDelivery(delivery),
    payment: {brand: cardBrand(number), last4: number.slice(-4), authCode: randomCode(6, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'), status: 'aprobado'},
    status: 'nuevo',
    history: [{status: 'nuevo', at: now}],
    demo: false
  };
  write('db.orders', [order, ...readOrders()]);
  if (order.delivery.method === 'domicilio') saveUser({...getProfile(), phone: session.phone, address: order.delivery});
  return order;
}

export async function myOrders() {
  await wait(250);
  const session = getSession();
  if (!session) return [];
  return readOrders().filter(order => order.customer.phone === session.phone);
}

export const ordersSnapshot = () => readOrders();

// --- Back office -----------------------------------------------------------
// En la demo el PIN solo separa las vistas; un back office real necesita
// usuarios propios, contraseñas con hash y permisos validados en el servidor.

export const DEMO_PIN = '2020';

export async function adminLogin(pin) {
  await wait(500);
  if (onlyDigits(pin) !== DEMO_PIN) throw new ApiError('pin', 'PIN incorrecto.', 'pin');
  write('admin', {since: new Date().toISOString()});
}
export const isAdmin = () => Boolean(read('admin', null));
export const adminLogout = () => remove('admin');

function requireAdmin() {
  if (!isAdmin()) throw new ApiError('forbidden', 'Tu sesión del back office terminó.');
}

export async function listOrders() {
  requireAdmin();
  await wait(150);
  return readOrders();
}

export async function setOrderStatus(id, status) {
  requireAdmin();
  await wait(350);
  const orders = readOrders();
  const order = orders.find(item => item.id === id);
  if (!order) throw new ApiError('not_found', 'No encontramos ese pedido.');
  if (!canMoveTo(order, status)) throw new ApiError('transition', `Este pedido ahora está como «${STATUS[order.status].label}».`);
  const at = new Date().toISOString();
  order.status = status;
  order.history.push({status, at});
  if (status === 'cancelado') order.payment = {...order.payment, status: 'reembolsado', refund: {amount: order.total, at}};
  write('db.orders', orders);
  return order;
}

export async function updateProduct(id, patch) {
  requireAdmin();
  await wait(200);
  if (!beerById(id)) throw new ApiError('not_found', 'Producto desconocido.');
  const catalog = read('catalog', {});
  const next = {...catalog[id]};
  if ('price' in patch) {
    const price = Number(patch.price);
    if (!Number.isInteger(price) || price < PRICE_RANGE.min || price > PRICE_RANGE.max) {
      throw new ApiError('price', `Usa un precio entero entre ${money(PRICE_RANGE.min)} y ${money(PRICE_RANGE.max)}.`, 'price');
    }
    next.price = price;
  }
  if ('available' in patch) next.available = Boolean(patch.available);
  write('catalog', {...catalog, [id]: next});
  return getProducts().find(product => product.id === id);
}

export async function listCustomers() {
  requireAdmin();
  await wait(150);
  const customers = new Map();
  for (const user of Object.values(read('db.users', {}))) {
    customers.set(user.phone, {phone: user.phone, name: user.name, since: user.createdAt, orders: 0, spent: 0, bottles: 0, lastOrder: null, demo: false});
  }
  for (const order of readOrders()) {
    const entry = customers.get(order.customer.phone) ?? {phone: order.customer.phone, name: order.customer.name, since: order.createdAt, orders: 0, spent: 0, bottles: 0, lastOrder: null, demo: order.demo};
    entry.orders += 1;
    if (order.status !== 'cancelado') { entry.spent += order.total; entry.bottles += order.bottles; }
    if (!entry.lastOrder || order.createdAt > entry.lastOrder) entry.lastOrder = order.createdAt;
    if (order.createdAt < entry.since) entry.since = order.createdAt;
    customers.set(order.customer.phone, entry);
  }
  return [...customers.values()].sort((a, b) => (b.lastOrder ?? '').localeCompare(a.lastOrder ?? ''));
}

export async function resetDemo() {
  requireAdmin();
  await wait(300);
  for (const key of ['db.orders', 'db.users', 'db.seq', 'db.seededAt', 'catalog', 'otp', 'verified', 'cart', 'session']) remove(key);
  seed();
}

// --- Datos de ejemplo ------------------------------------------------------
// Pedidos ficticios de la última semana para que el back office no arranque
// vacío. Sus números usan el prefijo 555 y el contacto queda deshabilitado.

const SEED_CUSTOMERS = [
  ['Mariana Chávez', '6395550142'], ['Luis Ortega', '6395550187'], ['Daniela Rascón', '6485550123'],
  ['Jorge Armendáriz', '6395550166'], ['Paola Villalobos', '6485550199'], ['Ricardo Holguín', '6395550111'],
  ['Sofía Terrazas', '6395550175'], ['Andrés Loya', '6485550158']
];
const SEED_ADDRESSES = {
  Delicias: [['Av. 6a Norte 415', 'Centro'], ['Calle Río Florido 1208', 'Las Palmas'], ['Av. Agricultura Poniente 310', 'Revolución']],
  Meoqui: [['Calle Morelos 820', 'Centro'], ['Av. Juárez 1415', 'Lomas de San Pedro']]
};
const SEED_CARDS = [['visa', '4821'], ['mastercard', '1107'], ['visa', '9034'], ['amex', '2005'], ['mastercard', '5561']];
// [horas atrás, cliente, entrega, estado final, artículos [id, presentación, cantidad]]
const SEED_ORDERS = [
  [148, 5, 'Delicias', 'entregado', [['pale', 12, 1], ['porter', 6, 1]]],
  [141, 6, null, 'entregado', [['pionera', 6, 2]]],
  [122, 7, 'Meoqui', 'entregado', [['monito', 24, 1]]],
  [99, 0, 'Delicias', 'entregado', [['irish', 6, 1], ['pionera', 6, 1]]],
  [94, 3, null, 'cancelado', [['porter', 1, 4], ['irish', 1, 2]]],
  [75, 4, 'Meoqui', 'entregado', [['pionera', 12, 1], ['monito', 6, 1]]],
  [52, 1, 'Delicias', 'entregado', [['pale', 24, 1]]],
  [29, 2, null, 'entregado', [['irish', 6, 1], ['porter', 6, 1], ['pale', 6, 1]]],
  [21, 6, null, 'listo', [['monito', 6, 2]]],
  [3, 0, 'Delicias', 'en_camino', [['pionera', 6, 1], ['porter', 6, 1]]],
  [1.3, 7, 'Meoqui', 'preparando', [['pale', 12, 1], ['irish', 6, 1]]],
  [.4, 3, 'Delicias', 'nuevo', [['pionera', 24, 1]]]
];
const STEP_MINUTES = {preparando: 12, en_camino: 45, listo: 40, entregado: 95, cancelado: 8};

function seed(now = Date.now()) {
  const products = Object.fromEntries(beers.map(beer => [beer.id, beer]));
  const orders = SEED_ORDERS.map(([hours, who, city, status, items], index) => {
    const created = now - hours * 3_600_000;
    const [name, phone] = SEED_CUSTOMERS[who];
    const quote = quoteLines(items.map(([id, size, qty]) => ({id, size, qty})), products);
    const method = city ? 'domicilio' : 'recoger';
    const flow = statusFlow(method);
    const steps = status === 'cancelado' ? ['nuevo', 'cancelado'] : flow.slice(0, flow.indexOf(status) + 1);
    const history = steps.map(step => ({status: step, at: new Date(Math.min(now - 60_000, created + (STEP_MINUTES[step] ?? 0) * 60_000)).toISOString()}));
    const [street, colonia] = city ? SEED_ADDRESSES[city][index % SEED_ADDRESSES[city].length] : [];
    const shipping = shippingCost(quote.subtotal, method);
    const [brand, last4] = SEED_CARDS[index % SEED_CARDS.length];
    return {
      id: `DEL-${1001 + index}`,
      createdAt: new Date(created).toISOString(),
      customer: {name, phone},
      channel: index % 3 ? 'whatsapp' : 'sms',
      items: quote.lines.map(line => ({id: line.id, name: line.product.name, size: line.size, packName: line.packName, qty: line.qty, price: line.price, total: line.total, bottles: line.bottles})),
      bottles: quote.bottles, subtotal: quote.subtotal, savings: quote.savings, shipping, total: quote.subtotal + shipping,
      delivery: city ? {method, city, street, colonia, references: ''} : {method},
      payment: {brand, last4, authCode: randomCode(6, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'), status: status === 'cancelado' ? 'reembolsado' : 'aprobado',
        ...(status === 'cancelado' ? {refund: {amount: quote.subtotal + shipping, at: history.at(-1).at}} : {})},
      status, history, demo: true
    };
  }).reverse();
  write('db.orders', [...readOrders().filter(order => !order.demo), ...orders]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  write('db.seq', Math.max(read('db.seq', 1000), 1000 + SEED_ORDERS.length));
  write('db.seededAt', now);
}

// Si la demo se abre otro día y nadie ha comprado todavía, los pedidos de
// ejemplo se regeneran para que "hoy" tenga movimiento.
export function ensureSeed() {
  const seededAt = read('db.seededAt', null);
  if (!seededAt) return seed();
  const stale = Date.now() - seededAt > 12 * 3_600_000;
  if (stale && readOrders().every(order => order.demo)) seed();
}

export const brandName = brand => BRAND_NAMES[brand] ?? 'Tarjeta';
export const packLabel = size => packBySize(size)?.name ?? `${size} botellas`;
export {isOpenOrder};

ensureSeed();
