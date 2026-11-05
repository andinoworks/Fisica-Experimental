// Compara el motor de cálculo contra numpy/scipy (referencia.json) y contra los
// ejemplos resueltos de los apuntes Serie C. Se corre con:  node tests/run.mjs

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const vendor = new URL('../vendor/', import.meta.url);
const load = (file) => {
  const path = decodeURIComponent(new URL(file, vendor).pathname).replace(/^\/([A-Za-z]:)/, '$1');
  return require(path);
};
globalThis.math = load('math.js');
const jstat = load('jstat.min.js');
globalThis.jStat = jstat.jStat ?? jstat;
globalThis.mlMatrix = load('matrix.umd.js');

const stats = await import('../js/core/stats.js');
const { fitPolynomial, fitWithXUncertainty, linearDetails, normalMatrices } = await import('../js/core/fit.js');
const sym = await import('../js/core/symbolic.js');
const { parseNumbers, parseNu, scalarOrList } = await import('../js/core/parse.js');
const { fmtMeasurement, fmt, numberFormat } = await import('../js/core/format.js');

const ref = JSON.parse(readFileSync(new URL('./referencia.json', import.meta.url), 'utf8'));

let passed = 0;
const failures = [];
function close(name, actual, expected, tolerance = 1e-8) {
  const error = Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-300);
  const ok = Number.isFinite(actual) ? error <= tolerance || Math.abs(actual - expected) <= tolerance : actual === expected;
  if (ok) passed += 1;
  else failures.push(`${name}: dio ${actual}, se esperaba ${expected}`);
}
function equal(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed += 1;
  else failures.push(`${name}: dio ${JSON.stringify(actual)}, se esperaba ${JSON.stringify(expected)}`);
}
function throws(name, fn) {
  try {
    fn();
    failures.push(`${name}: debía dar error y no dio`);
  } catch {
    passed += 1;
  }
}

// ---------- Distribuciones contra scipy ----------
for (const [c, nu, expected] of ref.grillas.t) close(`t(${c},${nu})`, stats.coverage(c, nu), expected, 1e-6);
for (const [p, a, b, expected] of ref.grillas.f) close(`F(${p},${a},${b})`, stats.fInv(p, a, b), expected, 1e-6);
for (const [p, expected] of ref.grillas.z) close(`z(${p})`, stats.normInv(p), expected, 1e-6);

