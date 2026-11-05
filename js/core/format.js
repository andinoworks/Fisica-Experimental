// Formato de números y de resultados para el informe.

export const numberFormat = { mode: 'auto', digits: 5, comma: false, sig: 1 };

const SUPERSCRIPT = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

function localize(text) {
  return numberFormat.comma ? text.replace(/\./g, ',') : text;
}

function tidyExponent(text) {
  return text.replace(/e\+?(-?)0*(\d)/, 'e$1$2');
}

export function fmt(value, options = {}) {
  if (value === Infinity) return '∞';
  if (value === -Infinity) return '−∞';
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const { mode, digits } = { ...numberFormat, ...options };
  if (mode === 'fixed') return localize(value.toFixed(digits));
  if (mode === 'sci') return localize(tidyExponent(value.toExponential(digits)));
  if (value === 0) return '0';
  const magnitude = Math.abs(value);
  if (magnitude >= 1e6 || magnitude < 1e-3) {
    return localize(tidyExponent(value.toExponential(Math.max(digits - 1, 0))));
  }
  return localize(String(Number(value.toPrecision(digits))));
}

export function fmtInt(value) {
  if (value === Infinity) return '∞';
  return String(value);
}

export function percent(fraction) {
  return `${localize((fraction * 100).toFixed(1))} %`;
}

function superscript(n) {
  return String(n).split('').map((c) => SUPERSCRIPT[c]).join('');
}

function roundTo(value, decimals) {
  if (decimals >= 0) return value.toFixed(decimals);
  const factor = 10 ** -decimals;
  return String(Math.round(value / factor) * factor);
}

// Regla del apunte (Serie C 4/11, 2.6): la incertidumbre con 1 cifra significativa
// (a veces 2) y el valor redondeado a ese mismo decimal.
export function fmtMeasurement(value, uncertainty, { sig = numberFormat.sig, unit = '' } = {}) {
  const suffix = unit ? ` ${unit}` : '';
  if (!Number.isFinite(value)) return '—';
  if (!(uncertainty > 0) || !Number.isFinite(uncertainty)) return `${fmt(value)}${suffix}`;

  const rounded = Number(uncertainty.toPrecision(sig));
  const exponent = Math.floor(Math.log10(rounded));
  const decimals = sig - 1 - exponent;

  const magnitude = Math.max(Math.abs(value), rounded);
  const useScale = magnitude >= 1e4 || magnitude < 1e-3;
  if (!useScale) {
    return localize(`(${roundTo(value, decimals)} ± ${roundTo(rounded, decimals)})`) + suffix;
  }
  const power = Math.floor(Math.log10(magnitude));
  const scale = 10 ** power;
  const scaledDecimals = Math.max(decimals + power, 0);
  const mantissa = (value / scale).toFixed(scaledDecimals);
  const error = (rounded / scale).toFixed(scaledDecimals);
  return localize(`(${mantissa} ± ${error})`) + ` × 10${superscript(power)}${suffix}`;
}
