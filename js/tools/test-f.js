// Test F de igualdad de varianzas. Reemplaza a test_f.py.

import { answer, card, keyValues, row, group, note } from '../ui/dom.js';
import { n, p, procedure } from '../ui/procedimiento.js';
import { fmt, fmtInt } from '../core/format.js';
import { parseNumbers, parseScalar } from '../core/parse.js';
import { fTest, variance } from '../core/stats.js';
import { confidenceOf, percentOf } from './comunes.js';

function readSample(s, suffix) {
  if (s.mode === 'raw') {
    const values = parseNumbers(s[`data${suffix}`]);
    if (values.length === 0) return null;
    if (values.length < 2) throw new Error(`El método ${suffix} necesita al menos 2 mediciones.`);
    return { v: variance(values), n: values.length };
  }
  const given = parseScalar(s[`v${suffix}`]);
  const count = parseScalar(s[`n${suffix}`]);
  if (given === null || count === null) return null;
  if (given <= 0) throw new Error('Las varianzas y los desvíos deben ser mayores que cero.');
  return { v: s.mode === 'sd' ? given * given : given, n: count };
}

// Los pasos del test F, también usados en "Comparar valores".
export function fTestSteps({ var1, n1, var2, n2, result: r, confidence, alt, titlePrefix = '' }) {
  const alpha = 1 - confidence;
  const relation = { two: '\\neq', greater: '>', less: '<' }[alt];
  const hypotheses = {
    title: `${titlePrefix}hipótesis`.replace(/^h/, 'H'),
    math: [`H_0:\\ \\sigma_1^{2} = \\sigma_2^{2}`, `H_a:\\ \\sigma_1^{2} ${relation} \\sigma_2^{2}`],
  };
  if (alt === 'two') {
    const big = r.firstIsLarger ? var1 : var2;
    const small = r.firstIsLarger ? var2 : var1;
    return [
      hypotheses,
      {
        title: `${titlePrefix}estadístico F`.replace(/^e/, 'E'),
        text: 'Se pone la varianza mayor en el numerador.',
        math: [
          `f = \\dfrac{s_{\\text{mayor}}^{2}}{s_{\\text{menor}}^{2}} = \\dfrac{${n(big)}}{${n(small)}} = ${n(r.f)}`,
          `\\nu_1 = ${n(r.d1)} \\ \\text{(numerador)}, \\qquad \\nu_2 = ${n(r.d2)} \\ \\text{(denominador)}`,
        ],
      },
      {
        title: `${titlePrefix}valor crítico y decisión`.replace(/^v/, 'V'),
        math: [
          `\\alpha = 1 - ${n(confidence)} = ${n(alpha)}`,
          `F_{\\alpha/2,\\,\\nu_1,\\,\\nu_2} = F_{${n(alpha / 2)},\\,${n(r.d1)},\\,${n(r.d2)}} = ${n(r.critical)}`,
          `f = ${n(r.f)} ${r.reject ? '\\geq' : '<'} ${n(r.critical)}`,
        ],
        conclusion: r.reject ? 'Se rechaza H₀: las varianzas no son homogéneas.' : 'No se rechaza H₀: las varianzas son homogéneas.',
      },
    ];
  }
  return [
    hypotheses,
    {
      title: 'Estadístico F',
      math: [
        `f = \\dfrac{s_1^{2}}{s_2^{2}} = \\dfrac{${p(var1)}}{${p(var2)}} = ${n(r.f)}`,
        `\\nu_1 = ${n1 - 1}, \\qquad \\nu_2 = ${n2 - 1}`,
      ],
    },
    {
      title: 'Valor crítico y decisión',
      math: [
        `\\alpha = 1 - ${n(confidence)} = ${n(alpha)}`,
        alt === 'greater'
          ? `F_{\\alpha,\\,\\nu_1,\\,\\nu_2} = ${n(r.critical)}, \\qquad f = ${n(r.f)} ${r.reject ? '\\geq' : '<'} ${n(r.critical)}`
          : `F_{1-\\alpha,\\,\\nu_1,\\,\\nu_2} = ${n(r.critical)}, \\qquad f = ${n(r.f)} ${r.reject ? '\\leq' : '>'} ${n(r.critical)}`,
      ],
      conclusion: r.reject ? 'Se rechaza H₀: las varianzas no son homogéneas.' : 'No se rechaza H₀: las varianzas son homogéneas.',
    },
  ];
}

