// Navegación, memoria de los datos y ciclo de cálculo de cada herramienta.

import { h, createForm, note, plainText, tex } from './ui/dom.js';
import { numberFormat } from './core/format.js';
import { compileFormula, partialDerivative, symbolTex } from './core/symbolic.js';

import muestra from './tools/muestra.js';
import testF from './tools/test-f.js';
import comparar from './tools/comparar.js';
import propagacion from './tools/propagacion.js';
import { lineal, ponderado, polinomial } from './tools/ajustes.js';
import linealizar from './tools/linealizar.js';
import graficar from './tools/graficar.js';
import distribuciones from './tools/distribuciones.js';
import { mountTheory } from './teorico.js';
import { createSessions } from './sesiones.js';

const TOOLS = [propagacion, lineal, ponderado, polinomial, linealizar, muestra, testF, comparar, graficar, distribuciones];
const GROUPS = ['Incertidumbres', 'Ajustes', 'Muestras y comparación', 'Gráficos y tablas'];

const FORMAT_KEY = 'labdatos:formato';
const TOOL_DEFAULTS = Object.fromEntries(TOOLS.map((tool) => [tool.id, tool.defaults]));

let sessions;

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    // Algunos navegadores bloquean el acceso: safeStorage cae a memoria.
    return { getItem() { throw new Error(); }, setItem() { throw new Error(); }, removeItem() { throw new Error(); } };
  }
}

function loadFormat() {
  try {
    return JSON.parse(localStorage.getItem(FORMAT_KEY));
  } catch {
    return null;
  }
}

function saveFormat(value) {
  try {
    localStorage.setItem(FORMAT_KEY, JSON.stringify(value));
  } catch {
    // Sin almacenamiento se usa el formato por defecto la próxima vez.
  }
}

const clone = (value) => JSON.parse(JSON.stringify(value));

// ---------- Herramientas ----------

function mountTool(tool, main) {
  let state = { ...clone(tool.defaults), ...(sessions.getTool(tool.id) ?? {}) };
  let timer = null;
  let hooks = [];
  let form;

  const formBox = h('div', { class: 'form' });
  const results = h('div', { class: 'results', 'aria-live': 'polite' });

  function compute() {
    const height = results.offsetHeight;
    results.style.minHeight = `${height}px`;
    let nodes;
    try {
      nodes = tool.calc(state);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      console.debug(error);
      nodes = [note('error', error.message)];
    }
    if (!nodes || nodes.length === 0) {
      results.replaceChildren(h('p', { class: 'empty' }, tool.hint ?? 'Cargá los datos y el resultado aparece acá.'));
    } else {
      const copyButton = h('button', {
        type: 'button',
        class: 'quiet',
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(plainText(results));
            copyButton.textContent = 'Copiado';
          } catch {
            copyButton.textContent = 'No se pudo copiar';
          }
          setTimeout(() => { copyButton.textContent = 'Copiar resultados'; }, 1600);
        },
      }, 'Copiar resultados');
      results.replaceChildren(...nodes.filter(Boolean), h('div', { class: 'copy-row' }, copyButton));
      results.querySelectorAll('.plot').forEach((plot) => plot.draw?.());
    }
    results.style.minHeight = '';
  }

  function notify() {
    form.refresh();
    hooks.forEach((hook) => hook());
    sessions.setTool(tool.id, state);
    refreshSaveStatus();
    clearTimeout(timer);
    timer = setTimeout(compute, 220);
  }

  function rebuild() {
    hooks = [];
    form = createForm(state, notify);
    const ctx = {
      rebuild,
      recompute: notify,
      onChange: (hook) => hooks.push(hook),
    };
    formBox.replaceChildren(...[tool.form(form, state, ctx)].flat(Infinity).filter(Boolean));
    form.refresh();
    hooks.forEach((hook) => hook());
    clearTimeout(timer);
    compute();
  }

  const replaceState = (next) => {
    state = { ...clone(tool.defaults), ...clone(next) };
    sessions.setTool(tool.id, state);
    refreshSaveStatus();
    rebuild();
  };

  main.replaceChildren(
    h('header', { class: 'tool-head' },
      h('h1', {}, tool.title),
      h('p', {}, tool.description),
      tool.origin && h('p', { class: 'origin' }, tool.origin),
      h('div', { class: 'tool-actions' },
        (tool.examples ?? []).map((example) => h('button', {
          type: 'button',
          onClick: () => replaceState(example.state),
        }, example.label)),
        h('button', { type: 'button', class: 'quiet', onClick: () => replaceState({}) }, 'Vaciar'))),
    h('div', { class: `tool-grid${tool.wideForm ? ' wide-form' : ''}` }, formBox, h('div', { class: 'results-panel' }, results)),
  );
  rebuild();
  tool.onRecompute = compute;
  document.title = `${tool.title}: Laboratorio de Datos`;
}

