// Comparación estadística de resultados. Reemplaza a la parte B de welch_2variables.py
// y agrega la comparación de dos muestras del teórico, con su análisis de homogeneidad.

import { answer, card, h, keyValues, note, row, group, verdict } from '../ui/dom.js';
import { b, decisionSteps, hypothesesStep, n, p, procedure } from '../ui/procedimiento.js';
import { fmt, fmtInt } from '../core/format.js';
import { parseScalar } from '../core/parse.js';
import { compareResults, compareSamples, compareToReference } from '../core/stats.js';
import { ALTERNATIVES, confidenceOf, nuOf, percentOf, requireNumber, sampleFrom } from './comunes.js';
import { fTestSteps } from './test-f.js';

const YES = 'Se rechaza H₀: los valores no son compatibles.';
const NO = 'No se rechaza H₀: los valores son compatibles.';

function header(reject, confidence) {
  return answer([{
    label: `Resultado al ${percentOf(confidence)}`,
    value: reject ? 'No compatibles' : 'Compatibles',
    detail: reject ? 'Se rechaza la hipótesis nula: hay una discrepancia estadísticamente significativa.' : 'No se rechaza la hipótesis nula.',
  }]);
}

function homogeneityBlock(result, label, s1Label, s2Label, fConfidence) {
  const f = result.homogeneity;
  return card('Análisis de homogeneidad de las varianzas',
    keyValues([
      [`Varianza ${s1Label}`, fmt(result.var1)],
      [`Varianza ${s2Label}`, fmt(result.var2)],
      ['Estadístico F', fmt(f.f)],
      [`F crítico (${percentOf(fConfidence)})`, fmt(f.critical)],
    ]),
    h('div', { style: 'height:10px' }),
    verdict(!f.reject,
      f.reject ? 'Varianzas no homogéneas' : 'Varianzas homogéneas',
      `${f.reject ? 'Para comparar corresponde Welch.' : 'Para comparar corresponde Student agrupado.'} ${label}`));
}

// Pasos para la comparación de dos medias, agrupada o con Welch.
function meansSteps(a, b_, r, labels) {
  const steps = [];
  const difference = `${p(a.mean)} - ${p(b_.mean)}`;
  if (r.pooled) {
    const sp2 = ((a.n - 1) * a.s2 + (b_.n - 1) * b_.s2) / (a.n + b_.n - 2);
    steps.push({
      title: 'Varianza agrupada',
      text: `Se usa porque ${labels.reason}.`,
      math: [
        `s_p^{2} = \\dfrac{(n_1 - 1) s_1^{2} + (n_2 - 1) s_2^{2}}{n_1 + n_2 - 2}`,
        `s_p^{2} = \\dfrac{${n(a.n - 1)} \\cdot ${n(a.s2)} + ${n(b_.n - 1)} \\cdot ${n(b_.s2)}}{${n(a.n + b_.n - 2)}} = ${n(sp2)}, \\qquad s_p = ${n(Math.sqrt(sp2))}`,
      ],
    });
    steps.push({
      title: 'Estadístico de prueba',
      math: [
        `t = \\dfrac{\\bar{x}_1 - \\bar{x}_2}{s_p \\sqrt{\\dfrac{1}{n_1} + \\dfrac{1}{n_2}}}`,
        `t = \\dfrac{${difference}}{${n(Math.sqrt(sp2))} \\sqrt{\\dfrac{1}{${n(a.n)}} + \\dfrac{1}{${n(b_.n)}}}} = ${n(r.statistic)}`,
        `\\nu = n_1 + n_2 - 2 = ${n(r.nu)}`,
      ],
    });
    return steps;
  }
  const ua2 = a.s2 / a.n;
  const ub2 = b_.s2 / b_.n;
  steps.push({
    title: 'Estadístico de prueba (Welch)',
    text: `Se usa porque ${labels.reason}.`,
    math: [
      `t = \\dfrac{\\bar{x}_1 - \\bar{x}_2}{\\sqrt{\\dfrac{s_1^{2}}{n_1} + \\dfrac{s_2^{2}}{n_2}}}`,
      `t = \\dfrac{${difference}}{\\sqrt{\\dfrac{${n(a.s2)}}{${n(a.n)}} + \\dfrac{${n(b_.s2)}}{${n(b_.n)}}}} = ${n(r.statistic)}`,
    ],
  });
  steps.push({
    title: 'Grados de libertad (Welch-Satterthwaite)',
    math: [
      `\\nu = \\dfrac{\\left(\\dfrac{s_1^{2}}{n_1} + \\dfrac{s_2^{2}}{n_2}\\right)^{2}}{\\dfrac{(s_1^{2}/n_1)^{2}}{n_1 - 1} + \\dfrac{(s_2^{2}/n_2)^{2}}{n_2 - 1}}`,
      `\\nu = \\dfrac{\\left(${n(ua2)} + ${n(ub2)}\\right)^{2}}{\\dfrac{${b(ua2)}^{2}}{${n(a.n - 1)}} + \\dfrac{${b(ub2)}^{2}}{${n(b_.n - 1)}}} = ${n(r.nuRaw)}`,
      `\\nu = ${n(r.nu)} \\ \\text{(truncado al entero inferior)}`,
    ],
  });
  return steps;
}

