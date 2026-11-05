// Conversión de campos y textos que repiten varias herramientas.

import { parseNumbers, parseScalar, parseNu } from '../core/parse.js';
import { summarize } from '../core/stats.js';

export function confidenceOf(text) {
  const value = parseScalar(text);
  if (value === null) return 0.95;
  if (!(value > 0 && value < 100)) throw new Error('El nivel de confianza debe estar entre 0 y 100 %.');
  return value / 100;
}

export const ALTERNATIVES = [
  ['two', 'Bilateral: son distintos'],
  ['greater', 'Unilateral: el primero es mayor'],
  ['less', 'Unilateral: el primero es menor'],
];

export const percentOf = (confidence) => `${+(confidence * 100).toFixed(2)} %`;

export function requireNumber(text, name) {
  const value = parseScalar(text);
  if (value === null) throw new Error(`Falta ${name}.`);
  return value;
}

// Muestra desde datos crudos o desde media, desvío y N. Null si está vacía.
export function sampleFrom(s, suffix) {
  if (s[`mode${suffix}`] === 'raw') {
    const values = parseNumbers(s[`data${suffix}`]);
    return values.length ? { ...summarize(values), values } : null;
  }
  const mean = parseScalar(s[`mean${suffix}`]);
  const sd = parseScalar(s[`s${suffix}`]);
  const n = parseScalar(s[`n${suffix}`]);
  if (mean === null && sd === null && n === null) return null;
  if (mean === null || sd === null || n === null) throw new Error('Completá media, desvío y N de las dos muestras.');
  return { mean, s: sd, s2: sd * sd, n, nu: n - 1, sem: sd / Math.sqrt(n) };
}

export const nuOf = (text) => parseNu(text);
