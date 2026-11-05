// Ajuste de polinomios por cuadrados mínimos, ordinario o ponderado (Serie C 9/15, cap. 3).
// Se resuelve con QR sobre columnas escaladas en vez de invertir la matriz normal:
// da el mismo resultado teórico y pierde menos precisión en grados altos.

const Matrix = () => globalThis.mlMatrix;

function solve(x, y, weights, degree) {
  const { Matrix: M, QrDecomposition, inverse } = Matrix();
  const n = degree + 1;
  const rows = x.map((xi, i) => {
    const row = new Array(n);
    let power = weights[i];
    for (let j = 0; j < n; j += 1) {
      row[j] = power;
      power *= xi;
    }
    return row;
  });
  const scale = new Array(n).fill(0).map((_, j) =>
    Math.sqrt(rows.reduce((sum, row) => sum + row[j] * row[j], 0)) || 1);
  const scaled = rows.map((row) => row.map((value, j) => value / scale[j]));

  const qr = new QrDecomposition(new M(scaled));
  const r = qr.upperTriangularMatrix;
  const diagonal = new Array(n).fill(0).map((_, j) => Math.abs(r.get(j, j)));
  if (Math.min(...diagonal) < 1e-12 * Math.max(...diagonal)) {
    throw new Error('Hay demasiados valores de x repetidos para este grado: el ajuste no tiene solución única.');
  }
  const b = M.columnVector(y.map((yi, i) => yi * weights[i]));
  const solution = qr.solve(b).to1DArray();
  const rInverse = inverse(r);
  const product = rInverse.mmul(rInverse.transpose());

  return {
    coef: solution.map((value, j) => value / scale[j]),
    // Matriz α⁻¹ del apunte (ec. 3.15).
    cov: new Array(n).fill(0).map((_, k) =>
      new Array(n).fill(0).map((__, l) => product.get(k, l) / (scale[k] * scale[l]))),
  };
}

const evalPoly = (coef, x) => coef.reduceRight((acc, c) => acc * x + c, 0);

// sigma = null: ajuste ordinario. La incertidumbre sale de la dispersión de los residuos.
// sigma = [...]: ajuste ponderado. La incertidumbre sale de las σ de cada punto.
export function fitPolynomial(x, y, { degree = 1, sigma = null } = {}) {
  const N = x.length;
  if (y.length !== N) throw new Error(`x tiene ${N} valores e y tiene ${y.length}.`);
  const parameters = degree + 1;
  const nu = N - parameters;
  if (nu < 1) throw new Error(`Faltan datos: para grado ${degree} hacen falta al menos ${parameters + 1} puntos.`);
  if (sigma && sigma.some((s) => !(s > 0))) {
    throw new Error('Para ponderar, todas las incertidumbres de y tienen que ser mayores que cero.');
  }

  const weights = sigma ? sigma.map((s) => 1 / s) : new Array(N).fill(1);
  const { coef, cov: alphaInverse } = solve(x, y, weights, degree);

  const predicted = x.map((xi) => evalPoly(coef, xi));
  const residuals = y.map((yi, i) => yi - predicted[i]);
  const weightSum = weights.reduce((sum, w) => sum + w * w, 0);
  const yMean = y.reduce((sum, yi, i) => sum + weights[i] * weights[i] * yi, 0) / weightSum;
  const ssRes = residuals.reduce((sum, r, i) => sum + (weights[i] * r) ** 2, 0);
  const ssTot = y.reduce((sum, yi, i) => sum + (weights[i] * (yi - yMean)) ** 2, 0);
  const residualVariance = ssRes / nu;

  const factor = sigma ? 1 : residualVariance;
  const cov = alphaInverse.map((row) => row.map((value) => value * factor));

  return {
    coef,
    cov,
    u: cov.map((row, k) => Math.sqrt(row[k])),
    N,
    nu,
    degree,
    weighted: Boolean(sigma),
    sigma,
    predicted,
    residuals,
    ssRes,
    residualVariance,
    s: Math.sqrt(residualVariance),
    r2: ssTot > 0 ? 1 - ssRes / ssTot : NaN,
    // Valor de y en x0 con su incertidumbre, usando la covarianza completa (ec. 3.16).
    predict(x0) {
      const powers = coef.map((_, k) => x0 ** k);
      let u2 = 0;
      for (let k = 0; k <= degree; k += 1) {
        for (let l = 0; l <= degree; l += 1) u2 += powers[k] * powers[l] * cov[k][l];
      }
      return { y: evalPoly(coef, x0), u: Math.sqrt(Math.max(u2, 0)) };
    },
    at: (x0) => evalPoly(coef, x0),
    slopeAt(x0) {
      return coef.reduceRight((acc, c, k) => (k === 0 ? acc : acc * x0 + k * c), 0);
    },
  };
}

// Ajuste ponderado que además propaga la incertidumbre de x hacia y (ec. 4.19):
// σ'² = σy² + (dy/dx · σx)². La pendiente depende del ajuste, así que se itera.
export function fitWithXUncertainty(x, y, sigmaX, sigmaY, degree = 1) {
  let result = fitPolynomial(x, y, { degree, sigma: sigmaY });
  let iterations = 0;
  for (; iterations < 50; iterations += 1) {
    const previous = result.coef;
    const effective = x.map((xi, i) => Math.hypot(sigmaY[i], result.slopeAt(xi) * sigmaX[i]));
    result = fitPolynomial(x, y, { degree, sigma: effective });
    const change = result.coef.reduce((max, c, k) => Math.max(max, Math.abs(c - previous[k]) / (Math.abs(c) || 1)), 0);
    if (change < 1e-10) break;
  }
  return result;
}