// ---------- Programas originales ----------
{
  const r = ref.lineal;
  const f = fitPolynomial(r.x, r.y, { degree: 1 });
  close('cuad_minimos m', f.coef[1], r.m);
  close('cuad_minimos b', f.coef[0], r.b);
  close('cuad_minimos u_m', f.u[1], r.um);
  close('cuad_minimos u_b', f.u[0], r.ub);
  close('cuad_minimos cov', f.cov[0][1], r.cov);
  close('cuad_minimos s2', f.residualVariance, r.s2);
  close('cuad_minimos r2', f.r2, r.r2);
  close('cuad_minimos k', stats.coverage(0.95, f.nu), r.k, 1e-6);
}
{
  const r = ref.ponderado;
  const f = fitPolynomial(r.x, r.y, { degree: 1, sigma: r.e });
  close('ponderado m', f.coef[1], r.m);
  close('ponderado b', f.coef[0], r.b);
  close('ponderado u_m', f.u[1], r.um);
  close('ponderado u_b', f.u[0], r.ub);
}
for (const degree of [2, 3]) {
  const r = ref.polinomio;
  const g = r.grados[degree];
  const f = fitPolynomial(r.x, r.y, { degree });
  g.coef.forEach((c, k) => close(`polinomio g${degree} a${k}`, f.coef[k], c, 1e-7));
  g.u.forEach((u, k) => close(`polinomio g${degree} u${k}`, f.u[k], u, 1e-7));
  close(`polinomio g${degree} r2`, f.r2, g.r2);
}
{
  const r = ref.f;
  const t = stats.fTest({ var1: stats.variance(r.a), n1: r.a.length, var2: stats.variance(r.b), n2: r.b.length, confidence: 0.95 });
  close('test_f F', t.f, r.F);
  close('test_f Fcrit', t.critical, r.Fcrit, 1e-6);
  equal('test_f orden', [t.d1, t.d2], [6, 4]);
}
{
  const r = ref.welch;
  const compiled = sym.compileFormula('gamma = x1 / (x1 - x2)');
  equal('variables detectadas', compiled.variables, ['x1', 'x2']);
  equal('nombre de salida', compiled.output, 'gamma');
  const a = stats.summarize(r.x1);
  const b = stats.summarize(r.x2);
  const res = sym.propagate(compiled, [
    { name: 'x1', value: a.mean, u: a.sem, nu: a.nu },
    { name: 'x2', value: b.mean, u: b.sem, nu: b.nu },
  ], [{ a: 'x1', b: 'x2', value: stats.covariance(r.x1, r.x2) / a.n }]);
  close('welch y', res.y, r.y);
  close('welch c1 (derivada automática)', res.rows[0].c, r.c1);
  close('welch c2 (derivada automática)', res.rows[1].c, r.c2);
  close('welch u_c', res.uc, r.uc);
  equal('welch nu_eff', res.nuEff, Math.max(r.nu, 1));
}
{
  const r = ref.welchB;
  const c = stats.compareResults({ v1: 1.32, u1: 0.02, nu1: 1251, v2: 1.24, u2: 0.02, nu2: 8, confidence: 0.95 });
  close('parte B t', c.statistic, r.t);
  equal('parte B nu', c.nu, r.nu);
  close('parte B t crítico', c.critical, r.tcrit, 1e-6);
  const t = stats.compareToReference({ value: 1.32, u: 0.02, nu: 1251, reference: 1.4, confidence: 0.95 });
  close('parte B teórico t', Math.abs(t.statistic), r.teorico_t);
  close('parte B teórico crítico', t.critical, r.teorico_crit, 1e-6);
}

