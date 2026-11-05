// Estadística: distribuciones (jStat), muestras y pruebas de hipótesis.
// Las fórmulas siguen los apuntes Serie C 4/11 y 9/15 (FaMAF).

const jStat = () => globalThis.jStat;

// ---------- Distribuciones ----------

export const normCdf = (z) => jStat().normal.cdf(z, 0, 1);
export const normInv = (p) => jStat().normal.inv(p, 0, 1);

export function tCdf(t, nu) {
  return nu === Infinity ? normCdf(t) : jStat().studentt.cdf(t, nu);
}

export function tInv(p, nu) {
  return nu === Infinity ? normInv(p) : jStat().studentt.inv(p, nu);
}

export const fCdf = (f, d1, d2) => jStat().centralF.cdf(f, d1, d2);
export const fInv = (p, d1, d2) => jStat().centralF.inv(p, d1, d2);

// Factor de cobertura bilateral para un nivel de confianza (0.95 = 95 %).
export const coverage = (confidence, nu) => tInv(1 - (1 - confidence) / 2, nu);

export function binomialPmf(k, n, p) {
  if (k < 0 || k > n || !Number.isInteger(k)) return 0;
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;
  const ln = jStat().gammaln;
  return Math.exp(ln(n + 1) - ln(k + 1) - ln(n - k + 1) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

export function poissonPmf(k, mu) {
  if (k < 0 || !Number.isInteger(k)) return 0;
  if (mu === 0) return k === 0 ? 1 : 0;
  return Math.exp(k * Math.log(mu) - mu - jStat().gammaln(k + 1));
}

export const gaussianPdf = (x, mu, sigma) =>
  Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI));

// ---------- Muestras ----------

export const mean = (xs) => xs.reduce((sum, x) => sum + x, 0) / xs.length;

export function covariance(xs, ys) {
  const mx = mean(xs);
  const my = mean(ys);
  return xs.reduce((sum, x, i) => sum + (x - mx) * (ys[i] - my), 0) / (xs.length - 1);
}

export const variance = (xs) => covariance(xs, xs);
export const std = (xs) => Math.sqrt(variance(xs));

