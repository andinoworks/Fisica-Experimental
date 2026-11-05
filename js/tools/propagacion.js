// Propagación con derivadas automáticas y Welch-Satterthwaite.
// Reemplaza a la parte A de welch_2variables.py, para cualquier cantidad de variables.

import { answer, card, h, keyValues, note, row, table, tex } from '../ui/dom.js';
import { fmt, fmtInt, fmtMeasurement, percent } from '../core/format.js';
import { parseNumbers, parseNu, parseScalar } from '../core/parse.js';
import { covariance, summarize } from '../core/stats.js';
import { compileFormula, propagate, propagatePaired, symbolTex } from '../core/symbolic.js';
import { confidenceOf, percentOf } from './comunes.js';

const emptyVariable = () => ({ mode: 'direct', value: '', u: '', nu: '', data: '', ub: '' });
const pairKey = (a, b) => `${a}|${b}`;

function detect(s) {
  try {
    return compileFormula(s.formula).variables;
  } catch {
    return null;
  }
}

// Valor, incertidumbre y grados de libertad de cada variable, según cómo se cargó.
function readVariable(name, v) {
  if (v.mode === 'series') {
    const values = parseNumbers(v.data);
    if (values.length === 0) return null;
    if (values.length < 2) throw new Error(`${name} necesita al menos 2 mediciones.`);
    const r = summarize(values);
    const ub = parseScalar(v.ub) ?? 0;
    const u = Math.hypot(r.sem, ub);
    // Tipo A con ν = N-1 más tipo B con ν infinito: Welch-Satterthwaite (6.9).
    const nu = ub > 0 ? r.nu * (u / r.sem) ** 4 : r.nu;
    return { name, value: r.mean, u, nu, values, n: r.n };
  }
  const value = parseScalar(v.value);
  if (value === null) return null;
  const u = parseScalar(v.u) ?? 0;
  if (u < 0) throw new Error(`La incertidumbre de ${name} no puede ser negativa.`);
  return { name, value, u, nu: parseNu(v.nu) };
}

