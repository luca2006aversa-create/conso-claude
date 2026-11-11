// Cockpit : tout le site d'un coup d'œil. Globe au centre, chiffres clés autour, ce qui t'attend à droite.
'use strict';

H.vues.cockpit = {
  nom: 'Cockpit',
  vivant: true,

  rendre() {
    const d = H.d, t = H.calc.taches(), c = H.calc.clients(), x = H.calc.extractions(), co = H.calc.conso();
    const site = d.site, enLigne = site.reglages.enLigne;
    const jours30 = H.derniersJours(30);
    const extr30 = jours30.map((j) => { const p = x.parJour[j]; return p ? p.termine + p.echec + p.en_cours : 0; });
    const versions = site.etiquettes.filter((e) => /^v\d/.test(e.nom));
    const versions21 = H.derniersJours(21).map((j) => versions.filter((e) => H.jour(e.date) === j).length);
    const debout = site.instances.filter((i) => !i.releves.length || i.releves[i.releves.length - 1].ok).length;
    const etapes = d.clients.etapes.filter((e) => e.id !== 'ecarte');
    const barreEtapes = `<div style="display:flex;height:10px;border-radius:5px;overflow:hidden;margin-top:auto;background:var(--trait)">${etapes.map((e) => `<i title="${e.nom} : ${c.par[e.id] || 0}" style="flex:${Math.max(c.par[e.id] || 0, e.id === 'repere' ? 0 : (c.par[e.id] ? 6 : 0))};background:${G.V(e.couleur)}"></i>`).join('')}</div>`;
    const sim = H.sim ? H.sim.projeter(d.argent.scenario) : null;
    const eq = sim ? sim.N.findIndex((v, i) => i > 0 && v > 0) : -1;

    return `${H.entete('Cockpit')}
<div class="grille">
  <div class="carte kpi c3 lien" data-aller="atelier/versions"><h2>Version</h2><div class="chiffre">${G.esc(site.versionMain || '—')}<small>en travail</small></div>
    <div class="sous">en ligne : ${enLigne.url ? `<b class="plus">${G.esc(enLigne.version || 'oui')}</b>` : 'pas encore'}</div>${G.trait(versions21, 'accent')}</div>

  <div class="carte c6 r3 globe-boite"><h2>Le monde d'Ašru<em>glisse pour tourner · molette pour agrandir</em></h2>
    <div style="position:relative"><canvas id="globe"></canvas><div id="bulle"></div>
      <div class="couches">
        <label><input type="checkbox" data-c="agences"><i style="background:var(--accent)"></i>Agences</label>
        <label><input type="checkbox" data-c="extractions"><i style="background:var(--orange)"></i>Extractions</label>
        <label><input type="checkbox" data-c="serveurs"><i style="background:var(--vert);border-radius:2px"></i>Serveurs</label>
        <label><input type="checkbox" data-c="cibles"><i style="border:2px dashed var(--accent);background:none"></i>À prospecter</label>
      </div>
      <div class="zoom"><button data-z="+" title="Agrandir">+</button><button data-z="-" title="Réduire">−</button></div>
    </div></div>

  <div class="carte c3 lien" data-aller="serveurs"><h2>Santé</h2><div class="anneaux">
    ${G.anneau(site.instances.length ? debout / site.instances.length * 100 : 0, debout === site.instances.length ? 'vert' : 'orange', 'Instances', `${debout}/${site.instances.length}`)}
    ${G.anneau(x.reussite, x.reussite >= 90 ? 'vert' : 'orange', 'Extractions')}</div></div>

  <div class="carte kpi c3 lien" data-aller="clients"><h2>Agences</h2><div class="chiffre">${c.contactes}<small>/ ${c.total} contactées</small></div>
    <div class="sous">${c.par.demo || 0} démo · ${c.par.lettre || 0} lettre · ${c.par.client || 0} client</div>${barreEtapes}</div>

  <div class="carte c3 lien" data-aller="conso"><h2>Conso Claude<em>${co.actif ? G.esc(co.actif.compte) : ''}</em></h2><div class="anneaux">
    ${co.actif ? G.anneau(co.actif.semaine, co.actif.semaine > 85 ? 'rouge' : 'orange', 'Semaine') + G.anneau(co.actif.cinqHeures, co.actif.cinqHeures > 85 ? 'rouge' : 'accent', '5 heures') : G.vide('Pas de relevé')}</div>
    <div class="sous" style="text-align:center;margin-top:4px">${G.court(co.aujourdhui)} tokens aujourd'hui</div></div>

  ${G.kpi('Extractions', `${extr30.reduce((a, b) => a + b, 0)}<small>en 30 jours</small>`, `${x.total} en tout · ${G.nb(x.aire)} km²`, extr30, 'orange', 'c3', 'extractions')}

  <div class="carte c3"><h2>À faire</h2><div class="todo">
    <div data-aller="clients/echanges" style="--c:var(--rouge)"><b>${c.relances.length}</b><span>relances<br>à faire</span></div>
    <div data-aller="taches" style="--c:var(--rose)"><b>${t.aValider}</b><span>à valider</span></div>
    <div data-aller="taches" style="--c:var(--orange)"><b>${t.attendToi}</b><span>attendent<br>ta réponse</span></div>
    <div data-aller="taches" style="--c:var(--accent)"><b>${t.notes}</b><span>notes<br>à ranger</span></div></div></div>

  <div class="carte c5 lien" data-aller="taches"><h2>Tâches<em>par semaine</em></h2>
    ${G.courbes([{ v: t.semaines.creees, c: 'accent', nom: 'ouvertes' }, { v: t.semaines.faites, c: 'vert', aire: 1, nom: 'terminées' }], { x: t.semaines.x, h: 200 })}
    ${G.legende([['accent', 'ouvertes'], ['vert', 'terminées']])}</div>
  <div class="carte c4 lien" data-aller="clients"><h2>Parcours des agences</h2>${G.entonnoir(c.entonnoir.filter((e, i) => [0, 1, 3, 5].includes(i)))}</div>
  <div class="carte c3 lien" data-aller="taches"><h2>Tâches</h2>${G.donut([{ nom: 'Faites', v: t.par.fait || 0, c: 'vert' }, { nom: 'À valider', v: t.par.a_valider || 0, c: 'rose' }, { nom: 'En cours', v: t.par.en_cours || 0, c: 'orange' },
    { nom: 'À faire', v: t.par.a_faire || 0, c: 'accent' }, { nom: 'Idées', v: t.par.idee || 0, c: 'violet' }, { nom: 'En pause', v: t.par.en_pause || 0, c: 'encre-3' }], String(t.ouvertes), 'ouvertes', 150)}</div>

  <div class="carte c6 lien" data-aller="argent"><h2>Argent<em>prévision de ton scénario, sur 2 ans</em></h2>
    ${sim ? G.courbes([{ v: sim.R, c: 'vert', pointille: 0, nom: 'revenus' }, { v: sim.C, c: 'rouge', pointille: 0, nom: 'dépenses' }, { v: sim.N, c: 'accent', aire: 1, pointille: 0, nom: 'reste' }],
      { x: sim.R.map((_, i) => `m${i}`), unite: ' €', h: 200, zero: true, marques: eq > 0 ? [{ i: eq, s: 2, t: 'équilibre', c: 'vert' }] : [] }) : ''}
    ${G.legende([['vert', 'revenus'], ['rouge', 'dépenses'], ['accent', 'ce qu\'il te reste']])}</div>
  <div class="carte c6 lien" data-aller="atelier"><h2>Dernières versions<em>survole un point</em></h2>${this.frise(versions.slice(0, 7).reverse(), enLigne)}</div>
</div>`;
  },

  // Les dernières versions sur une ligne ; la plus récente à droite.
  frise(versions, enLigne) {
    if (!versions.length) return G.vide('Pas encore de version étiquetée');
    const w = 640, pas = (w - 80) / Math.max(1, versions.length - 1);
    return `<svg viewBox="0 0 ${w} 150" width="100%"><line x1="20" x2="${w - 20}" y1="70" y2="70" stroke="${G.V('encre')}" stroke-width="3"/>${versions.map((v, i) => {
      const x = versions.length === 1 ? w / 2 : 40 + i * pas, dernier = i === versions.length - 1, ligne = enLigne.version && v.nom === `v${enLigne.version}`;
      return `<circle cx="${x}" cy="70" r="${dernier ? 11 : 8}" fill="${G.V(dernier ? 'accent' : 'surface')}" stroke="${G.V(ligne ? 'vert' : dernier ? 'accent' : 'encre-3')}" stroke-width="4"><title>${G.esc(v.message || v.nom)}</title></circle>
        <text class="f" x="${x}" y="100" text-anchor="middle">${G.esc(v.nom.replace(/^v/, ''))}</text><text x="${x}" y="116" text-anchor="middle">${H.dateCourte(v.date)}</text>
        ${dernier ? `<rect x="${x - 38}" y="24" width="76" height="22" rx="11" fill="${G.V('accent')}"/><text x="${x}" y="39" text-anchor="middle" style="fill:var(--sur);font-weight:600">en travail</text>` : ''}
        ${ligne ? `<rect x="${x - 34}" y="24" width="68" height="22" rx="11" fill="${G.V('vert')}"/><text x="${x}" y="39" text-anchor="middle" style="fill:var(--sur);font-weight:600">en ligne</text>` : ''}`;
    }).join('')}</svg>`;
  },

  apres() {
    const d = H.d, x = H.calc.extractions();
    const pc = d.site.reglages.serveurs.find((s) => s.etat !== 'prevu' && (s.lon || s.lat));
    const points = [
      ...d.clients.villes.filter((v) => v.lon !== undefined).map((v) => ({ couche: 'agences', lon: v.lon, lat: v.lat, r: v.agences, t: `${v.nom} · ${v.agences} agences, ${v.contactees} contactées`, aller: 'clients' })),
      ...x.groupes.map((g) => ({ couche: 'extractions', lon: g.lon, lat: g.lat, r: g.n, t: `${g.lieu} · ${g.n} extraction${g.n > 1 ? 's' : ''}`, aller: 'extractions' })),
      ...d.site.reglages.serveurs.filter((s) => s.lon || s.lat).map((s) => ({ couche: 'serveurs', lon: s.lon, lat: s.lat, etat: s.etat, t: `${s.nom} · ${s.lieu} · ${{ local: 'local', prevu: 'prévu', en_ligne: 'en ligne' }[s.etat]}`, aller: 'serveurs' })),
      ...d.site.reglages.cibles.map((v) => ({ couche: 'cibles', lon: v.lon, lat: v.lat, t: `${v.nom} · à prospecter` })),
    ];
    const arcs = pc ? x.groupes.filter((g) => Math.hypot(g.lon - pc.lon, g.lat - pc.lat) > 1.5).map((g) => ({ de: [pc.lon, pc.lat], a: [g.lon, g.lat], poids: g.n })) : [];
    H.globe({ points, arcs });
  },
};
