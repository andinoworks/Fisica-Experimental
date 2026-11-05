// Ajustes por cuadrados mínimos. Reemplaza a cuad_minimos.py, cuad_minimos_EXP.py,
// ajuste_lineal_ponderado.py y ajuste_polinomial.py: comparten el mismo motor.

import { answer, card, group, h, keyValues, more, note, row, table, verdict } from '../ui/dom.js';
import { fitChart } from '../ui/plot.js';
import { fmt, fmtInt, fmtMeasurement } from '../core/format.js';
import { parseNumbers, parseScalar, scalarOrList } from '../core/parse.js';
import { coverage } from '../core/stats.js';
import { fitPolynomial, fitWithXUncertainty } from '../core/fit.js';
import { confidenceOf, percentOf } from './comunes.js';

export function readXY(s) {
  const x = parseNumbers(s.x);
  const y = parseNumbers(s.y);
  if (x.length === 0 && y.length === 0) return null;
  if (x.length !== y.length) throw new Error(`x tiene ${x.length} valores e y tiene ${y.length}.`);
  return {
    x,
    y,
    ex: scalarOrList(s.ex, x.length, 'La incertidumbre de x'),
    ey: scalarOrList(s.ey, x.length, 'La incertidumbre de y'),
  };
}

export function dataFields(f, { eyLabel = 'Incertidumbre de y (solo para graficar)', exLabel = 'Incertidumbre de x (solo para graficar)' } = {}) {
  return [
    row(
      f.area('x', { label: 'x', rows: 6, placeholder: '1.0\n2.0\n3.0' }),
      f.area('y', { label: 'y', rows: 6, placeholder: '2.1\n3.9\n6.2' })),
    f.text('ey', { label: eyLabel, placeholder: 'Un valor para todos, o uno por punto' }),
    f.text('ex', { label: exLabel, placeholder: 'Un valor para todos, o uno por punto' }),
  ];
}

export function chartFields(f) {
  return group('Gráfico',
    f.text('title', { label: 'Título (opcional)' }),
    row(f.text('labelX', { label: 'Eje x', placeholder: 'Tiempo (s)' }), f.text('labelY', { label: 'Eje y', placeholder: 'Posición (cm)' })),
    h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px 18px' },
      f.check('logX', { label: 'x logarítmico' }),
      f.check('logY', { label: 'y logarítmico' })));
}

export function checkLog(s, x, y) {
  if (s.logX && x.some((v) => v <= 0)) throw new Error('Con eje x logarítmico, todos los x tienen que ser positivos.');
  if (s.logY && y.some((v) => v <= 0)) throw new Error('Con eje y logarítmico, todos los y tienen que ser positivos.');
}

function powerName(k) {
  if (k === 0) return '';
  return k === 1 ? ' x' : ` x^${k}`;
}

export function equationText(coef) {
  let text = 'y =';
  for (let k = coef.length - 1; k >= 0; k -= 1) {
    const value = coef[k];
    const first = k === coef.length - 1;
    if (first) text += ` ${fmt(value)}${powerName(k)}`;
    else text += ` ${value < 0 ? '−' : '+'} ${fmt(Math.abs(value))}${powerName(k)}`;
  }
  return text;
}

// Compara σx contra σy con el criterio del apunte (4/11, ec. 4.16 a 4.18).
// El apunte no da un umbral numérico: 1/3 y 3 son un criterio orientativo.
function xUncertaintyAdvice(slope, ex, ey) {
  if (!ex || !ey) return null;
  const worst = Math.max(...ex.map((value, i) => (ey[i] > 0 ? (Math.abs(slope) * value) / ey[i] : 0)));
  if (worst < 1 / 3) return null;
  if (worst > 3) {
    return note('warn', `La incertidumbre de x pesa más que la de y (|m|·σx/σy ≈ ${fmt(worst)}). El apunte recomienda intercambiar las variables antes de ajustar.`);
  }
  return note('warn', `Las incertidumbres de x e y son comparables (|m|·σx/σy ≈ ${fmt(worst)}). El apunte recomienda propagar σx a y con un ajuste ponderado (ec. 4.19).`);
}

