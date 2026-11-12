// Page « Conso Claude » : consommation des comptes Claude, réunis ou séparés.
// Données : GET /api/conso (résumé des transcriptions, rangé par compte côté serveur).
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const sombre = matchMedia('(prefers-color-scheme: dark)');
// Teintes des comptes en mode sombre (mêmes rampes, pas validés pour la surface sombre).
const SOMBRE = { '#2a78d6': '#3987e5', '#eb6834': '#d95926', '#1baf7a': '#199e70', '#eda100': '#c98500' };
const COULEURS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const JOUR_MS = 86400000;

let D = null;          // réponse du serveur
let J = {};            // uuid → jour → [tokens, sortie, requêtes, cache relu]
let vue = 'tout';      // 'tout', un uuid, ou 'reglages'
let plage = 90;        // jours affichés par la courbe, la chaleur et les projets
try { vue = localStorage.getItem('conso.vue') || 'tout'; plage = Number(localStorage.getItem('conso.plage')) || 90; } catch { /* stockage indisponible */ }

// ---------- Outils ----------
const pad = (n) => String(n).padStart(2, '0');
const cleJ = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const deCle = (k) => { const [a, m, j] = k.split('-').map(Number); return new Date(a, m - 1, j); };
const ajoute = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const lundi = (d) => ajoute(d, -((d.getDay() + 6) % 7));
const auj = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const dateCourte = (d) => `${d.getDate()} ${MOIS[d.getMonth()]}`;
const dateLongue = (d) => `${JOURS[(d.getDay() + 6) % 7]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function fmt(n) {
  const v = Math.abs(n);
  const f = (x, d) => x.toFixed(d).replace('.', ',');
  if (v >= 1e9) return `${f(n / 1e9, 2)} G`;
  if (v >= 1e6) return `${f(n / 1e6, v >= 1e8 ? 0 : 1)} M`;
  if (v >= 1e3) return `${Math.round(n / 1e3)} k`;
  return String(Math.round(n));
}
const entier = (n) => Math.round(n).toLocaleString('fr-FR');
const couleur = (u) => { const c = D.comptes[u]?.couleur || '#898781'; return sombre.matches ? (SOMBRE[c] || c) : c; };
const nom = (u) => D.comptes[u]?.nom || 'Compte inconnu';
const point = (u) => `<i class="point" style="background:${couleur(u)}"></i>`;

function plafond(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const f of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (f * p >= v) return f * p;
  return 10 * p;
}

// Tous les comptes connus, dans l'ordre d'arrivée.
function tousComptes() {
  const u = Object.keys(D.comptes).sort((a, b) => (D.comptes[a].vu || 0) - (D.comptes[b].vu || 0));
  for (const k of Object.keys(D.heures)) if (!u.includes(k)) u.push(k);
  return u;
}
const portee = () => (vue === 'tout' ? tousComptes() : [vue]);
const val = (u, k, i = 0) => J[u]?.[k]?.[i] ?? 0;
function somme(us, d0, d1, i = 0) { // jours [d0, d1[
  let s = 0;
  for (let d = d0; d < d1; d = ajoute(d, 1)) { const k = cleJ(d); for (const u of us) s += val(u, k, i); }
  return s;
}

function preparer() {
  J = {};
  for (const [u, hs] of Object.entries(D.heures)) {
    const m = (J[u] = {});
    for (const [h, v] of Object.entries(hs)) {
      const x = (m[h.slice(0, 10)] ??= [0, 0, 0, 0]);
      for (let i = 0; i < 4; i++) x[i] += v[i];
    }
  }
  LIM = limiteParJour();
}

// Ouvre un jour dans « Un jour, heure par heure » sans redessiner toute la page.
function choisirJour(k) {
  if (!k || !/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
  jourChoisi = k;
  const y = scrollY;
  afficher();
  scrollTo(0, y);
  $('#jour')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function premierJour() {
  let min = null;
  for (const u of portee()) for (const k of Object.keys(J[u] || {})) if (!min || k < min) min = k;
  return min ? deCle(min) : auj();
}

// ---------- Infobulle ----------
const bulle = $('#infobulle');
function montrer(html, x, y) {
  bulle.innerHTML = html;
  bulle.hidden = false;
  const r = bulle.getBoundingClientRect();
  let gx = x + 14, gy = y + 14;
  if (gx + r.width > innerWidth - 8) gx = x - r.width - 14;
  if (gy + r.height > innerHeight - 8) gy = y - r.height - 14;
  bulle.style.left = `${Math.max(8, gx)}px`;
  bulle.style.top = `${Math.max(8, gy)}px`;
}
const cacher = () => { bulle.hidden = true; };
document.addEventListener('mousemove', (e) => {
  const c = e.target.closest?.('[data-info]');
  if (c) montrer(c.dataset.info, e.clientX, e.clientY);
  else if (!e.target.closest?.('[data-suivi]')) cacher();
});
// Au toucher : afficher l'infobulle du carré touché.
document.addEventListener('touchstart', (e) => {
  const c = e.target.closest?.('[data-info]');
  if (c) { const t = e.touches[0]; montrer(c.dataset.info, t.clientX, t.clientY); } else cacher();
}, { passive: true });

function lignesInfo(titre, parts, total, extra = '') {
  let h = `<b>${esc(titre)}</b>`;
  for (const [u, v] of parts) h += `<div class="l"><span>${point(u)}${esc(nom(u))}</span><span>${fmt(v)}</span></div>`;
  if (parts.length > 1) h += `<div class="l"><span>Total</span><b>${fmt(total)}</b></div>`;
  return esc(h + extra);
}
// Lignes ajoutées sous une journée : requêtes et points de limite hebdo.
function infoJour(us, k, req) {
  let h = req ? `<div class="l"><span>Requêtes</span><span>${entier(req)}</span></div>` : '';
  for (const u of us) if (LIM[u]?.[k] !== undefined) h += `<div class="l"><span>Limite hebdo${us.length > 1 ? ` (${esc(nom(u))})` : ''}</span><span>+${Math.round(LIM[u][k])} pts</span></div>`;
  return h;
}
let jourChoisi = cleJ(new Date());

function toast(t) {
  const el = $('#toast'); el.textContent = t; el.hidden = false;
  clearTimeout(toast.m); toast.m = setTimeout(() => { el.hidden = true; }, 2600);
}

// ---------- Graphiques (SVG à la main) ----------
const NS = 'http://www.w3.org/2000/svg';
const largeur = (el) => Math.max(260, el.clientWidth);

// Rectangle aux coins du haut arrondis (barres posées sur la ligne de base).
function barre(x, y, w, h, r) {
  if (h <= 0) return '';
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function axeY(W, H, m, max, fmtY = fmt) {
  let s = '';
  for (let i = 0; i <= 4; i++) {
    const v = (max * i) / 4;
    const y = m.t + (H - m.t - m.b) * (1 - i / 4);
    s += i === 0 ? `<line class="axe" x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}"/>`
      : `<line class="grille" x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}"/>`;
    s += `<text x="${m.l - 6}" y="${y + 4}" text-anchor="end">${fmtY(v)}</text>`;
  }
  return s;
}

