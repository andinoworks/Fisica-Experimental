// Página de consulta: fórmulas de los apuntes Serie C y tablas de distribuciones.
// Las tablas se calculan al abrir la página, así que coinciden con lo que usa la web.

import { card, createForm, h, tex } from './ui/dom.js';
import { fInv, normCdf, tInv } from './core/stats.js';
import { numberFormat } from './core/format.js';

const fixed = (value, decimals) => {
  const text = value.toFixed(decimals);
  return numberFormat.comma ? text.replace('.', ',') : text;
};

const SECTIONS = [
  {
    id: 'incertidumbres',
    title: 'Mediciones e incertidumbres',
    source: 'Serie C 4/11, capítulo 2',
    body: [
      'Una incertidumbre es de tipo A si se obtiene con un procedimiento estadístico, y de tipo B si no, como la apreciación de un instrumento. Con ambas contribuciones se suman en cuadratura.',
      'Para una lectura única de una cantidad estable, con un instrumento bien calibrado, es razonable tomar como incertidumbre la mitad de la apreciación.',
      ['Valor de una cantidad', 'C = (C_0 \\pm U_0)\\ [\\text{unidad}], \\qquad E = \\dfrac{U_0}{C_0}, \\qquad E_\\% = 100\\, \\dfrac{U_0}{C_0}'],
      'La incertidumbre se informa, en general, con una cifra significativa (dos como máximo en la guía GUM), y el valor se redondea a ese mismo decimal. El redondeo se hace solo al final de los cálculos.',
    ],
  },
  {
    id: 'propagacion',
    title: 'Propagación de incertidumbres',
    source: 'Serie C 4/11, sección 2.5; 9/15, capítulos 2 y 6',
    link: ['propagacion', 'Propagación y Welch-Satterthwaite'],
    body: [
      ['Cantidades independientes', 'u_c^{2}(y) = \\sum_{i} \\left(\\dfrac{\\partial f}{\\partial x_i}\\right)^{2} u^{2}(x_i)'],
      ['Cantidades correlacionadas', 'u_c^{2}(y) = \\sum_{i} \\left(\\dfrac{\\partial f}{\\partial x_i}\\right)^{2} u^{2}(x_i) + 2 \\sum_{i<j} \\dfrac{\\partial f}{\\partial x_i} \\dfrac{\\partial f}{\\partial x_j}\\, u(x_i, x_j)'],
      ['Covarianza de los datos y de las medias', 's_{xy} = \\dfrac{1}{N-1} \\sum_{k} (x_k - \\bar{x})(y_k - \\bar{y}), \\qquad u(\\bar{x}, \\bar{y}) = \\dfrac{s_{xy}}{N}'],
      ['Cota superior', 'u_c(y) \\leq \\sum_{i} \\left|\\dfrac{\\partial f}{\\partial x_i}\\right| u(x_i)'],
      ['Casos particulares', 'F = X \\pm Y:\\ \\Delta F = \\sqrt{\\Delta X^{2} + \\Delta Y^{2}} \\qquad F = XY \\ \\text{o}\\ X/Y:\\ \\dfrac{\\Delta F}{|F|} = \\sqrt{\\left(\\dfrac{\\Delta X}{X}\\right)^{2} + \\left(\\dfrac{\\Delta Y}{Y}\\right)^{2}} \\qquad F = X^{n}:\\ \\dfrac{\\Delta F}{|F|} = |n| \\dfrac{\\Delta X}{|X|}'],
      ['Promedio de M determinaciones (ec. 6.3)', 'y = \\dfrac{1}{M} \\sum_{k} f(X_{1,k}, \\dots, X_{N,k})'],
      'La ec. 6.3 puede preferirse cuando f no es lineal, y coincide con evaluar f en las medias cuando f es lineal.',
    ],
  },
  {
    id: 'welch',
    title: 'Welch-Satterthwaite e incertidumbre expandida',
    source: 'Serie C 9/15, capítulos 4 y 6',
    link: ['propagacion', 'Propagación y Welch-Satterthwaite'],
    body: [
      ['Grados de libertad efectivos', '\\nu_{ef} = \\dfrac{u_c^{4}(y)}{\\sum_{i} \\dfrac{c_i^{4}\\, u^{4}(x_i)}{\\nu_i}}, \\qquad c_i = \\dfrac{\\partial f}{\\partial x_i}'],
      'ν efectivo se trunca al entero inferior. La fórmula supone cantidades de entrada independientes.',
      ['Incertidumbre expandida', 'U = k\\, u_c(y), \\qquad k = t_{\\alpha/2,\\,\\nu_{ef}}, \\qquad y \\pm U'],
      ['Grados de libertad de una incertidumbre tipo B', '\\nu_i \\approx \\dfrac{1}{2} \\left[\\dfrac{u(s)}{s}\\right]^{-2}'],
      'Si la incertidumbre tipo B se conoce exactamente, que es lo frecuente, se toma ν infinito.',
    ],
  },
  {
    id: 'muestras',
    title: 'Tratamiento estadístico de una muestra',
    source: 'Serie C 4/11, capítulo 3',
    link: ['muestra', 'Una muestra'],
    body: [
      ['Media, desvío y error estándar', '\\bar{x} = \\dfrac{1}{N} \\sum_i x_i, \\qquad s = \\sqrt{\\dfrac{\\sum_i (x_i - \\bar{x})^{2}}{N-1}}, \\qquad s_{\\bar{x}} = \\dfrac{s}{\\sqrt{N}}'],
      ['Distribución normal', 'G_{\\mu,\\sigma}(x) = \\dfrac{1}{\\sigma \\sqrt{2\\pi}}\\, e^{-(x-\\mu)^{2} / 2\\sigma^{2}}, \\qquad Z = \\dfrac{X - \\mu}{\\sigma}'],
      'Dentro de 1σ, 2σ y 3σ de la media cae aproximadamente el 68,3 %, el 95,4 % y el 99,7 % de los valores.',
      ['Intervalo con muestra grande (N > 30)', '\\bar{x} \\pm z_{\\alpha/2} \\dfrac{s}{\\sqrt{N}}'],
      ['Intervalo con muestra chica', '\\bar{x} \\pm t_{\\alpha/2,\\,\\nu} \\dfrac{s}{\\sqrt{N}}, \\qquad \\nu = N - 1'],
      'Histograma: se usan aproximadamente √N clases de igual ancho, cerradas a izquierda y abiertas a derecha, con altura igual a la frecuencia relativa.',
    ],
  },
  {
    id: 'comparacion',
    title: 'Comparación de valores',
    source: 'Serie C 4/11, sección 3.10; 9/15, sección 1.1',
    link: ['comparar', 'Comparar valores'],
    body: [
      ['Contra un valor de referencia', 't = \\dfrac{\\bar{x} - \\mu_0}{s_{\\bar{x}}}, \\qquad \\nu = N - 1'],
      ['Regiones de rechazo', 'H_a: \\mu \\neq \\mu_0:\\ |t| \\geq t_{\\alpha/2,\\nu} \\qquad H_a: \\mu > \\mu_0:\\ t \\geq t_{\\alpha,\\nu} \\qquad H_a: \\mu < \\mu_0:\\ t \\leq -t_{\\alpha,\\nu}'],
      ['Dos muestras grandes', 'z = \\dfrac{\\bar{x} - \\bar{y}}{\\sqrt{s_{\\bar{x}}^{2} + s_{\\bar{y}}^{2}}}'],
      'Con muestras chicas, primero se analiza si las varianzas son homogéneas con el test F.',
      ['Varianzas homogéneas', 't = \\dfrac{\\bar{x} - \\bar{y}}{s_p \\sqrt{\\dfrac{1}{n_x} + \\dfrac{1}{n_y}}}, \\qquad s_p^{2} = \\dfrac{(n_x - 1) s_x^{2} + (n_y - 1) s_y^{2}}{n_x + n_y - 2}, \\qquad \\nu = n_x + n_y - 2'],
      ['Varianzas no homogéneas (Welch)', 't = \\dfrac{\\bar{x} - \\bar{y}}{\\sqrt{\\dfrac{s_x^{2}}{n_x} + \\dfrac{s_y^{2}}{n_y}}}, \\qquad \\nu = \\dfrac{\\left(\\dfrac{s_x^{2}}{n_x} + \\dfrac{s_y^{2}}{n_y}\\right)^{2}}{\\dfrac{(s_x^{2}/n_x)^{2}}{n_x - 1} + \\dfrac{(s_y^{2}/n_y)^{2}}{n_y - 1}}'],
    ],
  },
  {
    id: 'test-f',
    title: 'Homogeneidad de varianzas: test F',
    source: 'Serie C 9/15, sección 1.1.3',
    link: ['test-f', 'Test F de varianzas'],
    body: [
      ['Estadístico', 'H_0: \\sigma_x^{2} = \\sigma_y^{2}, \\qquad f = \\dfrac{s_x^{2}}{s_y^{2}}, \\qquad \\nu_1 = n_x - 1, \\quad \\nu_2 = n_y - 1'],
      ['Región de rechazo bilateral', 'f \\geq F_{\\alpha/2,\\nu_1,\\nu_2} \\quad \\text{o} \\quad f \\leq F_{1-\\alpha/2,\\nu_1,\\nu_2}'],
      ['Propiedad para la cola inferior', 'F_{1-\\alpha,\\nu_1,\\nu_2} = \\dfrac{1}{F_{\\alpha,\\nu_2,\\nu_1}}'],
    ],
  },
  {
    id: 'recta',
    title: 'Ajuste de una recta',
    source: 'Serie C 4/11, capítulo 4',
    link: ['ajuste-lineal', 'Ajuste lineal'],
    body: [
      ['Parámetros', 'a_0 = \\dfrac{S_{XY}}{S_{XX}}, \\qquad b_0 = \\bar{Y} - a_0 \\bar{X}'],
      ['Sumas', 'S_{XX} = \\sum (X_i - \\bar{X})^{2}, \\quad S_{XY} = \\sum (X_i - \\bar{X})(Y_i - \\bar{Y}), \\quad S_{YY} = \\sum (Y_i - \\bar{Y})^{2}'],
      ['Dispersión y determinación', 's^{2} = \\dfrac{SSE}{N-2}, \\qquad r^{2} = 1 - \\dfrac{SSE}{S_{YY}}, \\qquad r = \\dfrac{S_{XY}}{\\sqrt{S_{XX} S_{YY}}}'],
      ['Incertidumbres', 's_{a_0} = \\dfrac{s}{\\sqrt{S_{XX}}}, \\qquad s_{b_0} = s \\sqrt{\\dfrac{\\sum X_i^{2}}{N\\, S_{XX}}}, \\qquad a = a_0 \\pm t_{\\alpha/2,\\,N-2}\\, s_{a_0}'],
      ['Estimación previa', 's_{a_0} \\approx \\dfrac{s}{L} \\sqrt{\\dfrac{12}{N}}'],
      ['Incertidumbre en x', '\\text{Si } \\left|\\dfrac{\\Delta y}{\\Delta x}\\right| \\sigma_x \\ll \\sigma_y \\text{ se desprecia. Si es comparable, } \\sigma_y\' = \\sqrt{\\sigma_y^{2} + \\left(\\dfrac{\\Delta y}{\\Delta x} \\sigma_x\\right)^{2}}'],
      'Si en cambio σx domina, conviene intercambiar las variables.',
    ],
  },
  {
    id: 'ponderado',
    title: 'Ajuste ponderado y linealización',
    source: 'Serie C 4/11, secciones 4.5 y 4.6',
    link: ['ajuste-ponderado', 'Ajuste ponderado'],
    body: [
      ['Se minimiza', 'S(a, b) = \\sum_{i} \\dfrac{\\left[Y_i - (a X_i + b)\\right]^{2}}{\\sigma_i^{2}}'],
      ['Parámetros', 'a_0 = \\dfrac{1}{\\Delta} \\left( \\sum \\dfrac{1}{\\sigma_i^{2}} \\sum \\dfrac{X_i Y_i}{\\sigma_i^{2}} - \\sum \\dfrac{X_i}{\\sigma_i^{2}} \\sum \\dfrac{Y_i}{\\sigma_i^{2}} \\right), \\quad b_0 = \\dfrac{1}{\\Delta} \\left( \\sum \\dfrac{X_i^{2}}{\\sigma_i^{2}} \\sum \\dfrac{Y_i}{\\sigma_i^{2}} - \\sum \\dfrac{X_i}{\\sigma_i^{2}} \\sum \\dfrac{X_i Y_i}{\\sigma_i^{2}} \\right)'],
      ['Determinante e incertidumbres', '\\Delta = \\sum \\dfrac{1}{\\sigma_i^{2}} \\sum \\dfrac{X_i^{2}}{\\sigma_i^{2}} - \\left(\\sum \\dfrac{X_i}{\\sigma_i^{2}}\\right)^{2}, \\quad s_{a_0}^{2} = \\dfrac{1}{\\Delta} \\sum \\dfrac{1}{\\sigma_i^{2}}, \\quad s_{b_0}^{2} = \\dfrac{1}{\\Delta} \\sum \\dfrac{X_i^{2}}{\\sigma_i^{2}}'],
      ['Linealización: y\' = f(y)', '\\sigma_i\' = \\left|\\dfrac{\\partial f}{\\partial y}\\right|_{y = Y_i} \\sigma_i'],
      'Aun si las σᵢ son iguales, las σᵢ′ dejan de serlo, y por eso después de linealizar hace falta el ajuste ponderado.',
      ['Ejemplos', 'T = 2\\pi \\sqrt{\\dfrac{M}{k}} \\ \\to\\ T^{2} = \\dfrac{4\\pi^{2}}{k} M \\qquad T - T_a = (T_0 - T_a) e^{-t/\\tau} \\ \\to\\ \\ln \\dfrac{T - T_a}{T_0 - T_a} = -\\dfrac{t}{\\tau}'],
    ],
  },
  {
    id: 'polinomio',
    title: 'Ajuste de un polinomio',
    source: 'Serie C 9/15, capítulo 3',
    link: ['ajuste-polinomial', 'Ajuste polinomial'],
    body: [
      ['Sistema', '\\alpha\\, a = \\beta, \\qquad \\alpha_{kj} = \\sum_{i} \\dfrac{x_i^{k+j}}{s_i^{2}}, \\qquad \\beta_{k} = \\sum_{i} \\dfrac{y_i\\, x_i^{k}}{s_i^{2}}'],
      ['Solución y covarianza', 'a = \\alpha^{-1} \\beta, \\qquad \\text{Cov}(a_k, a_j) = (\\alpha^{-1})_{kj}, \\qquad s_{a_k} = \\sqrt{(\\alpha^{-1})_{kk}}'],
      ['Valor calculado con el ajuste', 's_y^{2} = \\sum_{k} x^{2k} (\\alpha^{-1})_{kk} + \\sum_{k} \\sum_{l \\neq k} x^{k} x^{l} (\\alpha^{-1})_{kl}'],
    ],
  },
  {
    id: 'discretas',
    title: 'Distribuciones binomial y de Poisson',
    source: 'Serie C 9/15, capítulo 5',
    link: ['distribuciones', 'Distribuciones y tablas'],
    body: [
      ['Binomial', 'B_{n,p}(\\nu) = \\dfrac{n!}{\\nu!\\,(n-\\nu)!}\\, p^{\\nu} (1-p)^{n-\\nu}, \\qquad \\mu = np, \\qquad \\sigma = \\sqrt{np(1-p)}'],
      ['Poisson', 'P_{\\mu}(\\nu) = e^{-\\mu} \\dfrac{\\mu^{\\nu}}{\\nu!}, \\qquad \\sigma = \\sqrt{\\mu}, \\qquad \\mu = R\\, T'],
      'Ambas se aproximan a una normal con la misma media y el mismo desvío: la binomial con n grande y la de Poisson con μ grande. Con un solo conteo ν, se estima μ ≈ ν ± √ν.',
    ],
  },
  {
    id: 'gum',
    title: 'Procedimiento de la guía GUM',
    source: 'Serie C 9/15, capítulo 6',
    link: ['propagacion', 'Propagación y Welch-Satterthwaite'],
    steps: [
      'Escribir el modelo: Y = f(X₁, …, X_N).',
      'Determinar el valor estimado de cada cantidad de entrada.',
      'Evaluar la incertidumbre estándar de cada una, de tipo A o B.',
      'Evaluar las covarianzas de las cantidades correlacionadas.',
      'Calcular el resultado y = f(x₁, …, x_N).',
      'Calcular la incertidumbre estándar combinada u_c(y).',
      'Si hace falta, calcular la incertidumbre expandida U = k·u_c con ν efectivo.',
      'Expresar el resultado con su incertidumbre, sin dígitos de más, y describir cómo se obtuvo.',
    ],
  },
];

