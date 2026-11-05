// Transformación de variables para linealizar y ajuste de la recta (Serie C 4/11, sección 4.6).
// Las incertidumbres de las variables nuevas se propagan con derivadas automáticas (ec. 4.28).

import { answer, card, group, h, keyValues, note, row, tex } from '../ui/dom.js';
import { fitChart } from '../ui/plot.js';
import { fmt, fmtInt, fmtMeasurement } from '../core/format.js';
import { parseScalar } from '../core/parse.js';
import { coverage } from '../core/stats.js';
import { fitPolynomial, fitWithXUncertainty } from '../core/fit.js';
import { compileFormula, evaluate, partialDerivative, propagate, sensitivity } from '../core/symbolic.js';
import { confidenceOf, percentOf } from './comunes.js';
import { dataFields, dataTable, equationText, predictionCard, readXY } from './ajustes.js';

const PRESETS = {
  'ln-x': ['ln(y)', 'x', 'y = A·exp(m·x), como un enfriamiento'],
  'ln-inv': ['ln(y)', '1/x', 'y = A·exp(m/x), como el termistor (x en kelvin)'],
  'ln-ln': ['ln(y)', 'ln(x)', 'y = A·x^m, ley de potencias'],
  'sq-x': ['y^2', 'x', 'y² = m·x + b, como T² contra M en un resorte'],
  'y-inv': ['y', '1/x', 'y = m/x + b'],
  'y-sq': ['y', 'x^2', 'y = m·x² + b'],
  'y-sqrt': ['y', 'sqrt(x)', 'y = m·√x + b'],
};

const parameterNames = (s) => {
  try {
    return [...new Set([...compileFormula(s.fy).variables, ...compileFormula(s.fx).variables])].filter((name) => name !== 'x' && name !== 'y');
  } catch {
    return null;
  }
};

