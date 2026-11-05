// Propagación con derivadas automáticas y Welch-Satterthwaite.
// Reemplaza a la parte A de welch_2variables.py, para cualquier cantidad de variables.

import { answer, card, h, keyValues, note, row, table, tex } from '../ui/dom.js';
import { fmt, fmtInt, fmtMeasurement, percent } from '../core/format.js';
import { parseNumbers, parseNu, parseScalar } from '../core/parse.js';
import { covariance, summarize } from '../core/stats.js';
import { compileFormula, nodeToTexNumbers, nodeToTexWith,parseConstantNames, propagate, propagatePaired, propagateWithConstants, symbolTex } from '../core/symbolic.js';
import { confidenceOf, percentOf } from './comunes.js';
import { b as br, chain, combinedSteps, expandedStep, n as num, p as par, procedure, welchStep } from '../ui/procedimiento.js';

const emptyVariable = () => ({ mode: 'direct', value: '', u: '', nu: '', data: '', ub: '' });
const pairKey = (a, b) => `${a}|${b}`;

// c1, c2… siempre son constantes sin valor; el campo "constantes" agrega otros nombres.
const compileState = (s) => compileFormula(s.formula, { constants: parseConstantNames(s.constants) });

function detect(s) {
  try {
    const compiled = compileState(s);
    return { variables: compiled.variables, constants: compiled.constants };
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
    return { name, value: r.mean, u, nu, values, n: r.n, s: r.s, sem: r.sem, ub };
  }
  const value = parseScalar(v.value);
  if (value === null) return null;
  const u = parseScalar(v.u) ?? 0;
  if (u < 0) throw new Error(`La incertidumbre de ${name} no puede ser negativa.`);
  return { name, value, u, nu: parseNu(v.nu) };
}

function inputLines(inputs) {
  return inputs.map((input) => {
    const name = symbolTex(input.name);
    if (input.values) {
      const lines = [
        `\\bar{${name}} = ${num(input.value)}, \\quad s = ${num(input.s)}, \\quad N = ${input.n}`,
        `s_{\\bar{${name}}} = \\dfrac{s}{\\sqrt{N}} = \\dfrac{${num(input.s)}}{\\sqrt{${input.n}}} = ${num(input.sem)}`,
      ];
      if (input.ub > 0) {
        lines.push(`u(${name}) = \\sqrt{s_{\\bar{${name}}}^{2} + u_B^{2}} = \\sqrt{${br(input.sem)}^{2} + ${br(input.ub)}^{2}} = ${num(input.u)}`);
        lines.push(`\\nu_{${name}} = (N-1) \\left(\\dfrac{u}{s_{\\bar{${name}}}}\\right)^{4} = ${num(input.nu)}`);
      } else {
        lines.push(`u(${name}) = ${num(input.u)}, \\quad \\nu_{${name}} = N - 1 = ${num(input.nu)}`);
      }
      return lines;
    }
    if (input.u === 0) return [`${name} = ${num(input.value)} \\ \\text{(sin incertidumbre)}`];
    return [`${name} = ${num(input.value)}, \\quad u(${name}) = ${num(input.u)}, \\quad \\nu_{${name}} = ${num(input.nu)}`];
  }).flat();
}