// ---------- Inicio ----------

const LABS = [
  ['1. Termometría', 'Calibración del mercurio y la termocupla', [['ajuste-lineal', 'Ajuste lineal']], 'Termistor: ln(R/R₀) contra 1/T', [['linealizar', 'Linealizar']]],
  ['2. Viscosidad', 'η a partir de tiempos y densidades, con incertidumbre expandida', [['propagacion', 'Propagación']], 'Tiempos: media y desvío', [['muestra', 'Una muestra']]],
  ['3. Clément y Desormes', 'γ con la correlación entre h₁ y h₂', [['propagacion', 'Propagación']], 'γ por ajuste y comparación de ambos valores', [['ajuste-lineal', 'Ajuste lineal'], ['comparar', 'Comparar']]],
  ['4. Dilatación', 'Pendiente de ΔL contra ΔT', [['ajuste-lineal', 'Ajuste lineal']], 'α = m/L₀', [['propagacion', 'Propagación']]],
  ['5. Calorimetría', 'Equivalente en agua y calor específico', [['propagacion', 'Propagación']], 'Comparación con el valor tabulado', [['comparar', 'Comparar']]],
];

function mountHome(main) {
  const input = h('input', { type: 'text', value: 'gamma = x1 / (x1 - x2)', 'aria-label': 'Fórmula de prueba', autocomplete: 'off', spellcheck: false, autocapitalize: 'off' });
  const output = h('div', { class: 'math-list' });

  function refresh() {
    try {
      const compiled = compileFormula(input.value);
      const lhs = compiled.output ? symbolTex(compiled.output) : 'f';
      output.replaceChildren(...compiled.variables.map((name) => {
        const derivative = partialDerivative(compiled, name);
        return h('div', {}, tex(`\\dfrac{\\partial ${lhs}}{\\partial ${symbolTex(name)}} = ${derivative.tex ?? '\\text{(numérica)}'}`));
      }));
    } catch (error) {
      output.replaceChildren(note('error', error.message));
    }
  }
  input.addEventListener('input', refresh);

  const links = (items) => items.map(([id, text], i) => [i ? ', ' : '', h('a', { href: `#/${id}` }, text)]);

  main.replaceChildren(h('div', { class: 'home' },
    h('section', { class: 'home-hero', style: 'margin-top:0' },
      h('h1', {}, 'Laboratorio de Datos'),
      h('p', {}, 'Los análisis de Física Experimental II sin instalar nada y desde cualquier dispositivo. Escribís la fórmula y la web saca las derivadas parciales sola:'),
      h('div', { class: 'demo' },
        input,
        output,
        h('p', { style: 'margin-top:10px' }, h('a', {
          href: '#/propagacion',
          onClick: () => sessions.setTool('propagacion', { ...(sessions.getTool('propagacion') ?? {}), formula: input.value }),
        }, 'Calcular la incertidumbre de esta fórmula')))),
    h('section', {},
      h('h2', {}, 'Herramientas'),
      h('div', { class: 'tool-index' }, GROUPS.map((name) => h('div', {},
        h('h3', {}, name),
        TOOLS.filter((tool) => tool.group === name).map((tool) => h('a', { href: `#/${tool.id}` },
          h('strong', {}, tool.title),
          h('span', {}, tool.short))))))),
    h('section', {},
      h('h2', {}, 'Qué usar en cada laboratorio'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'labs' },
        h('thead', {}, h('tr', {}, ['Laboratorio', 'Para', 'Usá', 'Para', 'Usá'].map((text) => h('th', { scope: 'col' }, text)))),
        h('tbody', {}, LABS.map(([lab, a, la, b, lb]) => h('tr', {},
          h('td', {}, lab), h('td', {}, a), h('td', {}, links(la)), h('td', {}, b), h('td', {}, links(lb)))))))),
    h('section', {},
      h('h2', {}, 'Sesiones'),
      h('p', { style: 'max-width:74ch' }, 'Creá una sesión por experimento, por ejemplo "Lab 3 Clément". Todo lo que cargues se guarda solo en la sesión activa, y podés cambiar de una a otra sin perder datos. Las sesiones quedan en este navegador: para llevarlas a otro dispositivo o tener una copia, usá "Exportar".')),
    h('section', {},
      h('h2', {}, 'Cómo cargar los datos'),
      h('p', { style: 'max-width:74ch' }, 'Pegá las columnas desde Excel o Python: sirven espacios, tabulaciones, saltos de línea, punto y coma, coma decimal o punto decimal. Los cálculos se hacen en tu dispositivo: no se envía nada a ningún servidor.')),
  ));
  refresh();
  document.title = 'Laboratorio de Datos';
}