export default {
  id: 'linealizar',
  group: 'Ajustes',
  title: 'Linealizar y ajustar',
  short: 'Transforma las variables, propaga las σ y ajusta la recta',
  description: 'Transforma tus datos para que la relación sea lineal, por ejemplo ln(R/R₀) contra 1/T. Propaga las incertidumbres a las variables nuevas y ajusta la recta.',
  origin: 'Agregada desde el teórico: Serie C 4/11, sección 4.6.',
  hint: 'Cargá los datos y elegí la transformación.',
  defaults: {
    preset: 'ln-x', fy: 'ln(y)', fx: 'x', x: '', y: '', ex: '', ey: '', confidence: '95', params: {}, x0: '',
    propagateX: false, derived: '', derivedUnit: '', title: '', labelX: '', labelY: '',
  },
  examples: [
    {
      label: 'Datos de muestra: enfriamiento',
      state: {
        preset: 'custom', fy: 'ln((y - Ta) / (T0 - Ta))', fx: 'x', params: { Ta: '20', T0: '90' },
        x: '0 60 120 180 240 300 360', y: '90 72.5 59.6 50.1 42.9 37.6 33.8', ey: '0.5',
        derived: 'tau = -1/m', derivedUnit: 's', labelX: 't (s)', labelY: 'ln[(T − Tₐ)/(T₀ − Tₐ)]',
      },
    },
  ],
  form(f, s, ctx) {
    const paramsBox = h('div', { class: 'row' });
    let signature = null;
    const applyPreset = (value) => {
      if (PRESETS[value]) {
        [s.fy, s.fx] = PRESETS[value];
        ctx.rebuild();
      }
    };
    ctx.onChange(() => {
      const names = parameterNames(s);
      if (!names) return;
      const next = names.join('|');
      if (next === signature) return;
      signature = next;
      paramsBox.replaceChildren(...names.map((name) => f.text(name, { label: `Constante ${name}`, decimal: true, target: s.params })));
    });

    return [
      f.select('preset', {
        label: 'Transformación',
        onChange: applyPreset,
        options: [
          ...Object.entries(PRESETS).map(([key, [fy, fx, text]]) => [key, `${fy} contra ${fx}: ${text}`]),
          ['custom', 'Personalizada'],
        ],
      }),
      row(
        f.text('fy', { label: 'Nueva Y =', help: 'En función de y (y de x si hace falta).' }),
        f.text('fx', { label: 'Nueva X =', help: 'En función de x.' })),
      paramsBox,
      dataFields(f, { eyLabel: 'Incertidumbre de y', exLabel: 'Incertidumbre de x' }),
      f.check('propagateX', { label: 'Propagar también σ de la nueva X al ajuste (ec. 4.19)' }),
      f.confidence(),
      f.text('x0', { label: 'Evaluar la recta en nueva X = (opcional)', decimal: true }),
      group('Magnitud que sale de la recta',
        f.text('derived', { label: 'Fórmula en función de m y b (opcional)', placeholder: 'tau = -1/m', help: 'Se propaga con la covarianza entre m y b.' }),
        f.text('derivedUnit', { label: 'Unidad' })),
      group('Gráfico',
        f.text('title', { label: 'Título (opcional)' }),
        row(f.text('labelX', { label: 'Eje x' }), f.text('labelY', { label: 'Eje y' }))),
    ];
  },
  calc(s) {
    const data = readXY(s);
    if (!data) return null;
    const fy = compileFormula(s.fy);
    const fx = compileFormula(s.fx);
    if (fx.variables.includes('y')) throw new Error('La nueva X no puede depender de y.');
    if (!fy.variables.includes('y')) throw new Error('La nueva Y tiene que depender de y.');

    const constants = {};
    for (const name of parameterNames(s) ?? []) {
      const value = parseScalar(s.params?.[name]);
      if (value === null) return null;
      constants[name] = value;
    }

    const dYy = partialDerivative(fy, 'y');
    const dYx = fy.variables.includes('x') ? partialDerivative(fy, 'x') : null;
    const dXx = fx.variables.includes('x') ? partialDerivative(fx, 'x') : null;

    const X = [];
    const Y = [];
    const sX = [];
    const sY = [];
    data.x.forEach((xi, i) => {
      const scope = { ...constants, x: xi, y: data.y[i] };
      const context = `punto ${i + 1} (x = ${fmt(xi)}, y = ${fmt(data.y[i])})`;
      const newX = evaluate(fx, scope);
      const newY = evaluate(fy, scope);
      if (!Number.isFinite(newX) || !Number.isFinite(newY)) throw new Error(`La transformación no da un número real en el ${context}.`);
      X.push(newX);
      Y.push(newY);
      const ex = data.ex?.[i] ?? 0;
      const ey = data.ey?.[i] ?? 0;
      sX.push(dXx ? Math.abs(sensitivity(fx, dXx, scope)) * ex : 0);
      const fromY = sensitivity(fy, dYy, scope) * ey;
      const fromX = dYx ? sensitivity(fy, dYx, scope) * ex : 0;
      sY.push(Math.hypot(fromY, fromX));
    });

    const confidence = confidenceOf(s.confidence);
    const hasSigma = sY.every((value) => value > 0);
    let fit;
    if (!hasSigma) fit = fitPolynomial(X, Y, { degree: 1 });
    else if (s.propagateX && sX.some((value) => value > 0)) fit = fitWithXUncertainty(X, Y, sX, sY);
    else fit = fitPolynomial(X, Y, { degree: 1, sigma: sY });

    const [b, m] = fit.coef;
    const [ub, um] = fit.u;
    const k = coverage(confidence, fit.nu);
    const nodes = [answer([
      { label: `Pendiente al ${percentOf(confidence)}`, value: `m = ${fmtMeasurement(m, k * um)}` },
      { label: `Ordenada al ${percentOf(confidence)}`, value: `b = ${fmtMeasurement(b, k * ub)}`, detail: `k = ${fmt(k)} (t de Student, ν = ${fmtInt(fit.nu)})` },
    ])];

    if (!hasSigma) {
      nodes.push(note('warn', 'Sin incertidumbre de y se hizo un ajuste ordinario. El apunte recuerda que al transformar las σ dejan de ser iguales, así que conviene cargarla y ponderar.'));
    }

    if (s.derived.trim()) {
      const derived = compileFormula(s.derived);
      const unknown = derived.variables.filter((name) => name !== 'm' && name !== 'b' && !(name in constants));
      if (unknown.length) throw new Error(`En la magnitud derivada solo se puede usar m, b y las constantes: sobra ${unknown.join(', ')}.`);
      const inputs = derived.variables.map((name) => {
        if (name === 'm') return { name, value: m, u: um, nu: fit.nu };
        if (name === 'b') return { name, value: b, u: ub, nu: fit.nu };
        return { name, value: constants[name], u: 0, nu: Infinity };
      });
      const usesBoth = derived.variables.includes('m') && derived.variables.includes('b');
      const covariances = usesBoth ? [{ a: 'm', b: 'b', value: fit.cov[0][1] }] : [];
      const r = propagate(derived, inputs, covariances, confidence);
      const U = k * r.uc;
      nodes.push(answer([{
        label: `${derived.output ?? 'Magnitud derivada'} al ${percentOf(confidence)}`,
        value: fmtMeasurement(r.y, U, { unit: s.derivedUnit.trim() }),
        detail: `Valor ${fmt(r.y)}, u = ${fmt(r.uc)}, con ν = ${fmtInt(fit.nu)} del ajuste`,
      }]));
    }

    nodes.push(card('Transformación', h('div', { class: 'math-list' },
      tex(`Y = ${fy.tex}`),
      tex(`X = ${fx.tex}`),
      dYy.symbolic && tex(`\\dfrac{\\partial Y}{\\partial y} = ${dYy.tex}`),
      dYx?.symbolic && tex(`\\dfrac{\\partial Y}{\\partial x} = ${dYx.tex}`),
      dXx?.symbolic && tex(`\\dfrac{\\partial X}{\\partial x} = ${dXx.tex}`))));

    nodes.push(card(null, fitChart({
      x: X, y: Y, ex: sX, ey: sY,
      curve: { at: fit.at, name: `${equationText([b, m]).replace(/^y/, 'Y').replace(/ x$/, ' X').replace(/ x /, ' X ')}   (R² = ${fmt(fit.r2)})` },
      residuals: fit.residuals, residualBars: fit.sigma ?? sY,
      labelX: s.labelX.trim() || s.fx, labelY: s.labelY.trim() || s.fy, title: s.title.trim(), filename: 'linealizado',
    })));

    nodes.push(card('Resultados del ajuste',
      keyValues([
        ['Pendiente m y su incertidumbre estándar', `${fmt(m)} ± ${fmt(um)}`],
        ['Ordenada b y su incertidumbre estándar', `${fmt(b)} ± ${fmt(ub)}`],
        ['Cov(m, b)', fmt(fit.cov[0][1])],
        fit.weighted ? ['χ² reducido (cercano a 1 si las σ son realistas)', fmt(fit.residualVariance)] : ['Varianza residual s²', fmt(fit.residualVariance)],
        [fit.weighted ? 'R² ponderado' : 'R²', fmt(fit.r2)],
      ]),
      h('div', { style: 'height:10px' }),
      dataTable(fit, X, Y)));
    nodes.push(predictionCard(fit, s.x0, k, confidence));
    return nodes;
  },
};