// Aires empilées par compte (+ moyenne glissante sur 7 jours), avec curseur au survol.
function courbe(el, jours, us) {
  const W = largeur(el), H = 240, m = { l: 48, r: 12, t: 12, b: 26 };
  const n = jours.length;
  const series = us.map((u) => jours.map((k) => val(u, k)));
  const totaux = jours.map((_, i) => series.reduce((s, v) => s + v[i], 0));
  const moy = totaux.map((_, i) => { const a = totaux.slice(Math.max(0, i - 6), i + 1); return a.reduce((s, v) => s + v, 0) / a.length; });
  const max = plafond(Math.max(...totaux, ...moy) * 1.05);
  const X = (i) => m.l + (n === 1 ? 0 : ((W - m.l - m.r) * i) / (n - 1));
  const Y = (v) => m.t + (H - m.t - m.b) * (1 - v / max);
  let s = axeY(W, H, m, max);
  const pas = Math.ceil(n / Math.max(2, Math.floor((W - m.l) / 70)));
  for (let i = 0; i < n; i += pas) s += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle">${dateCourte(deCle(jours[i]))}</text>`;
  const cumul = jours.map(() => 0);
  series.forEach((v, j) => {
    const bas = cumul.slice();
    v.forEach((x, i) => { cumul[i] += x; });
    const haut = cumul.map((c, i) => `${X(i)},${Y(c)}`).join(' L');
    const retour = bas.map((c, i) => `${X(i)},${Y(c)}`).reverse().join(' L');
    s += `<path d="M${haut} L${retour}Z" fill="${couleur(us[j])}" fill-opacity="${us.length > 1 ? 0.8 : 0.3}"/>`;
    s += `<path d="M${haut}" fill="none" stroke="${us.length > 1 ? 'var(--surface)' : couleur(us[j])}" stroke-width="${us.length > 1 ? 1.5 : 2}" stroke-linejoin="round"/>`;
  });
  s += `<path d="M${moy.map((v, i) => `${X(i)},${Y(v)}`).join(' L')}" fill="none" stroke="var(--encre-2)" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round"/>`;
  s += '<g class="survol" pointer-events="none"></g>';
  s += `<rect data-suivi x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="transparent"/>`;
  el.innerHTML = `<svg xmlns="${NS}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tokens par jour">${s}</svg>`;
  const svg = el.firstChild, g = svg.querySelector('.survol');
  svg.querySelector('[data-suivi]').addEventListener('mousemove', (e) => {
    const r = svg.getBoundingClientRect();
    const i = Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left - m.l) / (W - m.l - m.r)) * (n - 1))));
    let c = 0, pts = '';
    series.forEach((v, j) => { c += v[i]; pts += `<circle cx="${X(i)}" cy="${Y(c)}" r="4" fill="${couleur(us[j])}" stroke="var(--surface)" stroke-width="2"/>`; });
    g.innerHTML = `<line class="curseur" x1="${X(i)}" x2="${X(i)}" y1="${m.t}" y2="${H - m.b}"/>${pts}`;
    const h = `<b>${dateLongue(deCle(jours[i]))}</b>${us.map((u, j) => `<div class="l"><span>${point(u)}${esc(nom(u))}</span><span>${fmt(series[j][i])}</span></div>`).join('')}`
      + `${us.length > 1 ? `<div class="l"><span>Total</span><b>${fmt(totaux[i])}</b></div>` : ''}<div class="l"><span>Moyenne 7 j</span><span>${fmt(moy[i])}</span></div>`
      + infoJour(us, jours[i], us.reduce((s2, u) => s2 + val(u, jours[i], 2), 0));
    montrer(h, e.clientX, e.clientY);
  });
  svg.querySelector('[data-suivi]').addEventListener('mouseleave', () => { g.innerHTML = ''; cacher(); });
  svg.querySelector('[data-suivi]').style.cursor = 'pointer';
  svg.querySelector('[data-suivi]').addEventListener('click', (e) => {
    const r = svg.getBoundingClientRect();
    const i = Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left - m.l) / (W - m.l - m.r)) * (n - 1))));
    choisirJour(jours[i]);
  });
}

// Barres empilées par compte. groupes : [{ etiquette, titre, valeurs: {uuid: n} }]
function barres(el, groupes, us, H = 220) {
  const W = largeur(el), m = { l: 48, r: 8, t: 12, b: 26 };
  const n = groupes.length;
  const totaux = groupes.map((g) => us.reduce((s, u) => s + (g.valeurs[u] || 0), 0));
  const max = plafond(Math.max(...totaux) * 1.08);
  const bande = (W - m.l - m.r) / n, w = Math.max(3, Math.min(48, bande * 0.66));
  const Y = (v) => (H - m.t - m.b) * (v / max);
  let s = axeY(W, H, m, max);
  const pas = Math.ceil(n / Math.max(2, Math.floor((W - m.l) / 52)));
  groupes.forEach((g, i) => {
    const x = m.l + bande * i + (bande - w) / 2;
    let base = H - m.b;
    const visibles = us.filter((u) => (g.valeurs[u] || 0) > 0);
    visibles.forEach((u, j) => {
      const h = Y(g.valeurs[u]);
      const dernier = j === visibles.length - 1;
      const hh = Math.max(0, h - (j > 0 ? 2 : 0)); // 2 px de vide entre segments
      s += `<path d="${dernier ? barre(x, base - h, w, hh, 4) : `M${x},${base}V${base - hh}H${x + w}V${base}Z`}" fill="${couleur(u)}"/>`;
      base -= h;
    });
    // Le chiffre au-dessus de chaque barre, quand la place le permet (vue 30 jours, journée).
    if (totaux[i] > 0 && bande >= 22) s += `<text x="${x + w / 2}" y="${base - 4}" text-anchor="middle" style="fill:var(--encre-2);font-size:10px">${fmt(totaux[i]).replace(/ /g, '')}</text>`;
    const extra = g.jour ? infoJour(us, g.jour, g.req) : g.req ? `<div class="l"><span>Requêtes</span><span>${entier(g.req)}</span></div>` : '';
    const info = lignesInfo(g.titre, us.map((u) => [u, g.valeurs[u] || 0]), totaux[i], extra);
    if (g.jour === jourChoisi) s += `<rect x="${m.l + bande * i}" y="${m.t}" width="${bande}" height="${H - m.t - m.b}" fill="var(--encre)" fill-opacity=".06" rx="3"/>`;
    s += `<rect data-info="${info}"${g.jour ? ` data-jour="${g.jour}" style="cursor:pointer"` : ''} x="${m.l + bande * i}" y="${m.t}" width="${bande}" height="${H - m.t - m.b}" fill="transparent"/>`;
    if (i % pas === 0) s += `<text x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${esc(g.etiquette)}</text>`;
  });
  el.innerHTML = `<svg xmlns="${NS}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">${s}</svg>`;
}

