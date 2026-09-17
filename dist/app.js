'use strict';
// Original brand photographs remain intact. SVG clipping isolates their real bottles.
const bottles = {
  pionera:{w:1080,h:1920,view:'173 123 375 1417',path:'M264 182 Q265 139 288 132 Q352 118 414 132 Q446 137 451 183 L437 194 Q453 204 443 219 L438 232 L469 627 Q476 664 503 696 Q542 739 544 788 L544 1410 Q542 1489 510 1510 Q365 1560 223 1510 Q183 1488 184 1420 L177 804 Q174 746 203 703 Q240 660 249 628 L273 233 Q262 215 268 200 Z'},
  irish:{w:900,h:1500,view:'42 35 356 1430',path:'M130 97 Q135 54 157 47 Q215 30 268 43 Q296 50 302 99 L290 110 Q307 124 293 143 L313 383 L330 570 Q334 603 356 629 Q393 667 394 728 L394 1354 Q393 1429 350 1442 Q217 1487 94 1443 Q57 1425 57 1361 L48 729 Q45 668 79 629 Q104 599 109 572 L126 394 L139 149 Q124 127 139 109 Z'},
  pale:{w:900,h:1500,view:'44 44 350 1425',path:'M128 105 Q134 67 156 53 Q215 39 266 51 Q295 61 302 108 L290 116 Q303 136 293 158 L315 421 L331 576 Q337 610 360 644 Q391 682 391 742 L390 1360 Q388 1430 355 1445 Q230 1489 97 1451 Q54 1437 53 1374 L48 746 Q44 683 77 644 Q109 608 114 573 L132 408 L142 159 Q128 145 136 123 Z'},
  porter:{w:900,h:1500,view:'67 20 348 1398',path:'M145 87 Q147 49 166 35 Q230 14 284 30 Q310 40 313 86 L301 98 Q318 124 305 144 L321 390 L337 540 Q342 570 365 608 Q407 657 406 713 L411 1319 Q411 1374 376 1390 Q236 1440 105 1390 Q82 1375 81 1328 L72 720 Q67 667 94 622 Q125 577 130 544 L145 390 L157 146 Q143 134 151 111 Z'},
  monito:{w:900,h:1500,view:'29 36 377 1460',path:'M110 98 Q113 56 140 48 Q213 32 256 45 Q289 49 294 99 L282 109 Q296 121 280 136 L283 327 Q296 473 328 578 Q355 660 378 735 Q402 808 402 850 L398 1366 Q395 1440 364 1463 Q219 1520 94 1470 Q53 1452 51 1394 L34 934 Q26 855 38 796 Q57 706 83 623 Q111 520 124 378 L130 139 Q113 127 118 114 Z'}
};
let serial=0;
function bottleSVG(id, className='',label='') {const b=bottles[id],clip=`bottle-${++serial}`;return `<svg class="${className}" viewBox="${b.view}" role="img" aria-label="${label||'Botella de cerveza '+id}" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="${clip}"><path d="${b.path}"/></clipPath></defs><image href="/assets/${id}.png" width="${b.w}" height="${b.h}" clip-path="url(#${clip})"/></svg>`;}
document.querySelector('.hero-bottles').innerHTML=bottleSVG('irish','hero-bottle side left')+bottleSVG('pale','hero-bottle side right')+bottleSVG('pionera','hero-bottle center');
const beers=[
{id:'pionera',name:'Pionera',title:'ESPÍRITU<br>PIONERO.',style:'Blonde Ale',abv:'6',notes:['Mandarina','Durazno','Cítrica'],description:'Un homenaje a quienes fundaron Delicias. Una Blonde Ale de carácter cítrico, con aromas sutiles a mandarina y durazno.',pairing:'Tacos de carnitas, ceviche o pastel de limón.',bg:'#c8aa40',fg:'#242417',accent:'#615219',word:'PIONERA',tag:'PARA QUIENES ABREN CAMINO'},
{id:'monito',name:'Monito de Meoqui',title:'FUERA DE<br>ESTE MUNDO.',style:'Receta de la casa',abv:'4',notes:['Melón','Ligera','Refrescante'],description:'Ligera, refrescante y con delicadas notas a melón. El lado más inesperado de la casa Backhoff, inspirado en Meoqui.',pairing:'Botanas saladas y platillos suaves.',bg:'#b6c683',fg:'#21301d',accent:'#4c6237',word:'MONITO',tag:'UN ENCUENTRO CON LO DIFERENTE'},
{id:'irish',name:'Irish Red Ale',title:'COMO UN<br>ATARDECER.',style:'Irish Red Ale',abv:'5',notes:['Caramelo','Cremosa','Ámbar rojizo'],description:'Notas acarameladas, textura cremosa y el tono rojizo de un atardecer en Chihuahua. Una cerveza para quedarse un rato más.',pairing:'Hamburguesas, pollo a la parrilla o chocolate.',bg:'#a63930',fg:'#fff0d4',accent:'#f6c49c',word:'IRISH RED',tag:'EL LADO CÁLIDO DEL NORTE'},
{id:'porter',name:'London Porter',title:'OSCURAMENTE<br>DELICIOSA.',style:'London Porter',abv:'4.5',notes:['Café tostado','Cacao','Maltas especiales'],description:'Lúpulo noble inglés y maltas especiales. Café tostado y cacao se encuentran en una cerveza de carácter profundo.',pairing:'Parrilladas, queso cheddar o postres de nuez.',bg:'#292726',fg:'#eee2cf',accent:'#c8aa82',word:'PORTER',tag:'PARA SABOREAR SIN PRISA'},
{id:'pale',name:'American Pale Ale',title:'CARÁCTER<br>TROPICAL.',style:'American Pale Ale',abv:'5',notes:['Frutas tropicales','Lúpulo','Amargor equilibrado'],description:'El aroma tropical del lúpulo americano, con un amargor bien balanceado. Una cerveza expresiva, de principio a fin.',pairing:'Alitas, pizza y comida picante.',bg:'#586a91',fg:'#f7eedb',accent:'#dce3f0',word:'PALE ALE',tag:'UNA BUENA DOSIS DE PERSONALIDAD'}
];
document.querySelector('#beers').innerHTML=beers.map((b,i)=>`<section class="beer-section ${i%2?'reverse':''}" id="${b.id}" aria-labelledby="name-${b.id}" style="--scene-bg:${b.bg};--scene-fg:${b.fg};--accent:${b.accent}"><div class="beer-stage"><div class="scene-top"><span>0${i+1} / 05</span><span>${b.tag}</span><span>DELICIA · CHIHUAHUA</span></div><span class="giant-word" aria-hidden="true">${b.word}</span><div class="bottle-space"><div class="orbit" aria-hidden="true"></div><div class="bottle-motion">${bottleSVG(b.id,'product-bottle',b.name)}</div><span class="bottle-ground" aria-hidden="true"></span><span class="bottle-caption">CERVEZA ARTESANAL · ${b.style.toUpperCase()}</span></div><div class="beer-copy"><div class="beer-eyebrow"><span>${b.style}</span><span class="abv"><strong>${b.abv}%</strong> ALC. VOL.</span></div><h2 id="name-${b.id}">${b.name}</h2><p class="beer-headline">${b.title.replace('<br>','<br> ')}</p><div class="beer-details"><p class="description">${b.description}</p><ul class="notes" aria-label="Perfil de sabor">${b.notes.map(n=>`<li>${n}</li>`).join('')}</ul><div class="pairing"><span>VA MUY BIEN CON</span><p>${b.pairing}</p></div></div></div><div class="scene-bottom"><span>HECHA EN DELICIAS, CHIHUAHUA</span><a href="#${beers[i+1]?.id||'origen'}">${i===4?'DISFRUTA EL MOMENTO':'SIGUE DESCUBRIENDO'} <span>↓</span></a></div><div class="scene-progress" aria-hidden="true"></div></div></section>`).join('');
document.querySelector('.beer-nav').innerHTML=beers.map((b,i)=>`<a href="#${b.id}" aria-label="${b.name}"><span>${b.name}</span><i>0${i+1}</i></a>`).join('');
// Native scrolling stays in control. Bottle movement follows the actual sticky
// interval; text reveals finish on their own, even if the visitor stops scrolling.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const smallScreen = matchMedia('(max-width: 800px)');
const sections = [...document.querySelectorAll('.beer-section')].map((el, i) => ({
  el, i,
  stage: el.querySelector('.beer-stage'),
  bottle: el.querySelector('.bottle-motion'),
  word: el.querySelector('.giant-word'),
  ground: el.querySelector('.bottle-ground'),
  progress: el.querySelector('.scene-progress'),
  active: false, value: null, top: 0, height: 0, pinned: 0
}));
const nav = document.querySelector('.beer-nav');
const navLinks = [...nav.children];
const clamp = (value) => Math.min(1, Math.max(0, value));
const ease = (value) => 1 - Math.pow(1 - clamp(value), 3);
let frame = 0;
let last = 0;
let scrollPosition = scrollY;
let viewport = innerHeight;

