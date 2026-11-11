// Argent : ce qui rentre et ce qui sort (réel, noté à la main), la prévision du simulateur, la grille des prix
// et le trajet d'un euro. Les hypothèses de calcul viennent de la grille des prix du site (docs/TARIFS.md).
'use strict';

/* ---------- Simulateur (utilisé aussi par le cockpit) ---------- */
H.sim = {
  // Projette mois par mois : R = revenus hors taxe, C = dépenses + cotisations, N = ce qu'il reste, K = clients.
  projeter(s, mois = 24) {
    const t = H.d.argent.tarifs, hy = t.hypotheses, prix = (id) => t.formules.find((f) => f.id === id).mois;
    const vn = s.vn / 100, ag = s.agences / 100, depart = s.departs / 100;
    const remise = 1 - vn + vn * hy.coefVN, remiseAg = 1 - vn + vn * hy.coefVNAgence, tva = (1 - vn) * hy.tvaUE + vn * hy.tvaVN;
    const envie = Math.exp(-(s.prixPro - prix('pro')) / 26);     // hypothèse : moins de « Pro » quand son prix monte
    const reel = H.calc.depensesDuMois(H.mois()), fixe = reel > 0 ? reel : hy.coutFixe;
    let etu = 0, pro = 0, age = 0;
    const R = [], C = [], N = [], K = [];
    for (let m = 0; m <= mois; m++) {
      const n = etu + pro + age;
      const ttcPerso = etu * prix('etudiant') * remise + pro * s.prixPro * remise, htAgences = age * prix('agence_s') * remiseAg;
      const ht = ttcPerso / (1 + tva) + htAgences;
      const cout = fixe + hy.coutParClient * n + hy.paiementPct * (ttcPerso + htAgences) + hy.paiementFixe * n + hy.cotisations * ht;
      R.push(ht); C.push(cout); N.push(ht - cout); K.push(n);
      etu = etu * (1 - depart) + s.nouveaux * (1 - ag) * .65;
      pro = pro * (1 - depart) + s.nouveaux * (1 - ag) * .35 * envie;
      age = age * (1 - depart * .5) + s.nouveaux * ag;
    }
    return { R, C, N, K, fixe, fixeReel: reel > 0 };
  },
};