// Barres horizontales (projets, modèles), segmentées par compte.
function barresH(el, lignes, us) {
  const W = largeur(el), lab = Math.min(150, W * 0.34), droite = 56, h = 24, gap = 8;
  const max = Math.max(1, ...lignes.map((l) => l.total));
  const H = lignes.length * (h + gap);
  let s = '';
  lignes.forEach((l, i) => {
    const y = i * (h + gap);
    s += `<text x="${lab - 8}" y="${y + h / 2 + 4}" text-anchor="end" style="fill:var(--encre)">${esc(l.nom.length > 22 ? `${l.nom.slice(0, 21)}…` : l.nom)}</text>`;
    let x = lab;
    const visibles = us.filter((u) => (l.valeurs[u] || 0) > 0);
    visibles.forEach((u, j) => {
      const w = ((W - lab - droite) * l.valeurs[u]) / max;
      const ww = Math.max(1, w - (j < visibles.length - 1 ? 2 : 0));
      const r = j === visibles.length - 1 ? Math.min(4, ww / 2) : 0;
      s += `<path d="M${x},${y}H${x + ww - r}Q${x + ww},${y} ${x + ww},${y + r}V${y + h - r}Q${x + ww},${y + h} ${x + ww - r},${y + h}H${x}Z" fill="${couleur(u)}"/>`;
      x += w;
    });
    s += `<text x="${x + 6}" y="${y + h / 2 + 4}">${fmt(l.total)}</text>`;
    s += `<rect data-info="${lignesInfo(l.nom, us.map((u) => [u, l.valeurs[u] || 0]), l.total)}" x="0" y="${y}" width="${W}" height="${h}" fill="transparent"/>`;
  });
  el.innerHTML = lignes.length ? `<svg xmlns="${NS}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg>` : '<p class="vide">Rien sur cette période.</p>';
}

// Teinte d'intensité : la couleur du compte mélangée à la surface (une seule teinte, clair → foncé).
const NIVEAUX = [28, 48, 68, 86, 100];
const teinte = (c, niveau) => `color-mix(in oklab, ${c} ${NIVEAUX[niveau]}%, var(--surface))`;
function seuils(valeurs) {
  const v = valeurs.filter((x) => x > 0).sort((a, b) => a - b);
  if (!v.length) return [1, 1, 1, 1];
  return [0.2, 0.4, 0.6, 0.8].map((q) => v[Math.floor(q * (v.length - 1))]);
}
const niveau = (x, s) => (x <= s[0] ? 0 : x <= s[1] ? 1 : x <= s[2] ? 2 : x <= s[3] ? 3 : 4);

// Calendrier d'activité : un carré par jour sur 53 semaines.
function calendrier(el, us, c) {
  const fin = auj(), debut = lundi(ajoute(fin, -52 * 7));
  const cote = 12, ecart = 3, m = { l: 30, t: 18 };
  const jours = [];
  for (let d = debut; d <= fin; d = ajoute(d, 1)) jours.push(d);
  const tot = (d) => us.reduce((s, u) => s + val(u, cleJ(d)), 0);
  const sl = seuils(jours.map(tot));
  const W = m.l + 53 * (cote + ecart), H = m.t + 7 * (cote + ecart);
  let s = '';
  [0, 2, 4].forEach((j) => { s += `<text x="${m.l - 6}" y="${m.t + j * (cote + ecart) + cote - 2}" text-anchor="end">${JOURS[j]}</text>`; });
  let moisPrec = -1;
  for (const d of jours) {
    const sem = Math.floor((d - debut) / (7 * JOUR_MS) + 0.01);
    const jr = (d.getDay() + 6) % 7;
    const x = m.l + sem * (cote + ecart), y = m.t + jr * (cote + ecart);
    if (jr === 0 && d.getMonth() !== moisPrec && d.getDate() <= 7) { moisPrec = d.getMonth(); s += `<text x="${x}" y="${m.t - 6}">${MOIS[d.getMonth()]}</text>`; }
    const k = cleJ(d), t = tot(d);
    const req = us.reduce((a, u) => a + val(u, k, 2), 0);
    const info = esc(`<b>${dateLongue(d)}</b>${us.length > 1 ? us.map((u) => `<div class="l"><span>${point(u)}${esc(nom(u))}</span><span>${fmt(val(u, k))}</span></div>`).join('') : ''}<div class="l"><span>Total</span><b>${t ? fmt(t) : 'aucune activité'}</b></div>${infoJour(us, k, req)}`);
    if (k === jourChoisi) s += `<rect x="${x - 1.5}" y="${y - 1.5}" width="${cote + 3}" height="${cote + 3}" rx="3.5" fill="none" stroke="var(--encre)" stroke-width="1.5"/>`;
    s += t > 0 ? `<rect class="cellule" data-jour="${k}" style="cursor:pointer" data-info="${info}" x="${x}" y="${y}" width="${cote}" height="${cote}" rx="2.5" fill="${teinte(c, niveau(t, sl))}"/>`
      : `<rect class="vide-j" data-info="${info}" x="${x + 0.5}" y="${y + 0.5}" width="${cote - 1}" height="${cote - 1}" rx="2.5"/>`;
  }
  el.innerHTML = `<div class="defile"><svg xmlns="${NS}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Activité par jour sur un an">${s}</svg></div>`
    + `<div class="echelle">moins <i style="background:var(--surface-2);border:1px solid var(--trait)"></i>${NIVEAUX.map((_, i) => `<i style="background:${teinte(c, i)}"></i>`).join('')} plus</div>`;
  // Écran étroit : montrer d'abord les semaines récentes (à droite).
  const defile = el.querySelector('.defile');
  defile.scrollLeft = defile.scrollWidth;
}