export function median(xs) {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function summarize(xs) {
  if (xs.length < 2) throw new Error('Hacen falta al menos 2 mediciones.');
  const s = std(xs);
  return {
    n: xs.length,
    mean: mean(xs),
    s,
    s2: s * s,
    sem: s / Math.sqrt(xs.length),
    median: median(xs),
    min: Math.min(...xs),
    max: Math.max(...xs),
    nu: xs.length - 1,
  };
}

// Histograma del apunte (3.3): raíz de N clases, cerradas a izquierda y abiertas a derecha.
export function histogram(xs, requestedBins) {
  const n = xs.length;
  const bins = requestedBins > 0 ? requestedBins : Math.ceil(Math.sqrt(n));
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const width = hi > lo ? (hi - lo) / bins : 1;
  const counts = new Array(bins).fill(0);
  for (const x of xs) {
    // El máximo cae en el borde superior: se cuenta en la última clase.
    counts[Math.min(Math.floor((x - lo) / width), bins - 1)] += 1;
  }
  return {
    width,
    classes: counts.map((count, i) => ({
      from: lo + i * width,
      to: lo + (i + 1) * width,
      center: lo + (i + 0.5) * width,
      count,
      freq: count / n,
    })),
  };
}

// ---------- Pruebas de hipótesis ----------

// alt: 'two' (distinto), 'greater' (mayor) o 'less' (menor).
function decide(statistic, nu, confidence, alt) {
  const alpha = 1 - confidence;
  const cdf = tCdf(statistic, nu);
  if (alt === 'greater') {
    const critical = tInv(1 - alpha, nu);
    return { critical, reject: statistic >= critical, p: 1 - cdf };
  }
  if (alt === 'less') {
    const critical = tInv(1 - alpha, nu);
    return { critical, reject: statistic <= -critical, p: cdf };
  }
  const critical = tInv(1 - alpha / 2, nu);
  return { critical, reject: Math.abs(statistic) >= critical, p: 2 * Math.min(cdf, 1 - cdf) };
}

// Fórmula de Welch-Satterthwaite truncada al entero inferior (ec. 4.11).
// Cada término es [uᵢ², νᵢ]. El mínimo razonable es 1 grado de libertad.
export function welchNu(terms, total) {
  const denominator = terms.reduce((sum, [u2, nu]) => (nu === Infinity ? sum : sum + (u2 * u2) / nu), 0);
  if (denominator === 0) return { nu: Infinity, raw: Infinity, clamped: false };
  const sum = total ?? terms.reduce((acc, [u2]) => acc + u2, 0);
  const raw = (sum * sum) / denominator;
  const nu = Math.floor(raw);
  return { nu: Math.max(nu, 1), raw, clamped: nu < 1 };
}

export function compareToReference({ value, u, nu, reference, confidence, alt = 'two' }) {
  if (!(u > 0)) throw new Error('La incertidumbre debe ser mayor que cero.');
  const statistic = (value - reference) / u;
  return { difference: value - reference, statistic, nu, ...decide(statistic, nu, confidence, alt) };
}

export function compareResults({ v1, u1, nu1, v2, u2, nu2, cov = 0, confidence, alt = 'two' }) {
  const variance12 = u1 * u1 + u2 * u2 - 2 * cov;
  if (!(variance12 > 0)) throw new Error('La incertidumbre de la diferencia da cero o negativa: revisá la covarianza.');
  const uDiff = Math.sqrt(variance12);
  const { nu, raw, clamped } = welchNu([[u1 * u1, nu1], [u2 * u2, nu2]]);
  const statistic = (v1 - v2) / uDiff;
  return { difference: v1 - v2, uDiff, statistic, nu, nuRaw: raw, clamped, ...decide(statistic, nu, confidence, alt) };
}

// Prueba F del apunte (9/15, 1.1.3). En bilateral se pone la varianza mayor en el
// numerador y se compara contra F(α/2), como en test_f.py.
export function fTest({ var1, n1, var2, n2, confidence, alt = 'two' }) {
  if (!(var1 > 0) || !(var2 > 0)) throw new Error('Las varianzas deben ser mayores que cero.');
  if (n1 < 2 || n2 < 2) throw new Error('Cada muestra necesita al menos 2 mediciones.');
  const alpha = 1 - confidence;
  if (alt !== 'two') {
    const d1 = n1 - 1;
    const d2 = n2 - 1;
    const f = var1 / var2;
    const cdf = fCdf(f, d1, d2);
    const critical = alt === 'greater' ? fInv(1 - alpha, d1, d2) : fInv(alpha, d1, d2);
    const reject = alt === 'greater' ? f >= critical : f <= critical;
    return { f, d1, d2, critical, reject, p: alt === 'greater' ? 1 - cdf : cdf, firstIsLarger: var1 >= var2 };
  }
  const firstIsLarger = var1 >= var2;
  const d1 = (firstIsLarger ? n1 : n2) - 1;
  const d2 = (firstIsLarger ? n2 : n1) - 1;
  const f = firstIsLarger ? var1 / var2 : var2 / var1;
  const critical = fInv(1 - alpha / 2, d1, d2);
  const upper = 1 - fCdf(f, d1, d2);
  return { f, d1, d2, critical, reject: f >= critical, p: Math.min(2 * upper, 1), firstIsLarger };
}

// Dos muestras: agrupada si las varianzas son homogéneas, Welch si no (9/15, 1.1.3).
export function compareSamples({ a, b, confidence, fConfidence = confidence, method = 'auto', alt = 'two' }) {
  const homogeneity = fTest({ var1: a.s2, n1: a.n, var2: b.s2, n2: b.n, confidence: fConfidence });
  const pooled = method === 'pooled' || (method === 'auto' && !homogeneity.reject);
  const ua2 = a.s2 / a.n;
  const ub2 = b.s2 / b.n;
  let uDiff;
  let nu;
  let nuRaw;
  if (pooled) {
    const sp2 = ((a.n - 1) * a.s2 + (b.n - 1) * b.s2) / (a.n + b.n - 2);
    uDiff = Math.sqrt(sp2 * (1 / a.n + 1 / b.n));
    nu = a.n + b.n - 2;
    nuRaw = nu;
  } else {
    uDiff = Math.sqrt(ua2 + ub2);
    ({ nu, raw: nuRaw } = welchNu([[ua2, a.n - 1], [ub2, b.n - 1]]));
  }
  const statistic = (a.mean - b.mean) / uDiff;
  return {
    homogeneity,
    pooled,
    difference: a.mean - b.mean,
    uDiff,
    statistic,
    nu,
    nuRaw,
    ...decide(statistic, nu, confidence, alt),
  };
}