export default {
  id: 'propagacion',
  group: 'Incertidumbres',
  title: 'Propagación y Welch-Satterthwaite',
  short: 'Escribís la fórmula: derivadas, incertidumbre combinada, ν efectivo y U',
  description: 'Escribí la fórmula y cargá cada variable. La web calcula las derivadas parciales, la incertidumbre combinada, los grados de libertad efectivos y la incertidumbre expandida.',
  origin: 'Reemplaza a la parte A de welch_2variables.py. Teoría: Serie C 9/15, capítulos 2, 4 y 6.',
  wideForm: true,
  hint: 'Escribí la fórmula y completá los valores de cada variable.',
  defaults: { formula: '', confidence: '95', unit: '', vars: {}, cov: {} },
  examples: [
    {
      label: 'Clément y Desormes (welch_2variables.py)',
      state: {
        formula: 'gamma = x1 / (x1 - x2)',
        vars: {
          x1: { mode: 'series', data: '301 305 298 302 300 306 299 303 301 304' },
          x2: { mode: 'series', data: '85 87 83 86 84 88 82 87 84 86' },
        },
        cov: { 'x1|x2': { mode: 'series', value: '' } },
      },
    },
    {
      label: 'Momento de inercia (9/15)',
      state: {
        formula: 'I = M * R^2 / 2',
        unit: 'g cm²',
        vars: {
          M: { mode: 'direct', value: '252.6', u: '2.5', nu: '7' },
          R: { mode: 'direct', value: '6.35', u: '0.05', nu: '4' },
        },
      },
    },
    {
      label: 'Ángulos correlacionados (9/15)',
      state: {
        formula: 'theta = alpha + beta',
        unit: 'grados',
        vars: {
          alpha: { mode: 'direct', value: '33', u: '1.58', nu: '4' },
          beta: { mode: 'direct', value: '52', u: '2', nu: '4' },
        },
        cov: { 'alpha|beta': { mode: 'manual', value: '-3' } },
      },
    },
  ],
  form(f, s, ctx) {
    const variablesBox = h('div', { class: 'variables' });
    const covBox = h('div', { class: 'variables' });
    const covSection = h('div', { class: 'group' },
      h('h3', {}, 'Correlación entre variables'),
      h('p', { class: 'help', style: 'color:var(--ink-2);font-size:.875rem' },
        'Elegí "medidas de a pares" solo si cada medición de una variable se tomó junto con la de la otra, como h₁ y h₂ en Clément y Desormes. Dos series con el mismo N medidas por separado son independientes.'),
      covBox);
    let signature = null;

    function renderVariables(names) {
      variablesBox.replaceChildren(...names.map((name) => {
        s.vars[name] = { ...emptyVariable(), ...s.vars[name] };
        const v = s.vars[name];
        const direct = row(
          f.text('value', { label: 'Valor', decimal: true, target: v }),
          f.text('u', { label: 'Incertidumbre u', decimal: true, target: v, placeholder: '0' }),
          f.text('nu', { label: 'Grados ν', decimal: true, target: v, placeholder: '∞' }));
        const series = h('div', { style: 'display:grid;gap:10px' },
          f.area('data', { label: 'Mediciones', rows: 2, target: v }),
          f.text('ub', { label: 'Tipo B a sumar (opcional)', decimal: true, target: v, placeholder: '0' }));
        const sync = () => {
          direct.hidden = v.mode !== 'direct';
          series.hidden = v.mode !== 'series';
        };
        sync();
        ctx.onChange(sync);
        return h('div', { class: 'variable' },
          h('div', { class: 'variable-head' },
            h('span', { class: 'symbol' }, tex(symbolTex(name))),
            f.select('mode', { options: [['direct', 'Valor y u'], ['series', 'Serie de datos']], target: v })),
          direct,
          series);
      }));
    }

    function renderCovariances(names) {
      const pairs = [];
      names.forEach((a, i) => names.slice(i + 1).forEach((b) => pairs.push([a, b])));
      covSection.hidden = pairs.length === 0;
      covBox.replaceChildren(...pairs.map(([a, b]) => {
        const key = pairKey(a, b);
        s.cov[key] = { mode: 'none', value: '', ...s.cov[key] };
        const entry = s.cov[key];
        const manual = f.text('value', { label: 'Cov de los valores usados', decimal: true, target: entry, help: 'Si las variables son promedios, es la covarianza de las medias: s_xy / N.' });
        const sync = () => { manual.hidden = entry.mode !== 'manual'; };
        sync();
        ctx.onChange(sync);
        return h('div', { class: 'variable' },
          h('div', { class: 'variable-head' }, h('span', {}, tex(`${symbolTex(a)},\\ ${symbolTex(b)}`))),
          f.select('mode', {
            target: entry,
            options: [['none', 'Independientes'], ['series', 'De a pares (usa las series)'], ['manual', 'Ingresar la covarianza']],
          }),
          manual);
      }));
    }

    function refreshStructure() {
      const names = detect(s);
      if (!names) return;
      const next = names.join('|');
      if (next === signature) return;
      signature = next;
      renderVariables(names);
      renderCovariances(names);
    }
    ctx.onChange(refreshStructure);

    return [
      f.text('formula', { label: 'Fórmula', placeholder: 'gamma = x1 / (x1 - x2)', help: 'Potencia con ^ o **; exp, ln o log, log10, sqrt, sin, cos, tan (en radianes). pi y e son constantes. Las variables se detectan solas.' }),
      row(f.confidence(), f.text('unit', { label: 'Unidad del resultado', placeholder: 'g cm²' })),
      variablesBox,
      covSection,
    ];
  },
  calc(s) {
    if (!s.formula.trim()) return null;
    const compiled = compileFormula(s.formula);
    const names = compiled.variables;
    if (names.length === 0) throw new Error('La fórmula no tiene variables.');
    const inputs = [];
    for (const name of names) {
      const parsed = readVariable(name, { ...emptyVariable(), ...s.vars[name] });
      if (!parsed) return null;
      inputs.push(parsed);
    }

    const confidence = confidenceOf(s.confidence);
    const byName = Object.fromEntries(inputs.map((input) => [input.name, input]));
    const covariances = [];
    const pairedWith = new Set();
    names.forEach((a, i) => names.slice(i + 1).forEach((b) => {
      const entry = s.cov[pairKey(a, b)];
      if (!entry || entry.mode === 'none') return;
      if (entry.mode === 'manual') {
        const value = parseScalar(entry.value);
        if (value !== null) covariances.push({ a, b, value });
        return;
      }
      const x = byName[a];
      const y = byName[b];
      if (!x.values || !y.values) throw new Error(`Para calcular la covarianza de ${a} y ${b}, ambas tienen que cargarse como serie de datos.`);
      if (x.n !== y.n) throw new Error(`${a} tiene ${x.n} mediciones y ${b} tiene ${y.n}: para medirlas de a pares tienen que coincidir.`);
      covariances.push({ a, b, value: covariance(x.values, y.values) / x.n });
      pairedWith.add(a).add(b);
    }));

    const r = propagate(compiled, inputs, covariances, confidence);
    const unit = s.unit.trim();
    const outputTex = compiled.output ? symbolTex(compiled.output) : 'q';
    const nodes = [];

    // Alternativa del apunte (ec. 6.3) cuando todo lo que varía se midió de a pares.
    const varying = inputs.filter((input) => input.u > 0);
    const allPaired = varying.length >= 2 && varying.every((input) => pairedWith.has(input.name));
    let paired = null;
    if (allPaired) {
      const series = Object.fromEntries(varying.map((input) => [input.name, input.values]));
      const fixed = Object.fromEntries(inputs.filter((input) => input.u === 0).map((input) => [input.name, input.value]));
      paired = propagatePaired(compiled, series, fixed, confidence);
    }

    const nuDetail = r.nuEff === Infinity ? 'ν efectivo infinito: k sale de la normal' : `ν efectivo = ${fmtInt(r.nuEff)}`;
    nodes.push(answer([
      { label: `${r.crossRows.length ? 'Con covarianza y Welch-Satterthwaite' : 'Resultado con incertidumbre expandida'}, al ${percentOf(confidence)}`, value: fmtMeasurement(r.y, r.U, { unit }), detail: `U = ${fmt(r.U)}, k = ${fmt(r.k)}, ${nuDetail}` },
      paired && { label: `Calculando en cada juego de mediciones (ec. 6.3), al ${percentOf(confidence)}`, value: fmtMeasurement(paired.y, paired.U, { unit }), detail: `U = ${fmt(paired.U)}, k = ${fmt(paired.k)}, ν = ${fmtInt(paired.nu)}` },
      { label: 'Incertidumbre estándar combinada', value: fmtMeasurement(r.y, r.uc, { unit }), detail: `u_c = ${fmt(r.uc)}` },
    ].filter(Boolean)));

    if (r.crossRows.length) {
      const inflated = paired && r.U > 1.5 * paired.U;
      nodes.push(note('warn',
        h('strong', {}, 'Welch-Satterthwaite con covarianza es solo una aproximación. '),
        'El apunte plantea la fórmula para cantidades independientes: la covarianza achica u_c pero no entra en el denominador de ν, y eso puede bajar mucho ν. ',
        r.clamped ? 'Acá ν dio menor que 1 y se tomó ν = 1. ' : '',
        inflated ? `Por eso k = ${fmt(r.k, { mode: 'auto', digits: 3 })} y U sale ${fmt(r.U / paired.U, { mode: 'auto', digits: 2 })} veces mayor que con la ec. 6.3. Para datos de a pares, conviene la ec. 6.3 o consultar qué criterio pide la cátedra.` : ''));
    } else if (r.clamped) {
      nodes.push(note('warn', 'ν efectivo dio menor que 1 y se tomó ν = 1.'));
    }

    const numericNames = r.rows.filter((row_) => !row_.derivative.symbolic).map((row_) => row_.name);
    if (numericNames.length) {
      nodes.push(note('warn', `No hay derivada simbólica para ${numericNames.join(', ')}: se calculó numéricamente.`));
    }

    nodes.push(card('Derivadas parciales', h('div', { class: 'math-list' },
      tex(`${outputTex} = ${compiled.tex}`),
      r.rows.filter((row_) => row_.derivative.symbolic).map((row_) => tex(
        `c_{${symbolTex(row_.name)}} = \\dfrac{\\partial ${outputTex}}{\\partial ${symbolTex(row_.name)}} = ${row_.derivative.tex}`)))));

    nodes.push(card('Presupuesto de incertidumbre',
      table(['Variable', 'Valor', 'u', 'ν', 'c', '|c·u|', 'Aporte a Σ(c·u)²'], r.rows.map((row_) => [
        tex(symbolTex(row_.name)), fmt(row_.value), fmt(row_.u), row_.nu === Infinity ? '∞' : fmt(row_.nu),
        fmt(row_.c), fmt(Math.abs(row_.c * row_.u)), r.independent > 0 ? percent(row_.contribution / r.independent) : '—',
      ]))));

    if (r.crossRows.length) {
      nodes.push(card('Términos de covarianza',
        table(['Par', 'Cov', '2·c·c·Cov'], r.crossRows.map((row_) => [
          tex(`${symbolTex(row_.a)},\\ ${symbolTex(row_.b)}`), fmt(row_.value), fmt(row_.term),
        ])),
        h('div', { style: 'height:8px' }),
        keyValues([
          ['Sin correlación, u sería', fmt(Math.sqrt(r.independent))],
          ['Con correlación, u_c es', fmt(r.uc)],
        ])));
    }

    nodes.push(card('Cálculo', keyValues([
      [`Valor de ${compiled.output ?? 'la fórmula'}`, fmt(r.y)],
      ['Incertidumbre combinada u_c', fmt(r.uc)],
      ['ν efectivo sin truncar', fmt(r.nuRaw)],
      ['ν efectivo', r.nuEff === Infinity ? '∞' : fmtInt(r.nuEff)],
      [`k para ${percentOf(confidence)}`, fmt(r.k)],
      ['Incertidumbre expandida U = k·u_c', fmt(r.U)],
    ])));

    if (paired) {
      nodes.push(card('Detalle de la ec. 6.3',
        h('p', { class: 'help' }, `Evalúa la fórmula en cada juego de ${paired.values.length} mediciones y promedia. No necesita covarianzas ni Welch-Satterthwaite, y el apunte la menciona como preferible para fórmulas no lineales.`),
        keyValues([
          ['Valor medio', fmt(paired.y)],
          ['Incertidumbre estándar s/√N', fmt(paired.u)],
          ['Grados de libertad ν = N−1', fmtInt(paired.nu)],
          ['k', fmt(paired.k)],
          ['Incertidumbre expandida U', fmt(paired.U)],
        ])));
    }
    return nodes;
  },
};
