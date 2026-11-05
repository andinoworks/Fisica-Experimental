// Test F de igualdad de varianzas. Reemplaza a test_f.py.

import { answer, card, keyValues, row, group, note } from '../ui/dom.js';
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
  const n = parseScalar(s[`n${suffix}`]);
  if (given === null || n === null) return null;
  if (given <= 0) throw new Error('Las varianzas y los desvíos deben ser mayores que cero.');
  return { v: s.mode === 'sd' ? given * given : given, n };
}

export default {
  id: 'test-f',
  group: 'Muestras y comparación',
  title: 'Test F de varianzas',
  short: 'Decide si se usa Student agrupado o Welch',
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
    const name = () => (s.mode === 'sd' ? 'Desvío s' : 'Varianza s²');
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
    const larger = r.firstIsLarger ? 'método 1' : 'método 2';
    const compatible = !r.reject;
    return [
      answer([{
        label: `Resultado al ${percentOf(confidence)}`,
        value: compatible ? 'Varianzas homogéneas' : 'Varianzas no homogéneas',
        detail: compatible
          ? 'Para comparar las medias corresponde el test de Student agrupado.'
          : 'Para comparar las medias corresponde Welch-Satterthwaite.',
      }]),
      note(compatible ? 'ok' : 'warn', compatible ? 'No se rechaza H₀: σ₁² = σ₂².' : 'Se rechaza H₀: σ₁² = σ₂².'),
      card('Detalle', keyValues([
        ['Varianza del método 1', `${fmt(a.v)} (ν = ${fmtInt(a.n - 1)})`],
        ['Varianza del método 2', `${fmt(b.v)} (ν = ${fmtInt(b.n - 1)})`],
        s.alt === 'two' && ['Numerador (varianza mayor)', larger],
        ['Estadístico F', fmt(r.f)],
        ['F crítico', `${fmt(r.critical)} (ν₁ = ${fmtInt(r.d1)}, ν₂ = ${fmtInt(r.d2)})`],
        ['Valor p', fmt(r.p)],
      ].filter(Boolean))),
    ];
  },
};
