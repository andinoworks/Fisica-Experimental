# Laboratorio de Datos
nDirección: https://andinoworks.github.io/Fisica-Experimental/

Análisis de datos para Física Experimental II (FaMAF, UNC). Es una página estática: no necesita servidor ni instalación, y los cálculos se hacen en el dispositivo de quien la usa.

## Herramientas

| Herramienta | Reemplaza a | Qué hace |
|---|---|---|
| Propagación y Welch-Satterthwaite | `welch_2variables.py` (parte A) | Deriva la fórmula sola; da u_c, ν efectivo, k y U, con covarianzas |
| Ajuste lineal | `cuad_minimos.py`, `cuad_minimos_EXP.py` | Recta, residuos, R², test de ordenada |
| Ajuste ponderado | `ajuste_lineal_ponderado.py` | Recta con σ por punto; puede propagar σx (ec. 4.19) |
| Ajuste polinomial | `ajuste_polinomial.py` | Polinomio, matriz de covarianza, valor interpolado (ec. 3.16) |
| Linealizar y ajustar | Teórico 4/11, sección 4.6 | Transforma variables y propaga las σ (ec. 4.28) |
| Una muestra | Teórico 4/11, cap. 3 | Media, desvío, intervalo, histograma, comparación |
| Test F de varianzas | `test_f.py` | Homogeneidad de varianzas |
| Comparar valores | `welch_2variables.py` (parte B) | Test t contra referencia, entre resultados y entre muestras |
| Graficar funciones | `graficar_funciones.py` | Funciones, derivadas y puntos con barras de error |
| Distribuciones y tablas | Apéndices y 9/15, cap. 5 | t y F críticos, normal, binomial, Poisson, ν tipo B |

## Probarla en la computadora

Hace falta un servidor local porque usa módulos de JavaScript:

```
python -m http.server 8000
```

y abrir `http://localhost:8000`.

## Publicarla

En GitHub: Settings → Pages → Deploy from a branch → `main` y carpeta `/ (root)`. La carpeta `referencias/` no se sube (está en `.gitignore`).

## Pruebas

`node tests/run.mjs` compara el motor de cálculo contra numpy/scipy y contra los ejemplos resueltos de los apuntes. `tests/referencia.py` regenera los valores de referencia.

## Estructura

- `js/core/`: cálculo, sin interfaz (`stats`, `fit`, `symbolic`, `parse`, `format`).
- `js/tools/`: una herramienta por archivo.
- `js/ui/`: formularios, resultados y gráficos.
- `vendor/`: librerías incluidas; ver `vendor/LICENSES.md`.
