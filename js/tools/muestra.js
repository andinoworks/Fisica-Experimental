// Estadística de una serie de mediciones repetidas (Serie C 4/11, cap. 3).

import { answer, card, h, keyValues, more, note, table, verdict, row, group } from '../ui/dom.js';
import { chart, lineTrace, linspace, INK } from '../ui/plot.js';
import { fmt, fmtInt, fmtMeasurement } from '../core/format.js';
import { parseNumbers, parseScalar } from '../core/parse.js';
import { summarize, histogram, coverage, gaussianPdf, compareToReference, welchNu } from '../core/stats.js';
import { confidenceOf, ALTERNATIVES, percentOf } from './comunes.js';
import { b as br, decisionSteps, hypothesesStep, n, p as par, procedure } from '../ui/procedimiento.js';

export default {
  id: 'muestra',
  group: 'Muestras y comparación',
  title: 'Una muestra',
  short: 'Media, desvío, error estándar, intervalo e histograma',
  description: 'Resumen de mediciones repetidas de una misma cantidad, con su intervalo de confianza, histograma y comparación opcional con un valor de referencia.',
  origin: 'Agregada desde el teórico: Serie C 4/11, capítulo 3.',
  hint: 'Pegá las mediciones y aparecen la media, el intervalo y el histograma.',
  defaults: { data: '', confidence: '95', uB: '', unit: '', dist: 'auto', ref: '', alt: 'two', bins: '', gauss: false, label: '' },
  examples: [
    { label: 'Ángulo α (9/15)', state: { data: '35 31 33 32 34', uB: '', unit: 'grados', label: 'Ángulo α (grados)' } },
  ],
  form(f, s) {
    return [
      f.area('data', { label: 'Mediciones', rows: 5, placeholder: '2.1  2.3  2.2  2.4  2.2' }),
      row(f.confidence(), f.text('unit', { label: 'Unidad', placeholder: 's' })),
      f.text('uB', { label: 'Incertidumbre tipo B (opcional)', decimal: true, placeholder: 'Ej.: media apreciación del instrumento', help: 'Se suma en cuadratura con el error estándar.' }),
      f.select('dist', {
        label: 'Distribución para el intervalo',
        options: [['auto', 'Según N: t si N < 30, z si no'], ['t', 't de Student'], ['z', 'Normal z (muestra grande)']],
      }),
      group('Comparar con un valor de referencia',
        f.text('ref', { label: 'Valor de referencia μ₀ (opcional)', decimal: true }),
        f.when(() => s.ref.trim() !== '', f.select('alt', { label: 'Hipótesis alternativa', options: ALTERNATIVES }))),
      group('Histograma',
        f.text('label', { label: 'Nombre del eje', placeholder: 'Período (s)' }),
        f.text('bins', { label: 'Clases', decimal: true, placeholder: 'Automático: raíz de N' }),
        f.check('gauss', { label: 'Superponer la curva normal' })),
    ];
  },
  calc(s) {
    const values = parseNumbers(s.data);
    if (values.length === 0) return null;
    const r = summarize(values);
    const confidence = confidenceOf(s.confidence);
    const uB = parseScalar(s.uB) ?? 0;
    if (uB < 0) throw new Error('La incertidumbre tipo B no puede ser negativa.');

    const u = Math.hypot(r.sem, uB);
    const useZ = s.dist === 'z' || (s.dist === 'auto' && r.n >= 30);
    const welch = welchNu([[r.sem * r.sem, r.nu], [uB * uB, Infinity]], u * u);
    const nu = useZ ? Infinity : welch.nu;
    const k = coverage(confidence, nu);
    const U = k * u;
    const unit = s.unit.trim();

    const nodes = [
      answer([
        { label: `Valor con incertidumbre expandida al ${percentOf(confidence)}`, value: fmtMeasurement(r.mean, U, { unit }), detail: `U = k·u, con k = ${fmt(k)} (${useZ ? 'normal z' : `t de Student, ν = ${fmtInt(nu)}`})` },
        { label: 'Valor con incertidumbre estándar', value: fmtMeasurement(r.mean, u, { unit }) },
      ]),
      card('Estadística', keyValues([
        ['Número de mediciones N', fmtInt(r.n)],
        ['Media', fmt(r.mean)],
        ['Mediana', fmt(r.median)],
        ['Mínimo y máximo', `${fmt(r.min)} y ${fmt(r.max)}`],
        ['Desvío estándar muestral s', fmt(r.s)],
        ['Varianza muestral s²', fmt(r.s2)],
        ['Error estándar s/√N', fmt(r.sem)],
        uB > 0 && ['Incertidumbre combinada u', fmt(u)],
        ['Grados de libertad ν', fmtInt(nu)],
        ['Factor de cobertura k', fmt(k)],
        ['Incertidumbre expandida U', fmt(U)],
      ].filter(Boolean))),
    ];

    const steps = [
      {
        title: 'Media',
        math: [`\\bar{x} = \\dfrac{\\sum x_i}{N} = \\dfrac{${n(r.mean * r.n)}}{${r.n}} = ${n(r.mean)}`],
      },
      {
        title: 'Desvío estándar muestral',
        math: [`s = \\sqrt{\\dfrac{\\sum (x_i - \\bar{x})^{2}}{N - 1}} = \\sqrt{\\dfrac{${n(r.s2 * r.nu)}}{${r.nu}}} = ${n(r.s)}`],
      },
      {
        title: 'Error estándar de la media',
        math: [`s_{\\bar{x}} = \\dfrac{s}{\\sqrt{N}} = \\dfrac{${n(r.s)}}{\\sqrt{${r.n}}} = ${n(r.sem)}`],
      },
      uB > 0 && {
        title: 'Incertidumbre combinada con la tipo B',
        math: [
          `u = \\sqrt{s_{\\bar{x}}^{2} + u_B^{2}} = \\sqrt{${br(r.sem)}^{2} + ${br(uB)}^{2}} = ${n(u)}`,
          !useZ && `\\nu = (N - 1) \\left(\\dfrac{u}{s_{\\bar{x}}}\\right)^{4} = ${r.nu} \\left(\\dfrac{${n(u)}}{${n(r.sem)}}\\right)^{4} = ${n(welch.raw)} \\ \\to\\ ${n(nu)}`,
        ],
      },
      {
        title: 'Intervalo de confianza',
        text: useZ ? 'Se usa la normal z: muestra grande.' : 'Se usa t de Student: muestra chica.',
        math: [
          useZ ? `k = z = ${n(k)}` : `k = t_{\\alpha/2,\\,\\nu} = t_{${n((1 - confidence) / 2)},\\,${n(nu)}} = ${n(k)}`,
          `U = k\\, ${uB > 0 ? 'u' : 's_{\\bar{x}}'} = ${n(k)} \\cdot ${n(u)} = ${n(U)}`,
        ],
      },
    ];
    const referenceValue = parseScalar(s.ref);
    if (referenceValue !== null) {
      const test = compareToReference({ value: r.mean, u, nu, reference: referenceValue, confidence, alt: s.alt });
      steps.push(
        hypothesesStep('\\mu', '\\mu_0', s.alt),
        {
          title: 'Estadístico de prueba',
          math: [`${useZ ? 'z' : 't'} = \\dfrac{\\bar{x} - \\mu_0}{${uB > 0 ? 'u' : 's_{\\bar{x}}'}} = \\dfrac{${par(r.mean)} - ${par(referenceValue)}}{${n(u)}} = ${n(test.statistic)}`],
        },
        ...decisionSteps({ stat: useZ ? 'z' : 't', value: test.statistic, nu, confidence, alt: s.alt, critical: test.critical, reject: test.reject }),
      );
    }
    nodes.splice(1, 0, procedure(steps));

    if (r.n === 2) nodes.push(note('warn', 'Con solo 2 mediciones el desvío es muy poco confiable.'));

    const reference = parseScalar(s.ref);
    if (reference !== null) {
      const test = compareToReference({ value: r.mean, u, nu, reference, confidence, alt: s.alt });
      nodes.push(card('Comparación con el valor de referencia',
        keyValues([
          ['Estadístico', `${useZ ? 'z' : 't'} = ${fmt(test.statistic)}`],
          ['Valor crítico', fmt(test.critical)],
          ['Valor p', fmt(test.p)],
        ]),
        h('div', { style: 'height:10px' }),
        test.reject
          ? verdict(false, `Se rechaza H₀ al ${percentOf(confidence)}`, 'El valor medido no es compatible con la referencia.')
          : verdict(true, `No se rechaza H₀ al ${percentOf(confidence)}`, 'El valor medido es compatible con la referencia.')));
    }

    const requested = parseScalar(s.bins);
    if (requested !== null && !(Number.isInteger(requested) && requested > 0)) throw new Error('Las clases deben ser un entero positivo.');
    const histo = histogram(values, requested ?? 0);
    const traces = [{
      type: 'bar',
      name: 'Frecuencia relativa',
      x: histo.classes.map((c) => c.center),
      y: histo.classes.map((c) => c.freq),
      width: histo.width * 0.96,
      marker: { color: '#2a78d6' },
      hovertemplate: 'Clase centrada en %{x}<br>Frecuencia %{y:.3f}<extra></extra>',
    }];
    if (s.gauss && r.s > 0) {
      const grid = linspace(r.mean - 4 * r.s, r.mean + 4 * r.s);
      traces.push(lineTrace(grid, grid.map((x) => gaussianPdf(x, r.mean, r.s) * histo.width), { name: 'Normal con la misma media y s', color: INK }));
    }
    const axisName = s.label.trim() || (unit ? `Valor medido (${unit})` : 'Valor medido');
    nodes.push(card('Histograma',
      chart(traces, { x: { title: axisName }, y: { title: 'Frecuencia relativa', rangemode: 'tozero' }, legend: traces.length > 1 }, { filename: 'histograma' }),
      h('div', { style: 'height:10px' }),
      more('Tabla de clases', table(['Clase', 'n', 'Frecuencia relativa'], histo.classes.map((c, i) => [
        `[${fmt(c.from)}, ${fmt(c.to)}${i === histo.classes.length - 1 ? ']' : ')'}`, fmtInt(c.count), fmt(c.freq),
      ])))));
    return nodes;
  },
};
