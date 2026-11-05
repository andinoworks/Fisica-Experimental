// Lectura de los datos que escribe o pega el usuario.
// Acepta coma o punto decimal, y listas separadas por espacios, tabs, saltos de
// línea, punto y coma o comas: sirve pegar desde Excel, Python o el cuaderno.

function toNumber(token) {
  const clean = token.replace(/−/g, '-');
  const value = Number(clean);
  if (clean === '' || !Number.isFinite(value)) {
    throw new Error(`"${token}" no es un número.`);
  }
  return value;
}

function splitToken(token) {
  const trimmed = token.replace(/^,+|,+$/g, '');
  if (!trimmed) return [];
  if (!trimmed.includes(',')) return [trimmed];
  const commas = trimmed.split(',').length - 1;
  // "1,5" es un decimal. "1.0,2.0" y "1,2,3" son listas.
  if (commas === 1 && !trimmed.includes('.')) return [trimmed.replace(',', '.')];
  return trimmed.split(',');
}

export function parseNumbers(text) {
  const cleaned = String(text ?? '').replace(/np\.array|[\[\]()]/g, ' ');
  return cleaned.split(/[\s;]+/).flatMap(splitToken).map(toNumber);
}

// Un solo número. Devuelve null si el campo está vacío.
export function parseScalar(text) {
  const values = parseNumbers(text);
  if (values.length === 0) return null;
  if (values.length > 1) throw new Error(`Se esperaba un solo número y hay ${values.length}.`);
  return values[0];
}

// Grados de libertad: vacío, "inf" o "∞" significan infinito (tipo B bien conocida).
export function parseNu(text) {
  const raw = String(text ?? '').trim().toLowerCase();
  if (raw === '' || raw === 'inf' || raw === '∞' || raw === 'infinito') return Infinity;
  const value = parseScalar(raw);
  if (!(value > 0)) throw new Error('Los grados de libertad deben ser mayores que cero.');
  return value;
}

// Incertidumbres: un número vale para todos los puntos, o una lista con uno por punto.
export function scalarOrList(text, n, name = 'La incertidumbre') {
  const values = parseNumbers(text);
  if (values.length === 0) return null;
  if (values.length === 1) return new Array(n).fill(values[0]);
  if (values.length !== n) {
    throw new Error(`${name} tiene ${values.length} valores y hay ${n} puntos. Poné uno solo o uno por punto.`);
  }
  return values;
}