export function dataTable(fit, x, y) {
  return more('Tabla de datos y residuos', table(['x', 'y', 'Ajuste', 'Residuo'], x.map((xi, i) => [
    fmt(xi), fmt(y[i]), fmt(fit.predicted[i]), fmt(fit.residuals[i]),
  ])));
}

export function predictionCard(fit, text, k, confidence) {
  const x0 = parseScalar(text);
  if (x0 === null) return null;
  const p = fit.predict(x0);
  return card(`Valor de y en x = ${fmt(x0)}`, keyValues([
    ['Resultado', fmtMeasurement(p.y, k * p.u)],
    ['Valor', fmt(p.y)],
    ['Incertidumbre estándar (con covarianza)', fmt(p.u)],
    [`Incertidumbre expandida al ${percentOf(confidence)}`, fmt(k * p.u)],
  ]));
}

export function covarianceBlock(fit, names) {
  return more('Matriz de covarianza', table(['', ...names], fit.cov.map((rowValues, i) => [names[i], ...rowValues.map((v) => fmt(v))])));
}

function buildFit(s, data, { weighted, degree }) {
  if (!weighted) return fitPolynomial(data.x, data.y, { degree });
  if (!data.ey) throw new Error('El ajuste ponderado necesita la incertidumbre de y de cada punto.');
  if (s.propagateX && data.ex) return fitWithXUncertainty(data.x, data.y, data.ex, data.ey, degree);
  return fitPolynomial(data.x, data.y, { degree, sigma: data.ey });
}

function straightLineTool(config) {
  return {
    ...config,
    group: 'Ajustes',
    hint: 'Cargá las columnas x e y para ajustar la recta.',
    defaults: {
      x: '', y: '', ex: '', ey: '', confidence: '95', x0: '', symM: 'm', unitM: '', symB: 'b', unitB: '',
      title: '', labelX: '', labelY: '', logX: false, logY: false, testB: true, propagateX: false,
    },
    form(f) {
      return [
        dataFields(f, config.weighted ? { eyLabel: 'Incertidumbre de y de cada punto' } : {}),
        config.weighted && f.check('propagateX', { label: 'Propagar la incertidumbre de x hacia y (ec. 4.19)' }),
        f.confidence(),
        f.check('testB', { label: 'Probar si la ordenada es compatible con cero' }),
        f.text('x0', { label: 'Evaluar la recta en x = (opcional)', decimal: true }),
        group('Nombres y unidades',
          row(f.text('symM', { label: 'Símbolo pendiente' }), f.text('unitM', { label: 'Unidad', placeholder: 'N/m' })),
          row(f.text('symB', { label: 'Símbolo ordenada' }), f.text('unitB', { label: 'Unidad', placeholder: 'V' }))),
        chartFields(f),
      ];
    },
    calc(s) {
      const data = readXY(s);
      if (!data) return null;
      checkLog(s, data.x, data.y);
      const confidence = confidenceOf(s.confidence);
      const fit = buildFit(s, data, { weighted: config.weighted, degree: 1 });
      const [b, m] = fit.coef;
      const [ub, um] = fit.u;
      const k = coverage(confidence, fit.nu);
      const symM = s.symM.trim() || 'm';
      const symB = s.symB.trim() || 'b';
      const unitM = s.unitM.trim();
      const unitB = s.unitB.trim();
      const tb = Math.abs(b) / ub;

      const nodes = [
        answer([
          { label: `Pendiente al ${percentOf(confidence)}`, value: `${symM} = ${fmtMeasurement(m, k * um, { unit: unitM })}` },
          { label: `Ordenada al ${percentOf(confidence)}`, value: `${symB} = ${fmtMeasurement(b, k * ub, { unit: unitB })}`, detail: `k = ${fmt(k)} (t de Student, ν = ${fmtInt(fit.nu)})` },
        ]),
      ];
      if (s.testB) {
        nodes.push(tb <= k
          ? verdict(true, `${symB} es compatible con cero`, `|t| = ${fmt(tb)} ≤ t crítico = ${fmt(k)}. El modelo no muestra un desvío aditivo.`)
          : verdict(false, `${symB} no es compatible con cero`, `|t| = ${fmt(tb)} > t crítico = ${fmt(k)}. Puede haber un error sistemático de cero o de calibración.`));
      }
      if (config.weighted && s.propagateX && !data.ex) nodes.push(note('warn', 'Falta la incertidumbre de x para poder propagarla.'));
      if (!(config.weighted && s.propagateX)) nodes.push(xUncertaintyAdvice(m, data.ex, data.ey));

      nodes.push(card(null, fitChart({
        x: data.x, y: data.y, ex: data.ex, ey: data.ey,
        curve: { at: fit.at, name: `${equationText([b, m])}   (R² = ${fmt(fit.r2)})` },
        residuals: fit.residuals, residualBars: fit.weighted ? fit.sigma : data.ey,
        labelX: s.labelX.trim() || 'x', labelY: s.labelY.trim() || 'y', title: s.title.trim(),
        filename: config.id, logX: s.logX, logY: s.logY,
      })));

      nodes.push(card('Resultados del ajuste',
        keyValues([
          ['Puntos N', fmtInt(fit.N)],
          ['Grados de libertad ν = N−2', fmtInt(fit.nu)],
          [`${symM} y su incertidumbre estándar`, `${fmt(m)} ± ${fmt(um)}`],
          [`${symB} y su incertidumbre estándar`, `${fmt(b)} ± ${fmt(ub)}`],
          [`Cov(${symM}, ${symB})`, fmt(fit.cov[0][1])],
          [`${symM} expandida: U`, fmt(k * um)],
          [`${symB} expandida: U`, fmt(k * ub)],
          fit.weighted
            ? ['χ² reducido (cercano a 1 si las σ son realistas)', fmt(fit.residualVariance)]
            : ['Varianza residual s²', fmt(fit.residualVariance)],
          !fit.weighted && ['Desvío residual s', fmt(fit.s)],
          [fit.weighted ? 'R² ponderado' : 'R²', fmt(fit.r2)],
          !fit.weighted && ['Coeficiente de correlación r', fmt(Math.sign(m) * Math.sqrt(Math.max(fit.r2, 0)))],
          [`t crítico (${percentOf(confidence)})`, fmt(k)],
        ].filter(Boolean)),
        h('div', { style: 'height:10px' }),
        dataTable(fit, data.x, data.y)));
      nodes.push(predictionCard(fit, s.x0, k, confidence));
      return nodes;
    },
  };
}