// Chaleur jour de la semaine × heure, sur la période choisie.
function chaleur(el, us, c, d0) {
  const g = Array.from({ length: 7 }, () => Array(24).fill(0));
  const k0 = cleJ(d0);
  for (const u of us) for (const [h, v] of Object.entries(D.heures[u] || {})) {
    if (h.slice(0, 10) < k0) continue;
    const d = deCle(h.slice(0, 10));
    g[(d.getDay() + 6) % 7][Number(h.slice(11, 13))] += v[0];
  }
  const sl = seuils(g.flat());
  // Carrés de taille fixe (comme le calendrier), jamais étirés en rectangles.
  const m = { l: 34, t: 4, b: 18 }, ecart = 3;
  const cote = Math.max(9, Math.min(18, Math.floor((largeur(el) - m.l) / 24) - ecart));
  const pas = cote + ecart, W = m.l + 24 * pas, H = m.t + 7 * pas + m.b;
  let s = '';
  g.forEach((ligne, j) => {
    s += `<text x="${m.l - 6}" y="${m.t + j * pas + cote / 2 + 4}" text-anchor="end">${JOURS[j]}</text>`;
    ligne.forEach((v, h) => {
      const info = esc(`<b>${JOURS[j]} ${h} h – ${h + 1} h</b><div class="l"><span>Sur ${plage} jours</span><b>${v ? fmt(v) : 'rien'}</b></div>`);
      s += v > 0 ? `<rect data-info="${info}" x="${m.l + h * pas}" y="${m.t + j * pas}" width="${cote}" height="${cote}" rx="2.5" fill="${teinte(c, niveau(v, sl))}"/>`
        : `<rect class="vide-j" data-info="${info}" x="${m.l + h * pas + 0.5}" y="${m.t + j * pas + 0.5}" width="${cote - 1}" height="${cote - 1}" rx="2.5"/>`;
    });
  });
  for (let h = 0; h < 24; h += 3) s += `<text x="${m.l + h * pas + cote / 2}" y="${H - 4}" text-anchor="middle">${h} h</text>`;
  el.innerHTML = `<div class="defile"><svg class="chaleur cal" xmlns="${NS}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg></div>`
    + `<div class="echelle">moins <i style="background:var(--surface-2);border:1px solid var(--trait)"></i>${NIVEAUX.map((_, i) => `<i style="background:${teinte(c, i)}"></i>`).join('')} plus</div>`;
}

// Montée du % hebdo au fil de la semaine de quota, contre un rythme régulier.
function courbeLimite(el, us) {
  const W = largeur(el), H = 200, m = { l: 40, r: 12, t: 10, b: 24 };
  const X = (j) => m.l + ((W - m.l - m.r) * j) / 7;
  const sems = us.map((u) => [u, semaineEnCours(u)]).filter(([, sem]) => sem);
  // Après une réinitialisation offerte, la courbe continue au-dessus de 100 % : l'axe s'allonge.
  const sommet = Math.max(100, ...sems.map(([, sem]) => Math.max(...sem.cumuls)));
  const pas = sommet > 150 ? 50 : 25;
  const max = Math.ceil(sommet / pas) * pas;
  const Y = (p) => m.t + (H - m.t - m.b) * (1 - p / max);
  let s = '';
  for (let v = 0; v <= max; v += pas) {
    s += `<line class="${v === 0 || (v === 100 && max > 100) ? 'axe' : 'grille'}" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/>`;
    s += `<text x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${v} %</text>`;
  }
  for (let j = 0; j <= 7; j++) s += `<text x="${X(j)}" y="${H - 6}" text-anchor="middle">j${j}</text>`;
  s += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(7)}" y2="${Y(100)}" stroke="var(--muet)" stroke-width="1.5" stroke-dasharray="4 4"/>`;
  const heure = (t) => `${dateLongue(new Date(t))} ${pad(new Date(t).getHours())} h ${pad(new Date(t).getMinutes())}`;
  for (const [u, sem] of sems) {
    const debut = Date.parse(sem.reset) - 7 * JOUR_MS;
    const Xt = (t) => X(Math.max(0, (t - debut) / JOUR_MS));
    // Le moment de bascule : un trait vertical pointillé à chaque réinitialisation.
    for (const b of sem.bascules) {
      const x = Xt(b.t);
      s += `<line x1="${x}" x2="${x}" y1="${m.t}" y2="${Y(0)}" stroke="${couleur(u)}" stroke-width="1.5" stroke-dasharray="2 4"/>`;
      s += `<line data-info="${esc(`<b>${esc(nom(u))} · réinitialisation</b><div class="l"><span>${heure(b.t)}</span></div><div class="l"><span>Avant</span><b>${Math.round(b.avant)} %</b></div>`)}" x1="${x}" x2="${x}" y1="${m.t}" y2="${Y(0)}" stroke="transparent" stroke-width="12"/>`;
    }
    const pts = sem.releves.map((r, i) => [Xt(r.t), Y(sem.cumuls[i]), r, sem.cumuls[i]]);
    s += `<path d="M${X(0)},${Y(0)} L${pts.map((p) => `${p[0]},${p[1]}`).join(' L')}" fill="none" stroke="${couleur(u)}" stroke-width="2" stroke-linejoin="round"/>`;
    const [x, y] = pts[pts.length - 1];
    s += `<circle cx="${x}" cy="${y}" r="5" fill="${couleur(u)}" stroke="var(--surface)" stroke-width="2"/>`;
    for (const [px, py, r, cumul] of pts) {
      const ligneCumul = cumul > r.pct ? `<div class="l"><span>Cumul de la semaine</span><b>${Math.round(cumul)} %</b></div>` : '';
      s += `<circle data-info="${esc(`<b>${esc(nom(u))}</b><div class="l"><span>${heure(r.t)}</span></div><div class="l"><span>Limite hebdo</span><b>${Math.round(r.pct)} %</b></div>${ligneCumul}`)}" cx="${px}" cy="${py}" r="8" fill="transparent"/>`;
    }
  }
  const rien = !sems.length;
  el.innerHTML = rien ? '' : `<svg xmlns="${NS}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg>`;
}

function semaineEnCours(u) {
  const rel = D.limites.filter((r) => r.uuid === u);
  const der = rel[rel.length - 1];
  if (!der?.reset || Date.parse(der.reset) < Date.now()) return null;
  const releves = rel.filter((r) => r.reset && Math.abs(Date.parse(r.reset) - Date.parse(der.reset)) < 3600000);
  // Réinitialisation offerte en cours de semaine : le % retombe sans que la date de remise
  // change. On garde ce qui était déjà consommé pour que la courbe continue de monter.
  let decalage = 0;
  const bascules = [];
  const cumuls = releves.map((r, i) => {
    const avant = releves[i - 1];
    if (avant && chute(avant, r)) { decalage += avant.pct; bascules.push({ t: r.t, avant: avant.pct }); }
    return r.pct + decalage;
  });
  return { reset: der.reset, dernier: der, releves, cumuls, bascules, cumul: der.pct + decalage };
}

// Une vraie remise à zéro, pas le petit flottement d'un relevé à l'autre (1 à 3 pts).
function chute(a, b) { return b.pct < a.pct - 5; }

