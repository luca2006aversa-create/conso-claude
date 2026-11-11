// Serveurs : où tourne le site aujourd'hui (les instances du PC), en quel état, et ce qui est prévu en ligne.
// Les temps de réponse et la disponibilité viennent des relevés faits chaque minute par le serveur du pilotage.
'use strict';

H.vues.serveurs = {
  nom: 'Serveurs',
  vivant: true,
  VILLES: [['Paris', 2.35, 48.85], ['Francfort', 8.68, 50.11], ['Amsterdam', 4.9, 52.37], ['Londres', -0.12, 51.5], ['Singapour', 103.82, 1.35],
    ['Hanoï', 105.85, 21.03], ['Hô Chi Minh-Ville', 106.7, 10.78], ['Hong Kong', 114.17, 22.32], ['Tokyo', 139.7, 35.68]],
  ETATS: { local: ['local', 'accent'], prevu: ['prévu', 'encre-3'], en_ligne: ['en ligne', 'vert'] },

  rendre() {
    const s = H.d.site, r = s.reglages, principal = s.instances.find((i) => i.nom === 'sitescope-api') || s.instances[0];
    const dernier = (i) => i.releves[i.releves.length - 1];
    const debout = s.instances.filter((i) => !i.releves.length || dernier(i).ok);
    const couleurs = ['accent', 'orange', 'violet', 'turquoise', 'rose'];
    const suivies = [principal, ...s.instances.filter((i) => i !== principal)].filter((i) => i && i.releves.length > 1).slice(0, 5);
    const n = Math.max(0, ...suivies.map((i) => i.releves.length));
    const heures = suivies[0] ? suivies[0].releves.map((p) => new Date(p.t).toTimeString().slice(0, 5)) : [];
    // Disponibilité par jour de l'instance principale (ou du site en ligne quand il existe).
    const cible = r.enLigne.url ? 'en-ligne' : principal?.nom;
    const jours = H.derniersJours(90), parJour = Object.fromEntries(s.jours.map((j) => [j.jour, j.instances[cible]]));
    const coul = jours.map((j) => { const x = parJour[j]; if (!x || !x.total) return null; const p = x.ok / x.total; return p >= .99 ? 'vert' : p >= .9 ? 'orange' : 'rouge'; });
    const releves = jours.map((j) => parJour[j]).filter((x) => x && x.total), dispo = releves.length ? releves.reduce((a, x) => a + x.ok, 0) / releves.reduce((a, x) => a + x.total, 0) * 100 : null;
    const x = H.calc.extractions(), sources = Object.entries(x.sources).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const court = (nom) => (nom === 'sitescope-api' ? 'principal' : nom.replace(/^sitescope-?/, '') || 'principal');

    return `${H.entete('Serveurs')}
<div class="grille">
  <div class="carte c4 ${r.enLigne.url ? '' : 'prevu'}"><h2>Le site en ligne</h2>
    ${r.enLigne.url ? `<div class="chiffre plus">En ligne<small>${G.esc(r.enLigne.version || '')}</small></div><div class="sous"><a href="${G.esc(r.enLigne.url)}" target="_blank" rel="noopener">${G.esc(r.enLigne.url.replace(/^https?:\/\//, ''))}</a></div>${G.trait(s.enLigneReleves.map((p) => p.ms), 'vert')}`
      : `<div class="chiffre" style="color:var(--encre-3)">Pas encore</div><div class="sous">Le jour de la mise en ligne, colle son adresse ici : le hub suivra sa santé.</div>`}
    ${H.enLigne ? '' : `<div class="ligne-form"><input class="champ" id="el-url" placeholder="https://…" value="${G.esc(r.enLigne.url)}"><input class="champ" id="el-version" placeholder="version" value="${G.esc(r.enLigne.version)}" style="flex:0 1 80px"><button class="btn" id="el-ok">OK</button></div>`}</div>
  ${G.kpi('Instances debout', `${debout.length}<small>/ ${s.instances.length}</small>`, s.docker === 'ok' ? 'sur ton PC (Docker)' : 'Docker est arrêté', null, 'vert', 'c2')}
  ${G.kpi('Version en travail', G.esc(s.versionMain || '—'), 'branche principale', null, 'accent', 'c2')}
  ${G.kpi('Disque libre', principal?.details?.disque != null ? `${G.nb(principal.details.disque)}<small>Go</small>` : '—', 'sur le PC', null, 'accent', 'c2')}
  ${G.kpi('Sources de données', principal?.details ? String(principal.details.sources) : '—', principal?.details ? `satellite : ${principal.details.satellite ? 'branché' : 'non branché'}` : 'pas encore relevé', null, 'accent', 'c2')}

  <div class="carte c12"><h2>Instances qui tournent<em>une par chantier · relevé chaque minute</em></h2>
    ${s.instances.length ? `<div class="inst">${s.instances.map((i) => { const d = dernier(i); return `<div><div class="t"><i class="${d ? (d.ok ? '' : 'ko') : 'gris'}"></i>${G.esc(court(i.nom))}<span class="sous" style="margin-left:auto;font-weight:400">:${i.port}</span></div>
      <div class="sous">${G.esc(i.branche || 'sans branche')}${i.version ? ` · ${G.esc(i.version)}` : ''}</div>
      ${i.releves.length > 1 ? G.trait(i.releves.map((p) => p.ms), d.ok ? 'vert' : 'rouge', 180, 28) : '<div class="sous">premier relevé dans une minute</div>'}
      <div class="sous" style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">${d ? `${d.ms} ms` : ''}${H.enLigne ? '' : `<a class="btn petit" href="http://localhost:${i.port}/" target="_blank" rel="noopener">Ouvrir</a>`}</div></div>`; }).join('')}</div>`
      : G.vide(s.docker === 'ok' ? 'Aucune instance du site ne tourne' : 'Docker est arrêté : aucune instance visible')}</div>

  <div class="carte c8"><h2>Temps de réponse<em>${n ? `${n} derniers relevés` : ''}</em></h2>
    ${suivies.length ? G.courbes(suivies.map((i, k) => ({ v: i.releves.map((p) => p.ms), c: couleurs[k], nom: court(i.nom), aire: k === 0 })), { x: heures, unite: ' ms', h: 220 }) + G.legende(suivies.map((i, k) => [couleurs[k], court(i.nom)]))
      : G.vide('Les relevés commencent dès que le pilotage tourne : reviens dans quelques minutes')}</div>
  <div class="carte c4"><h2>Disponibilité<em>${cible === 'en-ligne' ? 'site en ligne' : 'instance principale'}</em></h2>
    <div class="anneaux">${dispo == null ? G.vide('Pas encore de relevé') : G.anneau(dispo, dispo >= 99 ? 'vert' : 'orange', `${releves.length} jour${releves.length > 1 ? 's' : ''} relevé${releves.length > 1 ? 's' : ''}`, `${G.nb(dispo, 1)} %`)}</div>
    <div style="margin-top:10px">${G.bande(coul, jours.map((j) => { const p = parJour[j]; return `${H.dateCourte(j)} : ${p && p.total ? `${Math.round(p.ok / p.total * 100)} %` : 'pas de relevé'}`; }))}</div>
    <div class="sous" style="display:flex;justify-content:space-between"><span>il y a 90 jours</span><span>aujourd'hui</span></div></div>

  <div class="carte c8"><h2>Le trajet d'une demande<em>aujourd'hui sur ton PC · le serveur en ligne prendra la place de « Entrée »</em></h2><div class="defile">${this.schema(principal, debout.includes(principal), x, sources)}</div></div>
  <div class="carte c4"><h2>Tes serveurs<em>montrés sur le globe</em></h2>
    ${G.barresH(r.serveurs.map((v) => ({ nom: `${v.nom} · ${v.lieu}`, v: Math.max(v.cout, .5), c: this.ETATS[v.etat][1], txt: `${this.ETATS[v.etat][0]}${v.cout ? ` · ${G.nb(v.cout)} €` : ''}` })))}
    ${H.enLigne ? '' : `<div class="ligne-form"><input class="champ" id="sv-nom" placeholder="Nom (VPS…)"><select class="champ" id="sv-ville">${this.VILLES.map((v, i) => `<option value="${i}">${v[0]}</option>`).join('')}</select>
      <select class="champ" id="sv-etat"><option value="prevu">prévu</option><option value="en_ligne">en ligne</option><option value="local">local</option></select>
      <input class="champ" id="sv-cout" type="number" min="0" placeholder="€/mois" style="flex:0 1 80px"><button class="btn p" id="sv-ajouter">Ajouter</button></div>
    <div class="boutons">${r.serveurs.map((v) => `<span class="puce">${G.esc(v.nom)} <button class="suppr" data-suppr-serveur="${G.esc(v.id)}" title="Retirer">×</button></span>`).join('')}</div>`}</div>
</div>`;
  },

  // Schéma animé : navigateur → entrée → site / extractions → sources de données.
  schema(principal, debout, x, sources) {
    const etat = debout ? 'vert' : 'rouge';
    const noeuds = [[10, 100, 80, 'Navigateur', 'toi, tes invités', 'accent'], [170, 100, 130, 'Entrée', principal ? `PC · port ${principal.port}` : 'arrêtée', etat],
      [370, 40, 130, 'Site + comptes', principal?.version ? `version ${principal.version}` : '', etat], [370, 160, 130, 'Extractions', `${x.total} lancées · ${x.reussite} % réussies`, x.reussite >= 90 ? 'vert' : 'orange'],
      ...sources.map(([nom, nb], i) => [570, 20 + i * 76, 120, nom, `${G.nb(nb)} couches`, 'vert'])];
    const liens = [[90, 124, 170, 124, 5], [300, 124, 370, 64, 4], [300, 124, 370, 184, 3], ...sources.map((_, i) => [500, 184, 570, 44 + i * 76, 3 - i * .7])];
    return `<svg viewBox="0 0 700 250" width="100%" style="min-width:560px">
      ${liens.map(([a, b, c, d, e]) => `<path d="M${a} ${b}C${(a + c) / 2} ${b} ${(a + c) / 2} ${d} ${c} ${d}" fill="none" stroke="${G.V(etat)}" stroke-width="${1.5 + e}" opacity=".5" stroke-dasharray="7 6">${debout ? `<animate attributeName="stroke-dashoffset" from="26" to="0" dur="${1.8 - e / 5}s" repeatCount="indefinite"/>` : ''}</path>`).join('')}
      ${noeuds.map(([px, py, l, a, b, c]) => `<rect x="${px}" y="${py}" width="${l}" height="48" rx="10" fill="${G.V('surface')}" stroke="${G.V(c)}" stroke-width="2"/><circle cx="${px + 13}" cy="${py + 14}" r="4" fill="${G.V(c)}"/><text class="f" x="${px + 23}" y="${py + 18}">${G.esc(a)}</text><text x="${px + 10}" y="${py + 36}">${G.esc(b)}</text>`).join('')}
    </svg>`;
  },

  apres() {
    if (H.enLigne) return;
    const r = H.d.site.reglages, v = (id) => document.getElementById(id).value;
    const enregistrer = async (champs, message) => { const rep = await H.essayer(() => H.api('PUT', 'hub/site', champs), message); if (rep) { H.d.site.reglages = rep; H.rendre(); } };
    document.getElementById('el-ok').onclick = () => enregistrer({ enLigne: { url: v('el-url'), version: v('el-version'), depuis: r.enLigne.depuis || H.jour() } }, 'Adresse enregistrée');
    document.getElementById('sv-ajouter').onclick = () => { const ville = this.VILLES[Number(v('sv-ville'))];
      enregistrer({ serveurs: [...r.serveurs, { id: `s${Date.now().toString(36)}`, nom: v('sv-nom').trim() || 'Serveur', lieu: ville[0], lon: ville[1], lat: ville[2], etat: v('sv-etat'), cout: Number(v('sv-cout')) || 0 }] }, 'Serveur ajouté'); };
    document.querySelectorAll('[data-suppr-serveur]').forEach((b) => { b.onclick = () => enregistrer({ serveurs: r.serveurs.filter((s) => s.id !== b.dataset.supprServeur) }, 'Serveur retiré'); });
  },
};
