// Comparación estadística de resultados. Reemplaza a la parte B de welch_2variables.py
// y agrega la comparación de dos muestras del teórico.

import { answer, card, keyValues, note, row, group } from '../ui/dom.js';
import { fmt, fmtInt } from '../core/format.js';
import { parseScalar } from '../core/parse.js';
import { compareResults, compareSamples, compareToReference } from '../core/stats.js';
import { ALTERNATIVES, confidenceOf, nuOf, percentOf, requireNumber, sampleFrom } from './comunes.js';

function result(reject, confidence, detailRows, extra = []) {
  return [
    answer([{
      label: `Resultado al ${percentOf(confidence)}`,
      value: reject ? 'No compatibles' : 'Compatibles',
      detail: reject ? 'Se rechaza la hipótesis nula: hay una discrepancia estadísticamente significativa.' : 'No se rechaza la hipótesis nula.',
    }]),
    ...extra,
    card('Detalle', keyValues(detailRows.filter(Boolean))),
  ];
}

export default {
  id: 'comparar',
  group: 'Muestras y comparación',
  title: 'Comparar valores',
  short: 'Test t contra una referencia, entre dos resultados o entre dos muestras',
  description: 'Decide si dos valores son estadísticamente compatibles: un resultado contra un valor teórico, dos resultados con su incertidumbre, o dos muestras.',
  origin: 'Reemplaza a la parte B de welch_2variables.py. Teoría: Serie C 4/11, sección 3.10, y 9/15, sección 1.1.',
  hint: 'Completá los dos valores para compararlos.',
  defaults: {
    mode: 'two', confidence: '95', alt: 'two',
    v1: '', u1: '', nu1: '', v2: '', u2: '', nu2: '', cov: '', ref: '',
    mode1: 'raw', data1: '', mean1: '', s1: '', n1: '', mode2: 'raw', data2: '', mean2: '', s2: '', n2: '',
    method: 'auto', fConfidence: '95', dist: 'auto',
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
      f.when(() => s.mode === 'samples',
        sampleFields('1'),
        sampleFields('2'),
        f.select('method', { label: 'Método', options: [['auto', 'Según el test F'], ['pooled', 'Student agrupado'], ['welch', 'Welch']] }),
        f.when(() => s.method === 'auto', f.text('fConfidence', { label: 'Confianza del test F (%)', decimal: true }))),
      group('',
        f.confidence(),
        f.select('alt', { label: 'Hipótesis alternativa', options: ALTERNATIVES })),
    ];
  },
  calc(s) {
    const confidence = confidenceOf(s.confidence);

    if (s.mode === 'samples') {
      const a = sampleFrom(s, '1');
      const b = sampleFrom(s, '2');
      if (!a || !b) return null;
      const r = compareSamples({ a, b, confidence, fConfidence: confidenceOf(s.fConfidence), method: s.method, alt: s.alt });
      const extra = [];
      if (s.method === 'auto') {
        extra.push(note('info', `Test F: F = ${fmt(r.homogeneity.f)}, F crítico = ${fmt(r.homogeneity.critical)}. Las varianzas ${r.homogeneity.reject ? 'no son homogéneas: se usa Welch' : 'son homogéneas: se usa Student agrupado'}.`));
      }
      return result(r.reject, confidence, [
        ['Medias', `${fmt(a.mean)} y ${fmt(b.mean)}`],
        ['Diferencia', fmt(r.difference)],
        ['Incertidumbre de la diferencia', fmt(r.uDiff)],
        ['Método', r.pooled ? 'Student agrupado' : 'Welch'],
        !r.pooled && ['ν sin truncar', fmt(r.nuRaw)],
        ['Grados de libertad ν', fmtInt(r.nu)],
        ['Estadístico t', fmt(r.statistic)],
        ['t crítico', fmt(r.critical)],
        ['Valor p', fmt(r.p)],
      ], extra);
    }

    if (parseScalar(s.v1) === null && parseScalar(s.u1) === null) return null;
    const v1 = requireNumber(s.v1, 'el valor 1');
    const u1 = requireNumber(s.u1, 'la incertidumbre u₁');
    const nu1 = nuOf(s.nu1);

    if (s.mode === 'ref') {
      if (parseScalar(s.ref) === null) return null;
      const reference = parseScalar(s.ref);
      const r = compareToReference({ value: v1, u: u1, nu: nu1, reference, confidence, alt: s.alt });
      return result(r.reject, confidence, [
        ['Diferencia', fmt(r.difference)],
        ['Incertidumbre', fmt(u1)],
        ['Grados de libertad ν', fmtInt(r.nu)],
        ['Estadístico t', fmt(r.statistic)],
        ['t crítico', fmt(r.critical)],
        ['Valor p', fmt(r.p)],
      ]);
    }

    if (parseScalar(s.v2) === null && parseScalar(s.u2) === null) return null;
    const v2 = requireNumber(s.v2, 'el valor 2');
    const u2 = requireNumber(s.u2, 'la incertidumbre u₂');
    const cov = parseScalar(s.cov) ?? 0;
    const r = compareResults({ v1, u1, nu1, v2, u2, nu2: nuOf(s.nu2), cov, confidence, alt: s.alt });
    const extra = [];
    if (cov !== 0) extra.push(note('warn', 'Con covarianza, la fórmula de Welch-Satterthwaite es solo una aproximación: el apunte la plantea para cantidades independientes.'));
    if (r.clamped) extra.push(note('warn', 'ν efectivo dio menor que 1 y se tomó ν = 1.'));
    return result(r.reject, confidence, [
      ['Diferencia', fmt(r.difference)],
      ['Incertidumbre de la diferencia', fmt(r.uDiff)],
      ['ν sin truncar', fmt(r.nuRaw)],
      ['Grados de libertad ν', fmtInt(r.nu)],
      ['Estadístico t', fmt(r.statistic)],
      ['t crítico', fmt(r.critical)],
      ['Valor p', fmt(r.p)],
    ], extra);
  },
};