export default {
  id: 'test-f',
  group: 'Muestras y comparación',
  title: 'Test F de varianzas',
  short: 'Analiza si las varianzas son homogéneas: Student agrupado o Welch',
  description: 'Compara dos varianzas para decidir si son homogéneas. El resultado indica qué versión del test de Student corresponde usar después.',
  origin: 'Reemplaza a test_f.py. Teoría: Serie C 9/15, sección 1.1.3.',
  hint: 'Cargá las dos muestras para comparar sus varianzas.',
  defaults: { mode: 'raw', data1: '', data2: '', v1: '', n1: '', v2: '', n2: '', confidence: '95', alt: 'two' },
  examples: [
    { label: 'Ejemplo de test_f.py', state: { data1: '2.1 2.3 2.2 2.4 2.2', data2: '1.5 3.1 2.2 1.1 3.5 2.0 1.8' } },
    { label: 'Pelícanos (9/15)', state: { mode: 'sd', v1: '0.017', n1: '10', v2: '0.006', n2: '13', confidence: '90' } },
  ],
  form(f, s) {
    const summary = () => s.mode !== 'raw';
    return [
      f.select('mode', {
        label: 'Qué tenés',
        options: [['raw', 'Las mediciones'], ['var', 'Varianzas s² y N'], ['sd', 'Desvíos s y N']],
      }),
      f.when(() => s.mode === 'raw',
        f.area('data1', { label: 'Mediciones del método 1', rows: 3 }),
        f.area('data2', { label: 'Mediciones del método 2', rows: 3 })),
      f.when(summary,
        row(f.text('v1', { label: 'Método 1: s² o s', decimal: true }), f.text('n1', { label: 'N₁', decimal: true })),
        row(f.text('v2', { label: 'Método 2: s² o s', decimal: true }), f.text('n2', { label: 'N₂', decimal: true }))),
      group('',
        f.confidence(),
        f.select('alt', {
          label: 'Hipótesis alternativa',
          options: [['two', 'Bilateral: varianzas distintas'], ['greater', 'Unilateral: σ₁² > σ₂²'], ['less', 'Unilateral: σ₁² < σ₂²']],
        })),
    ];
  },
  calc(s) {
    const a = readSample(s, '1');
    const b = readSample(s, '2');
    if (!a || !b) return null;
    const confidence = confidenceOf(s.confidence);
    const r = fTest({ var1: a.v, n1: a.n, var2: b.v, n2: b.n, confidence, alt: s.alt });
    const compatible = !r.reject;
    const varianceStep = {
      title: 'Varianzas muestrales',
      math: [
        s.mode === 'raw' && `s^{2} = \\dfrac{\\sum (x_i - \\bar{x})^{2}}{N - 1}`,
        `s_1^{2} = ${n(a.v)}, \\quad N_1 = ${n(a.n)}`,
        `s_2^{2} = ${n(b.v)}, \\quad N_2 = ${n(b.n)}`,
      ],
    };
    return [
      answer([{
        label: `Resultado al ${percentOf(confidence)}`,
        value: compatible ? 'Varianzas homogéneas' : 'Varianzas no homogéneas',
        detail: compatible
          ? 'Para comparar las medias corresponde el test de Student agrupado.'
          : 'Para comparar las medias corresponde Welch-Satterthwaite.',
      }]),
      note(compatible ? 'ok' : 'warn', compatible ? 'No se rechaza H₀: σ₁² = σ₂².' : 'Se rechaza H₀: σ₁² = σ₂².'),
      procedure([
        varianceStep,
        ...fTestSteps({ var1: a.v, n1: a.n, var2: b.v, n2: b.n, result: r, confidence, alt: s.alt }),
      ]),
      card('Resumen', keyValues([
        ['Estadístico F', fmt(r.f)],
        ['F crítico', `${fmt(r.critical)} (ν₁ = ${fmtInt(r.d1)}, ν₂ = ${fmtInt(r.d2)})`],
        ['Valor p', fmt(r.p)],
      ])),
    ];
  },
};
