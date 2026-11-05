// Valores críticos y distribuciones del teórico: reemplaza a las tablas de los apéndices.

import { answer, card, keyValues, note, row, table } from '../ui/dom.js';
import { chart, lineTrace, linspace, INK } from '../ui/plot.js';
import { fmt, fmtInt } from '../core/format.js';
import { parseScalar } from '../core/parse.js';
import { binomialPmf, coverage, fCdf, fInv, gaussianPdf, normCdf, normInv, poissonPmf, tCdf, tInv } from '../core/stats.js';
import { confidenceOf, nuOf, percentOf, requireNumber } from './comunes.js';
import { b as br, n as num, p as par, procedure } from '../ui/procedimiento.js';

function discreteChart(values, mean, sigma, k, axisName, filename) {
  const grid = linspace(Math.min(...values.map((v) => v.k)) - 0.5, Math.max(...values.map((v) => v.k)) + 0.5);
  const traces = [
    {
      type: 'bar', name: 'Probabilidad', x: values.map((v) => v.k), y: values.map((v) => v.p), width: 0.92,
      marker: { color: values.map((v) => (v.k === k ? '#eb6834' : '#2a78d6')) },
      hovertemplate: 'k = %{x}<br>P = %{y:.4g}<extra></extra>',
    },
  ];
  if (sigma > 0) traces.push(lineTrace(grid, grid.map((x) => gaussianPdf(x, mean, sigma)), { name: 'Normal con igual media y σ', color: INK }));
  return card(null, chart(traces, { x: { title: axisName }, y: { title: 'Probabilidad', rangemode: 'tozero' }, legend: traces.length > 1 }, { filename }));
}

function probabilityBlock(pmf, kMax, k, label) {
  let below = 0;
  for (let i = 0; i <= Math.min(k, kMax); i += 1) below += pmf(i);
  const at = pmf(k);
  return [
    answer([{ label: `P(${label} = ${k})`, value: fmt(at) }]),
    card('Probabilidades acumuladas', keyValues([
      [`P(${label} ≤ ${k})`, fmt(Math.min(below, 1))],
      [`P(${label} ≥ ${k})`, fmt(Math.min(Math.max(1 - below + at, 0), 1))],
      [`P(${label} < ${k})`, fmt(Math.min(below - at, 1))],
      [`P(${label} > ${k})`, fmt(Math.max(1 - below, 0))],
    ])),
  ];
}