function sectionNode(section) {
  const body = (section.body ?? []).map((item) => (typeof item === 'string'
    ? h('p', {}, item)
    : [h('h3', {}, item[0]), h('div', { class: 'math-list' }, tex(item[1]))]));
  return h('section', { class: 'theory-section', id: `t-${section.id}` },
    h('h2', {}, section.title),
    h('section', { class: 'card' },
      body,
      section.steps && h('ol', {}, section.steps.map((step) => h('li', {}, step))),
      h('p', { class: 'see', style: 'margin:12px 0 0' },
        `Fuente: ${section.source}.`,
        section.link && [' Herramienta: ', h('a', { href: `#/${section.link[0]}` }, section.link[1]), '.'])));
}

// ---------- Tablas ----------

const numberTable = (headers, rows) => h('div', { class: 'table-wrap' },
  h('table', { class: 'number-table' },
    h('thead', {}, h('tr', {}, headers.map((text) => h('th', { scope: 'col' }, text)))),
    h('tbody', {}, rows.map((cells) => h('tr', {}, cells.map((cell) => h('td', {}, cell)))))));

function tTable() {
  const alphas = [0.25, 0.1, 0.05, 0.025, 0.01, 0.005, 0.001, 0.0005];
  const nus = [...Array.from({ length: 30 }, (_, i) => i + 1), 40, 50, 60, 80, 100, 120, Infinity];
  return card(null,
    h('p', { class: 'help' }, 'Valor crítico t(α, ν): deja un área α en la cola superior. Para un intervalo bilateral con confianza 1−α, buscá la columna α/2 (95 % es la columna 0,025).'),
    numberTable(['ν \\ α', ...alphas.map((alpha) => fixed(alpha, 4))],
      nus.map((nu) => [nu === Infinity ? '∞' : String(nu), ...alphas.map((alpha) => fixed(tInv(1 - alpha, nu), 3))])));
}