// ---------- Ejemplos resueltos de los apuntes ----------
{
  // 9/15 cap. 3: glucosa, polinomio de grado 2 con σ = 1 g/l
  const x = [1, 2, 3, 4, 5, 6, 7, 8];
  const y = [74, 54, 52, 51, 52, 53, 58, 71];
  const f = fitPolynomial(x, y, { degree: 2, sigma: new Array(8).fill(1) });
  close('glucosa a0', f.coef[0], 84.48214, 1e-6);
  close('glucosa a1', f.coef[1], -15.875, 1e-6);
  close('glucosa a2', f.coef[2], 1.767857, 1e-6);
  close('glucosa u a0', f.u[0], 1.395, 1e-3);
  close('glucosa u a1', f.u[1], 0.7113, 1e-3);
  close('glucosa u a2', f.u[2], 0.07715, 1e-3);
  close('glucosa cov a0a1', f.cov[0][1], -0.9107143, 1e-6);
  const at = f.predict(4.5);
  close('glucosa y(4.5)', at.y, 48.84375, 1e-6);
  close('glucosa u(4.5) con covarianza', at.u, 0.5376, 1e-3);
}
{
  // 9/15 cap. 4: momento de inercia, I = M R²/2
  const c = sym.compileFormula('I = M * R^2 / 2');
  const res = sym.propagate(c, [
    { name: 'M', value: 252.6, u: 2.5, nu: 7 },
    { name: 'R', value: 6.35, u: 0.05, nu: 4 },
  ]);
  close('inercia I', res.y, 5092.7, 1e-4);
  close('inercia c_M', res.rows[0].c, 20.16125, 1e-6);
  close('inercia c_R', res.rows[1].c, 1604.01, 1e-5);
  close('inercia u', res.uc, 94.7, 1e-3);
  equal('inercia nu_eff', res.nuEff, 7);
  close('inercia k', res.k, 2.365, 1e-3);
  equal('inercia informe', fmtMeasurement(res.y, res.U, { sig: 2, unit: 'g cm²' }), '(5090 ± 220) g cm²');
}
{
  // 9/15 cap. 2: ángulos α + β, con covarianza negativa
  const al = [35, 31, 33, 32, 34];
  const be = [50, 55, 51, 53, 51];
  close('ángulos s_α', stats.std(al), 1.6, 0.02);
  close('ángulos s_αβ', stats.covariance(al, be), -3, 1e-9);
  const c = sym.compileFormula('alpha + beta');
  const res = sym.propagate(c, [
    { name: 'alpha', value: 33, u: stats.std(al), nu: 4 },
    { name: 'beta', value: 52, u: stats.std(be), nu: 4 },
  ], [{ a: 'alpha', b: 'beta', value: -3 }]);
  close('ángulos θ', res.y, 85);
  close('ángulos s_θ', res.uc, 0.7, 0.02);
}
{
  // 9/15 cap. 1: pelícanos, varianzas no homogéneas
  const a = { n: 10, mean: 0.041, s2: 0.017 ** 2 };
  const b = { n: 13, mean: 0.026, s2: 0.006 ** 2 };
  const res = stats.compareSamples({ a, b, confidence: 0.95, fConfidence: 0.9, alt: 'greater' });
  close('pelícanos f', res.homogeneity.f, 8.028, 1e-3);
  close('pelícanos F crítico', res.homogeneity.critical, 2.796, 1e-3);
  equal('pelícanos no homogéneas', res.pooled, false);
  close('pelícanos t', res.statistic, 2.665, 1e-3);
  close('pelícanos ν sin truncar', res.nuRaw, 10.73, 1e-3);
  equal('pelícanos ν', res.nu, 10);
  close('pelícanos t crítico', res.critical, 1.812, 1e-3);
  equal('pelícanos rechaza', res.reject, true);
}
{
  // Lentes: t bilateral contra un valor de referencia
  const res = stats.compareToReference({ value: 3.05, u: 0.34 / Math.sqrt(10), nu: 9, reference: 3.2, confidence: 0.95 });
  close('lentes t', res.statistic, -1.395, 1e-3);
  close('lentes crítico', res.critical, 2.262, 1e-3);
  equal('lentes no rechaza', res.reject, false);
}
{
  // Discretas
  close('binomial fusibles', stats.binomialPmf(2, 16, 0.05), 0.146, 2e-3);
  close('binomial monedas', stats.binomialPmf(25, 40, 0.5), 3.66e-2, 2e-3);
  close('poisson 72 con μ=64', stats.poissonPmf(72, 64), 0.029, 0.02);
  close('poisson acum', stats.poissonPmf(0, 3) + stats.poissonPmf(1, 3) + stats.poissonPmf(2, 3), 0.423, 3e-3);
  close('poisson k grande', stats.poissonPmf(500, 500), 0.01784, 1e-3);
}
{
  // Histograma: péndulo con R = 0,21 s y N = 100 da 10 clases
  const xs = Array.from({ length: 100 }, (_, i) => 2.67 + (0.21 * i) / 99);
  const h = stats.histogram(xs);
  equal('histograma clases', h.classes.length, 10);
  equal('histograma total', h.classes.reduce((s, c) => s + c.count, 0), 100);
  close('histograma suma frecuencias', h.classes.reduce((s, c) => s + c.freq, 0), 1);
}

