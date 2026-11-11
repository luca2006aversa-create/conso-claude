// Extractions : tout ce qui a été réellement extrait (dossiers data/jobs du site) — combien, quand, où, depuis
// quelles sources, en combien de temps, et ce qui a échoué.
'use strict';

H.vues.extractions = {
  nom: 'Extractions',

  rendre() {
    const x = H.calc.extractions(), jours = H.derniersJours(60);
    const serie = (cle) => jours.map((j) => x.parJour[j]?.[cle] || 0);
    const total60 = jours.map((j) => { const p = x.parJour[j]; return p ? p.termine + p.echec + p.en_cours : 0; });
    const couleurs = { OpenStreetMap: 'accent', Calculé: 'violet', Eau: 'turquoise', Satellite: 'orange', Relief: 'vert', Importé: 'rose', 'Plans de ville': 'rouge', 'Population et bâti': 'encre-2', 'Bâti mondial': 'encre-3', 'Occupation du sol': 'encre-3', Autre: 'encre-3' };
    const sources = Object.entries(x.sources).sort((a, b) => b[1] - a[1]);
    // Quand : jour de la semaine × heure (heure du PC).
    const grille = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const e of x.liste) { if (!e.debut) continue; const d = new Date(e.debut); grille[(d.getDay() + 6) % 7][d.getHours()]++; }
    const finies = x.liste.filter((e) => e.statut === 'termine' && e.duree && e.aire);
    const duree = (s) => (s >= 90 ? `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')}` : `${Math.round(s)} s`);
    const coulStatut = { termine: 'vert', echec: 'rouge' };
    const dernieres = [...x.liste].reverse().slice(0, 12);

    return `${H.entete('Extractions')}
<div class="grille">
  ${G.kpi('Extractions', String(x.total), `${total60.reduce((a, b) => a + b, 0)} sur 60 jours`, total60, 'orange')}
  <div class="carte c3"><h2>Réussite</h2><div class="anneaux">${G.anneau(x.reussite, x.reussite >= 90 ? 'vert' : 'orange', `${x.finies} réussies`)}${G.anneau(x.total ? x.echecs.length / x.total * 100 : 0, 'rouge', `${x.echecs.length} échecs`, String(x.echecs.length))}</div></div>
  ${G.kpi('Durée habituelle', duree(x.dureeMediane), 'la moitié finissent avant', finies.slice(-30).map((e) => e.duree), 'accent')}
  ${G.kpi('Surface extraite', `${G.court(x.aire)}<small>km²</small>`, `${G.court(x.liste.reduce((s, e) => s + (e.objets || 0), 0))} objets relevés`, null, 'turquoise')}

  <div class="carte c8"><h2>Par jour<em>60 derniers jours</em></h2>
    ${G.barres([{ nom: 'réussies', c: 'vert', v: serie('termine') }, { nom: 'échecs', c: 'rouge', v: serie('echec') }, { nom: 'interrompues ou en cours', c: 'orange', v: serie('en_cours') }], { x: jours.map(H.dateCourte) })}
    ${G.legende([['vert', 'réussies'], ['rouge', 'échecs'], ['orange', 'interrompues ou en cours']])}</div>
  <div class="carte c4"><h2>Sources de données<em>couches extraites</em></h2>${G.donut(sources.map(([nom, v]) => ({ nom, v, c: couleurs[nom] || 'encre-3' })), G.court(sources.reduce((s, a) => s + a[1], 0)), 'couches', 150)}
    ${G.legende(sources.slice(0, 6).map(([nom, v]) => [couleurs[nom] || 'encre-3', `${nom} ${v}`]))}</div>

  <div class="carte c8"><h2>Quand<em>jour × heure (heure du PC)</em></h2>
    ${G.chaleur(grille, 'orange', { lignes: ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'], cw: 25, ch: 22, cols: Array.from({ length: 24 }, (_, i) => (i % 3 ? '' : `${i} h`)), titre: (v, j, i) => `${['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][j]} ${i} h : ${v}` })}</div>
  <div class="carte c4"><h2>Où</h2>${G.barresH(Object.entries(x.lieux).sort((a, b) => b[1] - a[1]).slice(0, 9).map(([nom, v]) => ({ nom, v, c: 'orange' })))}</div>

  <div class="carte"><h2>Plus c'est grand, plus c'est long ?<em>une bulle = une extraction réussie · une graduation = 10 fois plus</em></h2>
    ${finies.length ? G.nuage(finies.map((e) => ({ x: e.aire, y: e.duree / 60, r: 4 + Math.sqrt(e.couches || 1), c: 'accent', nom: `${e.nom} · ${G.nb(e.aire, 1)} km² · ${duree(e.duree)} · ${e.couches} couches` })), { xn: 'surface (km²)', yn: 'minutes', log: true }) : G.vide('Pas encore d\'extraction terminée')}</div>
  <div class="carte"><h2>Les dernières<em>longueur = durée</em></h2>
    ${G.barresH(dernieres.map((e) => ({ nom: `${H.dateCourte(x.jourDe(e))} · ${e.nom}`, v: Math.max(e.duree || 0, 3), c: coulStatut[e.statut] || 'orange', txt: e.statut === 'echec' ? 'échec' : e.duree ? duree(e.duree) : '…' })))}</div>

  <div class="carte c12"><h2>Ce qui a échoué<em>${x.echecs.length} en tout</em></h2>
    ${x.echecs.length ? `<div class="fil">${[...x.echecs].reverse().slice(0, 8).map((e) => `<div style="--c:var(--rouge)"><time>${H.dateCourte(x.jourDe(e))} · ${G.esc(H.calc.lieu(e.centre))}</time><b>${G.esc(e.nom)}</b><br><span class="sous">${G.esc((e.erreur || 'cause non notée').slice(0, 170))}</span></div>`).join('')}</div>` : G.vide('Aucun échec', '✓')}</div>
</div>`;
  },
};