export default {
  id: 'distribuciones',
  group: 'Gráficos y tablas',
  title: 'Distribuciones y tablas',
  short: 'Valores críticos t y F, normal, binomial y Poisson',
  description: 'Reemplaza a las tablas de los apéndices del apunte. Sirve para buscar valores críticos y calcular probabilidades.',
  origin: 'Agregada desde el teórico: Serie C 4/11, apéndice B, y 9/15, capítulo 5 y apéndice A.',
  hint: 'Completá los parámetros.',
  defaults: {
    kind: 't', confidence: '95', nu: '', tvalue: '', alpha: '0.05', d1: '', d2: '', fvalue: '',
    mu: '0', sigma: '1', a: '', b: '', p: '', n: '', prob: '', k: '', poisson: '', rel: '',
  },
  examples: [
    { label: 'Fusibles: binomial (9/15)', state: { kind: 'binomial', n: '16', prob: '0.05', k: '2' } },
    { label: 'Geiger: Poisson (9/15)', state: { kind: 'poisson', poisson: '3', k: '2' } },
    { label: 'F crítico (9/15)', state: { kind: 'f', alpha: '0.05', d1: '9', d2: '12' } },
  ],
  form(f, s) {
    return [
      f.select('kind', {
        label: 'Qué necesitás',
        options: [
          ['t', 'Valor crítico t de Student'],
          ['f', 'Valor crítico F'],
          ['normal', 'Probabilidad en una normal'],
          ['z', 'Valor z para una confianza'],
          ['binomial', 'Distribución binomial'],
          ['poisson', 'Distribución de Poisson'],
          ['nuB', 'ν de una incertidumbre tipo B'],
        ],
      }),
      f.when(() => s.kind === 't',
        row(f.confidence(), f.text('nu', { label: 'Grados de libertad ν', decimal: true, placeholder: '∞' })),
        f.text('tvalue', { label: 't medido, para el valor p (opcional)', decimal: true })),
      f.when(() => s.kind === 'f',
        f.text('alpha', { label: 'Área en la cola superior α', decimal: true, help: 'En una prueba bilateral, usá α/2.' }),
        row(f.text('d1', { label: 'ν₁ (numerador)', decimal: true }), f.text('d2', { label: 'ν₂ (denominador)', decimal: true })),
        f.text('fvalue', { label: 'F medido, para el valor p (opcional)', decimal: true })),
      f.when(() => s.kind === 'normal',
        row(f.text('mu', { label: 'Media μ', decimal: true }), f.text('sigma', { label: 'Desvío σ', decimal: true })),
        row(f.text('a', { label: 'Desde a', decimal: true, placeholder: '−∞' }), f.text('b', { label: 'Hasta b', decimal: true, placeholder: '+∞' }))),
      f.when(() => s.kind === 'z', f.confidence()),
      f.when(() => s.kind === 'binomial',
        row(f.text('n', { label: 'Ensayos n', decimal: true }), f.text('prob', { label: 'Probabilidad p', decimal: true }), f.text('k', { label: 'Éxitos k', decimal: true }))),
      f.when(() => s.kind === 'poisson',
        row(f.text('poisson', { label: 'Media μ', decimal: true }), f.text('k', { label: 'Eventos k', decimal: true }))),
      f.when(() => s.kind === 'nuB',
        f.text('rel', { label: 'Incertidumbre relativa de la incertidumbre u(s)/s', decimal: true, placeholder: '0.2', help: 'Ejemplo del apunte: 0,2 da ν = 12.' })),
    ];
  },
  calc(s) {
    switch (s.kind) {
      case 't': {
        if (!s.nu.trim() && !s.tvalue.trim()) return null;
        const confidence = confidenceOf(s.confidence);
        const nu = nuOf(s.nu);
        const nodes = [
          answer([{ label: `t crítico bilateral, ${percentOf(confidence)}, ν = ${fmtInt(nu)}`, value: fmt(coverage(confidence, nu)), detail: `Unilateral: ${fmt(tInv(confidence, nu))}` }]),
          procedure([{
            title: 'Definición',
            text: 'Es el valor que deja α/2 de área en cada cola de la distribución t.',
            math: [
              `\\alpha = 1 - ${num(confidence)} = ${num(1 - confidence)}`,
              `P(-t_{\\alpha/2,\\nu} < T < t_{\\alpha/2,\\nu}) = 1 - \\alpha`,
              `t_{${num((1 - confidence) / 2)},\\,${num(nu)}} = ${num(coverage(confidence, nu))}`,
            ],
          }]),
          card('Otros niveles', table(['Confianza', 'Bilateral', 'Unilateral'], [0.68, 0.9, 0.95, 0.99, 0.999].map((c) => [percentOf(c), fmt(coverage(c, nu)), fmt(tInv(c, nu))]))),
        ];
        const t = parseScalar(s.tvalue);
        if (t !== null) {
          const cdf = tCdf(Math.abs(t), nu);
          nodes.push(card('Valor p', keyValues([['Bilateral', fmt(2 * (1 - cdf))], ['Unilateral', fmt(1 - cdf)]])));
        }
        return nodes;
      }
      case 'f': {
        if (!s.d1.trim() || !s.d2.trim()) return null;
        const alpha = requireNumber(s.alpha, 'α');
        const d1 = requireNumber(s.d1, 'ν₁');
        const d2 = requireNumber(s.d2, 'ν₂');
        if (!(alpha > 0 && alpha < 1)) throw new Error('α debe estar entre 0 y 1.');
        if (!(d1 > 0 && d2 > 0)) throw new Error('Los grados de libertad deben ser positivos.');
        const nodes = [
          answer([{ label: `F crítico de cola superior, α = ${fmt(alpha)}`, value: fmt(fInv(1 - alpha, d1, d2)), detail: `Cola inferior: F(1−α; ν₁, ν₂) = ${fmt(fInv(alpha, d1, d2))}` }]),
          procedure([{
            title: 'Definición',
            text: 'Es el valor que deja un área α en la cola superior. La cola inferior cumple la propiedad 1.7 del apunte.',
            math: [
              `P(f > F_{\\alpha,\\nu_1,\\nu_2}) = \\alpha`,
              `F_{${num(alpha)},\\,${num(d1)},\\,${num(d2)}} = ${num(fInv(1 - alpha, d1, d2))}`,
              `F_{1-\\alpha,\\nu_1,\\nu_2} = \\dfrac{1}{F_{\\alpha,\\nu_2,\\nu_1}} = \\dfrac{1}{${num(fInv(1 - alpha, d2, d1))}} = ${num(fInv(alpha, d1, d2))}`,
            ],
          }]),
        ];
        const value = parseScalar(s.fvalue);
        if (value !== null) nodes.push(card('Valor p', keyValues([['Cola superior', fmt(1 - fCdf(value, d1, d2))]])));
        return nodes;
      }
      case 'normal': {
        const mu = requireNumber(s.mu, 'la media');
        const sigma = requireNumber(s.sigma, 'el desvío');
        if (!(sigma > 0)) throw new Error('El desvío debe ser mayor que cero.');
        const a = parseScalar(s.a);
        const b = parseScalar(s.b);
        if (a === null && b === null) return null;
        const za = a === null ? -Infinity : (a - mu) / sigma;
        const zb = b === null ? Infinity : (b - mu) / sigma;
        if (zb < za) throw new Error('a tiene que ser menor que b.');
        const pa = a === null ? 0 : normCdf(za);
        const pb = b === null ? 1 : normCdf(zb);
        const grid = linspace(mu - 4 * sigma, mu + 4 * sigma);
        const inside = grid.filter((x) => (a === null || x >= a) && (b === null || x <= b));
        const traces = [
          { ...lineTrace(inside, inside.map((x) => gaussianPdf(x, mu, sigma)), { name: 'Área pedida', color: '#2a78d6' }), fill: 'tozeroy' },
          lineTrace(grid, grid.map((x) => gaussianPdf(x, mu, sigma)), { name: 'Densidad normal', color: INK }),
        ];
        return [
          answer([{ label: `P(${a === null ? '−∞' : fmt(a)} ≤ X ≤ ${b === null ? '+∞' : fmt(b)})`, value: fmt(pb - pa), detail: `z de ${fmt(za)} a ${fmt(zb)}` }]),
          procedure([
            {
              title: 'Estandarización',
              math: [
                `z = \\dfrac{x - \\mu}{\\sigma}`,
                a !== null && `z_a = \\dfrac{${par(a)} - ${par(mu)}}{${num(sigma)}} = ${num(za)}`,
                b !== null && `z_b = \\dfrac{${par(b)} - ${par(mu)}}{${num(sigma)}} = ${num(zb)}`,
              ],
            },
            {
              title: 'Probabilidad',
              math: [`P = P(Z \\leq z_b) - P(Z \\leq z_a) = ${num(pb)} - ${num(pa)} = ${num(pb - pa)}`],
            },
          ]),
          card(null, chart(traces, { x: { title: 'x' }, y: { title: 'Densidad de probabilidad', rangemode: 'tozero' } }, { filename: 'normal' })),
        ];
      }
      case 'z': {
        const confidence = confidenceOf(s.confidence);
        return [answer([{ label: `z bilateral, ${percentOf(confidence)}`, value: fmt(normInv(1 - (1 - confidence) / 2)), detail: `Unilateral: ${fmt(normInv(confidence))}` }]),
          procedure([{
            title: 'Definición',
            math: [
              `\\alpha = 1 - ${num(confidence)} = ${num(1 - confidence)}`,
              `P(Z < z_{\\alpha/2}) = 1 - \\dfrac{\\alpha}{2} = ${num(1 - (1 - confidence) / 2)}`,
              `z_{\\alpha/2} = ${num(normInv(1 - (1 - confidence) / 2))}`,
            ],
          }])];
      }
      case 'binomial': {
        if (!s.n.trim() || !s.prob.trim() || !s.k.trim()) return null;
        const n = requireNumber(s.n, 'n');
        const p = requireNumber(s.prob, 'p');
        const k = requireNumber(s.k, 'k');
        if (!Number.isInteger(n) || n < 1 || n > 100000) throw new Error('n debe ser un entero entre 1 y 100000.');
        if (!(p >= 0 && p <= 1)) throw new Error('p debe estar entre 0 y 1.');
        if (!Number.isInteger(k) || k < 0 || k > n) throw new Error('k debe ser un entero entre 0 y n.');
        const mean = n * p;
        const sigma = Math.sqrt(n * p * (1 - p));
        const from = Math.max(0, Math.floor(Math.min(mean - 5 * sigma - 2, k - 2)));
        const to = Math.min(n, Math.ceil(Math.max(mean + 5 * sigma + 2, k + 2)));
        const values = [];
        for (let i = from; i <= to; i += 1) values.push({ k: i, p: binomialPmf(i, n, p) });
        return [
          ...probabilityBlock((i) => binomialPmf(i, n, p), n, k, 'k'),
          procedure([
            {
              title: 'Probabilidad de k éxitos en n ensayos',
              math: [
                `P(k) = \\dfrac{n!}{k!\\,(n-k)!}\\, p^{k} (1-p)^{n-k}`,
                `P(${k}) = \\dfrac{${n}!}{${k}!\\,${n - k}!} \\cdot ${br(p)}^{${k}} \\cdot ${br(1 - p)}^{${n - k}} = ${num(binomialPmf(k, n, p))}`,
              ],
            },
            {
              title: 'Media y desvío',
              math: [
                `\\mu = n p = ${n} \\cdot ${num(p)} = ${num(mean)}`,
                `\\sigma = \\sqrt{n p (1-p)} = \\sqrt{${n} \\cdot ${num(p)} \\cdot ${num(1 - p)}} = ${num(sigma)}`,
              ],
            },
          ]),
          card('Parámetros', keyValues([['Media np', fmt(mean)], ['Desvío √(np(1−p))', fmt(sigma)]])),
          discreteChart(values, mean, sigma, k, 'Número de éxitos', 'binomial'),
        ];
      }
      case 'poisson': {
        if (!s.poisson.trim() || !s.k.trim()) return null;
        const mu = requireNumber(s.poisson, 'μ');
        const k = requireNumber(s.k, 'k');
        if (!(mu > 0 && mu <= 100000)) throw new Error('μ debe ser mayor que cero.');
        if (!Number.isInteger(k) || k < 0) throw new Error('k debe ser un entero no negativo.');
        const sigma = Math.sqrt(mu);
        const from = Math.max(0, Math.floor(Math.min(mu - 5 * sigma - 2, k - 2)));
        const to = Math.ceil(Math.max(mu + 5 * sigma + 3, k + 2));
        const values = [];
        for (let i = from; i <= to; i += 1) values.push({ k: i, p: poissonPmf(i, mu) });
        return [
          ...probabilityBlock((i) => poissonPmf(i, mu), k, k, 'k'),
          procedure([
            {
              title: 'Probabilidad de k eventos',
              math: [
                `P_{\\mu}(k) = e^{-\\mu} \\dfrac{\\mu^{k}}{k!}`,
                `P_{${num(mu)}}(${k}) = e^{-${num(mu)}} \\cdot \\dfrac{${br(mu)}^{${k}}}{${k}!} = ${num(poissonPmf(k, mu))}`,
              ],
            },
            { title: 'Desvío', math: [`\\sigma = \\sqrt{\\mu} = \\sqrt{${num(mu)}} = ${num(sigma)}`] },
          ]),
          card('Parámetros', keyValues([['Media μ', fmt(mu)], ['Desvío √μ', fmt(sigma)]])),
          discreteChart(values, mu, sigma, k, 'Número de eventos', 'poisson'),
        ];
      }
      case 'nuB': {
        const rel = parseScalar(s.rel);
        if (rel === null) return null;
        if (!(rel > 0)) throw new Error('La incertidumbre relativa debe ser mayor que cero.');
        return [
          answer([{ label: 'Grados de libertad', value: `ν ≈ ${fmt(0.5 / (rel * rel))}`, detail: 'Ecuación 4.5 de la Serie C 9/15.' }]),
          procedure([{
            title: 'Fórmula',
            math: [`\\nu \\approx \\dfrac{1}{2} \\left[\\dfrac{u(s)}{s}\\right]^{-2} = \\dfrac{1}{2} ${br(rel)}^{-2} = ${num(0.5 / (rel * rel))}`],
          }]),
          note('info', 'Si la incertidumbre tipo B se considera exacta, poné ν = ∞ dejando el campo vacío en Propagación.'),
        ];
      }
      default:
        return null;
    }
  },
};
