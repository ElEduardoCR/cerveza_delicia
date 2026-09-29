// Pruebas de la tienda sin dependencias: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {packPrice, packQuote, quoteLines, shippingCost, nextStatus, canMoveTo, beers} from '../dist/shop/data.js';
import {money, esc, normalizePhone, isValidPhone, formatPhone, luhn, cardBrand, formatCardNumber, formatExpiry, parseExpiry} from '../dist/shop/util.js';
import {getCart, addToCart, setLineQty, clearCart, cartQuote, getSession} from '../dist/shop/store.js';
import * as api from '../dist/shop/api.js';

api.config.latency = 0;

test('precios por presentación con descuento redondeado a $5', () => {
  assert.deepEqual([1, 6, 12, 18, 24].map(size => packPrice(65, size)), [65, 370, 720, 1055, 1325]);
  assert.deepEqual([1, 6, 12, 18, 24].map(size => packPrice(70, size)), [70, 400, 775, 1135, 1430]);
  assert.equal(packQuote(65, 24).savings, 65 * 24 - 1325);
  assert.throws(() => packPrice(65, 5), RangeError);
});

test('cotización de líneas ignora basura y marca agotados', () => {
  const products = Object.fromEntries(beers.map(beer => [beer.id, {...beer, available: beer.id !== 'porter'}]));
  const quote = quoteLines([
    {id: 'pionera', size: 6, qty: 2}, {id: 'porter', size: 1, qty: 3},
    {id: 'nope', size: 6, qty: 1}, {id: 'pale', size: 7, qty: 1}, {id: 'pale', size: 6, qty: 0}
  ], products);
  assert.equal(quote.lines.length, 2);
  assert.equal(quote.subtotal, 370 * 2 + 70 * 3);
  assert.equal(quote.bottles, 15);
  assert.equal(quote.items, 5);
  assert.deepEqual(quote.unavailable.map(line => line.id), ['porter']);
});

test('envío: gratis al recoger o desde $800', () => {
  assert.equal(shippingCost(500, 'domicilio'), 60);
  assert.equal(shippingCost(800, 'domicilio'), 0);
  assert.equal(shippingCost(500, 'recoger'), 0);
  assert.equal(shippingCost(0, 'domicilio'), 0);
});

test('flujo de estados según el tipo de entrega', () => {
  const home = {status: 'preparando', delivery: {method: 'domicilio'}};
  const pickup = {status: 'preparando', delivery: {method: 'recoger'}};
  assert.equal(nextStatus(home), 'en_camino');
  assert.equal(nextStatus(pickup), 'listo');
  assert.equal(nextStatus({status: 'entregado', delivery: {method: 'domicilio'}}), null);
  assert.ok(canMoveTo(home, 'cancelado'));
  assert.ok(!canMoveTo(home, 'entregado'));
  assert.ok(!canMoveTo({status: 'cancelado', delivery: {method: 'domicilio'}}, 'cancelado'));
});

test('formato de dinero, teléfonos y escape de HTML', () => {
  assert.equal(money(1325), '$1,325');
  assert.equal(money(61.666), '$61.67');
  assert.equal(esc('<img src=x onerror="a">'), '&lt;img src=x onerror=&quot;a&quot;&gt;');
  assert.equal(normalizePhone('+52 639 123 4567'), '6391234567');
  assert.equal(normalizePhone('521 639 123 4567'), '6391234567');
  assert.ok(isValidPhone('6391234567'));
  assert.ok(!isValidPhone('0391234567'));
  assert.ok(!isValidPhone('639123456'));
  assert.equal(formatPhone('6391234567'), '639 123 4567');
});

test('tarjetas: marca, Luhn, formato y vencimiento', () => {
  assert.ok(luhn('4242 4242 4242 4242'));
  assert.ok(!luhn('4242 4242 4242 4241'));
  assert.equal(cardBrand('4242'), 'visa');
  assert.equal(cardBrand('5555'), 'mastercard');
  assert.equal(cardBrand('2221 00'), 'mastercard');
  assert.equal(cardBrand('3782'), 'amex');
  assert.equal(cardBrand('6011'), null);
  assert.equal(formatCardNumber('378282246310005'), '3782 822463 10005');
  assert.equal(formatCardNumber('42424242424242429999'), '4242 4242 4242 4242');
  assert.equal(formatExpiry('0928'), '09/28');
  const now = new Date(2026, 8, 29);
  assert.ok(parseExpiry('09/26', now).valid);
  assert.equal(parseExpiry('08/26', now).reason, 'expired');
  assert.equal(parseExpiry('13/27', now).reason, 'month');
  assert.equal(parseExpiry('1227', now).reason, 'format');
});

test('carrito: suma líneas iguales, respeta el máximo y quita en cero', () => {
  clearCart();
  addToCart('pionera', 6, 1);
  addToCart('pionera', 6, 2);
  addToCart('porter', 24, 30);
  assert.deepEqual(getCart(), [{id: 'pionera', size: 6, qty: 3}, {id: 'porter', size: 24, qty: 20}]);
  setLineQty('porter', 24, 0);
  assert.equal(cartQuote().subtotal, 370 * 3);
  clearCart();
});

