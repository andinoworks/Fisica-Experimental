// Bloque "Procedimiento": cada paso muestra la fórmula, los valores reemplazados y el resultado.

import { h, tex } from './dom.js';
import { fmt, numberFormat } from '../core/format.js';
import { nodeToTexWith, symbolTex } from '../core/symbolic.js';

// Número como LaTeX, respetando el formato elegido por el usuario.
export function n(value) {
  if (value === Infinity) return '\\infty';
  if (value === -Infinity) return '-\\infty';
  const text = fmt(value);
  const [mantissa, exponent] = text.split('e');
  const body = (numberFormat.comma ? mantissa.replace(',', '{,}') : mantissa).replace('−', '-');
  return exponent === undefined ? body : `${body} \\times 10^{${exponent}}`;
}

// Entre paréntesis si es negativo, para reemplazar dentro de una fórmula.
export const p = (value) => (value < 0 ? `\\left(${n(value)}\\right)` : n(value));

// Paréntesis siempre: para potencias como (u)².
export const b = (value) => `\\left(${n(value)}\\right)`;

export const sumOf = (terms) => terms.join(' + ').replace(/\+ -/g, '- ');

export function procedure(steps, title = 'Procedimiento') {
  return h('section', { class: 'card procedure' },
    h('h2', {}, title),
    h('ol', { class: 'steps' }, steps.filter(Boolean).map((step) => h('li', {},
      h('h3', {}, step.title),
      step.text && h('p', {}, step.text),
      step.math && h('div', { class: 'math-list' }, step.math.filter(Boolean).map((source) => h('div', {}, tex(source)))),
      step.conclusion && h('p', { class: 'conclusion' }, step.conclusion),
      step.content))));
}

function criticalSymbol(stat, confidence, alt, nu) {
  const alpha = 1 - confidence;
  const tail = alt === 'two' ? alpha / 2 : alpha;
  if (stat === 'z' || nu === Infinity) return `z_{${n(tail)}}`;
  return `t_{${n(tail)},\\,${n(nu)}}`;
}

export function hypothesesStep(left, right, alt) {
  const relation = { two: '\\neq', greater: '>', less: '<' }[alt];
  return {
    title: 'Hipótesis',
    math: [`H_0:\\ ${left} = ${right}`, `H_a:\\ ${left} ${relation} ${right}`],
  };
}

// Valor crítico, región de rechazo y comparación con el estadístico.
export function decisionSteps({ stat = 't', value, nu, confidence, alt, critical, reject, yes, no }) {
  const symbol = criticalSymbol(stat, confidence, alt, nu);
  const alpha = 1 - confidence;
  const name = stat === 'z' || nu === Infinity ? 'z' : 't';
  const region = {
    two: `|${name}| \\geq ${symbol}`,
    greater: `${name} \\geq ${symbol}`,
    less: `${name} \\leq -${symbol}`,
  }[alt];
  const shown = alt === 'two' ? Math.abs(value) : value;
  const left = alt === 'two' ? `|${name}|` : name;
  const threshold = alt === 'less' ? -critical : critical;
  let relation;
  if (alt === 'less') relation = reject ? '\\leq' : '>';
  else relation = reject ? '\\geq' : '<';
  return [
    {
      title: 'Valor crítico y región de rechazo',
      math: [
        `\\alpha = 1 - ${n(confidence)} = ${n(alpha)}`,
        `${symbol} = ${n(critical)}`,
        `\\text{Se rechaza } H_0 \\text{ si } ${region}`,
      ],
    },
    {
      title: 'Decisión',
      math: [`${left} = ${n(shown)} ${relation} ${n(threshold)}`],
      conclusion: reject ? yes ?? 'Cae en la región de rechazo: se rechaza H₀.' : no ?? 'No cae en la región de rechazo: no se rechaza H₀.',
    },
  ];
}