export const lineal = straightLineTool({
  id: 'ajuste-lineal',
  title: 'Ajuste lineal',
  short: 'Recta por cuadrados mínimos, residuos y test de ordenada',
  description: 'Recta por cuadrados mínimos ordinarios. La incertidumbre sale de la dispersión de los puntos, y las barras de error solo se usan para graficar.',
  origin: 'Reemplaza a cuad_minimos.py y cuad_minimos_EXP.py: la notación decimal o científica se elige en "Formato de los números". Teoría: Serie C 4/11, capítulo 4.',
  weighted: false,
  examples: [
    { label: 'Ejemplo de cuad_minimos.py', state: { x: '1 2 3 4 5', y: '2.1 3.9 6.2 7.9 10.1', ex: '0.05', ey: '0.15' } },
  ],
});

export const ponderado = straightLineTool({
  id: 'ajuste-ponderado',
  title: 'Ajuste ponderado',
  short: 'Recta con una incertidumbre distinta en cada punto',
  description: 'Recta por cuadrados mínimos pesados con 1/σ². La incertidumbre sale de las barras de error de cada punto, no de la dispersión.',
  origin: 'Reemplaza a ajuste_lineal_ponderado.py. Teoría: Serie C 4/11, sección 4.5.',
  weighted: true,
  examples: [
    { label: 'Ejemplo de ajuste_lineal_ponderado.py', state: { x: '1 2 3 4 5', y: '2.1 3.8 6.5 7.9 9.8', ey: '0.1 0.5 1.2 0.4 0.1' } },
  ],
});