H.vues.argent = {
  nom: 'Argent',
  // La grille complète (hypothèses fiscales personnelles) n'existe que sur le PC.
  get onglets() { return H.enLigne ? null : [['', 'Pilotage'], ['grille', 'Grille des prix']]; },
  plein: (onglet) => onglet === 'grille' && !H.enLigne,

  rendre(onglet) {
    // La grille des prix complète (page « Tarifs et revenus », #267) : offres, objectif, hypothèses, structure.
    if (onglet === 'grille' && !H.enLigne) return `${H.entete('Argent', { onglets: this.onglets, actif: 'grille', base: 'argent' })}<iframe src="tarifs.html" title="Tarifs et revenus d'Ašru"></iframe>`;
    const a = H.d.argent, mois = H.mois(), e = (H.etat.argent ??= { sim: { ...a.scenario }, formule: 'pro', pays: 'ue' });
    const passes = H.derniersMois(12), futurs = H.derniersMois(12, 12);
    const dep = passes.map(H.calc.depensesDuMois), rev = passes.map(H.calc.revenusDuMois);
    const sim = H.sim.projeter(a.scenario), eq = sim.N.findIndex((v, i) => i > 0 && v > 0);
    const depMois = dep[11], revMois = rev[11];
    const contrats = {};
    for (const r of a.revenus.filter((x) => x.mois === mois)) contrats[r.formule || 'autre'] = (contrats[r.formule || 'autre'] || 0) + 1;
    const formule = (id) => a.tarifs.formules.find((f) => f.id === id);
    const parts = Object.entries(contrats).map(([id, v]) => ({ nom: formule(id)?.nom || 'Autre', v, c: formule(id)?.couleur || 'encre-3' }));
    const postes = {};
    for (const d of a.depenses) { if (d.fin && d.fin < mois) continue; postes[d.poste] = (postes[d.poste] || 0) + (d.rythme === 'mois' ? d.montant : d.rythme === 'an' ? d.montant / 12 : 0); }
    const couleurs = { Outils: 'violet', Serveur: 'vert', Données: 'turquoise', Domaine: 'accent', Voyage: 'orange', Autre: 'encre-3' };
    const lecture = H.enLigne;

    return `${H.entete('Argent', { onglets: this.onglets, actif: '', base: 'argent' })}
<div class="grille">
  ${G.kpi('Dépenses ce mois', G.eur(depMois), a.depenses.length ? `${a.depenses.length} ligne${a.depenses.length > 1 ? 's' : ''} dans ton carnet` : 'carnet vide : note-les plus bas', dep, 'rouge')}
  ${G.kpi('Revenus ce mois', G.eur(revMois), revMois ? `${a.revenus.filter((x) => x.mois === mois).length} paiement(s)` : 'pas encore de vente', rev, 'vert')}
  ${G.kpi('Il te reste', `<span class="${revMois - depMois < 0 ? 'moins' : 'plus'}">${G.eur(revMois - depMois)}</span>`, 'ce mois, avant cotisations', rev.map((r, i) => r - dep[i]), 'accent')}
  ${G.kpi('Prévision dans 12 mois', `${G.eur(sim.R[12])}<small>/ mois</small>`, eq > 0 ? `équilibre au mois ${eq} · ${Math.round(sim.K[12])} clients` : 'pas d\'équilibre avec ce scénario', sim.R.slice(0, 13), 'violet')}

  <div class="carte c8"><h2>Ce qui rentre, ce qui sort<em>trait plein = réel · pointillés = prévision du scénario</em></h2>
    ${G.courbes([{ v: [...rev, ...sim.R.slice(1, 13)], c: 'vert', aire: 1, pointille: 11, nom: 'revenus' }, { v: [...dep, ...sim.C.slice(1, 13)], c: 'rouge', pointille: 11, nom: 'dépenses' }],
      { x: [...passes, ...futurs].map(H.moisCourt), unite: ' €', h: 250, marques: [{ i: 11, t: "aujourd'hui" }] })}
    ${G.legende([['vert', 'revenus'], ['rouge', 'dépenses (et cotisations dans la prévision)']])}</div>
  <div class="carte c4"><h2>Tes contrats<em>ce mois</em></h2>
    ${parts.length ? G.donut(parts, String(parts.reduce((s, p) => s + p.v, 0)), 'contrats') + G.legende(parts.map((p) => [p.c, `${p.nom} ${p.v}`])) : G.donut([], '0', 'contrat') + '<div class="sous" style="text-align:center">Les contrats apparaîtront ici dès le premier paiement noté.</div>'}</div>

  <div class="carte c12"><h2>Simulateur : et si…<em>bouge les curseurs</em></h2>
    <div class="grille" style="gap:18px">
      <div class="reglages" style="grid-column:span 3">
        <label>Prix « Pro » / mois<output id="o-prixPro"></output><input type="range" id="s-prixPro" min="9" max="99" value="${e.sim.prixPro}"></label>
        <label>Nouveaux clients / mois<output id="o-nouveaux"></output><input type="range" id="s-nouveaux" min="0" max="80" value="${e.sim.nouveaux}"></label>
        <label>Clients qui partent / mois<output id="o-departs"></output><input type="range" id="s-departs" min="0" max="15" value="${e.sim.departs}"></label>
        <label>Part du Viêt Nam<output id="o-vn"></output><input type="range" id="s-vn" min="0" max="100" step="5" value="${e.sim.vn}"></label>
        <label>Agences parmi les nouveaux<output id="o-agences"></output><input type="range" id="s-agences" min="0" max="30" value="${e.sim.agences}"></label>
        <div class="boutons" style="margin:0">${lecture ? '' : '<button class="btn p" id="sim-garder">Garder ce scénario</button>'}<button class="btn" id="sim-retour">Revenir</button></div>
      </div>
      <div style="grid-column:span 9;min-width:0"><div class="resultats" id="sim-res"></div><div id="sim-courbe"></div>
        ${G.legende([['vert', 'revenus hors taxe'], ['rouge', 'dépenses + cotisations'], ['accent', 'ce qu\'il te reste']])}
        <div class="sous" id="sim-note" style="margin-top:6px"></div></div>
    </div></div>

  <div class="carte"><h2>Quel prix mettre ?<em>revenu dans 2 ans selon le prix « Pro »</em></h2><div id="sim-prix"></div>
    <div class="sous">La forme de cette courbe est une hypothèse tant qu'aucun client n'a payé.</div></div>
  <div class="carte"><h2>Où part chaque euro<em>pour un mois d'abonnement</em></h2>
    <div class="boutons" style="margin-top:0">${a.tarifs.formules.map((f) => `<button class="btn petit${f.id === e.formule ? ' p' : ''}" data-formule="${f.id}">${G.esc(f.nom)}</button>`).join('')}
      <span class="seg" style="margin-left:auto"><button data-pays="ue" class="${e.pays === 'ue' ? 'actif' : ''}">Europe</button><button data-pays="vn" class="${e.pays === 'vn' ? 'actif' : ''}">Viêt Nam</button></span></div>
    <div id="cascade"></div></div>

  <div class="carte"><h2>Tes formules<em>prix par mois</em></h2>${this.grille(a.tarifs)}${G.legende([['accent', 'Europe'], ['turquoise', 'Viêt Nam']])}</div>
  <div class="carte"><h2>Paquets d'extractions<em>prix du paquet et prix à l'unité</em></h2>
    ${G.courbes([{ v: a.tarifs.credits.map((c) => c[1]), c: 'accent', aire: 1, nom: 'prix du paquet' }, { v: a.tarifs.credits.map((c) => c[1] / c[0] * 10), c: 'orange', nom: 'prix à l\'unité × 10' }], { x: a.tarifs.credits.map((c) => String(c[0])), unite: ' €', h: 200 })}
    ${G.legende([['accent', 'prix du paquet'], ['orange', 'prix d\'une extraction (× 10)']])}</div>

  <div class="carte"><h2>Tes dépenses<em>par mois</em></h2>
    <div class="grille" style="gap:10px;align-items:center">
      <div style="grid-column:span 5">${G.donut(Object.entries(postes).map(([nom, v]) => ({ nom, v, c: couleurs[nom] })), G.eur(depMois), 'par mois', 150)}</div>
      <div style="grid-column:span 7">${a.depenses.length ? G.barresH(a.depenses.map((d) => ({ nom: d.nom, v: d.rythme === 'an' ? d.montant / 12 : d.montant, c: couleurs[d.poste], txt: `${G.nb(d.montant, 2)} €${{ mois: '/mois', an: '/an', unique: '' }[d.rythme]}` }))) : G.vide('Aucune dépense notée')}</div>
    </div>
    ${lecture ? '' : `<div class="ligne-form"><input class="champ" id="d-nom" placeholder="Quoi ? (abonnement, domaine…)"><input class="champ" id="d-montant" type="number" min="0" step="0.01" placeholder="€" style="flex:0 1 80px">
      <select class="champ" id="d-rythme" style="flex:0 1 100px"><option value="mois">par mois</option><option value="an">par an</option><option value="unique">une fois</option></select>
      <select class="champ" id="d-poste" style="flex:0 1 110px">${a.postes.map((p) => `<option>${p}</option>`).join('')}</select><button class="btn p" id="d-ajouter">Ajouter</button></div>
    <div class="boutons">${a.depenses.map((d) => `<span class="puce">${G.esc(d.nom)} <button class="suppr" data-suppr-dep="${d.id}" title="Retirer">×</button></span>`).join('')}</div>`}</div>
  <div class="carte"><h2>Tes revenus<em>ce que les clients ont payé</em></h2>
    ${a.revenus.length ? G.barres([{ nom: 'revenus', c: 'vert', v: rev }], { x: passes.map(H.moisCourt), unite: ' €', h: 150 }) : G.vide('Aucun paiement noté pour l\'instant')}
    ${lecture ? '' : `<div class="ligne-form"><input class="champ" id="r-mois" type="month" value="${mois}" style="flex:0 1 140px"><input class="champ" id="r-montant" type="number" min="0" step="0.01" placeholder="€" style="flex:0 1 90px">
      <select class="champ" id="r-formule">${a.tarifs.formules.map((f) => `<option value="${f.id}">${f.nom}</option>`).join('')}<option value="credits">Crédits</option></select>
      <input class="champ" id="r-nom" placeholder="Qui ? (facultatif)"><button class="btn p" id="r-ajouter">Ajouter</button></div>
    <div class="boutons">${a.revenus.slice(-12).map((r) => `<span class="puce">${H.moisCourt(r.mois)} · ${G.nb(r.montant)} € <button class="suppr" data-suppr-rev="${r.id}" title="Retirer">×</button></span>`).join('')}</div>`}</div>
</div>`;
  },

  // Deux barres par formule : Europe et Viêt Nam.
  grille(t) {
    const M = Math.max(...t.formules.map((f) => f.mois));
    return `<div class="barres-h">${t.formules.map((f) => { const vn = f.mois * (f.public === 'agence' ? t.hypotheses.coefVNAgence : t.hypotheses.coefVN);
      return `<div><span>${G.esc(f.nom)}</span><i style="width:${f.mois / M * 100}%;--c:var(--accent)"></i><b>${G.nb(f.mois)} €${f.ht ? ' HT' : ''}</b></div>
        <div><span></span><i style="width:${vn / M * 100}%;--c:var(--turquoise);height:8px"></i><b class="sous">${G.nb(vn, 1)} €</b></div>`; }).join('')}</div>`;
  },

  cascade() {
    const t = H.d.argent.tarifs, hy = t.hypotheses, e = H.etat.argent, f = t.formules.find((x) => x.id === e.formule) || t.formules[0], vn = e.pays === 'vn';
    const taux = vn ? hy.tvaVN : hy.tvaUE, prix = f.mois * (vn ? (f.public === 'agence' ? hy.coefVNAgence : hy.coefVN) : 1);
    const ht = f.ht ? prix : prix / (1 + taux), ttc = f.ht ? prix * (1 + taux) : prix;
    document.getElementById('cascade').innerHTML = G.cascade([{ nom: 'Le client paie', v: ttc, c: 'vert' }, { nom: 'TVA', v: -(ttc - ht), c: 'encre-3' },
      { nom: 'Paiement', v: -(hy.paiementPct * ttc + hy.paiementFixe), c: 'rouge' }, { nom: 'Serveur', v: -hy.coutParClient, c: 'rouge' },
      { nom: 'Cotisations', v: -hy.cotisations * ht, c: 'orange' }, { nom: 'Il te reste', total: 1, c: 'accent' }], { unite: (x) => `${G.nb(x, 2)} €` });
  },

  simuler() {
    const s = H.etat.argent.sim;
    for (const k of Object.keys(s)) { const o = document.getElementById(`o-${k}`); if (o) o.textContent = k === 'prixPro' ? `${s[k]} €` : ['departs', 'vn', 'agences'].includes(k) ? `${s[k]} %` : s[k]; }
    const p = H.sim.projeter(s), eq = p.N.findIndex((v, i) => i > 0 && v > 0), cumul = p.N.reduce((a, b) => a + b, 0);
    document.getElementById('sim-res').innerHTML = `<div><span class="sous">Dans 12 mois</span><b>${G.eur(p.R[12])}</b><span class="sous">par mois</span></div>
      <div><span class="sous">Dans 24 mois</span><b>${G.eur(p.R[24])}</b><span class="sous">par mois</span></div>
      <div><span class="sous">Équilibre</span><b class="${eq < 0 ? 'moins' : 'plus'}">${eq < 0 ? 'jamais' : `mois ${eq}`}</b><span class="sous">${Math.round(p.K[24])} clients à la fin</span></div>
      <div><span class="sous">Gagné en 2 ans</span><b class="${cumul < 0 ? 'moins' : ''}">${G.eur(cumul)}</b><span class="sous">après cotisations</span></div>`;
    document.getElementById('sim-courbe').innerHTML = G.courbes([{ v: p.R, c: 'vert', nom: 'revenus' }, { v: p.C, c: 'rouge', nom: 'dépenses' }, { v: p.N, c: 'accent', aire: 1, nom: 'reste' }],
      { x: p.R.map((_, i) => `m${i}`), unite: ' €', h: 240, zero: true, marques: eq > 0 ? [{ i: eq, s: 2, t: 'équilibre', c: 'vert' }] : [] });
    document.getElementById('sim-note').textContent = `Dépenses fixes comptées : ${G.eur(p.fixe)} par mois (${p.fixeReel ? 'ton carnet de dépenses' : 'hypothèse de la grille des prix, faute de carnet'}). Parmi les particuliers : 65 % d'étudiants, 35 % de Pro (hypothèse).`;
    const prix = Array.from({ length: 91 }, (_, i) => i + 9), revenus = prix.map((x) => H.sim.projeter({ ...s, prixPro: x }).R[24]), mieux = revenus.indexOf(Math.max(...revenus));
    document.getElementById('sim-prix').innerHTML = G.courbes([{ v: revenus, c: 'violet', aire: 1 }], { x: prix.map((x) => `${x} €`), unite: ' €', h: 220,
      marques: [{ i: mieux, t: `meilleur : ${prix[mieux]} €`, c: 'vert' }, { i: s.prixPro - 9, t: 'ton prix', c: 'orange', dy: 14 }] });
  },

  async enregistrer(champs, message) {
    const r = await H.essayer(() => H.api('PUT', 'hub/argent', champs), message);
    if (r) { H.d.argent = r; H.rendre(); }
  },

  apres(onglet) {
    if (onglet === 'grille' && !H.enLigne) return;
    const a = H.d.argent, e = H.etat.argent, vue = document.getElementById('vue');
    this.simuler(); this.cascade();
    vue.querySelectorAll('.reglages input').forEach((i) => { i.oninput = () => { e.sim[i.id.slice(2)] = Number(i.value); this.simuler(); }; });
    const clic = (id, f) => { const b = document.getElementById(id); if (b) b.onclick = f; };
    clic('sim-garder', () => this.enregistrer({ scenario: e.sim }, 'Scénario gardé'));
    clic('sim-retour', () => { e.sim = { ...a.scenario }; H.rendre(); });
    vue.querySelectorAll('[data-formule]').forEach((b) => { b.onclick = () => { e.formule = b.dataset.formule; vue.querySelectorAll('[data-formule]').forEach((x) => x.classList.toggle('p', x === b)); this.cascade(); }; });
    vue.querySelectorAll('[data-pays]').forEach((b) => { b.onclick = () => { e.pays = b.dataset.pays; vue.querySelectorAll('[data-pays]').forEach((x) => x.classList.toggle('actif', x === b)); this.cascade(); }; });
    const v = (id) => document.getElementById(id).value;
    clic('d-ajouter', () => { if (!v('d-nom').trim() || !(Number(v('d-montant')) > 0)) return H.toast('Indique un nom et un montant', true);
      this.enregistrer({ depenses: [...a.depenses, { nom: v('d-nom'), montant: Number(v('d-montant')), rythme: v('d-rythme'), poste: v('d-poste'), debut: H.mois() }] }, 'Dépense notée'); });
    clic('r-ajouter', () => { if (!(Number(v('r-montant')) > 0)) return H.toast('Indique un montant', true);
      this.enregistrer({ revenus: [...a.revenus, { mois: v('r-mois'), montant: Number(v('r-montant')), formule: v('r-formule'), nom: v('r-nom') }] }, 'Revenu noté'); });
    vue.querySelectorAll('[data-suppr-dep]').forEach((b) => { b.onclick = () => this.enregistrer({ depenses: a.depenses.filter((d) => d.id !== b.dataset.supprDep) }, 'Dépense retirée'); });
    vue.querySelectorAll('[data-suppr-rev]').forEach((b) => { b.onclick = () => this.enregistrer({ revenus: a.revenus.filter((r) => r.id !== b.dataset.supprRev) }, 'Revenu retiré'); });
  },
};
