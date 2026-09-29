// Catálogo de la tienda: cervezas, presentaciones, envío y estados de pedido.
// Módulo puro (sin DOM ni almacenamiento): lo comparten la landing, la tienda,
// el back office y las pruebas en Node.

export const BOTTLE_ML = 355;

// `price` es el precio de ejemplo por botella (MXN). El back office puede
// cambiarlo; las presentaciones se calculan a partir de él.
export const beers = [
  {id:'pionera',name:'Pionera',title:'ESPÍRITU<br>PIONERO.',style:'Blonde Ale',abv:'6',notes:['Mandarina','Durazno','Cítrica'],description:'Un homenaje a quienes fundaron Delicias. Una Blonde Ale de carácter cítrico, con aromas sutiles a mandarina y durazno.',pairing:'Tacos de carnitas, ceviche o pastel de limón.',bg:'#c8aa40',fg:'#242417',accent:'#615219',word:'PIONERA',tag:'PARA QUIENES ABREN CAMINO',price:65},
  {id:'monito',name:'Monito de Meoqui',title:'FUERA DE<br>ESTE MUNDO.',style:'Receta de la casa',abv:'4',notes:['Melón','Ligera','Refrescante'],description:'Ligera, refrescante y con delicadas notas a melón. El lado más inesperado de la casa Backhoff, inspirado en Meoqui.',pairing:'Botanas saladas y platillos suaves.',bg:'#b6c683',fg:'#21301d',accent:'#4c6237',word:'MONITO',tag:'UN ENCUENTRO CON LO DIFERENTE',price:60},
  {id:'irish',name:'Irish Red Ale',title:'COMO UN<br>ATARDECER.',style:'Irish Red Ale',abv:'5',notes:['Caramelo','Cremosa','Ámbar rojizo'],description:'Notas acarameladas, textura cremosa y el tono rojizo de un atardecer en Chihuahua. Una cerveza para quedarse un rato más.',pairing:'Hamburguesas, pollo a la parrilla o chocolate.',bg:'#a63930',fg:'#fff0d4',accent:'#f6c49c',word:'IRISH RED',tag:'EL LADO CÁLIDO DEL NORTE',price:65},
  {id:'porter',name:'London Porter',title:'OSCURAMENTE<br>DELICIOSA.',style:'London Porter',abv:'4.5',notes:['Café tostado','Cacao','Maltas especiales'],description:'Lúpulo noble inglés y maltas especiales. Café tostado y cacao se encuentran en una cerveza de carácter profundo.',pairing:'Parrilladas, queso cheddar o postres de nuez.',bg:'#292726',fg:'#eee2cf',accent:'#c8aa82',word:'PORTER',tag:'PARA SABOREAR SIN PRISA',price:70},
  {id:'pale',name:'American Pale Ale',title:'CARÁCTER<br>TROPICAL.',style:'American Pale Ale',abv:'5',notes:['Frutas tropicales','Lúpulo','Amargor equilibrado'],description:'El aroma tropical del lúpulo americano, con un amargor bien balanceado. Una cerveza expresiva, de principio a fin.',pairing:'Alitas, pizza y comida picante.',bg:'#586a91',fg:'#f7eedb',accent:'#dce3f0',word:'PALE ALE',tag:'UNA BUENA DOSIS DE PERSONALIDAD',price:70}
];

export const beerById = id => beers.find(beer => beer.id === id);
export const bottleImage = id => `/assets/tienda/${id}.webp`;

// Presentaciones a la venta. El descuento por volumen se aplica sobre el
// precio por botella.
export const packs = [
  {size:1, name:'Unidad', discount:0},
  {size:6, name:'Six', discount:.05},
  {size:12, name:'12 pack', discount:.08},
  {size:18, name:'18 pack', discount:.10},
  {size:24, name:'Caja 24', discount:.15}
];
export const DEFAULT_PACK = 6;
export const MAX_LINE_QTY = 20;
export const PRICE_RANGE = {min:10, max:1000};

export const packBySize = size => packs.find(pack => pack.size === Number(size));
export const bottlesLabel = n => `${n} ${n === 1 ? 'botella' : 'botellas'}`;

// Precio de una presentación, redondeado a múltiplos de $5.
export function packPrice(unitPrice, size) {
  const pack = packBySize(size);
  if (!pack) throw new RangeError(`Presentación inválida: ${size}`);
  if (pack.size === 1) return unitPrice;
  return Math.round(unitPrice * pack.size * (1 - pack.discount) / 5) * 5;
}

export function packQuote(unitPrice, size) {
  const pack = packBySize(size);
  const price = packPrice(unitPrice, size);
  return {...pack, price, perBottle: price / pack.size, savings: unitPrice * pack.size - price};
}

// Cotiza líneas {id, size, qty} contra un catálogo {id: producto}. Lo usan el
// carrito y el "servidor" al cobrar, para que el precio nunca venga del cliente.
export function quoteLines(items, productsById) {
  const lines = [];
  for (const {id, size, qty} of items) {
    const product = productsById[id];
    const count = Math.floor(Number(qty));
    if (!product || !packBySize(size) || !(count > 0)) continue;
    const quote = packQuote(product.price, size);
    lines.push({
      id, size: quote.size, qty: count, product, packName: quote.name,
      price: quote.price, total: quote.price * count,
      bottles: quote.size * count, savings: quote.savings * count,
      available: product.available !== false
    });
  }
  const sum = key => lines.reduce((total, line) => total + line[key], 0);
  return {
    lines, subtotal: sum('total'), savings: sum('savings'), bottles: sum('bottles'), items: sum('qty'),
    unavailable: lines.filter(line => !line.available)
  };
}

export const SHIPPING = {fee:60, freeFrom:800, cities:['Delicias', 'Meoqui']};

export function shippingCost(subtotal, method) {
  if (method === 'recoger' || subtotal <= 0) return 0;
  return subtotal >= SHIPPING.freeFrom ? 0 : SHIPPING.fee;
}

// Ciclo de vida de un pedido. Domicilio y recolección comparten los extremos.
export const STATUS = {
  nuevo: {label:'Nuevo', customer:'Recibido'},
  preparando: {label:'En preparación', customer:'En preparación'},
  en_camino: {label:'En camino', customer:'En camino'},
  listo: {label:'Listo para recoger', customer:'Listo para recoger'},
  entregado: {label:'Entregado', customer:'Entregado'},
  cancelado: {label:'Cancelado', customer:'Cancelado'}
};

export const statusFlow = method => method === 'recoger'
  ? ['nuevo', 'preparando', 'listo', 'entregado']
  : ['nuevo', 'preparando', 'en_camino', 'entregado'];

export const isOpenOrder = order => order.status !== 'entregado' && order.status !== 'cancelado';

export function nextStatus(order) {
  if (!isOpenOrder(order)) return null;
  const flow = statusFlow(order.delivery.method);
  return flow[flow.indexOf(order.status) + 1] ?? null;
}

export const canMoveTo = (order, status) =>
  status === 'cancelado' ? isOpenOrder(order) : nextStatus(order) === status;