// Points de limite hebdo consommés chaque jour, par compte (d'après les relevés).
// Une hausse entre deux relevés compte pour le jour du second ; après une remise à zéro,
// le nouveau pourcentage compte en entier.
function limiteParJour() {
  const res = {};
  const parCompte = {};
  for (const r of D.limites) (parCompte[r.uuid] ??= []).push(r);
  for (const [u, rel] of Object.entries(parCompte)) {
    rel.sort((a, b) => a.t - b.t);
    const m = (res[u] = {});
    for (let i = 1; i < rel.length; i++) {
      const a = rel[i - 1], b = rel[i];
      const memeSemaine = a.reset && b.reset && Math.abs(Date.parse(a.reset) - Date.parse(b.reset)) < 3600000;
      const hausse = memeSemaine && !chute(a, b) ? Math.max(0, b.pct - a.pct) : b.pct;
      const k = cleJ(new Date(b.t));
      m[k] = (m[k] || 0) + hausse;
    }
  }
  return res;
}
let LIM = {};

// Un jour, heure par heure : barres empilées par compte, chiffres et projets du jour.
function detailJour(us) {
  const k = jourChoisi, d = deCle(k);
  const groupes = Array.from({ length: 24 }, (_, h) => {
    const cle = `${k} ${pad(h)}`;
    const valeurs = {};
    for (const u of us) valeurs[u] = D.heures[u]?.[cle]?.[0] || 0;
    return { etiquette: `${h} h`, titre: `${dateCourte(d)}, ${h} h – ${h + 1} h`, valeurs, req: us.reduce((s, u) => s + (D.heures[u]?.[cle]?.[2] || 0), 0) };
  });
  const tot = us.reduce((s, u) => s + val(u, k), 0);
  const req = us.reduce((s, u) => s + val(u, k, 2), 0);
  const out = us.reduce((s, u) => s + val(u, k, 1), 0);
  const pic = groupes.reduce((b, g, h) => { const t = us.reduce((s, u) => s + g.valeurs[u], 0); return t > b[0] ? [t, h] : b; }, [0, -1]);
  const lim = us.filter((u) => LIM[u]?.[k] !== undefined).map((u) => `${us.length > 1 ? `${point(u)}${esc(nom(u))} : ` : ''}<b>${Math.round(LIM[u][k])} pts</b>`).join(' · ');
  const projets = {};
  for (const u of us) for (const [p, v] of Object.entries(D.projets[u]?.[k] || {})) projets[p] = (projets[p] || 0) + v;
  const topP = Object.entries(projets).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([p, v]) => `${esc(p)} ${fmt(v)}`).join(' · ');
  const actifs = us.filter((u) => val(u, k) > 0);
  const parts = us.length > 1 && actifs.length ? ` (${actifs.map((u) => `${point(u)}${esc(nom(u))} ${fmt(val(u, k))}`).join(' · ')})` : '';
  $('#jour-resume').innerHTML = tot
    ? `<b>${fmt(tot)} tokens</b>${parts} · ${entier(req)} requêtes · ${fmt(out)} en sortie${pic[1] >= 0 ? ` · pic à ${pic[1]} h` : ''}`
      + `${lim ? `<br>Limite hebdo consommée ce jour-là : ${lim}` : ''}${topP ? `<br>Projets : ${topP}` : ''}`
    : 'Aucune activité ce jour-là.';
  $('#jour-date').value = k;
  $('#jour-titre').textContent = dateLongue(d);
  barres($('#g-jour'), groupes, us, 200);
}

// ---------- Vues ----------
function onglets() {
  const us = tousComptes();
  const b = (id, texte, extra = '') => `<button data-vue="${id}" class="${vue === id ? 'actif' : ''}">${extra}${esc(texte)}</button>`;
  // En ligne, les réglages ne se modifient pas (ils vivent sur le PC).
  $('#onglets').innerHTML = b('tout', 'Tout') + us.map((u) => b(u, nom(u), point(u))).join('') + (EN_LIGNE ? '' : b('reglages', 'Comptes'));
}

function tuile(etiquette, us, d0, d1, comparaison) {
  const t = somme(us, d0, d1);
  const req = somme(us, d0, d1, 2);
  let detail = `${entier(req)} requêtes`;
  if (comparaison) {
    const [lib, c] = comparaison;
    if (c > 0) {
      const ecart = Math.round(((t - c) / c) * 100);
      detail += ` · <span class="${ecart >= 0 ? 'monte' : 'baisse'}">${ecart >= 0 ? '▲' : '▼'} ${Math.abs(ecart)} %</span> vs ${lib}`;
    }
  }
  const parts = us.length > 1 ? `<div class="parts">${us.map((u) => `<div>${point(u)}${esc(nom(u))} : <b>${fmt(somme([u], d0, d1))}</b></div>`).join('')}</div>` : '';
  return `<div class="tuile"><div class="lib">${etiquette}</div><div class="valeur">${fmt(t)} <small>tokens</small></div><div class="detail">${detail}</div>${parts}</div>`;
}

function blocLimites(us) {
  const html = us.map((u) => {
    const sem = semaineEnCours(u);
    if (!sem) return `<div class="limite"><div class="tete"><span>${point(u)}${esc(nom(u))}</span></div><div class="pied">Pas encore de relevé pour la semaine en cours : il arrive à la prochaine session Claude ouverte sur ce compte.</div></div>`;
    const r = sem.dernier, reset = new Date(sem.reset);
    const ecoule = Math.min(1, Math.max(0, (Date.now() - (reset - 7 * JOUR_MS)) / (7 * JOUR_MS)));
    const ecart = Math.round(r.pct - ecoule * 100);
    const cinq = r.r5 && Date.parse(r.r5) > Date.now()
      ? `<div class="tete" style="margin-top:6px"><span>Limite 5 h</span><b>${Math.round(r.p5)} %</b></div><div class="jauge"><span style="width:${Math.min(100, r.p5)}%;background:${couleur(u)};opacity:.6"></span></div><div class="pied">Remise à ${pad(new Date(r.r5).getHours())} h ${pad(new Date(r.r5).getMinutes())}</div>` : '';
    return `<div class="limite"><div class="tete"><span>${point(u)}${esc(nom(u))} · limite hebdo</span><b>${Math.round(r.pct)} %${sem.cumul > r.pct ? ` <small>(cumul ${Math.round(sem.cumul)} %)</small>` : ''}</b></div>
      <div class="jauge"><span style="width:${Math.min(100, r.pct)}%;background:${couleur(u)}"></span><em style="left:${ecoule * 100}%" title="Rythme régulier"></em></div>
      <div class="pied">Remise ${dateLongue(reset)} à ${pad(reset.getHours())} h · ${ecart > 0 ? `${ecart} pts d'avance sur le rythme régulier` : ecart < 0 ? `${-ecart} pts de marge sous le rythme régulier` : 'pile au rythme régulier'} · relevé ${dateCourte(new Date(r.t))} ${pad(new Date(r.t).getHours())} h</div>${cinq}</div>`;
  }).join('');
  return html;
}

