// Conso Claude. Sur le PC : la page Conso d'origine, entière (tous ses graphiques et tableaux), dans le hub.
// En ligne : un résumé (limites, 30 jours, projets, modèles) et un lien vers la page Conso complète en ligne.
'use strict';

H.vues.conso = {
  nom: 'Conso',
  plein: () => !H.enLigne,

  rendre() {
    if (!H.enLigne) return `${H.entete('Conso Claude')}<iframe src="conso.html" data-incruste title="Consommation Claude"></iframe>`;
    const c = H.d.conso, k = H.calc.conso(), jours = H.derniersJours(30), v30 = k.jours(30);
    const projets = Object.entries(c.projets).sort((a, b) => b[1] - a[1]), modeles = Object.entries(c.modeles).sort((a, b) => b[1] - a[1]);
    const couleurs = ['accent', 'turquoise', 'violet', 'orange', 'rose', 'vert'];
    const parts = (liste) => [...liste.slice(0, 5).map(([nom, v], i) => ({ nom, v, c: couleurs[i] })), ...(liste.length > 5 ? [{ nom: 'autres', v: liste.slice(5).reduce((s, x) => s + x[1], 0), c: 'encre-3' }] : [])];
    // Calendrier : 26 semaines, une colonne par semaine.
    const debut = new Date(`${H.lundi(H.jour(Date.now() - 25 * 7 * 864e5))}T12:00:00`);
    const grille = Array.from({ length: 7 }, (_, j) => Array.from({ length: 26 }, (_, s) => c.jours[H.jour(debut.getTime() + (s * 7 + j) * 864e5)]?.tok || 0));
    return `${H.entete('Conso Claude', { droite: window.HUB_CONFIG.conso ? `<a class="btn petit" href="${G.esc(window.HUB_CONFIG.conso)}">Page Conso complète</a>` : '' })}
<div class="grille">
  ${G.kpi("Aujourd'hui", G.court(k.aujourdhui), 'tokens', v30.slice(-14), 'violet', 'c4')}
  <div class="carte c8"><h2>Limites<em>dernier relevé de chaque compte</em></h2><div class="anneaux">${c.limites.map((l) => G.anneau(l.semaine, l.semaine > 85 ? 'rouge' : 'orange', `${l.compte} · semaine`) + G.anneau(l.cinqHeures, l.cinqHeures > 85 ? 'rouge' : 'accent', `${l.compte} · 5 h`)).join('') || G.vide('Pas de relevé')}</div></div>
  <div class="carte c12"><h2>Calendrier<em>6 mois</em></h2>${G.chaleur(grille, 'violet', { lignes: ['lun', '', 'mer', '', 'ven', '', 'dim'], cw: 24, ch: 18, titre: (v, j, s) => `${H.dateCourte(H.jour(debut.getTime() + (s * 7 + j) * 864e5))} : ${G.court(v)}` })}</div>
  <div class="carte c12"><h2>Par jour<em>30 jours</em></h2>${G.barres([{ nom: 'tokens', c: 'violet', v: v30 }], { x: jours.map(H.dateCourte) })}</div>
  <div class="carte"><h2>Par projet<em>7 jours</em></h2>${G.donut(parts(projets), G.court(projets.reduce((s, x) => s + x[1], 0)), 'tokens', 150)}${G.legende(parts(projets).map((p) => [p.c, p.nom]))}</div>
  <div class="carte"><h2>Par modèle<em>7 jours</em></h2>${G.donut(parts(modeles), String(modeles.length), 'modèles', 150)}${G.legende(parts(modeles).map((p) => [p.c, p.nom]))}</div>
</div>`;
  },
};
