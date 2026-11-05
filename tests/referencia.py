"""Genera tests/referencia.json con los resultados de numpy/scipy.

Usa los mismos datos y las mismas fórmulas que los programas originales de Python,
para comparar la web contra ellos. Se corre con:  python tests/referencia.py
"""
import json
from pathlib import Path

import numpy as np
from scipy import stats


def linear_ols():  # cuad_minimos.py y cuad_minimos_EXP.py
    x = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
    y = np.array([2.1, 3.9, 6.2, 7.9, 10.1])
    coef, cov = np.polyfit(x, y, deg=1, cov=True)
    res = y - np.polyval(coef, x)
    k = stats.t.ppf(0.975, df=3)
    return dict(x=x.tolist(), y=y.tolist(), m=coef[0], b=coef[1], um=cov[0, 0] ** 0.5, ub=cov[1, 1] ** 0.5,
                cov=cov[0, 1], s2=np.sum(res**2) / 3, r2=1 - np.sum(res**2) / np.sum((y - y.mean()) ** 2), k=k)


def linear_weighted():  # ajuste_lineal_ponderado.py
    x = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
    y = np.array([2.1, 3.8, 6.5, 7.9, 9.8])
    e = np.array([0.1, 0.5, 1.2, 0.4, 0.1])
    coef, cov = np.polyfit(x, y, deg=1, w=1 / e, cov='unscaled')
    return dict(x=x.tolist(), y=y.tolist(), e=e.tolist(), m=coef[0], b=coef[1],
                um=cov[0, 0] ** 0.5, ub=cov[1, 1] ** 0.5, k=stats.t.ppf(0.975, df=3))


def polynomial():  # ajuste_polinomial.py
    x = np.array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0])
    y = np.array([2.1, 5.8, 12.2, 20.9, 32.5, 45.8, 62.1])
    out = dict(x=x.tolist(), y=y.tolist(), grados={})
    for deg in (2, 3):
        coef, cov = np.polyfit(x, y, deg=deg, cov=True)
        res = y - np.polyval(coef, x)
        out['grados'][deg] = dict(coef=coef[::-1].tolist(), u=np.sqrt(np.diag(cov))[::-1].tolist(),
                                  r2=1 - np.sum(res**2) / np.sum((y - y.mean()) ** 2),
                                  k=stats.t.ppf(0.975, df=len(x) - deg - 1))
    return out


def f_test():  # test_f.py
    a = np.array([2.1, 2.3, 2.2, 2.4, 2.2])
    b = np.array([1.5, 3.1, 2.2, 1.1, 3.5, 2.0, 1.8])
    va, vb = np.var(a, ddof=1), np.var(b, ddof=1)
    return dict(a=a.tolist(), b=b.tolist(), va=va, vb=vb, F=vb / va, Fcrit=stats.f.ppf(0.975, dfn=6, dfd=4))


def welch():  # welch_2variables.py, parte A
    x1 = np.array([301.0, 305.0, 298.0, 302.0, 300.0, 306.0, 299.0, 303.0, 301.0, 304.0])
    x2 = np.array([85.0, 87.0, 83.0, 86.0, 84.0, 88.0, 82.0, 87.0, 84.0, 86.0])
    n = len(x1)
    c = np.cov(x1, x2, ddof=1)
    v1, v2, cv = c[0, 0] / n, c[1, 1] / n, c[0, 1] / n
    m1, m2 = x1.mean(), x2.mean()
    c1, c2 = -m2 / (m1 - m2) ** 2, m1 / (m1 - m2) ** 2
    a, b = c1**2 * v1, c2**2 * v2
    uc2 = a + b + 2 * c1 * c2 * cv
    nu = int(np.floor(uc2**2 / (a**2 / 9 + b**2 / 9)))
    return dict(x1=x1.tolist(), x2=x2.tolist(), y=m1 / (m1 - m2), c1=c1, c2=c2, cov=cv, uc=uc2**0.5, nu=nu,
                k=stats.t.ppf(0.975, df=nu))


def welch_b():  # welch_2variables.py, parte B
    v1, u1, n1, v2, u2, n2 = 1.32, 0.02, 1251, 1.24, 0.02, 8
    nu = int(np.floor((u1**2 + u2**2) ** 2 / (u1**4 / n1 + u2**4 / n2)))
    ud = np.sqrt(u1**2 + u2**2)
    return dict(t=abs(v1 - v2) / ud, nu=nu, tcrit=stats.t.ppf(0.975, df=nu), teorico_t=abs(v1 - 1.4) / u1,
                teorico_crit=stats.t.ppf(0.975, df=n1))


def grillas():
    confs = [0.68, 0.9, 0.95, 0.99, 0.999]
    nus = [1, 2, 3, 5, 7, 10, 11, 30, 120, 1251]
    t = [[c, n, stats.t.ppf(1 - (1 - c) / 2, n)] for c in confs for n in nus]
    d = [1, 2, 4, 6, 9, 12, 30, 100]
    f = [[p, a, b, stats.f.ppf(p, a, b)] for p in (0.9, 0.95, 0.975, 0.99, 0.05) for a in d for b in d]
    return dict(t=t, f=f, z=[[p, stats.norm.ppf(p)] for p in (0.5, 0.9, 0.975, 0.995, 0.9999)])


data = dict(lineal=linear_ols(), ponderado=linear_weighted(), polinomio=polynomial(), f=f_test(),
            welch=welch(), welchB=welch_b(), grillas=grillas())


def plain(value):
    if isinstance(value, dict):
        return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [plain(v) for v in value]
    return value.item() if hasattr(value, 'item') else value


Path(__file__).with_name('referencia.json').write_text(json.dumps(plain(data), indent=1), encoding='utf-8')
print('referencia.json generado')