// Resultado en función de constantes sin valor (c1, c2… o las que se agreguen).
function withConstants(compiled, inputs, covariances, confidence, unit) {
  const r = propagateWithConstants(compiled, inputs, covariances, confidence);
  const lhs = compiled.output ? symbolTex(compiled.output) : 'q';
  const expr = (node) => nodeToTexNumbers(node, par);
  const scope = Object.fromEntries(inputs.map((input) => [input.name, input.value]));
  const yTex = expr(r.yNode);
  const restTex = expr(r.rest);
  const unitText = unit ? ` ${unit}` : '';
  const nodes = [];

  const nuDetail = r.nuEff === null ? 'ν efectivo depende de las constantes' : r.nuEff === Infinity ? 'ν efectivo infinito' : `ν efectivo = ${fmtInt(r.nuEff)}`;
  const kDetail = r.k === null ? '' : `k = ${fmt(r.k)}, `;
  const level = `al ${percentOf(confidence)}`;
  const entries = [];
  if (r.kind === 'factor') {
    entries.push({
      label: r.U === null ? 'Resultado con incertidumbre estándar' : `Resultado con incertidumbre expandida, ${level}`,
      value: h('span', {}, fmtMeasurement(r.coefficient, r.U ?? r.uc), ' · ', tex(restTex), unitText),
      detail: h('span', {}, r.U === null ? `u_c = ${fmt(r.uc)} · ` : `U = ${fmt(r.U)} · `, tex(`\\left|${restTex}\\right|`), `, ${kDetail}${nuDetail}`),
    });
  } else if (r.kind === 'fixed') {
    entries.push({
      label: r.U === null ? 'Resultado con incertidumbre estándar' : `Resultado con incertidumbre expandida, ${level}`,
      value: h('span', {}, tex(yTex), ` ± ${fmt(r.U ?? r.uc)}${unitText}`),
      detail: `La incertidumbre no depende de las constantes. ${kDetail}${nuDetail}`,
    });
  } else {
    entries.push({ label: 'Resultado', value: h('span', {}, tex(`${lhs} = ${yTex}`), unitText) });
    entries.push({
      label: 'Incertidumbre estándar combinada',
      value: tex(`u_c(${lhs}) = ${expr(r.ucNode)}`),
      detail: r.k === null ? nuDetail : `U = k·u_c con ${kDetail}${nuDetail} (${level})`,
    });
  }
  nodes.push(answer(entries));

  if (r.nuEff === null) nodes.push(note('warn', 'Los grados de libertad efectivos dependen del valor de las constantes, así que no se puede dar k ni U: queda la incertidumbre estándar.'));
  else if (r.clamped) nodes.push(note('warn', 'ν efectivo dio menor que 1 y se tomó ν = 1.'));
  if (r.crossRows.length) nodes.push(note('warn', 'Welch-Satterthwaite con covarianza es solo una aproximación: la covarianza no entra en el denominador de ν.'));

  const partial = (name) => `\\dfrac{\\partial ${lhs}}{\\partial ${symbolTex(name)}}`;
  const active = r.rows.filter((row) => row.u > 0);
  const steps = [
    { title: 'Datos de entrada', math: inputLines(inputs), text: `Constantes sin valor: ${compiled.constants.join(', ')}. Quedan como letras en todo el cálculo.` },
    {
      title: 'Valor del resultado',
      math: [`${lhs} = ${compiled.tex}`, chain([lhs, nodeToTexWith(compiled.node, scope, par), yTex])],
    },
    {
      title: 'Coeficientes de sensibilidad (derivadas parciales)',
      math: r.rows.map((row) => chain([`c_{${symbolTex(row.name)}}`, partial(row.name), row.derivative.tex, expr(row.cNode)])),
    },
  ];
  if (active.length) {
    const general = active.map((row) => `\\left(${partial(row.name)}\\right)^{2} u^{2}(${symbolTex(row.name)})`);
    const valued = active.map((row) => `\\left(${expr(row.cNode)}\\right)^{2} ${br(row.u)}^{2}`);
    for (const { a, b, value } of r.crossRows) {
      general.push(`2 ${partial(a)} ${partial(b)} u(${symbolTex(a)},${symbolTex(b)})`);
      const ca = r.rows.find((row_) => row_.name === a).cNode;
      const cb = r.rows.find((row_) => row_.name === b).cNode;
      valued.push(`2 \\left(${expr(ca)}\\right) \\left(${expr(cb)}\\right) ${br(value)}`);
    }
    steps.push({
      title: 'Incertidumbre estándar combinada',
      math: [
        `u_c(${lhs}) = \\sqrt{${general.join(' + ')}}`,
        `u_c(${lhs}) = \\sqrt{${valued.join(' + ')}}`,
        `u_c(${lhs}) = ${expr(r.ucNode)}`,
        r.kind === 'factor' && `u_c(${lhs}) = ${num(r.uc)} \\left|${restTex}\\right|`,
        r.kind === 'fixed' && `u_c(${lhs}) = ${num(r.uc)}`,
      ].filter(Boolean),
    });
    if (r.nuEff !== null) {
      steps.push({
        title: 'Grados de libertad efectivos (Welch-Satterthwaite)',
        text: r.nuEff === Infinity
          ? 'Todas las incertidumbres tienen ν infinito, así que ν efectivo también es infinito.'
          : 'Las constantes aparecen igual en el numerador y en el denominador y se cancelan, así que ν efectivo es un número.',
        math: r.nuEff === Infinity ? [] : [`\\nu_{ef} = \\dfrac{u_c^{4}}{\\sum_i \\dfrac{c_i^{4}\\, u^{4}(x_i)}{\\nu_i}} = ${num(r.nuRaw)} \\Rightarrow \\nu_{ef} = ${r.nuEff}`],
      });
      steps.push({
        title: 'Incertidumbre expandida',
        math: r.kind === 'general'
          ? [`k = ${num(r.k)}`, `U = k\\, u_c = ${num(r.k)} \\cdot ${expr(r.ucNode)}`]
          : r.kind === 'factor'
            ? [`k = ${num(r.k)}`, `U = k\\, u_c = ${num(r.k)} \\cdot ${num(r.uc)} \\left|${restTex}\\right| = ${num(r.U)} \\left|${restTex}\\right|`]
            : [`k = ${num(r.k)}`, `U = k\\, u_c = ${num(r.k)} \\cdot ${num(r.uc)} = ${num(r.U)}`],
      });
    }
  }
  nodes.push(procedure(steps));

  nodes.push(card('Presupuesto de incertidumbre',
    table(['Variable', 'Valor', 'u', 'ν', 'c', 'Aporte a Σ(c·u)²'], r.rows.map((row_) => [
      tex(symbolTex(row_.name)), fmt(row_.value), fmt(row_.u), row_.nu === Infinity ? '∞' : fmt(row_.nu),
      tex(expr(row_.cNode)), row_.share === null ? 'depende de las constantes' : percent(row_.share),
    ]))));
  return nodes;
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
  defaults: { formula: '', confidence: '95', unit: '', constants: '', vars: {}, cov: {} },
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
    {
      label: 'Con una constante sin valor',
      state: {
        formula: 'F = c1 * x',
        vars: { x: { mode: 'series', data: '0.112 0.115 0.110 0.114 0.113' } },
      },
    },
  ],
  form(f, s, ctx) {
    const variablesBox = h('div', { class: 'variables' });
    const constantsBox = h('p', { class: 'help', style: 'color:var(--ink-2);font-size:.875rem;margin:0', hidden: true });
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

    function renderConstants(constants) {
      constantsBox.hidden = constants.length === 0;
      constantsBox.replaceChildren(
        h('strong', {}, constants.length === 1 ? 'Constante sin valor: ' : 'Constantes sin valor: '),
        ...constants.flatMap((name, i) => [i ? ', ' : '', tex(symbolTex(name))]),
        ' · el resultado queda en función de ', constants.length === 1 ? 'ella' : 'ellas', '.');
    }

    function refreshStructure() {
      const found = detect(s);
      if (!found) return;
      const next = `${found.variables.join('|')}#${found.constants.join('|')}`;
      if (next === signature) return;
      signature = next;
      renderConstants(found.constants);
      renderVariables(found.variables);
      renderCovariances(found.variables);
    }
    ctx.onChange(refreshStructure);

    return [
      f.text('formula', { label: 'Fórmula', placeholder: 'gamma = x1 / (x1 - x2)', help: 'Potencia con ^ o **; exp, ln o log, log10, sqrt, sin, cos, tan (en radianes). pi y e son constantes. Las variables se detectan solas; c1, c2, c3… son constantes sin valor.' }),
      row(f.confidence(), f.text('unit', { label: 'Unidad del resultado', placeholder: 'g cm²' })),
      f.text('constants', { label: 'Otras constantes sin valor (opcional)', placeholder: 'L0, m_e', help: 'Nombres separados por coma. c1, c2, c3… ya son constantes sin agregarlas acá. No se les pide valor ni incertidumbre.' }),
      constantsBox,
      variablesBox,
      covSection,
    ];
  },
  calc(s) {
    if (!s.formula.trim()) return null;
    const compiled = compileState(s);
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
      covariances.push({ a, b, value: covariance(x.values, y.values) / x.n, sxy: covariance(x.values, y.values), n: x.n });
      pairedWith.add(a).add(b);
    }));

    if (compiled.constants.length) return withConstants(compiled, inputs, covariances, confidence, s.unit.trim());

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

    const inputMath = inputLines(inputs);

    const covarianceStep = covariances.length > 0 && {
      title: 'Covarianzas',
      math: covariances.map(({ a, b, value, sxy, n: count }) => {
        const pair = `u(${symbolTex(a)},${symbolTex(b)})`;
        if (sxy === undefined) return `${pair} = ${num(value)} \\ \\text{(ingresada)}`;
        return `${pair} = \\dfrac{1}{N} \\cdot \\dfrac{\\sum (x_k - \\bar{x})(y_k - \\bar{y})}{N - 1} = \\dfrac{${num(sxy)}}{${count}} = ${num(value)}`;
      }),
    };

    const pairedSteps = paired && [{
      title: 'Otra forma: calcular en cada juego de mediciones (ec. 6.3)',
      text: `Evalúa la fórmula en cada uno de los ${paired.values.length} juegos y promedia. No necesita covarianzas ni Welch-Satterthwaite.`,
      math: [
        `${outputTex}_k = ${paired.values.slice(0, 6).map((value) => num(value)).join(',\\ ')}${paired.values.length > 6 ? ',\\ \\dots' : ''}`,
        `\\bar{${outputTex}} = ${num(paired.y)}, \\quad s = ${num(paired.s)}`,
        `u = \\dfrac{s}{\\sqrt{N}} = \\dfrac{${num(paired.s)}}{\\sqrt{${paired.values.length}}} = ${num(paired.u)}, \\quad \\nu = N - 1 = ${paired.nu}`,
        `U = k\\, u = ${num(paired.k)} \\cdot ${num(paired.u)} = ${num(paired.U)}`,
      ],
    }];

    nodes.push(procedure([
      { title: 'Datos de entrada', math: inputMath },
      covarianceStep,
      ...combinedSteps(compiled, r),
      welchStep(r),
      r.uc > 0 && expandedStep(r.k, r.uc, confidence, r.nuEff),
      ...(pairedSteps ?? []),
    ]));

    nodes.push(card('Presupuesto de incertidumbre',
      table(['Variable', 'Valor', 'u', 'ν', 'c', '|c·u|', 'Aporte a Σ(c·u)²'], r.rows.map((row_) => [
        tex(symbolTex(row_.name)), fmt(row_.value), fmt(row_.u), row_.nu === Infinity ? '∞' : fmt(row_.nu),
        fmt(row_.c), fmt(Math.abs(row_.c * row_.u)), r.independent > 0 ? percent(row_.contribution / r.independent) : '—',
      ]))));

    if (r.crossRows.length) {
      nodes.push(card('Efecto de la correlación', keyValues([
        ['Sin correlación, u sería', fmt(Math.sqrt(r.independent))],
        ['Con correlación, u_c es', fmt(r.uc)],
      ])));
    }

    return nodes;
  },
};