async function signIn(phone, name = 'Cliente Prueba') {
  const sent = await api.sendCode(phone, 'whatsapp');
  const result = await api.verifyCode(phone, sent.code);
  if (result.isNew) return api.register({token: result.token, name, adult: true});
  return result.user;
}

test('verificación por código: intentos, registro y sesión', async () => {
  await assert.rejects(api.sendCode('123', 'sms'), {code: 'phone'});
  const sent = await api.sendCode('6391112233', 'sms');
  await assert.rejects(api.sendCode('6391112233', 'sms'), {code: 'too_soon'});
  const wrong = sent.code === '000000' ? '111111' : '000000';
  await assert.rejects(api.verifyCode('6391112233', wrong), {code: 'invalid', message: /4 intentos/});
  const verified = await api.verifyCode('6391112233', sent.code);
  assert.equal(verified.isNew, true);
  await assert.rejects(api.register({token: verified.token, name: 'Ana López', adult: false}), {code: 'adult'});
  const user = await api.register({token: verified.token, name: '  Ana   López ', adult: true});
  assert.equal(user.name, 'Ana López');
  assert.equal(getSession().phone, '6391112233');
  assert.equal(getSession().channel, 'sms');
  await assert.rejects(api.register({token: verified.token, name: 'Otra', adult: true}), {code: 'expired'});

  // Un usuario existente entra directo.
  api.signOut();
  const again = await signIn('6391112233');
  assert.equal(again.name, 'Ana López');
});

test('pedido: el servidor recalcula precios, cobra y registra', async () => {
  await signIn('6392223344', 'Beto Prueba');
  const card = {name: 'Beto Prueba', number: '4242424242424242', expiry: '12/30', cvc: '123'};
  const delivery = {method: 'domicilio', city: 'Delicias', street: 'Calle 3a 123', colonia: 'Centro'};
  const items = [{id: 'pionera', size: 6, qty: 1}, {id: 'monito', size: 1, qty: 2}];

  await assert.rejects(api.placeOrder({items, delivery: {...delivery, city: 'Chihuahua'}, card}), {field: 'city'});
  await assert.rejects(api.placeOrder({items, delivery, card: {...card, number: '4000000000000002'}}), {code: 'card_declined'});
  await assert.rejects(api.placeOrder({items, delivery, card: {...card, cvc: '12'}}), {field: 'cardCvc'});
  await assert.rejects(api.placeOrder({items: [], delivery, card}), {code: 'empty'});

  const order = await api.placeOrder({items: [...items, {id: 'pale', size: 6, qty: 1, price: 1}], delivery, card});
  assert.match(order.id, /^DEL-\d{4}$/);
  assert.equal(order.subtotal, 370 + 60 * 2 + 400);
  assert.equal(order.shipping, 0);
  assert.equal(order.total, 890);
  assert.equal(order.bottles, 14);
  assert.deepEqual(order.payment, {...order.payment, brand: 'visa', last4: '4242', status: 'aprobado'});
  assert.ok(!JSON.stringify(order).includes('4242424242424242'), 'nunca se guarda el número completo');
  assert.deepEqual((await api.myOrders()).map(o => o.id), [order.id]);
  assert.equal(api.getProfile().address.street, 'Calle 3a 123');
});

test('back office: PIN, estados, catálogo y clientes', async () => {
  await assert.rejects(api.listOrders(), {code: 'forbidden'});
  await assert.rejects(api.adminLogin('1234'), {code: 'pin'});
  await api.adminLogin('2020');

  const orders = await api.listOrders();
  const mine = orders.find(order => !order.demo);
  assert.ok(orders.filter(order => order.demo).length >= 12);
  await assert.rejects(api.setOrderStatus(mine.id, 'entregado'), {code: 'transition'});
  await api.setOrderStatus(mine.id, 'preparando');
  await api.setOrderStatus(mine.id, 'en_camino');
  const done = await api.setOrderStatus(mine.id, 'entregado');
  assert.deepEqual(done.history.map(step => step.status), ['nuevo', 'preparando', 'en_camino', 'entregado']);
  await assert.rejects(api.setOrderStatus(mine.id, 'cancelado'), {code: 'transition'});

  await assert.rejects(api.updateProduct('pionera', {price: 5}), {field: 'price'});
  await api.updateProduct('pionera', {price: 80, available: false});
  await signIn('6392223344');
  const items = [{id: 'pionera', size: 1, qty: 1}];
  await assert.rejects(api.placeOrder({items, delivery: {method: 'recoger'}, card: {name: 'Beto', number: '4242424242424242', expiry: '12/30', cvc: '123'}}), {code: 'unavailable'});

  const customers = await api.listCustomers();
  const beto = customers.find(customer => customer.phone === '6392223344');
  assert.equal(beto.orders, 1);
  assert.equal(beto.spent, 890);

  await api.resetDemo();
  assert.equal((await api.listOrders()).length, 12);
  assert.equal(getSession(), null);
});