// Valor de la fórmula, derivadas e incertidumbre combinada, sin y con valores.
export function combinedSteps(compiled, r) {
  const lhs = compiled.output ? symbolTex(compiled.output) : 'q';
  const scope = Object.fromEntries(r.rows.map((row) => [row.name, row.value]));
  const number = (value) => p(value);
  const active = r.rows.filter((row) => row.u > 0);
  const partial = (name) => `\\dfrac{\\partial ${lhs}}{\\partial ${symbolTex(name)}}`;
  const uOf = (name) => `u(${symbolTex(name)})`;
  const uSq = (name) => `u^{2}(${symbolTex(name)})`;
  const coefficient = (row) => (row.derivative.symbolic ? row.derivative.tex : `c_{${symbolTex(row.name)}}`);
  const byName = Object.fromEntries(r.rows.map((row) => [row.name, row]));

  const steps = [
    {
      title: 'Valor del resultado',
      math: [
        `${lhs} = ${compiled.tex}`,
        `${lhs} = ${nodeToTexWith(compiled.node, scope, number)} = ${n(r.y)}`,
      ],
    },
    {
      title: 'Coeficientes de sensibilidad (derivadas parciales)',
      math: r.rows.map((row) => (row.derivative.symbolic
        ? `c_{${symbolTex(row.name)}} = ${partial(row.name)} = ${row.derivative.tex} = ${nodeToTexWith(row.derivative.node, scope, number)} = ${n(row.c)}`
        : `c_{${symbolTex(row.name)}} = ${partial(row.name)} = ${n(row.c)} \\ \\text{(numérica)}`)),
    },
  ];

  if (active.length === 0) return steps;

  const general = active.map((row) => `\\left(${partial(row.name)}\\right)^{2} ${uSq(row.name)}`);
  const symbolic = active.map((row) => `\\left(${coefficient(row)}\\right)^{2} ${uSq(row.name)}`);
  const valued = active.map((row) => `${b(row.c)}^{2} ${b(row.u)}^{2}`);
  for (const { a, b: other, value } of r.crossRows) {
    const pair = `u(${symbolTex(a)},${symbolTex(other)})`;
    general.push(`2 ${partial(a)} ${partial(other)} ${pair}`);
    symbolic.push(`2 \\left(${coefficient(byName[a])}\\right) \\left(${coefficient(byName[other])}\\right) ${pair}`);
    valued.push(`2 ${b(byName[a].c)} ${b(byName[other].c)} ${b(value)}`);
  }

  steps.push({
    title: 'Incertidumbre estándar combinada',
    text: 'Fórmula general, con las derivadas reemplazadas y con los valores:',
    math: [
      `u_c(${lhs}) = \\sqrt{${general.join(' + ')}}`,
      `u_c(${lhs}) = \\sqrt{${symbolic.join(' + ')}}`,
      `u_c(${lhs}) = \\sqrt{${valued.join(' + ')}}`,
      `u_c(${lhs}) = ${n(r.uc)}`,
    ],
  });
  return steps;
}

export function welchStep(r) {
  const active = r.rows.filter((row) => row.u > 0);
  if (active.length === 0) return null;
  const finite = active.filter((row) => row.nu !== Infinity);
  const general = `\\nu_{ef} = \\dfrac{u_c^{4}}{\\sum_i \\dfrac{c_i^{4}\\, u^{4}(x_i)}{\\nu_i}}`;
  if (finite.length === 0) {
    return { title: 'Grados de libertad efectivos (Welch-Satterthwaite)', text: 'Todas las incertidumbres tienen ν infinito, así que ν efectivo también es infinito.', math: [general] };
  }
  const terms = finite.map((row) => `\\dfrac{${b(row.c)}^{4} ${b(row.u)}^{4}}{${n(row.nu)}}`);
  const dropped = active.length > finite.length ? 'Los términos con ν infinito no aportan al denominador.' : null;
  return {
    title: 'Grados de libertad efectivos (Welch-Satterthwaite)',
    text: dropped,
    math: [
      general,
      `\\nu_{ef} = \\dfrac{${b(r.uc)}^{4}}{${terms.join(' + ')}} = ${n(r.nuRaw)}`,
      `\\nu_{ef} = ${r.nuEff} \\ \\text{(truncado al entero inferior${r.clamped ? ', con un mínimo de 1' : ''})}`,
    ],
  };
}

export function expandedStep(k, u, confidence, nu, uName = 'u_c') {
  const symbol = criticalSymbol('t', confidence, 'two', nu);
  return {
    title: 'Incertidumbre expandida',
    math: [`k = ${symbol} = ${n(k)}`, `U = k\\, ${uName} = ${n(k)} \\cdot ${p(u)} = ${n(k * u)}`],
  };
}

export const matrixTex = (rows) => `\\begin{pmatrix} ${rows.map((row) => row.map((value) => n(value)).join(' & ')).join(' \\\\ ')} \\end{pmatrix}`;