function legende(us, avecMoyenne) {
  return `<div class="c-leg">${us.length > 1 ? us.map((u) => `<span>${point(u)}${esc(nom(u))}</span>`).join('') : ''}${avecMoyenne ? '<span><i class="tiret"></i>Moyenne sur 7 jours</span>' : ''}</div>`;
}

function regroupe(us, d0, d1, cleGroupe) {
  const g = new Map();
  for (let d = d0; d < d1; d = ajoute(d, 1)) {
    const [cle, etiquette, titre] = cleGroupe(d);
    const x = g.get(cle) ?? { etiquette, titre, valeurs: {} };
    for (const u of us) x.valeurs[u] = (x.valeurs[u] || 0) + val(u, cleJ(d));
    g.set(cle, x);
  }
  return [...g.values()];
}

function classement(us, source, d0, n = 8) {
  const k0 = cleJ(d0), tot = new Map();
  for (const u of us) for (const [j, parNom] of Object.entries(D[source][u] || {})) {
    if (j < k0) continue;
    for (const [nm, v] of Object.entries(parNom)) {
      const x = tot.get(nm) ?? { nom: nm, total: 0, valeurs: {} };
      x.total += v; x.valeurs[u] = (x.valeurs[u] || 0) + v;
      tot.set(nm, x);
    }
  }
  const l = [...tot.values()].sort((a, b) => b.total - a.total);
  if (l.length > n) {
    const autres = { nom: `Autres (${l.length - n + 1})`, total: 0, valeurs: {} };
    for (const x of l.splice(n - 1)) { autres.total += x.total; for (const [u, v] of Object.entries(x.valeurs)) autres.valeurs[u] = (autres.valeurs[u] || 0) + v; }
    l.push(autres);
  }
  return l;
}

function vueStats() {
  const us = portee();
  const c = vue === 'tout' ? (sombre.matches ? '#3987e5' : '#2a78d6') : couleur(vue);
  const a = auj(), demain = ajoute(a, 1), lun = lundi(a);
  const mois = new Date(a.getFullYear(), a.getMonth(), 1);
  const debut = premierJour();
  const actifs30 = (() => { let n = 0; for (let d = ajoute(a, -29); d <= a; d = ajoute(d, 1)) if (us.some((u) => val(u, cleJ(d)) > 0)) n++; return n; })();
  const tot30 = somme(us, ajoute(a, -29), demain);
  // Comparaisons « à la même heure » : la période précédente coupée au même point.
  const fracJour = (Date.now() - a) / JOUR_MS;
  const memeAvancee = (d0, nbJours) => somme(us, d0, ajoute(d0, Math.floor(nbJours))) + somme(us, ajoute(d0, Math.floor(nbJours)), ajoute(d0, Math.floor(nbJours) + 1)) * (nbJours % 1);
  const joursSemaine = (a - lun) / JOUR_MS + fracJour;
  const joursMois = (a - mois) / JOUR_MS + fracJour;
  const moisPrec = new Date(a.getFullYear(), a.getMonth() - 1, 1);

  const titre = vue === 'tout' ? `Tous les comptes réunis (${us.length})` : `${nom(vue)} · ${esc(D.comptes[vue]?.email || '')}`;
  const d0 = ajoute(a, -(plage - 1));
  const jours = []; for (let d = d0; d <= a; d = ajoute(d, 1)) jours.push(cleJ(d));
  const html = `
    <div class="tuiles">
      ${tuile("Aujourd'hui", us, a, demain, ['hier même heure', memeAvancee(ajoute(a, -1), fracJour)])}
      ${tuile('Cette semaine <small>(depuis lundi)</small>', us, lun, demain, ['sem. dernière', memeAvancee(ajoute(lun, -7), joursSemaine)])}
      ${tuile(`Ce mois <small>(${MOIS_LONGS[a.getMonth()]})</small>`, us, mois, demain, [MOIS_LONGS[moisPrec.getMonth()], memeAvancee(moisPrec, joursMois)])}
      <div class="tuile"><div class="lib">Moyenne par jour actif <small>(30 j)</small></div><div class="valeur">${fmt(actifs30 ? tot30 / actifs30 : 0)}</div><div class="detail">${actifs30} jours actifs sur 30</div></div>
      ${tuile(`Depuis le début <small>(${dateCourte(debut)} ${debut.getFullYear()})</small>`, us, debut, demain)}
    </div>

    <section class="c-bloc"><div class="c-bloc-tete"><div><h2>Limites Claude</h2><p class="sous">${esc(titre)} — le petit trait sur la jauge marque le rythme régulier (100 % en fin de semaine).</p></div></div>
      <div class="rangee-2"><div class="limites">${blocLimites(us)}</div><div><div class="graphe" id="g-limite"></div>${legende(us.filter((u) => semaineEnCours(u)), false)}</div></div>
    </section>

    <section class="c-bloc"><div class="c-bloc-tete"><div><h2>Activité par jour</h2><p class="sous">Un carré par jour sur un an ; plus il est foncé, plus il y a eu de tokens ce jour-là.</p></div></div>
      <div id="g-cal" class="graphe cal"></div></section>

    <section class="c-bloc"><div class="c-bloc-tete"><div><h2>Tokens par jour</h2><p class="sous">Entrée + sortie + écriture du cache (le contexte relu depuis le cache n'est pas compté).</p></div>
      <div class="segment" id="plage">${[30, 90, 180, 365].map((p) => `<button data-plage="${p}" class="${p === plage ? 'actif' : ''}">${p === 365 ? '1 an' : `${p} j`}</button>`).join('')}</div></div>
      ${legende(us, plage > 30)}<div class="graphe" id="g-courbe"></div>
      <p class="astuce">Clique sur un jour (ici ou dans le calendrier) pour le voir heure par heure.</p>
      <details class="tableau"><summary>Voir les chiffres jour par jour</summary><div class="table-defile">${tableau(us, jours)}</div></details>
    </section>

    <section class="c-bloc" id="jour"><div class="c-bloc-tete"><div><h2>Un jour, heure par heure : <span id="jour-titre"></span></h2><p class="sous" id="jour-resume"></p></div>
      <div class="nav-jour"><button class="bouton" data-decale="-1" aria-label="Jour précédent">‹</button><input type="date" id="jour-date" aria-label="Jour"><button class="bouton" data-decale="1" aria-label="Jour suivant">›</button><button class="bouton" data-decale="0">Aujourd'hui</button></div></div>
      ${legende(us, false)}<div class="graphe" id="g-jour"></div>
    </section>

    <div class="rangee-2">
      <section class="c-bloc"><h2>Par semaine</h2><p class="sous">Les 16 dernières semaines (lundi → dimanche).</p>${legende(us, false)}<div class="graphe" id="g-sem"></div></section>
      <section class="c-bloc"><h2>Par mois</h2><p class="sous">Les 12 derniers mois.</p>${legende(us, false)}<div class="graphe" id="g-mois"></div></section>
    </div>

    <section class="c-bloc"><h2>Quand tu travailles</h2><p class="sous">Tokens par jour de la semaine et par heure, sur les ${plage} derniers jours.</p><div class="graphe" id="g-chaleur"></div></section>

    <div class="rangee-2">
      <section class="c-bloc"><h2>Par projet</h2><p class="sous">Sur les ${plage} derniers jours.</p>${legende(us, false)}<div class="graphe" id="g-projets"></div></section>
      <section class="c-bloc"><h2>Par modèle</h2><p class="sous">Sur les ${plage} derniers jours.</p>${legende(us, false)}<div class="graphe" id="g-modeles"></div></section>
    </div>`;
  $('#contenu').innerHTML = html;

  courbeLimite($('#g-limite'), us);
  calendrier($('#g-cal'), us, c);
  // 30 jours : une barre par jour, plus lisible qu'une courbe ; au-delà, la courbe.
  if (plage <= 30) barres($('#g-courbe'), jours.map((k) => { const d = deCle(k); const v = {}; for (const u of us) v[u] = val(u, k); return { etiquette: dateCourte(d), titre: dateLongue(d), valeurs: v, jour: k, req: us.reduce((s, u) => s + val(u, k, 2), 0) }; }), us, 240);
  else courbe($('#g-courbe'), jours, us);
  detailJour(us);
  barres($('#g-sem'), regroupe(us, ajoute(lun, -15 * 7), demain, (d) => { const l = lundi(d); return [cleJ(l), dateCourte(l), `Semaine du ${dateCourte(l)}`]; }), us);
  barres($('#g-mois'), regroupe(us, new Date(a.getFullYear(), a.getMonth() - 11, 1), demain, (d) => [`${d.getFullYear()}-${d.getMonth()}`, MOIS[d.getMonth()], `${MOIS_LONGS[d.getMonth()]} ${d.getFullYear()}`]), us);
  chaleur($('#g-chaleur'), us, c, d0);
  barresH($('#g-projets'), classement(us, 'projets', d0), us);
  barresH($('#g-modeles'), classement(us, 'modeles', d0, 6), us);
}