// ---------- Fórmulas ----------
{
  const c = sym.compileFormula('A * np.exp(-t / tau) + ln(R) ** 2 + sen(theta)');
  equal('notación Python y castellana', c.variables.sort(), ['A', 'R', 't', 'tau', 'theta']);
  const scope = { A: 2, t: 1, tau: 3, R: 4, theta: 0.5 };
  for (const name of c.variables) {
    const d = sym.partialDerivative(c, name);
    const step = Math.abs(scope[name]) * 1e-6;
    const numeric = (sym.evaluate(c, { ...scope, [name]: scope[name] + step }) - sym.evaluate(c, { ...scope, [name]: scope[name] - step })) / (2 * step);
    equal(`derivada simbólica ${name}`, d.symbolic, true);
    close(`derivada ${name} contra diferencias finitas`, sym.sensitivity(c, d, scope), numeric, 1e-6);
  }
  equal('pi y e son constantes', sym.compileFormula('2*pi*r + e').variables, ['r']);
  equal('tau y phi son variables', sym.compileFormula('tau + phi').variables, ['tau', 'phi']);
  close('una variable llamada phi usa su valor', sym.evaluate(sym.compileFormula('phi + 1'), { phi: 2 }), 3);
  throws('función desconocida', () => sym.compileFormula('foo(x)'));
  throws('falta un *', () => sym.compileFormula('x(1+y)'));
  throws('paréntesis sin cerrar', () => sym.compileFormula('(x+1'));
  throws('resultado complejo', () => sym.evaluate(sym.compileFormula('sqrt(x)'), { x: -1 }));
  equal('tex griego con subíndice', sym.symbolTex('eta_a'), '\\eta_{a}');
  equal('tex número', sym.symbolTex('x1'), 'x_{1}');
  equal('tex griego', sym.symbolTex('rho'), '\\rho');
}
{
  // Tipo B sola: todos los ν infinitos llevan a z
  const c = sym.compileFormula('a + b');
  const res = sym.propagate(c, [{ name: 'a', value: 1, u: 0.1, nu: Infinity }, { name: 'b', value: 2, u: 0.1, nu: Infinity }]);
  equal('ν infinito', res.nuEff, Infinity);
  close('k es z', res.k, 1.95996, 1e-4);
}
{
  // Correlación fuerte: u_c muy chica. ν_eff no puede quedar en 0.
  const c = sym.compileFormula('a - b');
  const res = sym.propagate(c, [{ name: 'a', value: 1, u: 1, nu: 9 }, { name: 'b', value: 1, u: 1, nu: 9 }], [{ a: 'a', b: 'b', value: 0.99 }]);
  equal('ν_eff mínimo', res.nuEff, 1);
  equal('avisa el recorte', res.clamped, true);
  throws('covarianza imposible', () => sym.propagate(c, [{ name: 'a', value: 1, u: 1, nu: 9 }, { name: 'b', value: 1, u: 1, nu: 9 }], [{ a: 'a', b: 'b', value: 5 }]) && sym.propagate(sym.compileFormula('a + b'), [{ name: 'a', value: 1, u: 1, nu: 9 }, { name: 'b', value: 1, u: 1, nu: 9 }], [{ a: 'a', b: 'b', value: -5 }]));
}
{
  // Mediciones de a pares (ec. 6.3)
  const c = sym.compileFormula('x1 / (x1 - x2)');
  const x1 = ref.welch.x1;
  const x2 = ref.welch.x2;
  const res = sym.propagatePaired(c, { x1, x2 }, {});
  equal('pares ν', res.nu, 9);
  close('pares media', res.y, stats.mean(x1.map((v, i) => v / (v - x2[i]))));
}
{
  // σx propagada a y, con solución conocida: y = 2x exacto
  const x = [1, 2, 3, 4];
  const y = [2, 4, 6, 8];
  const f = fitWithXUncertainty(x, y, [0.1, 0.1, 0.1, 0.1], [0.3, 0.3, 0.3, 0.3]);
  close('σx propagada pendiente', f.coef[1], 2);
  close('σx propagada σ efectiva', f.sigma[0], Math.hypot(0.3, 0.2));
}
{
  throws('pocos puntos', () => fitPolynomial([1, 2], [1, 2], { degree: 1 }));
  throws('x repetidos', () => fitPolynomial([1, 1, 1, 1], [1, 2, 3, 4], { degree: 1 }));
  throws('σ cero', () => fitPolynomial([1, 2, 3], [1, 2, 3], { degree: 1, sigma: [0, 1, 1] }));
}

