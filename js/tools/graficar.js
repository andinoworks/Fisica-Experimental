// Gráfico de funciones y datos. Reemplaza a graficar_funciones.py.

import { card, group, h, note, row } from '../ui/dom.js';
import { chart, dataTrace, lineTrace, linspace, logspace, SERIES } from '../ui/plot.js';
import { parseNumbers, parseScalar, scalarOrList } from '../core/parse.js';
import { compileFormula, partialDerivative } from '../core/symbolic.js';

const MAX_FUNCTIONS = SERIES.length;

function readFunctions(text) {
  return String(text ?? '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const compiled = compileFormula(line.replace(/^(\w+)\s*\(\s*x\s*\)\s*=/, '$1 ='));
    return { line, compiled };
  });
}

function parameterNames(s) {
  try {
    return [...new Set(readFunctions(s.functions).flatMap((fn) => fn.compiled.variables))].filter((name) => name !== 'x');
  } catch {
    return null;
  }
}

function sample(code, grid, constants) {
  return grid.map((x) => {
    try {
      const value = code.evaluate({ ...constants, x });
      return typeof value === 'number' && Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  });
}

export default {
  id: 'graficar',
  group: 'Gráficos y tablas',
  title: 'Graficar funciones',
  short: 'Varias funciones, derivadas y puntos con barras de error',
  description: 'Grafica una o varias funciones junto con tus puntos experimentales. Escribí una función por línea, en función de x.',
  origin: 'Reemplaza a graficar_funciones.py.',
  hint: 'Escribí una función y el rango de x.',
  defaults: {
    functions: '', xmin: '', xmax: '', points: '1000', derivative: false, params: {},
    x: '', y: '', ex: '', ey: '', title: '', labelX: '', labelY: '', logX: false, logY: false,
  },
  examples: [
    { label: 'Ejemplo de graficar_funciones.py', state: { functions: '21*x^2 + 0.243', xmin: '0.5', xmax: '7' } },
    {
      label: 'Oscilador amortiguado',
      state: { functions: 'A*sin(w*x)*exp(-g*x)\nA*exp(-g*x)', params: { A: '1', w: '3', g: '0.2' }, xmin: '0', xmax: '20', labelX: 'Tiempo (s)', labelY: 'Amplitud' },
    },
  ],
  form(f, s, ctx) {
    const paramsBox = h('div', { class: 'row' });
    let signature = null;
    ctx.onChange(() => {
      const names = parameterNames(s);
      if (!names) return;
      const next = names.join('|');
      if (next === signature) return;
      signature = next;
      paramsBox.replaceChildren(...names.map((name) => f.text(name, { label: name, decimal: true, target: s.params })));
    });
    return [
      f.area('functions', {
        label: 'Funciones de x (una por línea)',
        rows: 3,
        placeholder: '21*x^2 + 0.243\nA*exp(-x/tau)',
        help: 'Potencia con ^ o **; exp, ln o log, log10, sqrt, sin, cos, tan (en radianes). Las letras que no sean x se piden como constantes.',
      }),
      paramsBox,
      row(
        f.text('xmin', { label: 'x mínimo', decimal: true }),
        f.text('xmax', { label: 'x máximo', decimal: true }),
        f.text('points', { label: 'Puntos', decimal: true })),
      f.check('derivative', { label: 'Graficar también la derivada' }),
      group('Puntos experimentales (opcional)',
        row(f.area('x', { label: 'x', rows: 4 }), f.area('y', { label: 'y', rows: 4 })),
        row(f.text('ex', { label: 'σx' }), f.text('ey', { label: 'σy' }))),
      group('Gráfico',
        f.text('title', { label: 'Título (opcional)' }),
        row(f.text('labelX', { label: 'Eje x' }), f.text('labelY', { label: 'Eje y' })),
        h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px 18px' },
          f.check('logX', { label: 'x logarítmico' }),
          f.check('logY', { label: 'y logarítmico' }))),
    ];
  },
  calc(s) {
    const functions = readFunctions(s.functions);
    const px = parseNumbers(s.x);
    const py = parseNumbers(s.y);
    if (functions.length === 0 && px.length === 0) return null;
    if (px.length !== py.length) throw new Error(`x tiene ${px.length} valores e y tiene ${py.length}.`);
    if (functions.length > MAX_FUNCTIONS) throw new Error(`Se pueden graficar hasta ${MAX_FUNCTIONS} funciones a la vez, para que se distingan.`);

    const constants = {};
    for (const name of parameterNames(s) ?? []) {
      const value = parseScalar(s.params?.[name]);
      if (value === null) return functions.length ? [note('info', `Falta el valor de ${name}.`)] : null;
      constants[name] = value;
    }

    const traces = [];
    const notes = [];
    if (functions.length) {
      let xmin = parseScalar(s.xmin);
      let xmax = parseScalar(s.xmax);
      if ((xmin === null || xmax === null) && px.length) {
        xmin = xmin ?? Math.min(...px);
        xmax = xmax ?? Math.max(...px);
      }
      if (xmin === null || xmax === null) return [note('info', 'Falta el rango de x.')];
      if (!(xmax > xmin)) throw new Error('x máximo tiene que ser mayor que x mínimo.');
      const n = parseScalar(s.points) ?? 1000;
      if (!(n >= 2 && n <= 20000)) throw new Error('La cantidad de puntos debe estar entre 2 y 20000.');
      if (s.logX && xmin <= 0) throw new Error('Con eje x logarítmico, x mínimo tiene que ser positivo.');
      const grid = s.logX ? logspace(xmin, xmax, n) : linspace(xmin, xmax, n);

      functions.forEach(({ line, compiled }, i) => {
        const color = SERIES[i];
        const values = sample(compiled.code, grid, constants);
        if (values.every((value) => value === null)) notes.push(note('warn', `"${line}" no da valores reales en este rango.`));
        traces.push(lineTrace(grid, values, { name: line, color }));
        if (s.derivative) {
          const d = partialDerivative(compiled, 'x');
          if (d.symbolic) traces.push(lineTrace(grid, sample(d.code, grid, constants), { name: `Derivada de ${line}`, color, dash: 'dash' }));
          else notes.push(note('warn', `No hay derivada simbólica para "${line}".`));
        }
      });
    }

    if (px.length) {
      traces.push(dataTrace(px, py, {
        ex: scalarOrList(s.ex, px.length, 'σx') ?? undefined,
        ey: scalarOrList(s.ey, px.length, 'σy') ?? undefined,
        name: 'Datos experimentales',
      }));
    }

    return [
      ...notes,
      card(null, chart(traces, {
        title: s.title.trim(),
        x: { title: s.labelX.trim() || 'x', type: s.logX ? 'log' : 'linear' },
        y: { title: s.labelY.trim() || 'y', type: s.logY ? 'log' : 'linear' },
        legend: traces.length > 1,
      }, { filename: 'funciones', tall: true })),
    ];
  },
};