function tableau(us, jours) {
  const avecLim = us.filter((u) => LIM[u] && Object.keys(LIM[u]).length);
  const tete = `<tr><th>Jour</th>${us.length > 1 ? us.map((u) => `<th>${esc(nom(u))}</th>`).join('') : ''}<th>Tokens</th><th>Sortie</th><th>Requêtes</th>${avecLim.map((u) => `<th>Limite hebdo${us.length > 1 ? ` (${esc(nom(u))})` : ''}</th>`).join('')}</tr>`;
  const lignes = jours.slice().reverse().map((k) => {
    const t = us.reduce((s, u) => s + val(u, k), 0);
    return `<tr data-jour="${k}" style="cursor:pointer"><td>${dateLongue(deCle(k))}</td>${us.length > 1 ? us.map((u) => `<td>${entier(val(u, k))}</td>`).join('') : ''}<td>${entier(t)}</td><td>${entier(us.reduce((s, u) => s + val(u, k, 1), 0))}</td><td>${entier(us.reduce((s, u) => s + val(u, k, 2), 0))}</td>${avecLim.map((u) => `<td>${LIM[u][k] !== undefined ? `+${Math.round(LIM[u][k])} pts` : '–'}</td>`).join('')}</tr>`;
  }).join('');
  return `<table><thead>${tete}</thead><tbody>${lignes}</tbody></table>`;
}

function vueReglages() {
  const us = Object.keys(D.comptes).sort((a, b) => (D.comptes[a].vu || 0) - (D.comptes[b].vu || 0));
  const fmtT = (t) => { const d = new Date(t); return `${dateLongue(d)} à ${pad(d.getHours())} h ${pad(d.getMinutes())}`; };
  const maintenant = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  $('#contenu').innerHTML = `
    <section class="c-bloc"><h2>Les comptes</h2>
      <div class="aide"><p>Un compte apparaît ici dès que Claude Code s'ouvre en étant connecté dessus (le compte connecté est relevé à chaque relevé de limite du mod « Conso » et à chaque visite de cette page). Pour ajouter ton deuxième compte : connecte-toi dessus dans l'appli Claude, ouvre une session de Claude Code, puis reviens ici. Pense à passer sur cette page juste après chaque changement de compte : le rangement n'en sera que plus précis.</p></div>
      ${us.map((u) => `<div class="compte-ligne" data-uuid="${u}">
        <input type="text" value="${esc(nom(u))}" aria-label="Nom du compte">
        <span class="choix-couleur">${COULEURS.map((c) => `<button data-couleur="${c}" class="${D.comptes[u].couleur === c ? 'actif' : ''}" style="background:${c}" aria-label="Couleur ${c}"></button>`).join('')}</span>
        <span class="mail">${esc(D.comptes[u].email || '')} · ${esc((D.comptes[u].offre || '').replace('claude_', 'Claude '))}${D.connecte === u ? ' · <b>connecté maintenant</b>' : ''}</span>
      </div>`).join('')}
    </section>

    <section class="c-bloc"><h2>Quel compte, quand</h2>
      <div class="aide"><p>Les transcriptions ne disent pas quel compte les a produites : chaque message est donc rangé dans le compte connecté à son heure, d'après cette frise. Ce qui précède la première ligne revient au premier compte. Si un passage est mal rangé (par exemple avant la mise en place du suivi, le ${dateCourte(new Date(D.periodes[0]?.depuis || Date.now()))}), ajoute une correction : tout est recompté aussitôt.</p></div>
      <ul class="frise">${D.periodes.map((p) => `<li>${point(p.uuid)}<b>${esc(nom(p.uuid))}</b> à partir du ${fmtT(p.depuis)} <span class="src">${p.source === 'main' ? 'ajouté à la main' : 'détecté'}</span>${D.periodes.length > 1 ? ` <button class="lien-btn" data-suppr="${p.depuis}">retirer</button>` : ''}</li>`).join('')}</ul>
      <form class="form-ligne" id="f-periode">
        <span>À partir du</span><input type="datetime-local" name="depuis" value="${maintenant}" required>
        <span>c'était</span><select name="uuid">${us.map((u) => `<option value="${u}">${esc(nom(u))}</option>`).join('')}</select>
        <button class="bouton" type="submit">Ajouter</button>
      </form>
    </section>`;

  $('#contenu').addEventListener('change', async (e) => {
    const ligne = e.target.closest('.compte-ligne');
    if (ligne && e.target.matches('input[type=text]')) await envoyer('PUT', `compte/${ligne.dataset.uuid}`, { nom: e.target.value }, 'Nom enregistré');
  });
  $('#contenu').addEventListener('click', async (e) => {
    const bc = e.target.closest('[data-couleur]');
    if (bc) await envoyer('PUT', `compte/${bc.closest('.compte-ligne').dataset.uuid}`, { couleur: bc.dataset.couleur }, 'Couleur enregistrée');
    const bs = e.target.closest('[data-suppr]');
    if (bs) await envoyer('DELETE', `periode/${bs.dataset.suppr}`, null, 'Période retirée');
  });
  $('#f-periode').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    await envoyer('POST', 'periode', { depuis: new Date(f.get('depuis')).getTime(), uuid: f.get('uuid') }, 'Correction ajoutée');
  });
}