function normalTable() {
  const columns = Array.from({ length: 10 }, (_, i) => i / 100);
  const rows = Array.from({ length: 35 }, (_, i) => i / 10);
  const build = (sign) => rows.map((z) => [
    `${sign < 0 ? '−' : ''}${fixed(z, 1)}`,
    ...columns.map((extra) => fixed(normCdf(sign * (z + extra)), 4)),
  ]);
  return card(null,
    h('p', { class: 'help' }, 'P(Z ≤ z): área bajo la curva normal estándar a la izquierda de z. La fila da el primer decimal y la columna, el segundo.'),
    numberTable(['z', ...columns.map((value) => fixed(value, 2))], [...build(-1).reverse(), ...build(1)]));
}

function fTable() {
  const state = { alpha: '0.05' };
  const box = h('div');
  const d1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 24, 30, 40, 60, 120];
  const d2 = [...Array.from({ length: 30 }, (_, i) => i + 1), 40, 60, 120];
  const render = () => {
    const alpha = Number(state.alpha);
    box.replaceChildren(numberTable(['ν₂ \\ ν₁', ...d1.map(String)],
      d2.map((nu2) => [String(nu2), ...d1.map((nu1) => fixed(fInv(1 - alpha, nu1, nu2), 2))])));
  };
  const form = createForm(state, render);
  render();
  return card(null,
    h('p', { class: 'help' }, 'Valor crítico F(α, ν₁, ν₂): ν₁ son los grados de libertad del numerador y ν₂ los del denominador. Para el test bilateral, usá α/2.'),
    form.select('alpha', { label: 'Área en la cola superior α', options: [['0.1', '0,10'], ['0.05', '0,05'], ['0.025', '0,025'], ['0.01', '0,01'], ['0.005', '0,005']] }),
    h('div', { style: 'height:10px' }),
    box);
}

