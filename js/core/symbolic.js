// Fórmulas escritas por el usuario: lectura, derivadas parciales y propagación.
// math.js hace el álgebra; acá se adapta la notación y se aplica la guía GUM.

import { coverage, welchNu } from './stats.js';

const math = () => globalThis.math;

export const CONSTANTS = new Set(['pi', 'e']);

const GREEK = new Set(['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta',
  'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'varphi',
  'chi', 'psi', 'omega', 'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi', 'Omega']);

// Lo que suele venir de Python o de la notación castellana.
export function normalizeFormula(source) {
  return String(source ?? '')
    .replace(/\b(?:np|numpy|math)\./g, '')
    .replace(/\*\*/g, '^')
    .replace(/\bln\s*\(/g, 'log(')
    .replace(/\bsen\s*\(/g, 'sin(')
    .replace(/\btg\s*\(/g, 'tan(')
    .replace(/\barcsen\s*\(/g, 'asin(')
    .replace(/\barcsin\s*\(/g, 'asin(')
    .replace(/\barccos\s*\(/g, 'acos(')
    .replace(/\barctan\s*\(/g, 'atan(')
    .replace(/\braiz\s*\(/g, 'sqrt(')
    .replace(/\btan\s*\(/g, 'tan(');
}

export function symbolTex(name) {
  if (GREEK.has(name)) return `\\${name}`;
  const part = (text) => {
    if (GREEK.has(text)) return `\\${text}`;
    if (text.length === 1) return text;
    return `\\mathrm{${text.replace(/_/g, '\\_')}}`;
  };
  const underscore = name.indexOf('_');
  if (underscore > 0) {
    return `${part(name.slice(0, underscore))}_{${part(name.slice(underscore + 1))}}`;
  }
  const digits = name.match(/^([^\d]+)(\d+)$/);
  if (digits) return `${part(digits[1])}_{${digits[2]}}`;
  return part(name);
}

function texHandler(node) {
  // Con llaves: math.js pega el símbolo a "\cdot" sin dejar espacio.
  if (node.isSymbolNode) return `{${symbolTex(node.name)}}`;
  return undefined;
}

export function nodeToTex(node) {
  return node.toTex({ parenthesis: 'keep', implicit: 'hide', handler: texHandler });
}

function friendlyParseError(error, text) {
  const position = error.message.match(/char (\d+)/);
  const where = position ? ` (cerca del carácter ${position[1]})` : '';
  return new Error(`No pude leer la fórmula "${text}"${where}. Revisá paréntesis y operadores.`);
}

// "gamma = x1/(x1-x2)" o solo "x1/(x1-x2)".
export function compileFormula(source) {
  const raw = normalizeFormula(source).trim();
  if (!raw) throw new Error('Escribí una fórmula.');
  const equal = raw.indexOf('=');
  const output = equal > 0 ? raw.slice(0, equal).trim() : null;
  const body = equal >= 0 ? raw.slice(equal + 1).trim() : raw;
  if (!body) throw new Error('Falta la fórmula después del signo igual.');

  let node;
  try {
    node = math().parse(body);
  } catch (error) {
    throw friendlyParseError(error, body);
  }
  if (node.isBlockNode || node.isAssignmentNode) throw new Error('Escribí una sola fórmula, sin ";" ni otro "=".');

  for (const call of node.filter((n) => n.isFunctionNode)) {
    const name = call.fn?.name ?? call.name;
    if (typeof math()[name] !== 'function') {
      throw new Error(`No conozco la función "${name}". Si es una variable multiplicando, poné un * (por ejemplo ${name}*(...)).`);
    }
  }

  const names = new Set();
  // El nombre de una función (path 'fn') también es un SymbolNode, pero no es una variable.
  node.traverse((n, path) => {
    if (n.isSymbolNode && path !== 'fn' && !CONSTANTS.has(n.name)) names.add(n.name);
  });
  return { output, node, code: node.compile(), variables: [...names], tex: nodeToTex(node) };
}

function toReal(value, context) {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (value && typeof value.valueOf === 'function' && typeof value.valueOf() === 'number') return value.valueOf();
  throw new Error(`${context} no da un número real con estos valores.`);
}

export function evaluate(compiled, scope) {
  try {
    return toReal(compiled.code.evaluate({ ...scope }), 'La fórmula');
  } catch (error) {
    if (error.message.includes('no da un número real')) throw error;
    throw new Error(`No se pudo evaluar la fórmula: ${error.message}`);
  }
}

// Derivada parcial simbólica. Si math.js no sabe derivar la función, avisa y se usa
// una derivada numérica para no frenar el cálculo.
export function partialDerivative(compiled, name) {
  try {
    const node = math().derivative(compiled.node, name);
    return { name, node, code: node.compile(), tex: nodeToTex(node), symbolic: true };
  } catch {
    return { name, node: null, code: null, tex: null, symbolic: false };
  }
}

function numericDerivative(compiled, name, scope) {
  const x = scope[name];
  const step = Math.max(Math.abs(x), 1e-3) * 1e-6;
  const plus = compiled.code.evaluate({ ...scope, [name]: x + step });
  const minus = compiled.code.evaluate({ ...scope, [name]: x - step });
  return (plus - minus) / (2 * step);
}

export function sensitivity(compiled, derivative, scope) {
  if (derivative.symbolic) {
    return toReal(derivative.code.evaluate({ ...scope }), `La derivada respecto de ${derivative.name}`);
  }
  return toReal(numericDerivative(compiled, derivative.name, scope), `La derivada respecto de ${derivative.name}`);
}

// Propagación GUM con covarianzas y Welch-Satterthwaite (9/15: ec. 4.11, 6.6 y 6.9).
// inputs: [{ name, value, u, nu }]   covariances: [{ a, b, value }]
export function propagate(compiled, inputs, covariances = [], confidence = 0.95) {
  const scope = Object.fromEntries(inputs.map((input) => [input.name, input.value]));
  const y = evaluate(compiled, scope);

  const rows = inputs.map((input) => {
    const derivative = partialDerivative(compiled, input.name);
    let c = 0;
    try {
      c = sensitivity(compiled, derivative, scope);
    } catch (error) {
      if (input.u > 0) throw error;
    }
    if (!Number.isFinite(c)) {
      if (input.u > 0) throw new Error(`La derivada respecto de ${input.name} diverge con estos valores.`);
      c = 0;
    }
    return { ...input, derivative, c, contribution: (c * input.u) ** 2 };
  });

  const independent = rows.reduce((sum, row) => sum + row.contribution, 0);
  const byName = Object.fromEntries(rows.map((row) => [row.name, row]));
  let crossTerm = 0;
  const crossRows = [];
  for (const { a, b, value } of covariances) {
    if (!value) continue;
    const term = 2 * byName[a].c * byName[b].c * value;
    crossTerm += term;
    crossRows.push({ a, b, value, term });
  }
  const variance = independent + crossTerm;
  if (variance < 0) throw new Error('La varianza combinada da negativa: revisá las covarianzas (|Cov| no puede superar u₁·u₂).');
  const uc = Math.sqrt(variance);

  const welch = welchNu(rows.map((row) => [row.contribution, row.nu]), variance);
  const k = coverage(confidence, welch.nu);
  return {
    y,
    uc,
    variance,
    independent,
    crossTerm,
    crossRows,
    rows,
    nuEff: welch.nu,
    nuRaw: welch.raw,
    clamped: welch.clamped,
    k,
    U: k * uc,
  };
}

// Variante para mediciones de a pares (9/15, ec. 6.3): se calcula q en cada juego de
// mediciones simultáneas. Maneja la correlación sin necesitar covarianzas ni derivadas.
export function propagatePaired(compiled, series, fixed, confidence = 0.95) {
  const names = Object.keys(series);
  const n = series[names[0]].length;
  const values = [];
  for (let k = 0; k < n; k += 1) {
    const scope = { ...fixed };
    for (const name of names) scope[name] = series[name][k];
    values.push(evaluate(compiled, scope));
  }
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const s = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1));
  const u = s / Math.sqrt(n);
  const nu = n - 1;
  const k = coverage(confidence, nu);
  return { values, y: mean, s, u, nu, k, U: k * u };
}
