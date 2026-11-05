// Procedimiento de los ajustes, con las fórmulas del apunte (Serie C 4/11, cap. 4, y 9/15, cap. 3).

import { b, expandedStep, matrixTex, n, p } from '../ui/procedimiento.js';
import { linearDetails, normalMatrices } from '../core/fit.js';
import { symbolTex } from '../core/symbolic.js';

const nameTex = (name) => (/^[A-Za-z][A-Za-z0-9_]*$/.test(name) ? symbolTex(name) : `\\text{${name.replace(/[\\{}$&#^%~]/g, '')}}`);

function ordinarySteps(d, m, c) {
  return [
    {
      title: 'Promedios',
      math: [
        `\\bar{X} = \\dfrac{\\sum X_i}{N} = \\dfrac{${n(d.sumX)}}{${d.N}} = ${n(d.xMean)}`,
        `\\bar{Y} = \\dfrac{\\sum Y_i}{N} = \\dfrac{${n(d.sumY)}}{${d.N}} = ${n(d.yMean)}`,
      ],
    },
    {
      title: 'Sumas de cuadrados',
      math: [
        `S_{XX} = \\sum (X_i - \\bar{X})^{2} = ${n(d.Sxx)}`,
        `S_{XY} = \\sum (X_i - \\bar{X})(Y_i - \\bar{Y}) = ${n(d.Sxy)}`,
        `S_{YY} = \\sum (Y_i - \\bar{Y})^{2} = ${n(d.Syy)}`,
      ],
    },
    {
      title: 'Pendiente y ordenada',
      math: [
        `${m} = \\dfrac{S_{XY}}{S_{XX}} = \\dfrac{${n(d.Sxy)}}{${n(d.Sxx)}} = ${n(d.a)}`,
        `${c} = \\bar{Y} - ${m}\\, \\bar{X} = ${n(d.yMean)} - ${p(d.a)} \\cdot ${p(d.xMean)} = ${n(d.b)}`,
      ],
    },
    {
      title: 'Dispersión de los puntos',
      math: [
        `SSE = \\sum \\left[Y_i - (${m} X_i + ${c})\\right]^{2} = ${n(d.sse)}`,
        `s^{2} = \\dfrac{SSE}{N-2} = \\dfrac{${n(d.sse)}}{${d.N - 2}} = ${n(d.s2)}, \\qquad s = ${n(d.s)}`,
      ],
    },
    {
      title: 'Incertidumbres de los parámetros',
      math: [
        `s_{${m}} = \\dfrac{s}{\\sqrt{S_{XX}}} = \\dfrac{${n(d.s)}}{\\sqrt{${n(d.Sxx)}}} = ${n(d.ua)}`,
        `s_{${c}} = s \\sqrt{\\dfrac{\\sum X_i^{2}}{N\\, S_{XX}}} = ${n(d.s)} \\sqrt{\\dfrac{${n(d.sumX2)}}{${d.N} \\cdot ${n(d.Sxx)}}} = ${n(d.ub)}`,
      ],
    },
    {
      title: 'Coeficiente de determinación',
      math: [`r^{2} = 1 - \\dfrac{SSE}{S_{YY}} = 1 - \\dfrac{${n(d.sse)}}{${n(d.Syy)}} = ${n(d.r2)}`],
    },
  ];
}

