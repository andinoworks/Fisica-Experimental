// Gráficos con Plotly. Siempre sobre fondo blanco: es lo que se pega en el informe.

import { h } from './dom.js';
import { numberFormat } from '../core/format.js';

// Paleta categórica validada (dataviz, modo claro), en orden fijo.
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
export const INK = '#0b0b0b';
const TEXT = '#3d3c39';
const GRID = '#e7e6e1';
const AXIS = '#8d8c86';

function axis(extra = {}) {
  const { title, ...rest } = extra;
  return {
    title: title ? { text: title, font: { size: 14, color: TEXT } } : undefined,
    gridcolor: GRID,
    griddash: 'dot',
    zerolinecolor: AXIS,
    linecolor: AXIS,
    showline: true,
    mirror: false,
    ticks: 'outside',
    tickcolor: AXIS,
    tickfont: { size: 12, color: TEXT },
    automargin: true,
    exponentformat: 'power',
    ...rest,
  };
}

function baseLayout({ title, x, y, legend = true }) {
  return {
    title: title ? { text: title, font: { size: 16, color: TEXT }, x: 0.02, xanchor: 'left' } : undefined,
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: { family: "'IBM Plex Sans', system-ui, sans-serif", color: TEXT },
    separators: numberFormat.comma ? ',.' : '.,',
    margin: { l: 64, r: 20, t: title ? 96 : 68, b: 56 },
    xaxis: axis(x),
    yaxis: axis(y),
    showlegend: legend,
    legend: { orientation: 'h', x: 0, y: 1.02, yanchor: 'bottom', font: { size: 12 } },
    hovermode: 'closest',
    hoverlabel: { bgcolor: '#ffffff', bordercolor: AXIS, font: { color: TEXT } },
    dragmode: matchMedia('(pointer: coarse)').matches ? false : 'zoom',
  };
}

const CONFIG = (filename) => ({
  responsive: true,
  displaylogo: false,
  scrollZoom: false,
  locale: 'es',
  modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'],
  toImageButtonOptions: { format: 'png', scale: 3, filename },
});

export function plotBlock(traces, layout, { filename = 'grafico', tall = false } = {}) {
  const element = h('div', { class: tall ? 'plot tall' : 'plot', role: 'img', 'aria-label': layout.title?.text ?? 'Gráfico' });
  element.draw = () => globalThis.Plotly.newPlot(element, traces, layout, CONFIG(filename));
  return element;
}

export function chart(traces, options, block = {}) {
  return plotBlock(traces, baseLayout(options), block);
}

export function dataTrace(x, y, { ex, ey, name = 'Datos', color = INK, xaxis, yaxis } = {}) {
  const bars = (values) => (values && values.some((v) => v > 0)
    ? { type: 'data', array: values, visible: true, color, thickness: 1.3, width: 3 }
    : undefined);
  return {
    x, y, name, xaxis, yaxis,
    type: 'scatter',
    mode: 'markers',
    marker: { color, size: 8, line: { color: '#ffffff', width: 1.5 } },
    error_x: bars(ex),
    error_y: bars(ey),
  };
}

export function lineTrace(x, y, { name, color = SERIES[0], dash = 'solid', showlegend = true } = {}) {
  return { x, y, name, type: 'scatter', mode: 'lines', showlegend, line: { color, width: 2, dash }, connectgaps: false };
}

export function linspace(a, b, n = 300) {
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}

export function logspace(a, b, n = 300) {
  return linspace(Math.log10(a), Math.log10(b), n).map((v) => 10 ** v);
}

// Datos y curva arriba, residuos abajo: el doble panel de los programas originales.
export function fitChart({ x, y, ex, ey, curve, residuals, residualBars, labelX, labelY, title, filename, logX, logY }) {
  const span = Math.max(...x) - Math.min(...x) || 1;
  const margin = span * 0.05;
  let grid;
  if (logX) grid = logspace(Math.min(...x) * 0.9, Math.max(...x) * 1.1);
  else grid = linspace(Math.min(...x) - margin, Math.max(...x) + margin);

  const traces = [
    lineTrace(grid, grid.map(curve.at), { name: curve.name }),
    dataTrace(x, y, { ex, ey, name: 'Datos' }),
    dataTrace(x, residuals, { ey: residualBars, name: 'Residuos', color: INK, xaxis: 'x2', yaxis: 'y2' }),
  ];
  traces[2].showlegend = false;

  const layout = baseLayout({ title, x: { showticklabels: false, type: logX ? 'log' : 'linear', ticks: '' }, y: { title: labelY, domain: [0.34, 1], type: logY ? 'log' : 'linear' } });
  layout.xaxis2 = axis({ title: labelX, anchor: 'y2', matches: 'x', type: logX ? 'log' : 'linear' });
  layout.yaxis2 = axis({ title: 'Residuos', domain: [0, 0.25], anchor: 'x2', zeroline: true, zerolinecolor: '#e34948', zerolinewidth: 1.5 });
  layout.xaxis.anchor = 'y';
  layout.margin.b = 56;
  return plotBlock(traces, layout, { filename, tall: true });
}