const TABLES = [
  { id: 'tabla-t', title: 'Tabla t de Student', build: tTable },
  { id: 'tabla-f', title: 'Tabla F', build: fTable },
  { id: 'tabla-z', title: 'Tabla normal estándar', build: normalTable },
];

export function mountTheory(main) {
  const all = [...SECTIONS, ...TABLES];
  const index = all.map((item) => h('button', {
    type: 'button',
    class: 'quiet',
    onClick: () => document.getElementById(`t-${item.id}`).scrollIntoView({ behavior: 'smooth' }),
  }, item.title));

  // Armar las tablas tarda un poco: se calculan después de mostrar la página.
  const tableNodes = TABLES.map((table) => {
    const holder = h('section', { class: 'theory-section', id: `t-${table.id}` }, h('h2', {}, table.title));
    setTimeout(() => holder.append(table.build()), 0);
    return holder;
  });

  main.replaceChildren(h('div', { class: 'theory' },
    h('header', { class: 'tool-head' },
      h('h1', {}, 'Teórico y tablas'),
      h('p', {}, 'Resumen de las fórmulas de los apuntes Análisis de Datos e Incertidumbres en Física Experimental (Pérez, Schürrer y Stutz, Serie C 4/11 y 9/15). Para la teoría completa, consultá los apuntes.')),
    h('div', { class: 'theory-index' }, index),
    SECTIONS.map(sectionNode),
    tableNodes));
  document.title = 'Teórico y tablas: Laboratorio de Datos';
}