function weightedSteps(d, m, c) {
  return [
    {
      title: 'Sumas pesadas con 1/σ²',
      math: [
        `\\sum \\dfrac{1}{\\sigma_i^{2}} = ${n(d.S)}, \\quad \\sum \\dfrac{X_i}{\\sigma_i^{2}} = ${n(d.Sx)}, \\quad \\sum \\dfrac{Y_i}{\\sigma_i^{2}} = ${n(d.Sy)}`,
        `\\sum \\dfrac{X_i^{2}}{\\sigma_i^{2}} = ${n(d.Sxx)}, \\quad \\sum \\dfrac{X_i Y_i}{\\sigma_i^{2}} = ${n(d.Sxy)}`,
      ],
    },
    {
      title: 'Determinante',
      math: [
        `\\Delta = \\sum \\dfrac{1}{\\sigma_i^{2}} \\sum \\dfrac{X_i^{2}}{\\sigma_i^{2}} - \\left(\\sum \\dfrac{X_i}{\\sigma_i^{2}}\\right)^{2}`,
        `\\Delta = ${p(d.S)} \\cdot ${p(d.Sxx)} - ${b(d.Sx)}^{2} = ${n(d.delta)}`,
      ],
    },
    {
      title: 'Pendiente y ordenada',
      math: [
        `${m} = \\dfrac{1}{\\Delta} \\left( \\sum \\dfrac{1}{\\sigma_i^{2}} \\sum \\dfrac{X_i Y_i}{\\sigma_i^{2}} - \\sum \\dfrac{X_i}{\\sigma_i^{2}} \\sum \\dfrac{Y_i}{\\sigma_i^{2}} \\right)`,
        `${m} = \\dfrac{${p(d.S)} \\cdot ${p(d.Sxy)} - ${p(d.Sx)} \\cdot ${p(d.Sy)}}{${n(d.delta)}} = ${n(d.a)}`,
        `${c} = \\dfrac{1}{\\Delta} \\left( \\sum \\dfrac{X_i^{2}}{\\sigma_i^{2}} \\sum \\dfrac{Y_i}{\\sigma_i^{2}} - \\sum \\dfrac{X_i}{\\sigma_i^{2}} \\sum \\dfrac{X_i Y_i}{\\sigma_i^{2}} \\right)`,
        `${c} = \\dfrac{${p(d.Sxx)} \\cdot ${p(d.Sy)} - ${p(d.Sx)} \\cdot ${p(d.Sxy)}}{${n(d.delta)}} = ${n(d.b)}`,
      ],
    },
    {
      title: 'Incertidumbres de los parámetros',
      math: [
        `s_{${m}} = \\sqrt{\\dfrac{1}{\\Delta} \\sum \\dfrac{1}{\\sigma_i^{2}}} = \\sqrt{\\dfrac{${n(d.S)}}{${n(d.delta)}}} = ${n(d.ua)}`,
        `s_{${c}} = \\sqrt{\\dfrac{1}{\\Delta} \\sum \\dfrac{X_i^{2}}{\\sigma_i^{2}}} = \\sqrt{\\dfrac{${n(d.Sxx)}}{${n(d.delta)}}} = ${n(d.ub)}`,
      ],
    },
    {
      title: 'Bondad del ajuste',
      math: [
        `\\chi^{2} = \\sum \\dfrac{\\left[Y_i - (${m} X_i + ${c})\\right]^{2}}{\\sigma_i^{2}} = ${n(d.sse)}`,
        `\\dfrac{\\chi^{2}}{N-2} = \\dfrac{${n(d.sse)}}{${d.N - 2}} = ${n(d.s2)}`,
        `r^{2} = ${n(d.r2)} \\ \\text{(ponderado)}`,
      ],
    },
  ];
}

// propagatedX: el ajuste itera σ' con la pendiente (ec. 4.19).
export function linearSteps(x, y, fit, { confidence, k, symM = 'm', symB = 'b', testB = false, propagatedX = false }) {
  const m = nameTex(symM);
  const c = nameTex(symB);
  const d = linearDetails(x, y, fit.weighted ? fit.sigma : null);
  const steps = [];
  if (propagatedX) {
    steps.push({
      title: 'Incertidumbre de x propagada hacia y (ec. 4.19)',
      text: `Se usa σᵢ′ en lugar de σᵢ. Como depende de la pendiente, se ajusta y se recalcula hasta que no cambia. En el primer punto da ${fit.sigma[0].toPrecision(4)}.`,
      math: [`\\sigma_i' = \\sqrt{\\sigma_{y,i}^{2} + (${m}\\, \\sigma_{x,i})^{2}}`],
    });
  }
  steps.push(...(fit.weighted ? weightedSteps(d, m, c) : ordinarySteps(d, m, c)));
  const ks = expandedStep(k, d.ua, confidence, fit.nu, `s_{${m}}`);
  steps.push({
    title: 'Incertidumbres expandidas',
    math: [
      ks.math[0],
      `U_{${m}} = k\\, s_{${m}} = ${n(k)} \\cdot ${n(d.ua)} = ${n(k * d.ua)}`,
      `U_{${c}} = k\\, s_{${c}} = ${n(k)} \\cdot ${n(d.ub)} = ${n(k * d.ub)}`,
    ],
  });
  if (testB) {
    const t = Math.abs(d.b) / d.ub;
    steps.push({
      title: `Compatibilidad de la ordenada con cero`,
      math: [
        `H_0:\\ ${c} = 0`,
        `|t| = \\dfrac{|${c}|}{s_{${c}}} = \\dfrac{${n(Math.abs(d.b))}}{${n(d.ub)}} = ${n(t)}`,
        `|t| = ${n(t)} ${t <= k ? '\\leq' : '>'} ${n(k)} = k`,
      ],
      conclusion: t <= k ? 'No se rechaza H₀: la ordenada es compatible con cero.' : 'Se rechaza H₀: la ordenada no es compatible con cero.',
    });
  }
  return steps;
}

