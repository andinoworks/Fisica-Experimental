// Sesiones de trabajo: cada una guarda los datos de todas las herramientas.
// Viven en el navegador; para pasarlas a otro dispositivo se exportan a un archivo.

const PREFIX = 'labdatos:';
const REGISTRY = `${PREFIX}sesiones`;
const sessionKey = (id) => `${PREFIX}s:${id}`;
const FILE_APP = 'laboratorio-datos';
const MAX_NAME = 60;

// Si el navegador no deja guardar (ventana privada, sin espacio), se trabaja en memoria
// para que la página siga funcionando, y se avisa.
function safeStorage(storage) {
  const memory = new Map();
  let failed = false;
  return {
    get(key) {
      if (memory.has(key)) return memory.get(key);
      try {
        return storage.getItem(key);
      } catch {
        failed = true;
        return null;
      }
    },
    set(key, value) {
      try {
        storage.setItem(key, value);
        memory.delete(key);
        failed = false;
        return true;
      } catch {
        memory.set(key, value);
        failed = true;
        return false;
      }
    },
    remove(key) {
      memory.delete(key);
      try {
        storage.removeItem(key);
      } catch {
        failed = true;
      }
    },
    get failed() { return failed; },
  };
}

function parseObject(text) {
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// Solo se aceptan los campos que la herramienta conoce y con el mismo tipo de dato.
function cleanToolState(state, defaults) {
  const clean = {};
  if (!state || typeof state !== 'object') return clean;
  for (const [key, fallback] of Object.entries(defaults)) {
    const value = state[key];
    if (typeof value !== typeof fallback) continue;
    if (typeof value === 'object' && (value === null || Array.isArray(value))) continue;
    clean[key] = value;
  }
  return clean;
}

export function createSessions(storage, toolDefaults) {
  const store = safeStorage(storage);
  const toolIds = Object.keys(toolDefaults);

  function readRegistry() {
    const registry = parseObject(store.get(REGISTRY));
    if (!registry || !Array.isArray(registry.list) || registry.list.length === 0) return null;
    return registry;
  }

  function writeRegistry(registry) {
    return store.set(REGISTRY, JSON.stringify(registry));
  }

  function uniqueName(requested, list, ignoreId) {
    const base = String(requested ?? '').trim().slice(0, MAX_NAME) || 'Sesión';
    const taken = new Set(list.filter((entry) => entry.id !== ignoreId).map((entry) => entry.name));
    if (!taken.has(base)) return base;
    let count = 2;
    while (taken.has(`${base} (${count})`)) count += 1;
    return `${base} (${count})`;
  }

  // Primera vez: los datos de antes de que existieran las sesiones pasan a "Sesión 1".
  function initialize() {
    const id = newId();
    const data = {};
    for (const tool of toolIds) {
      const previous = parseObject(store.get(PREFIX + tool));
      if (previous) data[tool] = previous;
    }
    store.set(sessionKey(id), JSON.stringify(data));
    const registry = { active: id, list: [{ id, name: 'Sesión 1' }] };
    writeRegistry(registry);
    for (const tool of toolIds) store.remove(PREFIX + tool);
    return registry;
  }

  let registry = readRegistry() ?? initialize();
  if (!registry.list.some((entry) => entry.id === registry.active)) {
    registry.active = registry.list[0].id;
    writeRegistry(registry);
  }

  const readSession = (id) => parseObject(store.get(sessionKey(id))) ?? {};

  function create(name, data = {}) {
    registry = readRegistry() ?? registry;
    const id = newId();
    const entry = { id, name: uniqueName(name, registry.list) };
    store.set(sessionKey(id), JSON.stringify(data));
    registry.list.push(entry);
    registry.active = id;
    writeRegistry(registry);
    return entry;
  }

  return {
    list: () => registry.list.map((entry) => ({ ...entry })),
    get activeId() { return registry.active; },
    get activeName() { return registry.list.find((entry) => entry.id === registry.active)?.name ?? ''; },
    get saveFailed() { return store.failed; },

    getTool: (tool) => readSession(registry.active)[tool] ?? null,
    setTool(tool, state) {
      const data = readSession(registry.active);
      data[tool] = state;
      return store.set(sessionKey(registry.active), JSON.stringify(data));
    },

    create,
    switchTo(id) {
      if (!registry.list.some((entry) => entry.id === id)) return false;
      registry.active = id;
      writeRegistry(registry);
      return true;
    },
    rename(id, name) {
      const entry = registry.list.find((candidate) => candidate.id === id);
      if (!entry || !String(name ?? '').trim()) return false;
      entry.name = uniqueName(name, registry.list, id);
      writeRegistry(registry);
      return true;
    },
    // Nunca queda sin sesiones: al borrar la última se crea una vacía.
    remove(id) {
      if (!registry.list.some((entry) => entry.id === id)) return false;
      store.remove(sessionKey(id));
      registry.list = registry.list.filter((entry) => entry.id !== id);
      if (registry.list.length === 0) {
        const fresh = newId();
        store.set(sessionKey(fresh), '{}');
        registry.list = [{ id: fresh, name: 'Sesión 1' }];
        registry.active = fresh;
      } else if (registry.active === id) {
        registry.active = registry.list[0].id;
      }
      writeRegistry(registry);
      return true;
    },

    exportText(id = registry.active) {
      const entry = registry.list.find((candidate) => candidate.id === id);
      return JSON.stringify({ app: FILE_APP, version: 1, name: entry?.name ?? 'Sesión', tools: readSession(id) }, null, 1);
    },
    importText(text) {
      const file = parseObject(text);
      if (!file || file.app !== FILE_APP || !file.tools || typeof file.tools !== 'object') {
        throw new Error('Ese archivo no es una sesión de Laboratorio de Datos.');
      }
      const data = {};
      for (const tool of toolIds) {
        if (file.tools[tool]) data[tool] = cleanToolState(file.tools[tool], toolDefaults[tool]);
      }
      return create(file.name, data);
    },
  };
}