function measure() {
  viewport = innerHeight;
  for (const scene of sections) {
    scene.top = scene.el.getBoundingClientRect().top + scrollY;
    scene.height = scene.el.getBoundingClientRect().height;
    scene.pinned = getComputedStyle(scene.stage).position === 'sticky'
      ? Math.max(0, scene.height - scene.stage.getBoundingClientRect().height)
      : 0;
    scene.value = null;
  }
  requestTick();
}

function render(now) {
  frame = 0;
  const dt = Math.min(64, now - (last || now - 16));
  last = now;
  let unsettled = false;
  let current = -1;

  for (const scene of sections) {
    if (!scene.active) continue;
    // Reach the final pose BEFORE the sticky panel is released, including short
    // screens, reduced motion, and scenes without a sticky interval.
    const leadIn = viewport * .7;
    const target = clamp((scrollPosition - scene.top + leadIn) /
      Math.max(1, scene.pinned + leadIn));
    if (scene.value === null || reducedMotion.matches) scene.value = target;
    else {
      scene.value += (target - scene.value) * (1 - Math.exp(-dt / 80));
      if (Math.abs(target - scene.value) > .0001) unsettled = true;
      else scene.value = target;
    }
    const p = scene.value;
    const direction = scene.i % 2 ? -1 : 1;
    const arrive = ease(p / .6);
    // Keep a gentle turn throughout the pinned interval, without a dead zone.
    const turn = clamp((p - .2) / .8);
    const mobile = smallScreen.matches;

    // Once revealed, text remains fully readable when scrolling back. CSS owns
    // the finite reveal, so stopping the wheel cannot freeze it half-transparent.
    if (target >= .3 || reducedMotion.matches) scene.el.classList.add('is-revealed');

    if (reducedMotion.matches) {
      scene.bottle.style.transform = `rotate(${direction * -8}deg)`;
      scene.word.style.transform = 'none';
    } else {
      scene.bottle.style.transform =
        `translate3d(${direction * (1 - arrive) * (mobile ? 45 : 100)}px,${(1 - arrive) * 120 - turn * 22}px,0) ` +
        `rotateY(${direction * (28 * (1 - arrive) - 14 + turn * 24)}deg) ` +
        `rotateX(${(1 - arrive) * 8}deg) ` +
        `rotateZ(${direction * (-24 + arrive * 10 + turn * 8)}deg) ` +
        `scale(${.88 + arrive * .12})`;
      scene.word.style.transform = `translate3d(${direction * (.5 - p) * 65}px,0,0)`;
    }
    scene.ground.style.transform = `translateX(-50%) scaleX(${.7 + arrive * .3})`;
    scene.ground.style.opacity = .12 + arrive * .18;
    scene.progress.style.transform = `scaleX(${p})`;
    if (scrollPosition >= scene.top - viewport * .35 &&
        scrollPosition < scene.top + scene.height - viewport * .35) current = scene.i;
  }

  nav.classList.toggle('visible', current >= 0);
  navLinks.forEach((link, i) => {
    if (i === current) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  });
  if (unsettled && !reducedMotion.matches) frame = requestAnimationFrame(render);
  else last = 0;
}

function requestTick() {
  scrollPosition = scrollY;
  if (!frame) frame = requestAnimationFrame(render);
}

const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    sections.find(scene => scene.el === entry.target).active = entry.isIntersecting;
  }
  requestTick();
}, { rootMargin: '20% 0px' });
sections.forEach(scene => observer.observe(scene.el));
addEventListener('scroll', requestTick, { passive: true });
addEventListener('resize', measure, { passive: true });
addEventListener('pageshow', measure);
reducedMotion.addEventListener('change', measure);
document.fonts.ready.then(measure);
measure();