// ---------- El procedimiento que se muestra coincide con el ajuste ----------
{
  const r = ref.lineal;
  const f = fitPolynomial(r.x, r.y, { degree: 1 });
  const d = linearDetails(r.x, r.y);
  close('fórmulas pendiente', d.a, f.coef[1]);
  close('fórmulas ordenada', d.b, f.coef[0]);
  close('fórmulas s_m', d.ua, f.u[1]);
  close('fórmulas s_b', d.ub, f.u[0]);
  close('fórmulas r2', d.r2, f.r2);
}
{
  const r = ref.ponderado;
  const f = fitPolynomial(r.x, r.y, { degree: 1, sigma: r.e });
  const d = linearDetails(r.x, r.y, r.e);
  close('pesadas pendiente', d.a, f.coef[1]);
  close('pesadas ordenada', d.b, f.coef[0]);
  close('pesadas s_m', d.ua, f.u[1]);
  close('pesadas s_b', d.ub, f.u[0]);
  close('pesadas χ²', d.s2, f.residualVariance);
  close('pesadas r2', d.r2, f.r2);
}
{
  // α del apunte para la glucosa, y α·α⁻¹ = identidad
  const x = [1, 2, 3, 4, 5, 6, 7, 8];
  const y = [74, 54, 52, 51, 52, 53, 58, 71];
  const sigma = new Array(8).fill(1);
  const { alpha, beta } = normalMatrices(x, y, sigma, 2);
  close('glucosa α00', alpha[0][0], 8);
  close('glucosa α12', alpha[1][2], 1296);
  close('glucosa β0', beta[0], 465);
  close('glucosa β2', beta[2], 12168);
  const inverse = fitPolynomial(x, y, { degree: 2, sigma }).alphaInverse;
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      const product = alpha[i].reduce((sum, value, k) => sum + value * inverse[k][j], 0);
      close(`α·α⁻¹ ${i}${j}`, product, i === j ? 1 : 0, 1e-8);
    }
  }
}
{
  // Sustitución de valores en una fórmula
  const c = sym.compileFormula('M * R^2 / 2');
  const text = sym.nodeToTexWith(c.node, { M: 252.6, R: 6.35 }, String);
  equal('sustitución M', text.includes('252.6'), true);
  equal('sustitución R', text.includes('6.35'), true);
}

// ---------- Sesiones ----------
{
  const { createSessions } = await import('../js/sesiones.js');
  const fakeStorage = (initial = {}) => {
    const map = new Map(Object.entries(initial));
    return {
      map,
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => { map.set(key, value); },
      removeItem: (key) => { map.delete(key); },
    };
  };
  const defaults = { a: { x: '', on: false, vars: {} }, b: { y: '' } };

  // Los datos anteriores no se pierden al aparecer las sesiones
  const legacy = fakeStorage({ 'labdatos:a': JSON.stringify({ x: '1 2 3' }) });
  let s = createSessions(legacy, defaults);
  equal('migración conserva datos', s.getTool('a'), { x: '1 2 3' });
  equal('migración borra la clave vieja', legacy.map.has('labdatos:a'), false);
  equal('primera sesión', s.activeName, 'Sesión 1');

  const first = s.activeId;
  const second = s.create('Lab 3').id;
  equal('sesión nueva vacía', s.getTool('a'), null);
  s.setTool('a', { x: '9' });
  s.switchTo(first);
  equal('cambiar no pierde datos', s.getTool('a'), { x: '1 2 3' });
  s.switchTo(second);
  equal('volver recupera datos', s.getTool('a'), { x: '9' });

  s = createSessions(legacy, defaults);
  equal('reabrir conserva la activa', s.activeId, second);
  equal('reabrir conserva los datos', s.getTool('a'), { x: '9' });

  equal('nombres repetidos', s.create('Lab 3').name, 'Lab 3 (2)');
  s.rename(s.activeId, 'Lab 4');
  equal('renombrar', s.activeName, 'Lab 4');
  s.remove(s.activeId);
  equal('eliminar pasa a otra', s.list().length, 2);
  equal('eliminar no toca las otras', s.list().some((entry) => entry.id === first), true);

  // Exportar e importar
  s.switchTo(second);
  const text = s.exportText();
  const other = createSessions(fakeStorage(), defaults);
  const imported = other.importText(text);
  equal('importar nombre', imported.name, 'Lab 3');
  equal('importar activa', other.activeName, 'Lab 3');
  equal('importar datos', other.getTool('a'), { x: '9' });
  throws('archivo ajeno', () => other.importText('{"a":1}'));
  throws('archivo roto', () => other.importText('no es json'));

  // Un archivo con campos raros no entra al estado de la herramienta
  other.importText(JSON.stringify({ app: 'laboratorio-datos', name: 'x', tools: { a: { x: 5, on: true, vars: [], otro: '1' }, c: { z: 1 } } }));
  equal('importar filtra campos', other.getTool('a'), { on: true });
  equal('importar ignora herramientas desconocidas', other.getTool('c'), null);

  // Borrar todas deja una vacía
  const only = createSessions(fakeStorage(), defaults);
  only.remove(only.activeId);
  equal('siempre queda una sesión', only.list().length, 1);

  // Sin almacenamiento, funciona en memoria y avisa
  const broken = { getItem() { throw new Error(); }, setItem() { throw new Error(); }, removeItem() { throw new Error(); } };
  const memory = createSessions(broken, defaults);
  equal('sin almacenamiento avisa', memory.setTool('a', { x: '7' }), false);
  equal('sin almacenamiento conserva en memoria', memory.getTool('a'), { x: '7' });
  equal('sin almacenamiento marca el fallo', memory.saveFailed, true);
}