function reasonFor(method, homogeneity) {
  if (method === 'pooled') return 'lo elegiste en "Método"';
  if (method === 'welch') return 'lo elegiste en "Método"';
  return homogeneity.reject ? 'el test F indica varianzas no homogéneas' : 'el test F indica varianzas homogéneas';
}

export default {
  id: 'comparar',
  group: 'Muestras y comparación',
  title: 'Comparar valores',
  short: 'Test t con su procedimiento: referencia, dos resultados o dos muestras',
  description: 'Decide si dos valores son estadísticamente compatibles: un resultado contra un valor teórico, dos resultados con su incertidumbre, o dos muestras. Muestra cada paso y analiza si las varianzas son homogéneas.',
  origin: 'Reemplaza a la parte B de welch_2variables.py. Teoría: Serie C 4/11, sección 3.10, y 9/15, sección 1.1.',
  hint: 'Completá los dos valores para compararlos.',
  defaults: {
    mode: 'two', confidence: '95', alt: 'two',
    v1: '', u1: '', nu1: '', v2: '', u2: '', nu2: '', cov: '', ref: '',
    mode1: 'raw', data1: '', mean1: '', s1: '', n1: '', mode2: 'raw', data2: '', mean2: '', s2: '', n2: '',
    method: 'auto', fConfidence: '95',
  },
  examples: [
    { label: 'Dos métodos (welch_2variables.py)', state: { mode: 'two', v1: '1.32', u1: '0.02', nu1: '1251', v2: '1.24', u2: '0.02', nu2: '8' } },
    { label: 'Contra valor teórico', state: { mode: 'ref', v1: '1.32', u1: '0.02', nu1: '1251', ref: '1.4' } },
    { label: 'Lentes (9/15)', state: { mode: 'ref', v1: '3.05', u1: '0.1075', nu1: '9', ref: '3.2' } },
    {
      label: 'Pelícanos (9/15)',
      state: { mode: 'samples', mode1: 'summary', mean1: '0.041', s1: '0.017', n1: '10', mode2: 'summary', mean2: '0.026', s2: '0.006', n2: '13', fConfidence: '90', alt: 'greater' },
    },
  ],
  form(f, s) {
    const sampleFields = (suffix) => [
      f.select(`mode${suffix}`, { label: `Muestra ${suffix}`, options: [['raw', 'Mediciones'], ['summary', 'Media, s y N']] }),
      f.when(() => s[`mode${suffix}`] === 'raw', f.area(`data${suffix}`, { rows: 3, placeholder: 'Mediciones' })),
      f.when(() => s[`mode${suffix}`] !== 'raw',
        row(f.text(`mean${suffix}`, { label: 'Media', decimal: true }), f.text(`s${suffix}`, { label: 'Desvío s', decimal: true }), f.text(`n${suffix}`, { label: 'N', decimal: true }))),
    ];
    return [
      f.select('mode', {
        label: 'Qué querés comparar',
        options: [['two', 'Dos resultados (valor ± u)'], ['ref', 'Un resultado contra un valor de referencia'], ['samples', 'Dos muestras de mediciones']],
      }),
      f.when(() => s.mode !== 'samples',
        row(
          f.text('v1', { label: 'Valor 1', decimal: true }),
          f.text('u1', { label: 'Incertidumbre estándar u₁', decimal: true }),
          f.text('nu1', { label: 'Grados ν₁', decimal: true, placeholder: '∞' }))),
      f.when(() => s.mode === 'two',
        row(
          f.text('v2', { label: 'Valor 2', decimal: true }),
          f.text('u2', { label: 'Incertidumbre estándar u₂', decimal: true }),
          f.text('nu2', { label: 'Grados ν₂', decimal: true, placeholder: '∞' })),
        f.text('cov', { label: 'Covarianza entre ambos (opcional)', decimal: true, placeholder: '0 si son independientes' })),
      f.when(() => s.mode === 'ref', f.text('ref', { label: 'Valor de referencia', decimal: true })),
      f.when(() => s.mode === 'samples', sampleFields('1'), sampleFields('2')),
      f.when(() => s.mode !== 'ref',
        group('Homogeneidad de las varianzas',
          f.select('method', {
            label: 'Método',
            options: [['auto', 'Según el test F (homogéneas o no)'], ['pooled', 'Student agrupado'], ['welch', 'Welch']],
            help: 'Con dos resultados, el test F supone que cada u es s/√N de N = ν + 1 mediciones. Si el valor viene de una propagación o de un ajuste, elegí Welch.',
          }),
          f.text('fConfidence', { label: 'Confianza del test F (%)', decimal: true }))),
      group('',
        f.confidence(),
        f.select('alt', { label: 'Hipótesis alternativa', options: ALTERNATIVES })),
    ];
  },
  calc(s) {
    const confidence = confidenceOf(s.confidence);
    const fConfidence = confidenceOf(s.fConfidence);

    if (s.mode === 'samples') {
      const a = sampleFrom(s, '1');
      const b_ = sampleFrom(s, '2');
      if (!a || !b_) return null;
      const r = compareSamples({ a, b: b_, confidence, fConfidence, method: s.method, alt: s.alt });
      const reason = reasonFor(s.method, r.homogeneity);
      return [
        header(r.reject, confidence),
        homogeneityBlock({ ...r, var1: a.s2, var2: b_.s2 }, '', 'de la muestra 1', 'de la muestra 2', fConfidence),
        procedure([
          {
            title: 'Datos de cada muestra',
            math: [
              `\\bar{x}_1 = ${n(a.mean)}, \\quad s_1 = ${n(a.s)}, \\quad s_1^{2} = ${n(a.s2)}, \\quad n_1 = ${n(a.n)}`,
              `\\bar{x}_2 = ${n(b_.mean)}, \\quad s_2 = ${n(b_.s)}, \\quad s_2^{2} = ${n(b_.s2)}, \\quad n_2 = ${n(b_.n)}`,
            ],
          },
          ...fTestSteps({ var1: a.s2, n1: a.n, var2: b_.s2, n2: b_.n, result: r.homogeneity, confidence: fConfidence, alt: 'two', titlePrefix: 'Homogeneidad: ' }),
          hypothesesStep('\\mu_1', '\\mu_2', s.alt),
          ...meansSteps(a, b_, r, { reason }),
          ...decisionSteps({ value: r.statistic, nu: r.nu, confidence, alt: s.alt, critical: r.critical, reject: r.reject, yes: YES, no: NO }),
        ]),
        card('Resumen', keyValues([
          ['Método', r.pooled ? 'Student agrupado' : 'Welch'],
          ['Diferencia', fmt(r.difference)],
          ['Incertidumbre de la diferencia', fmt(r.uDiff)],
          ['Grados de libertad ν', fmtInt(r.nu)],
          ['Estadístico t', fmt(r.statistic)],
          ['t crítico', fmt(r.critical)],
          ['Valor p', fmt(r.p)],
        ])),
      ];
    }

    if (parseScalar(s.v1) === null && parseScalar(s.u1) === null) return null;
    const v1 = requireNumber(s.v1, 'el valor 1');
    const u1 = requireNumber(s.u1, 'la incertidumbre u₁');
    const nu1 = nuOf(s.nu1);

    if (s.mode === 'ref') {
      if (parseScalar(s.ref) === null) return null;
      const reference = parseScalar(s.ref);
      const r = compareToReference({ value: v1, u: u1, nu: nu1, reference, confidence, alt: s.alt });
      return [
        header(r.reject, confidence),
        procedure([
          hypothesesStep('\\mu', '\\mu_0', s.alt),
          {
            title: 'Estadístico de prueba',
            math: [
              `t = \\dfrac{x - \\mu_0}{u}`,
              `t = \\dfrac{${p(v1)} - ${p(reference)}}{${n(u1)}} = \\dfrac{${n(r.difference)}}{${n(u1)}} = ${n(r.statistic)}`,
              `\\nu = ${n(r.nu)}`,
            ],
          },
          ...decisionSteps({ value: r.statistic, nu: r.nu, confidence, alt: s.alt, critical: r.critical, reject: r.reject, yes: YES, no: NO }),
        ]),
        card('Resumen', keyValues([
          ['Diferencia', fmt(r.difference)],
          ['Estadístico t', fmt(r.statistic)],
          ['t crítico', fmt(r.critical)],
          ['Valor p', fmt(r.p)],
        ])),
      ];
    }

    if (parseScalar(s.v2) === null && parseScalar(s.u2) === null) return null;
    const v2 = requireNumber(s.v2, 'el valor 2');
    const u2 = requireNumber(s.u2, 'la incertidumbre u₂');
    const nu2 = nuOf(s.nu2);
    const cov = parseScalar(s.cov) ?? 0;

    // Análisis de homogeneidad: cada u se toma como s/√N con N = ν + 1.
    const canTestF = Number.isFinite(nu1) && Number.isFinite(nu2) && cov === 0;
    if (s.method !== 'welch' && canTestF) {
      if (!(u1 > 0 && u2 > 0)) throw new Error('Las incertidumbres deben ser mayores que cero.');
      const a = { mean: v1, s2: u1 * u1 * (nu1 + 1), s: u1 * Math.sqrt(nu1 + 1), n: nu1 + 1 };
      const b_ = { mean: v2, s2: u2 * u2 * (nu2 + 1), s: u2 * Math.sqrt(nu2 + 1), n: nu2 + 1 };
      const r = compareSamples({ a, b: b_, confidence, fConfidence, method: s.method, alt: s.alt });
      return [
        header(r.reject, confidence),
        homogeneityBlock({ ...r, var1: a.s2, var2: b_.s2 }, '', 'del resultado 1', 'del resultado 2', fConfidence),
        procedure([
          {
            title: 'Varianzas a partir de cada incertidumbre',
            text: 'Con u = s/√N y N = ν + 1:',
            math: [
              `s^{2} = u^{2} N`,
              `s_1^{2} = ${b(u1)}^{2} \\cdot ${n(a.n)} = ${n(a.s2)}`,
              `s_2^{2} = ${b(u2)}^{2} \\cdot ${n(b_.n)} = ${n(b_.s2)}`,
            ],
          },
          ...fTestSteps({ var1: a.s2, n1: a.n, var2: b_.s2, n2: b_.n, result: r.homogeneity, confidence: fConfidence, alt: 'two', titlePrefix: 'Homogeneidad: ' }),
          hypothesesStep('\\mu_1', '\\mu_2', s.alt),
          ...meansSteps(a, b_, r, { reason: reasonFor(s.method, r.homogeneity) }),
          ...decisionSteps({ value: r.statistic, nu: r.nu, confidence, alt: s.alt, critical: r.critical, reject: r.reject, yes: YES, no: NO }),
        ]),
        card('Resumen', keyValues([
          ['Método', r.pooled ? 'Student agrupado' : 'Welch'],
          ['Diferencia', fmt(r.difference)],
          ['Incertidumbre de la diferencia', fmt(r.uDiff)],
          ['Grados de libertad ν', fmtInt(r.nu)],
          ['Estadístico t', fmt(r.statistic)],
          ['t crítico', fmt(r.critical)],
          ['Valor p', fmt(r.p)],
        ])),
      ];
    }

    const r = compareResults({ v1, u1, nu1, v2, u2, nu2, cov, confidence, alt: s.alt });
    const notes = [];
    if (s.method !== 'welch') {
      notes.push(note('info', cov !== 0
        ? 'Con covarianza no se aplica el test F: se usa Welch.'
        : 'Con ν infinito no se puede calcular N para el test F: se usa Welch.'));
    }
    if (cov !== 0) notes.push(note('warn', 'Con covarianza, la fórmula de Welch-Satterthwaite es solo una aproximación: el apunte la plantea para cantidades independientes.'));
    if (r.clamped) notes.push(note('warn', 'ν efectivo dio menor que 1 y se tomó ν = 1.'));

    const finite = [[u1, nu1], [u2, nu2]].filter(([, nu]) => nu !== Infinity);
    const nuStep = finite.length === 0
      ? { title: 'Grados de libertad', text: 'Las dos incertidumbres tienen ν infinito: k sale de la normal.' }
      : {
        title: 'Grados de libertad (Welch-Satterthwaite)',
        math: [
          `\\nu = \\dfrac{(u_1^{2} + u_2^{2})^{2}}{\\dfrac{u_1^{4}}{\\nu_1} + \\dfrac{u_2^{4}}{\\nu_2}}`,
          `\\nu = \\dfrac{\\left(${b(u1)}^{2} + ${b(u2)}^{2}\\right)^{2}}{${finite.map(([u, nu]) => `\\dfrac{${b(u)}^{4}}{${n(nu)}}`).join(' + ')}} = ${n(r.nuRaw)}`,
          `\\nu = ${n(r.nu)} \\ \\text{(truncado al entero inferior)}`,
        ],
      };
    return [
      header(r.reject, confidence),
      ...notes,
      procedure([
        hypothesesStep('\\mu_1', '\\mu_2', s.alt),
        {
          title: 'Incertidumbre de la diferencia',
          math: [
            cov !== 0 ? `u_d = \\sqrt{u_1^{2} + u_2^{2} - 2\\, u(1,2)}` : `u_d = \\sqrt{u_1^{2} + u_2^{2}}`,
            `u_d = \\sqrt{${b(u1)}^{2} + ${b(u2)}^{2}${cov !== 0 ? ` - 2 \\cdot ${p(cov)}` : ''}} = ${n(r.uDiff)}`,
          ],
        },
        {
          title: 'Estadístico de prueba',
          math: [
            `t = \\dfrac{x_1 - x_2}{u_d}`,
            `t = \\dfrac{${p(v1)} - ${p(v2)}}{${n(r.uDiff)}} = ${n(r.statistic)}`,
          ],
        },
        nuStep,
        ...decisionSteps({ value: r.statistic, nu: r.nu, confidence, alt: s.alt, critical: r.critical, reject: r.reject, yes: YES, no: NO }),
      ]),
      card('Resumen', keyValues([
        ['Diferencia', fmt(r.difference)],
        ['Incertidumbre de la diferencia', fmt(r.uDiff)],
        ['Grados de libertad ν', fmtInt(r.nu)],
        ['Estadístico t', fmt(r.statistic)],
        ['t crítico', fmt(r.critical)],
        ['Valor p', fmt(r.p)],
      ])),
    ];
  },
};