// ---------- Navegación ----------

// ---------- Sesiones ----------

let refreshSaveStatus = () => {};

function downloadText(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = h('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildSessionPanel(onSwitch) {
  const select = h('select', { id: 'sesion-actual', 'aria-label': 'Sesión actual' });
  const status = h('p', { class: 'session-status', role: 'status' });
  const chip = document.querySelector('.session-chip');
  let deleteTimer = null;

  const nameInput = h('input', { type: 'text', maxLength: 60, 'aria-label': 'Nombre de la sesión', autocomplete: 'off' });
  let nameAction = null;
  const nameForm = h('form', {
    class: 'session-name',
    hidden: true,
    onSubmit: (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();
      if (!name) return;
      const action = nameAction;
      nameForm.hidden = true;
      action(name);
    },
  }, nameInput, h('div', { class: 'session-buttons' },
    h('button', { type: 'submit' }, 'Guardar'),
    h('button', { type: 'button', class: 'quiet', onClick: () => { nameForm.hidden = true; } }, 'Cancelar')));

  function askName(initial, action) {
    nameAction = action;
    nameInput.value = initial;
    nameForm.hidden = false;
    nameInput.focus();
    nameInput.select();
  }

  function say(text, isError = false) {
    status.textContent = text;
    status.classList.toggle('bad', isError);
  }

  const idleStatus = () => (sessions.saveFailed
    ? 'Este navegador no deja guardar: exportá la sesión para no perder los datos.'
    : 'Se guarda sola en este navegador.');

  refreshSaveStatus = () => {
    if (sessions.saveFailed) say(idleStatus(), true);
  };

  function refresh() {
    select.replaceChildren(...sessions.list().map((entry) => h('option', { value: entry.id }, entry.name)));
    select.value = sessions.activeId;
    if (chip) chip.textContent = sessions.activeName;
    say(idleStatus(), sessions.saveFailed);
  }

  const changed = () => {
    refresh();
    onSwitch();
  };

  select.addEventListener('change', () => {
    sessions.switchTo(select.value);
    changed();
  });

  const deleteButton = h('button', {
    type: 'button',
    class: 'quiet',
    onClick: () => {
      if (!deleteTimer) {
        deleteButton.textContent = '¿Seguro? Eliminar';
        deleteTimer = setTimeout(() => {
          deleteTimer = null;
          deleteButton.textContent = 'Eliminar';
        }, 4000);
        return;
      }
      clearTimeout(deleteTimer);
      deleteTimer = null;
      deleteButton.textContent = 'Eliminar';
      const name = sessions.activeName;
      sessions.remove(sessions.activeId);
      changed();
      say(`Se eliminó "${name}".`);
    },
  }, 'Eliminar');

  const fileInput = h('input', {
    type: 'file',
    accept: '.json,application/json',
    hidden: true,
    onChange: async (event) => {
      const [file] = event.target.files;
      event.target.value = '';
      if (!file) return;
      try {
        const entry = sessions.importText(await file.text());
        changed();
        say(`Se importó "${entry.name}".`);
      } catch (error) {
        say(error.message, true);
      }
    },
  });

  refresh();

  return h('section', { class: 'session-panel' },
    h('label', { class: 'field-label', htmlFor: 'sesion-actual' }, 'Sesión'),
    select,
    h('div', { class: 'session-buttons' },
      h('button', {
        type: 'button',
        onClick: () => askName('', (name) => {
          sessions.create(name);
          changed();
        }),
      }, 'Nueva'),
      h('button', {
        type: 'button',
        class: 'quiet',
        onClick: () => askName(sessions.activeName, (name) => {
          sessions.rename(sessions.activeId, name);
          refresh();
        }),
      }, 'Renombrar'),
      deleteButton),
    nameForm,
    status,
    h('details', { class: 'session-more' },
      h('summary', {}, 'Pasar a otro dispositivo'),
      h('p', {}, 'Exportá la sesión a un archivo y abrilo con "Importar" en el otro dispositivo.'),
      h('div', { class: 'session-buttons' },
        h('button', {
          type: 'button',
          class: 'quiet',
          onClick: () => {
            const name = sessions.activeName.replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'sesion';
            downloadText(sessions.exportText(), `${name}.json`);
          },
        }, 'Exportar'),
        h('button', { type: 'button', class: 'quiet', onClick: () => fileInput.click() }, 'Importar'),
        fileInput)));
}

function buildNav(onFormatChange, onSessionChange) {
  const nav = document.getElementById('nav');
  const saved = loadFormat();
  if (saved) Object.assign(numberFormat, saved);
  const settings = { mode: numberFormat.mode, digits: String(numberFormat.digits), comma: numberFormat.comma, sig: String(numberFormat.sig) };
  const applyFormat = () => {
    numberFormat.mode = settings.mode;
    const digits = Number(settings.digits);
    numberFormat.digits = Number.isInteger(digits) && digits >= 0 && digits <= 15 ? digits : 5;
    numberFormat.comma = settings.comma;
    numberFormat.sig = Number(settings.sig);
    saveFormat({ ...numberFormat });
    onFormatChange();
  };
  const f = createForm(settings, applyFormat);

  nav.replaceChildren(
    h('a', { class: 'nav-brand', href: '#/' }, 'Laboratorio de Datos', h('small', {}, 'Física Experimental II')),
    buildSessionPanel(onSessionChange),
    ...GROUPS.map((name) => h('ul', { class: 'nav-group' },
      h('li', { class: 'nav-group-title' }, name),
      TOOLS.filter((tool) => tool.group === name).map((tool) => h('li', {}, h('a', { href: `#/${tool.id}`, 'data-tool': tool.id }, tool.title))))),
    h('details', { class: 'settings' },
      h('summary', {}, 'Formato de los números'),
      f.select('mode', { label: 'Notación', options: [['auto', 'Automática'], ['fixed', 'Decimales fijos'], ['sci', 'Científica']] }),
      f.text('digits', { label: 'Cifras', decimal: true }),
      f.select('sig', { label: 'Cifras de la incertidumbre en el informe', options: [['1', '1 cifra'], ['2', '2 cifras']] }),
      f.check('comma', { label: 'Mostrar con coma decimal' })),
    h('ul', { class: 'nav-group' },
      h('li', { class: 'nav-group-title' }, 'Consulta'),
      h('li', {}, h('a', { href: '#/teorico', 'data-tool': 'teorico' }, 'Teórico y tablas'))),
  );
}

function route() {
  const main = document.getElementById('main');
  const id = location.hash.replace(/^#\/?/, '');
  const tool = TOOLS.find((candidate) => candidate.id === id);
  if (tool) mountTool(tool, main);
  else if (id === 'teorico') mountTheory(main);
  else mountHome(main);

  document.querySelectorAll('.nav-group a').forEach((link) => {
    if (link.dataset.tool === id) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.getElementById('nav').classList.remove('open');
  document.querySelector('.menu-button').setAttribute('aria-expanded', 'false');
  window.scrollTo(0, 0);
  return tool;
}

window.addEventListener('DOMContentLoaded', () => {
  let current = null;
  sessions = createSessions(browserStorage(), TOOL_DEFAULTS);
  buildNav(() => current?.onRecompute?.(), () => { current = route(); });
  document.querySelector('.menu-button').addEventListener('click', (event) => {
    const open = document.getElementById('nav').classList.toggle('open');
    event.currentTarget.setAttribute('aria-expanded', String(open));
  });
  window.addEventListener('hashchange', () => { current = route(); });
  current = route();
});