// ---------- Datos y formato ----------
equal('lista con coma decimal', parseNumbers('1,5 2,5\t3,5'), [1.5, 2.5, 3.5]);
equal('lista con punto y coma', parseNumbers('1.5, 2.5, 3.5'), [1.5, 2.5, 3.5]);
equal('lista pegada de Python', parseNumbers('np.array([1.0, 2.0, 3.0])'), [1, 2, 3]);
equal('lista sin espacios', parseNumbers('1.0,2.0,3.0'), [1, 2, 3]);
equal('enteros sin espacios', parseNumbers('1,2,3'), [1, 2, 3]);
equal('saltos de línea', parseNumbers('1\n2\r\n3\n'), [1, 2, 3]);
equal('notación científica', parseNumbers('1,5e-3 2E4'), [0.0015, 20000]);
equal('vacío', parseNumbers('  '), []);
throws('texto', () => parseNumbers('1 dos 3'));
equal('ν vacío', parseNu(''), Infinity);
equal('ν inf', parseNu('inf'), Infinity);
equal('ν número', parseNu('9'), 9);
throws('ν negativo', () => parseNu('-1'));
equal('escalar se repite', scalarOrList('0,1', 3), [0.1, 0.1, 0.1]);
throws('largo distinto', () => scalarOrList('1 2', 3));

// Ejemplos de redondeo del apunte (4/11, sección 2.6)
equal('redondeo 1', fmtMeasurement(46.023, 0.278, { unit: 'm/s' }), '(46.0 ± 0.3) m/s');
equal('redondeo 2', fmtMeasurement(127.46, 0.96), '(127 ± 1)');
equal('redondeo 3', fmtMeasurement(64251, 325, { unit: 'm' }), '(6.43 ± 0.03) × 10⁴ m');
equal('redondeo 4', fmtMeasurement(0.000123, 0.000004), '(1.23 ± 0.04) × 10⁻⁴');
equal('redondeo 5', fmtMeasurement(1234, 56), '(1230 ± 60)');
numberFormat.comma = true;
equal('coma decimal', fmtMeasurement(46.023, 0.278), '(46,0 ± 0,3)');
numberFormat.comma = false;
equal('fmt infinito', fmt(Infinity), '∞');

console.log(`${passed} pruebas correctas, ${failures.length} con error`);
for (const failure of failures) console.log(`  ✗ ${failure}`);
process.exit(failures.length ? 1 : 0);
