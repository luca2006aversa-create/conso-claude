// Graphiques du hub, dessinés en SVG sans bibliothèque. Chaque fonction renvoie une chaîne HTML.
// Les couleurs sont des noms de variables CSS (« vert », « accent »…), pour suivre le thème clair ou sombre.
'use strict';

const G = window.G = (() => {
  const V = (c) => `var(--${c})`;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const chemin = (pts) => 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L');
  const nb = (x, d = 0) => Number(x || 0).toLocaleString('fr-FR', { maximumFractionDigits: d });
  const eur = (x) => `${nb(Math.round(x))} €`;
  // 12 300 000 -> « 12,3 M » ; 4 500 -> « 4,5 k »
  const court = (x) => (x >= 1e9 ? `${nb(x / 1e9, 1)} Md` : x >= 1e6 ? `${nb(x / 1e6, 1)} M` : x >= 1e4 ? `${nb(x / 1e3, 0)} k` : x >= 1e3 ? `${nb(x / 1e3, 1)} k` : nb(x));
  const max = (v) => v.reduce((a, b) => Math.max(a, b), 0);
  // Haut d'échelle « rond » (4, 8, 20, 500…) pour que les quatre graduations tombent juste.
  const joli = (x) => { if (!(x > 0)) return 4; const p = 10 ** Math.floor(Math.log10(x)); return [1, 2, 4, 5, 8, 10].map((k) => k * p).find((k) => k >= x) < 4 ? 4 : [1, 2, 4, 5, 8, 10].map((k) => k * p).find((k) => k >= x); };

  /* Petit trait de tendance sous un chiffre. */
  function trait(v, c = 'accent', w = 120, h = 32) {
    if (!v.length) return '';
    if (v.length === 1) v = [v[0], v[0]];
    const M = Math.max(...v), m = Math.min(...v), e = M - m || 1;
    const pts = v.map((x, i) => [i / (v.length - 1) * w, h - 3 - (x - m) / e * (h - 6)]);
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none"><path d="${chemin(pts)}L${w} ${h}L0 ${h}Z" fill="${V(c)}" opacity=".13"/><path d="${chemin(pts)}" fill="none" stroke="${V(c)}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
  }

  /* Courbes : series = [{ v, c, aire, pointille (indice où le trait devient pointillé), nom }], marques = [{ i, t, c, s }]. */
  function courbes(series, { w = 640, h = 230, x = [], unite = '', marques = [], zero = false, format = nb } = {}) {
    const g = { l: 46, r: 12, t: 14, b: 22 }, n = Math.max(2, ...series.map((s) => s.v.length));
    const toutes = series.flatMap((s) => s.v);
    const M = joli(max(toutes) * 1.04), m = zero ? Math.min(0, ...toutes) : 0;
    const X = (i) => g.l + i / (n - 1) * (w - g.l - g.r), Y = (y) => g.t + (1 - (y - m) / (M - m)) * (h - g.t - g.b);
    let o = `<svg viewBox="0 0 ${w} ${h}" width="100%">`;
    for (let k = 0; k <= 4; k++) {
      const y = m + (M - m) * k / 4;
      o += `<line x1="${g.l}" x2="${w - g.r}" y1="${Y(y)}" y2="${Y(y)}" stroke="${V('trait')}"/><text x="${g.l - 6}" y="${Y(y) + 3}" text-anchor="end">${format(Math.round(y))}${unite}</text>`;
    }
    if (m < 0) o += `<line x1="${g.l}" x2="${w - g.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="${V('encre-3')}"/>`;
    const pas = Math.ceil(n / 8);
    x.forEach((t, i) => { if (i % pas === 0) o += `<text x="${X(i)}" y="${h - 6}" text-anchor="middle">${esc(t)}</text>`; });
    for (const s of series) {
      if (!s.v.length) continue;
      const pts = s.v.map((y, i) => [X(i), Y(y)]), d = s.pointille ?? pts.length;
      const bas = Y(Math.max(m, 0));
      if (s.aire) o += `<path d="${chemin(pts)}L${X(s.v.length - 1)} ${bas}L${X(0)} ${bas}Z" fill="${V(s.c)}" opacity=".14"/>`;
      if (d > 0) o += `<path d="${chemin(pts.slice(0, d + 1))}" fill="none" stroke="${V(s.c)}" stroke-width="2.4" stroke-linejoin="round"><title>${esc(s.nom || '')}</title></path>`;
      if (d < pts.length - 1) o += `<path d="${chemin(pts.slice(Math.max(0, d)))}" fill="none" stroke="${V(s.c)}" stroke-width="2.4" stroke-dasharray="5 5"/>`;
    }
    for (const k of marques) {
      const s = series[k.s || 0]; if (!s || s.v[k.i] === undefined) continue;
      const droite = k.i > n * .7;
      o += `<line x1="${X(k.i)}" x2="${X(k.i)}" y1="${g.t}" y2="${h - g.b}" stroke="${V(k.c || 'encre-3')}" stroke-dasharray="3 4"/><circle cx="${X(k.i)}" cy="${Y(s.v[k.i])}" r="5" fill="${V('surface')}" stroke="${V(k.c || 'encre')}" stroke-width="2.5"/><text class="f" x="${X(k.i) + (droite ? -8 : 8)}" y="${g.t + 9 + (k.dy || 0)}" text-anchor="${droite ? 'end' : 'start'}">${esc(k.t)}</text>`;
    }
    return o + '</svg>';
  }

  /* Aires empilées : series = [{ nom, c, v }]. */
  function empile(series, { w = 640, h = 230, x = [] } = {}) {
    const g = { l: 46, r: 12, t: 12, b: 22 }, n = Math.max(2, series[0]?.v.length || 2);
    const cumul = Array(n).fill(0), tot = Array.from({ length: n }, (_, i) => series.reduce((a, s) => a + (s.v[i] || 0), 0)), M = (max(tot) * 1.08) || 1;
    const X = (i) => g.l + i / (n - 1) * (w - g.l - g.r), Y = (y) => g.t + (1 - y / M) * (h - g.t - g.b);
    let o = `<svg viewBox="0 0 ${w} ${h}" width="100%">`;
    for (let k = 0; k <= 4; k++) o += `<line x1="${g.l}" x2="${w - g.r}" y1="${Y(M * k / 4)}" y2="${Y(M * k / 4)}" stroke="${V('trait')}"/><text x="${g.l - 6}" y="${Y(M * k / 4) + 3}" text-anchor="end">${nb(Math.round(M * k / 4))}</text>`;
    for (const s of series) {
      const bas = cumul.map((y, i) => [X(i), Y(y)]); s.v.forEach((y, i) => { cumul[i] += y || 0; });
      const haut = cumul.map((y, i) => [X(i), Y(y)]);
      o += `<path d="${chemin(haut)}L${chemin(bas.reverse()).slice(1)}Z" fill="${V(s.c)}" opacity=".8"><title>${esc(s.nom)}</title></path>`;
    }
    const pas = Math.ceil(n / 8); x.forEach((t, i) => { if (i % pas === 0) o += `<text x="${X(i)}" y="${h - 6}" text-anchor="middle">${esc(t)}</text>`; });
    return o + '</svg>';
  }

  /* Barres verticales empilées : series = [{ nom, c, v }], x = libellés. */
  function barres(series, { w = 640, h = 200, x = [], unite = '' } = {}) {
    const n = series[0]?.v.length || 0; if (!n) return '';
    const tot = Array.from({ length: n }, (_, i) => series.reduce((a, s) => a + (s.v[i] || 0), 0)), M = max(tot) || 1;
    const g = { l: 34, b: 20, t: 8 }, lb = (w - g.l - 6) / n; let o = `<svg viewBox="0 0 ${w} ${h}" width="100%">`;
    for (let k = 0; k <= 2; k++) { const y = g.t + (1 - k / 2) * (h - g.t - g.b); o += `<line x1="${g.l}" x2="${w}" y1="${y}" y2="${y}" stroke="${V('trait')}"/><text x="${g.l - 5}" y="${y + 3}" text-anchor="end">${court(M * k / 2)}</text>`; }
    const pas = Math.ceil(n / 10);
    for (let i = 0; i < n; i++) {
      let y = h - g.b;
      for (const s of series) { const hh = (s.v[i] || 0) / M * (h - g.t - g.b); if (hh <= 0) continue; y -= hh; o += `<rect x="${g.l + i * lb + Math.min(2, lb * .15)}" y="${y}" width="${Math.max(1, lb - Math.min(4, lb * .3))}" height="${hh}" fill="${V(s.c)}" rx="${Math.min(2, lb / 4)}"><title>${esc(x[i] ?? '')} · ${esc(s.nom)} : ${court(s.v[i])}${unite}</title></rect>`; }
      if (x[i] !== undefined && i % pas === 0) o += `<text x="${g.l + i * lb + lb / 2}" y="${h - 6}" text-anchor="middle">${esc(x[i])}</text>`;
    }
    return o + '</svg>';
  }

  /* Anneau à parts : parts = [{ nom, v, c }]. */
  function donut(parts, centre = '', sous = '', t = 170) {
    const tot = parts.reduce((a, p) => a + p.v, 0), r = 62, c = 2 * Math.PI * r; let a = 0;
    let o = `<svg viewBox="0 0 170 170" width="${t}" style="margin:auto">`;
    if (!tot) o += `<circle cx="85" cy="85" r="${r}" fill="none" stroke="${V('trait')}" stroke-width="24" stroke-dasharray="4 6"/>`;
    for (const p of parts) { if (!p.v) continue; const l = p.v / tot * c; o += `<circle cx="85" cy="85" r="${r}" fill="none" stroke="${V(p.c)}" stroke-width="24" stroke-dasharray="${Math.max(0, l - 2)} ${c}" stroke-dashoffset="${-a}" transform="rotate(-90 85 85)"><title>${esc(p.nom)} : ${nb(p.v, 1)}</title></circle>`; a += l; }
    return o + `<text class="f" x="85" y="86" text-anchor="middle" style="font-size:22px">${esc(centre)}</text><text x="85" y="103" text-anchor="middle">${esc(sous)}</text></svg>`;
  }

  /* Jauge ronde : pct de 0 à 100. */
  function anneau(pct, c, nom, txt) {
    const r = 30, l = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct || 0));
    return `<div><svg viewBox="0 0 80 80" width="84" style="margin:auto"><circle cx="40" cy="40" r="${r}" fill="none" stroke="${V('trait')}" stroke-width="9"/><circle cx="40" cy="40" r="${r}" fill="none" stroke="${V(c)}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${p / 100 * l} ${l}" transform="rotate(-90 40 40)"/><text class="f" x="40" y="45" text-anchor="middle" style="font-size:15px">${esc(txt ?? `${Math.round(p)} %`)}</text></svg>${esc(nom)}</div>`;
  }

  /* Carte de chaleur : m = lignes de nombres. */
  function chaleur(m, c, { lignes = [], cols = [], cw = 18, ch = 18, titre = (v) => nb(v, 1) } = {}) {
    const M = max(m.flat()) || 1, gl = lignes.length ? 34 : 0, w = gl + (m[0]?.length || 0) * cw, h = m.length * ch + (cols.length ? 16 : 0);
    let o = `<svg viewBox="0 0 ${w} ${h}" width="100%">`;
    m.forEach((l, j) => {
      if (lignes[j]) o += `<text x="${gl - 6}" y="${j * ch + ch * .68}" text-anchor="end">${esc(lignes[j])}</text>`;
      l.forEach((v, i) => { o += `<rect x="${gl + i * cw + 1}" y="${j * ch + 1}" width="${cw - 2}" height="${ch - 2}" rx="3" fill="${v ? V(c) : V('trait')}" opacity="${v ? .18 + .82 * v / M : .5}"><title>${esc(titre(v, j, i))}</title></rect>`; });
    });
    cols.forEach((t, i) => { if (t) o += `<text x="${gl + i * cw + cw / 2}" y="${h - 3}" text-anchor="middle">${esc(t)}</text>`; });
    return o + '</svg>';
  }

  /* Entonnoir : et = [{ nom, v, c }]. */
  function entonnoir(et, { h = 190 } = {}) {
    const w = 640, l = w / et.length, M = Math.sqrt(Math.max(1, et[0]?.v || 1)), haut = h - 70; let o = `<svg viewBox="0 0 ${w} ${h}" width="100%">`;
    const ep = (v) => Math.sqrt(v) / M * haut + 16;
    et.forEach((e, i) => {
      const a = ep(e.v), b = et[i + 1] ? ep(et[i + 1].v) : a, cy = (h - 44) / 2 + 4;
      o += `<path d="M${i * l + 2} ${cy - a / 2}L${(i + 1) * l - 2} ${cy - b / 2}L${(i + 1) * l - 2} ${cy + b / 2}L${i * l + 2} ${cy + a / 2}Z" fill="${V(e.c)}" opacity=".88"/><text class="f" x="${i * l + l / 2}" y="${cy + 6}" text-anchor="middle" style="font-size:17px;fill:#fff;paint-order:stroke;stroke:rgba(0,0,0,.25);stroke-width:2px">${nb(e.v)}</text><text class="f" x="${i * l + l / 2}" y="${h - 22}" text-anchor="middle">${esc(e.nom)}</text>`;
      if (et[i + 1] && e.v) o += `<text x="${(i + 1) * l}" y="${h - 6}" text-anchor="middle">${Math.round(et[i + 1].v / e.v * 100)} % ›</text>`;
    });
    return o + '</svg>';
  }

  /* Cascade : it = [{ nom, v (négatif = retrait), c, total }]. */
  function cascade(it, { h = 220, unite = eur } = {}) {
    const w = 640, l = (w - 20) / it.length, M = Math.max(1, it[0]?.v || 1); let cumul = 0, o = `<svg viewBox="0 0 ${w} ${h}" width="100%">`;
    const Y = (y) => 18 + (1 - y / M) * (h - 58);
    it.forEach((e, i) => {
      const fin = e.total, haut = fin ? cumul : Math.max(cumul, cumul + e.v), bas = fin ? 0 : Math.min(cumul, cumul + e.v);
      o += `<rect x="${10 + i * l + 6}" y="${Y(Math.max(haut, 0))}" width="${l - 12}" height="${Math.max(2, Y(Math.max(bas, 0)) - Y(Math.max(haut, 0)))}" rx="4" fill="${V(e.c)}"/><text class="f" x="${10 + i * l + l / 2}" y="${Y(Math.max(haut, 0)) - 5}" text-anchor="middle">${fin ? unite(cumul) : (e.v > 0 ? '' : '− ') + unite(Math.abs(e.v))}</text><text x="${10 + i * l + l / 2}" y="${h - 22}" text-anchor="middle">${esc(e.nom)}</text>`;
      if (!fin) cumul += e.v;
    });
    return o + '</svg>';
  }

  /* Bande de jours : couleurs = liste de noms de couleur (ou null = pas de relevé). */
  function bande(couleurs, titres = []) {
    const n = couleurs.length;
    let o = `<svg viewBox="0 0 ${n * 7} 34" width="100%" height="34" preserveAspectRatio="none">`;
    couleurs.forEach((c, i) => { o += `<rect x="${i * 7}" y="0" width="5" height="34" rx="2" fill="${V(c || 'trait')}"><title>${esc(titres[i] || '')}</title></rect>`; });
    return o + '</svg>';
  }

  /* Nuage de points : pts = [{ x, y, r, c, nom }]. log = échelles logarithmiques (tailles de 1 à 100 000). */
  function nuage(pts, { w = 640, h = 240, xn = '', yn = '', log = false } = {}) {
    const f = log ? (v) => Math.log10(Math.max(v, .1)) : (v) => v;
    const bornes = (vals) => (log ? [Math.floor(Math.min(...vals.map(f))), Math.max(Math.ceil(Math.max(...vals.map(f))), Math.floor(Math.min(...vals.map(f))) + 1)] : [0, (max(vals) * 1.1) || 1]);
    const [x0, x1] = bornes(pts.map((p) => p.x)), [y0, y1] = bornes(pts.map((p) => p.y));
    const X = (x) => 46 + (f(x) - x0) / (x1 - x0) * (w - 66), Y = (y) => 14 + (1 - (f(y) - y0) / (y1 - y0)) * (h - 48);
    const grad = (v0, v1) => (log ? Array.from({ length: v1 - v0 + 1 }, (_, i) => 10 ** (v0 + i)) : [0, 1, 2, 3, 4].map((k) => v1 * k / 4));
    let o = `<svg viewBox="0 0 ${w} ${h}" width="100%">`;
    for (const v of grad(y0, y1)) o += `<line x1="46" x2="${w - 16}" y1="${Y(v)}" y2="${Y(v)}" stroke="${V('trait')}"/><text x="42" y="${Y(v) + 3}" text-anchor="end">${court(v)}</text>`;
    for (const v of grad(x0, x1)) o += `<line x1="${X(v)}" x2="${X(v)}" y1="14" y2="${h - 34}" stroke="${V('trait')}"/><text x="${X(v)}" y="${h - 20}" text-anchor="middle">${court(v)}</text>`;
    o += `<text x="${w - 16}" y="${h - 4}" text-anchor="end">${esc(xn)} →</text><text x="4" y="9">↑ ${esc(yn)}</text>`;
    for (const p of pts) o += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${p.r || 5}" fill="${V(p.c || 'accent')}" opacity=".65" stroke="${V('surface')}"><title>${esc(p.nom || '')}</title></circle>`;
    return o + '</svg>';
  }

  /* Barres horizontales avec libellés lisibles (HTML) : items = [{ nom, v, c, txt }]. */
  function barresH(items, { unite = '' } = {}) {
    const M = max(items.map((i) => i.v)) || 1;
    return `<div class="barres-h">${items.map((i) => `<div title="${esc(i.nom)}"><span>${esc(i.nom)}</span><i style="width:${Math.max(1, i.v / M * 100)}%;--c:${V(i.c || 'accent')}"></i><b>${esc(i.txt ?? nb(i.v, 1))}${unite}</b></div>`).join('')}</div>`;
  }

  const legende = (l) => `<div class="leg">${l.map(([c, t]) => `<span><i style="background:${V(c)}"></i>${esc(t)}</span>`).join('')}</div>`;
  const vide = (texte, signe = '○') => `<div class="vide"><b>${signe}</b>${esc(texte)}</div>`;
  const kpi = (nom, val, sous, v, c, cl = 'c3', lien = '') => `<div class="carte kpi ${cl}${lien ? ' lien' : ''}"${lien ? ` data-aller="${lien}"` : ''}><h2>${esc(nom)}</h2><div class="chiffre">${val}</div><div class="sous">${sous || '&nbsp;'}</div>${v && v.length ? trait(v, c) : ''}</div>`;

  return { V, esc, nb, eur, court, max, trait, courbes, empile, barres, donut, anneau, chaleur, entonnoir, cascade, bande, nuage, barresH, legende, vide, kpi };
})();