export const polinomial = {
  id: 'ajuste-polinomial',
  group: 'Ajustes',
  title: 'Ajuste polinomial',
  short: 'Polinomio de cualquier grado, con matriz de covarianza',
  description: 'Polinomio por cuadrados mínimos, con coeficientes, matriz de covarianza y valor interpolado con su incertidumbre.',
  origin: 'Reemplaza a ajuste_polinomial.py. Teoría: Serie C 9/15, capítulo 3.',
  hint: 'Cargá las columnas x e y y elegí el grado.',
  defaults: {
    x: '', y: '', ex: '', ey: '', degree: '2', method: 'ols', confidence: '95', x0: '',
    title: '', labelX: '', labelY: '', logX: false, logY: false,
  },
  examples: [
    { label: 'Ejemplo de ajuste_polinomial.py', state: { x: '1 2 3 4 5 6 7', y: '2.1 5.8 12.2 20.9 32.5 45.8 62.1', ex: '0.05', ey: '0.30', degree: '2', labelX: 'Tiempo (s)', labelY: 'Posición (cm)' } },
    { label: 'Glucosa (9/15)', state: { x: '1 2 3 4 5 6 7 8', y: '74 54 52 51 52 53 58 71', ey: '1', degree: '2', method: 'known', x0: '4.5', labelX: 'Tiempo (días)', labelY: 'Concentración (g/l)' } },
  ],
  form(f) {
    return [
      dataFields(f, { eyLabel: 'Incertidumbre de y', exLabel: 'Incertidumbre de x (solo para graficar)' }),
      row(f.text('degree', { label: 'Grado', decimal: true }), f.confidence()),
      f.select('method', {
        label: 'De dónde sale la incertidumbre',
        options: [['ols', 'De la dispersión de los puntos'], ['known', 'De la incertidumbre de y (ponderado)']],
        help: 'El programa original usa la dispersión. El apunte usa la incertidumbre de y.',
      }),
      f.text('x0', { label: 'Evaluar el polinomio en x = (opcional)', decimal: true }),
      chartFields(f),
    ];
  },
  calc(s) {
    const data = readXY(s);
    if (!data) return null;
    checkLog(s, data.x, data.y);
    const degree = parseScalar(s.degree);
    if (!Number.isInteger(degree) || degree < 1 || degree > 10) throw new Error('El grado debe ser un entero entre 1 y 10.');
    const confidence = confidenceOf(s.confidence);
    const fit = buildFit(s, data, { weighted: s.method === 'known', degree });
    const k = coverage(confidence, fit.nu);
    const names = fit.coef.map((_, i) => `a${i}`);

    return [
      answer([{
        label: `Coeficientes al ${percentOf(confidence)}`,
        value: h('div', {}, fit.coef.map((c, i) => h('div', {}, `${names[i]} = ${fmtMeasurement(c, k * fit.u[i])}`)).reverse()),
        detail: `k = ${fmt(k)} (t de Student, ν = ${fmtInt(fit.nu)})`,
      }]),
      card(null, fitChart({
        x: data.x, y: data.y, ex: data.ex, ey: data.ey,
        curve: { at: fit.at, name: `${equationText(fit.coef)}   (R² = ${fmt(fit.r2)})` },
        residuals: fit.residuals, residualBars: data.ey,
        labelX: s.labelX.trim() || 'x', labelY: s.labelY.trim() || 'y', title: s.title.trim(),
        filename: 'ajuste-polinomial', logX: s.logX, logY: s.logY,
      })),
      card('Resultados del ajuste',
        table(['Coeficiente', 'Valor', 'u (1σ)', `U (${percentOf(confidence)})`], fit.coef.map((c, i) => [
          `${names[i]} (x^${i})`, fmt(c), fmt(fit.u[i]), fmt(k * fit.u[i]),
        ]).reverse()),
        h('div', { style: 'height:10px' }),
        keyValues([
          ['Puntos N', fmtInt(fit.N)],
          ['Parámetros', fmtInt(degree + 1)],
          ['Grados de libertad ν', fmtInt(fit.nu)],
          fit.weighted ? ['χ² reducido (cercano a 1 si las σ son realistas)', fmt(fit.residualVariance)] : ['Varianza residual s²', fmt(fit.residualVariance)],
          !fit.weighted && ['Desvío residual s', fmt(fit.s)],
          [fit.weighted ? 'R² ponderado' : 'R²', fmt(fit.r2)],
        ].filter(Boolean)),
        h('div', { style: 'height:10px' }),
        covarianceBlock(fit, names),
        dataTable(fit, data.x, data.y)),
      predictionCard(fit, s.x0, k, confidence),
    ];
  },
};
