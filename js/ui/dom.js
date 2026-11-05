// Piezas de interfaz compartidas por todas las herramientas.

export function h(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (key === 'spellcheck') { element.setAttribute('spellcheck', String(value)); continue; }
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') element.className = value;
    else if (key === 'html') element.innerHTML = value;
    else if (key.startsWith('on')) element.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in element && key !== 'list') element[key] = value;
    else element.setAttribute(key, value === true ? '' : value);
  }
  element.append(...children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false));
  return element;
}

export function tex(source, display = false) {
  const span = h('span');
  globalThis.katex.render(`\\displaystyle ${source}`, span, { displayMode: display, throwOnError: false, strict: false });
  return span;
}

// ---------- Formularios enlazados a un objeto de estado ----------

export function createForm(state, notify) {
  const conditions = [];
  let counter = 0;
  const uid = () => `campo-${(counter += 1)}-${Math.random().toString(36).slice(2, 7)}`;

  function wrap(id, label, help, control) {
    return h('div', { class: 'field' },
      label && h('label', { htmlFor: id }, label),
      control,
      help && h('div', { class: 'help' }, help));
  }

  const form = {
    text(key, { label, help, placeholder, decimal = false, target = state } = {}) {
      const id = uid();
      const input = h('input', {
        id, type: 'text', value: target[key] ?? '', placeholder, autocomplete: 'off', spellcheck: false,
        autocapitalize: 'off', inputMode: decimal ? 'decimal' : undefined,
        onInput: (event) => { target[key] = event.target.value; notify(); },
      });
      return wrap(id, label, help, input);
    },
    area(key, { label, help, placeholder, rows = 3, target = state } = {}) {
      const id = uid();
      const input = h('textarea', {
        id, rows, value: target[key] ?? '', placeholder, autocomplete: 'off', spellcheck: false,
        autocapitalize: 'off',
        onInput: (event) => { target[key] = event.target.value; notify(); },
      });
      return wrap(id, label, help, input);
    },
    select(key, { label, help, options, target = state, onChange } = {}) {
      const id = uid();
      const input = h('select', {
        id,
        onChange: (event) => { target[key] = event.target.value; onChange?.(event.target.value); notify(); },
      }, options.map(([value, text]) => h('option', { value }, text)));
      input.value = target[key];
      return wrap(id, label, help, input);
    },
    check(key, { label, help, target = state } = {}) {
      return h('div', { class: 'field' },
        h('label', { class: 'check' },
          h('input', {
            type: 'checkbox', checked: Boolean(target[key]),
            onChange: (event) => { target[key] = event.target.checked; notify(); },
          }),
          h('span', {}, label)),
        help && h('div', { class: 'help' }, help));
    },
    confidence(key = 'confidence', label = 'Nivel de confianza (%)') {
      return form.text(key, { label, decimal: true, placeholder: '95' });
    },
    // Muestra los nodos solo cuando la condición se cumple.
    when(condition, ...nodes) {
      const box = h('div', { style: 'display:contents' }, nodes);
      conditions.push(() => { box.hidden = !condition(); box.style.display = box.hidden ? 'none' : 'contents'; });
      return box;
    },
    refresh() { conditions.forEach((apply) => apply()); },
  };
  return form;
}

export const row = (...nodes) => h('div', { class: 'row' }, nodes);
export const group = (title, ...nodes) => h('div', { class: 'group' }, title && h('h3', {}, title), nodes);

// ---------- Bloques de resultados ----------

const ICONS = {
  info: '<circle cx="9" cy="9" r="7.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 8v5M9 5v1" stroke="currentColor" stroke-width="1.7"/>',
  warn: '<path d="M9 2 17 16H1Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 7v4M9 13v1.2" stroke="currentColor" stroke-width="1.7"/>',
  error: '<circle cx="9" cy="9" r="7.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m6 6 6 6m0-6-6 6" stroke="currentColor" stroke-width="1.7"/>',
  ok: '<circle cx="9" cy="9" r="7.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m5.5 9.2 2.4 2.4 4.6-5" fill="none" stroke="currentColor" stroke-width="1.7"/>',
};

export function note(kind, ...content) {
  const icon = h('span', { html: `<svg viewBox="0 0 18 18" aria-hidden="true">${ICONS[kind] ?? ICONS.info}</svg>`, style: 'display:contents' });
  return h('div', { class: `note ${kind}`, role: kind === 'error' ? 'alert' : undefined }, icon, h('div', {}, content));
}

export function verdict(compatible, title, detail) {
  return note(compatible ? 'ok' : 'warn', h('strong', {}, title), detail ? h('div', {}, detail) : null);
}

export function card(title, ...content) {
  return h('section', { class: 'card' }, title && h('h2', {}, title), content);
}

export function answer(entries) {
  return h('section', { class: 'card answer' }, entries.flatMap(({ label, value, detail }) => [
    h('div', { class: 'label' }, label),
    h('div', { class: 'value' }, value),
    detail && h('div', { class: 'detail' }, detail),
  ]));
}

export function table(headers, rows, className) {
  return h('div', { class: 'table-wrap' },
    h('table', { class: className },
      headers && h('thead', {}, h('tr', {}, headers.map((text) => h('th', { scope: 'col' }, text)))),
      h('tbody', {}, rows.map((cells) => h('tr', {}, cells.map((cell) => h('td', {}, cell)))))));
}

export const keyValues = (rows) => table(null, rows, 'kv');

export function more(title, ...content) {
  return h('details', { class: 'more' }, h('summary', {}, title), content);
}

// Texto plano de los resultados, para pegar en el informe o en una planilla.
export function plainText(root) {
  const copy = root.cloneNode(true);
  copy.querySelectorAll('.plot, .copy-row, details:not([open]) > :not(summary)').forEach((node) => node.remove());
  copy.querySelectorAll('.katex').forEach((node) => {
    const source = node.querySelector('annotation');
    node.replaceWith(source ? source.textContent.replace('\\displaystyle ', '') : node.textContent);
    node.remove();
  });
  copy.style.position = 'absolute';
  copy.style.left = '-9999px';
  document.body.append(copy);
  const text = copy.innerText.replace(/\n{3,}/g, '\n\n').trim();
  copy.remove();
  return text;
}