export function polynomialSteps(x, y, fit, { confidence, k }) {
  const { alpha, beta } = normalMatrices(x, y, fit.weighted ? fit.sigma : null, fit.degree);
  const symbolA = fit.weighted ? '\\sum \\dfrac{x_i^{k+j}}{s_i^{2}}' : '\\sum x_i^{k+j}';
  const symbolB = fit.weighted ? '\\sum \\dfrac{y_i\\, x_i^{k}}{s_i^{2}}' : '\\sum y_i\\, x_i^{k}';
  const sigmaLine = fit.weighted
    ? { math: [`\\text{Cov}(a_k, a_j) = (\\alpha^{-1})_{kj}, \\qquad s_{a_k} = \\sqrt{(\\alpha^{-1})_{kk}}`] }
    : { math: [`s^{2} = \\dfrac{\\sum (y_i - y(x_i))^{2}}{N - ${fit.degree + 1}} = \\dfrac{${n(fit.ssRes)}}{${fit.nu}} = ${n(fit.residualVariance)}`, `\\text{Cov}(a_k, a_j) = s^{2} (\\alpha^{-1})_{kj}, \\qquad s_{a_k} = \\sqrt{s^{2} (\\alpha^{-1})_{kk}}`] };
  return [
    {
      title: 'Matriz α y vector β',
      math: [
        `\\alpha_{kj} = ${symbolA}, \\qquad \\beta_{k} = ${symbolB}`,
        `\\alpha = ${matrixTex(alpha)}, \\qquad \\beta = ${matrixTex(beta.map((value) => [value]))}`,
      ],
    },
    {
      title: 'Parámetros: a = α⁻¹ β',
      math: [
        `\\alpha^{-1} = ${matrixTex(fit.alphaInverse)}`,
        `a = \\alpha^{-1} \\beta = ${matrixTex(fit.coef.map((value) => [value]))}`,
      ],
    },
    {
      title: 'Incertidumbres de los parámetros',
      math: [
        ...sigmaLine.math,
        ...fit.u.map((value, i) => `s_{a_{${i}}} = ${n(value)}`),
      ],
    },
    {
      title: 'Incertidumbres expandidas',
      math: [
        expandedStep(k, 0, confidence, fit.nu).math[0],
        ...fit.u.map((value, i) => `U_{a_{${i}}} = ${n(k)} \\cdot ${n(value)} = ${n(k * value)}`),
      ],
    },
  ];
}

// Valor de y(x₀) con la covarianza completa (9/15, ec. 3.16).
export function predictionMath(fit, x0) {
  const at = fit.predict(x0);
  const terms = fit.coef.map((c, i) => (i === 0 ? n(c) : `${p(c)} \\cdot ${p(x0)}^{${i}}`)).join(' + ');
  return [
    `y(x_0) = \\sum_k a_k x_0^{k} = ${terms} = ${n(at.y)}`,
    `u_y = \\sqrt{\\sum_k \\sum_j x_0^{k+j}\\, \\text{Cov}(a_k, a_j)} = ${n(at.u)}`,
  ];
}