async function envoyer(methode, chemin, corps, message) {
  const r = await fetch(`/api/conso/${chemin}`, { method: methode, headers: { 'Content-Type': 'application/json' }, body: corps ? JSON.stringify(corps) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { toast(j.erreur || 'Erreur'); return; }
  toast(message);
  await charger();
}

function afficher() {
  if (!D) return;
  if (vue !== 'tout' && vue !== 'reglages' && !D.comptes[vue] && !D.heures[vue]) vue = 'tout';
  if (EN_LIGNE && vue === 'reglages') vue = 'tout';
  onglets();
  cacher();
  // Repartir d'un conteneur neuf : les écouteurs de la vue précédente disparaissent avec lui.
  const neuf = $('#contenu').cloneNode(false);
  $('#contenu').replaceWith(neuf);
  if (vue === 'reglages') vueReglages(); else vueStats();
  const d = new Date(D.maj);
  const auj_ = cleJ(d) === cleJ(new Date()), heure = `à ${pad(d.getHours())} h ${pad(d.getMinutes())}`;
  const jour_ = auj_ ? "d'aujourd'hui" : `du ${dateCourte(d)}`;
  $('#maj').textContent = horsLigne
    ? `${EN_LIGNE ? 'Hors connexion' : 'PC injoignable'} · données ${jour_} ${heure}`
    : EN_LIGNE ? `Envoyé par le PC ${auj_ ? '' : `le ${dateCourte(d)} `}${heure}` : `Mis à jour ${auj_ ? '' : `le ${dateCourte(d)} `}${heure}`;
  $('#maj').style.color = horsLigne ? 'var(--s-en_cours)' : '';
}

// Version en ligne (GitHub Pages) : config.js définit CONSO_CONFIG ; les données viennent de
// Supabase avec le jeton de lecture (donné une fois dans l'adresse : …#k=<jeton>, puis gardé).
const EN_LIGNE = window.CONSO_CONFIG || null;
function jetonLecture() {
  const m = /[#&]k=([\w-]+)/.exec(location.hash);
  if (m) {
    try { localStorage.setItem('conso.jeton', m[1]); } catch { /* rien */ }
    history.replaceState(null, '', location.pathname); // le jeton ne reste pas dans l'adresse
    return m[1];
  }
  try { return localStorage.getItem('conso.jeton'); } catch { return null; }
}
async function lireEnLigne() {
  const jeton = jetonLecture();
  if (!jeton) throw new Error("Lien incomplet : ouvre l'adresse complète (avec #k=…) une première fois.");
  try {
    const r = await fetch(`${EN_LIGNE.url}/rest/v1/rpc/conso_lire`, {
      method: 'POST', headers: { apikey: EN_LIGNE.cle, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_jeton: jeton }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.message || `Erreur ${r.status}`);
    if (!j?.donnees) throw new Error('Jeton refusé ou rien de publié pour le moment.');
    try { localStorage.setItem('conso.copie', JSON.stringify(j)); } catch { /* trop gros : tant pis */ }
    horsLigne = false;
    return j;
  } catch (e) {
    let copie = null;
    try { copie = JSON.parse(localStorage.getItem('conso.copie')); } catch { /* rien */ }
    if (!copie || /Jeton/.test(e.message)) throw e;
    horsLigne = true;
    return copie;
  }
}

async function charger() {
  if (EN_LIGNE?.desactive) { // page en pause : aucune requête vers Supabase
    $('#contenu').innerHTML = '<p class="vide">Page Conso en pause pour le moment.</p>';
    return;
  }
  try {
    if (EN_LIGNE) {
      const j = await lireEnLigne();
      D = j.donnees;
      D.maj = Date.parse(j.maj) || D.maj; // heure de l'envoi depuis le PC
    } else {
      const r = await fetch('/api/conso');
      horsLigne = r.headers.get('X-Conso-Hors-Ligne') === '1';
      D = await r.json();
      if (!r.ok) throw new Error(D.erreur);
    }
    preparer();
    afficher();
  } catch (e) {
    if (D) return; // on garde l'affichage précédent
    $('#contenu').innerHTML = EN_LIGNE
      ? `<p class="vide">Impossible de lire la consommation en ligne.<br><small>${esc(e.message)}</small></p>`
      : `<p class="vide">Impossible de joindre le PC (éteint, serveur du pilotage arrêté, ou Tailscale coupé sur ce téléphone).<br><small>${esc(e.message)}</small></p>`;
  }
}

$('#onglets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-vue]');
  if (!b) return;
  vue = b.dataset.vue;
  try { localStorage.setItem('conso.vue', vue); } catch { /* rien */ }
  afficher();
});
document.addEventListener('click', (e) => {
  const j = e.target.closest('[data-jour]');
  if (j) { choisirJour(j.dataset.jour); return; }
  const dec = e.target.closest('[data-decale]');
  if (dec) { const n = Number(dec.dataset.decale); choisirJour(cleJ(n ? ajoute(deCle(jourChoisi), n) : new Date())); return; }
  const b = e.target.closest('[data-plage]');
  if (!b) return;
  plage = Number(b.dataset.plage);
  try { localStorage.setItem('conso.plage', plage); } catch { /* rien */ }
  afficher();
});
document.addEventListener('change', (e) => { if (e.target.id === 'jour-date') choisirJour(e.target.value); });
let attente;
addEventListener('resize', () => { clearTimeout(attente); attente = setTimeout(afficher, 150); });
sombre.addEventListener('change', afficher);
if (!EN_LIGNE?.desactive) setInterval(charger, 2 * 60000);
// Revenir sur l'appli (téléphone) : recharger tout de suite.
document.addEventListener('visibilitychange', () => { if (!document.hidden) charger(); });
let horsLigne = false;
// Appli installable sur le téléphone : garde la page et les dernières données.
if ('serviceWorker' in navigator) {
  (EN_LIGNE ? navigator.serviceWorker.register('sw.js') : navigator.serviceWorker.register('conso-sw.js', { scope: '/conso' })).catch(() => {});
}
charger();
