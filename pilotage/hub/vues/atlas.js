// Atlas Planètes : un espace à part, sans lien avec Ašru. Le cap (où en est le projet d'un coup d'œil), la feuille
// de route en 3 paliers, le carnet de contacts (de « repéré » à « en échange ») et le journal de bord.
// Les courriels ne partent jamais d'ici : on note ce qui a été envoyé ou reçu.
'use strict';

H.vues.atlas = {
  nom: 'Atlas Planètes',
  onglets: [['', 'Cap'], ['feuille', 'Feuille de route'], ['contacts', 'Contacts'], ['journal', 'Journal']],
  pastille() {
    const a = H.d.atlas; if (!a) return 0;
    const auj = H.jour(), dans3 = H.jour(Date.now() + 3 * 864e5);
    return a.contacts.filter((c) => c.relance && c.relance <= auj && c.etape !== 'ecarte').length + a.echeances.filter((e) => e.date >= auj && e.date <= dans3).length;
  },

  rendre(onglet) {
    const a = H.d.atlas;
    const tete = H.entete('Atlas Planètes', { onglets: this.onglets, actif: onglet, base: 'atlas', droite: this.lienAtlas(true) });
    if (!a) return `${tete}<div class="carte c12">${G.vide("Pas de données d'Atlas Planètes", '!')}</div>`;
    return tete + ({ feuille: () => this.feuille(), contacts: () => this.contacts(), journal: () => this.journal() }[onglet] || (() => this.cap()))();
  },

  lienAtlas(petit) {
    const l = (H.d.atlas || {}).liens || {}, url = H.enLigne ? l.atlasEnLigne : l.atlasLocal;
    return url ? `<a class="btn${petit ? ' petit' : ' p'}" href="${G.esc(url)}" target="_blank" rel="noopener">Ouvrir l'atlas ↗</a>` : '';
  },
  jours: (date) => Math.round((new Date(`${date}T12:00:00`) - new Date(`${H.jour()}T12:00:00`)) / 864e5),
  coul(liste, id) { return G.V((H.d.atlas[liste].find((x) => x.id === id) || { couleur: 'encre-3' }).couleur); },
  initiales: (nom) => nom.replace(/\(.*?\)/g, '').split(/[\s/,–-]+/).filter((m) => /^[A-Za-zÀ-ÿ0-9]/.test(m)).slice(0, 2).map((m) => m[0].toUpperCase()).join(''),

  /* ================= Cap ================= */
  cap() {
    const a = H.d.atlas, auj = H.jour(), f = a.feuille;
    const faits = f.filter((e) => e.statut === 'fait').length, vivantes = f.filter((e) => e.statut !== 'plus_tard');
    const ecrits = a.contacts.filter((c) => !['repere', 'ecarte'].includes(c.etape)).length;
    const recus = a.contacts.flatMap((c) => c.echanges).filter((x) => x.sens === 'recu').length;
    const aVenir = a.echeances.filter((e) => e.date >= auj), prochaine = aVenir[0];
    const rang = (id) => a.etapes.findIndex((e) => e.id === id);
    const entonnoir = a.etapes.filter((e) => e.id !== 'ecarte').map((e) => ({ nom: e.nom, c: e.couleur, v: a.contacts.filter((c) => c.etape !== 'ecarte' && rang(c.etape) >= rang(e.id)).length }));
    const relances = a.contacts.filter((c) => c.relance && c.etape !== 'ecarte').sort((x, y) => x.relance.localeCompare(y.relance));
    const enCours = f.filter((e) => e.statut === 'en_cours');
    const dernier = a.contacts.flatMap((c) => c.echanges.filter((x) => x.sens !== 'etape').map((x) => ({ ...x, c }))).sort((x, y) => y.date.localeCompare(x.date))[0];

    return `<div class="grille">
  <div class="carte c3"><h2>Feuille de route</h2><div class="anneaux">${G.anneau(vivantes.length ? faits / vivantes.length * 100 : 0, 'vert', 'faites', `${faits}/${vivantes.length}`)}</div>
    <div class="sous" style="text-align:center">${f.filter((e) => e.statut === 'plus_tard').length} pour plus tard</div></div>
  <div class="carte kpi c3 lien" data-aller="atlas/contacts"><h2>Contacts</h2><div class="chiffre">${ecrits}<small>/ ${a.contacts.length} écrits</small></div>
    <div class="sous">${recus} réponse${recus > 1 ? 's' : ''} reçue${recus > 1 ? 's' : ''} · ${a.contacts.filter((c) => c.etape === 'echange').length} en échange</div>${this.barreEtapes()}</div>
  <div class="carte kpi c3"><h2>Prochaine date</h2>${prochaine ? `<div class="chiffre" style="color:${this.jours(prochaine.date) <= 7 ? 'var(--vif)' : 'inherit'}">${this.jours(prochaine.date) === 0 ? "aujourd'hui" : `J−${this.jours(prochaine.date)}`}</div>
    <div class="sous">${H.dateCourte(prochaine.date)} · ${G.esc(prochaine.titre)}</div>` : G.vide('Aucune date à venir')}</div>
  <div class="carte c3"><h2>L'atlas</h2><div class="boutons" style="flex-direction:column;align-items:stretch;margin:0">${this.lienAtlas(false)}
    ${a.liens.etude ? `<a class="btn" href="${G.esc(a.liens.etude)}" target="_blank" rel="noopener">L'étude en ligne ↗</a>` : ''}
    ${!H.enLigne && a.liens.atlasEnLigne ? `<a class="btn" href="${G.esc(a.liens.atlasEnLigne)}" target="_blank" rel="noopener">L'atlas en ligne ↗</a>` : ''}</div>
    ${H.enLigne ? '' : '<div class="sous" style="margin-top:8px">Sur le PC, l\'atlas s\'ouvre si son serveur tourne (raccourci du bureau).</div>'}</div>

  <div class="carte c7 lien" data-aller="atlas/feuille"><h2>Les trois paliers<em>du catalogue à l'outil</em></h2>${this.paliers()}
    ${G.legende(a.statuts.map((s) => [s.couleur, s.nom]))}</div>
  <div class="carte c5 lien" data-aller="atlas/contacts"><h2>Du premier mail à l'échange</h2>${G.entonnoir(entonnoir)}</div>

  <div class="carte c12"><h2>Les dates<em>${aVenir.length} à venir</em></h2>${this.frise(aVenir)}
    <div class="grille" style="gap:6px 24px;margin-top:6px"><div style="grid-column:span 7">${this.listeEcheances()}</div>
    <div style="grid-column:span 5">${H.enLigne ? '' : `<form id="a-echeance" class="ligne-form" style="margin:0"><input class="champ" type="date" name="date" required style="flex:0 1 150px">
      <input class="champ" name="titre" placeholder="Ajouter une date (rendu, conférence…)" required style="flex:1 1 180px"><button class="btn p" type="submit">Ajouter</button></form>`}</div></div></div>

  <div class="carte c4"><h2>En cours<em>${enCours.length}</em></h2>${enCours.map((e) => `<div style="display:flex;gap:8px;align-items:baseline;margin-bottom:6px"><i style="flex:none;width:8px;height:8px;border-radius:50%;background:${this.coul('paliers', e.palier)}"></i>
    <span>${G.esc(e.titre)}${e.note ? `<br><span class="sous">${G.esc(e.note)}</span>` : ''}</span></div>`).join('') || G.vide('Rien en cours')}</div>
  <div class="carte c4"><h2>Relances<em>${relances.length}</em></h2>${relances.slice(0, 6).map((c) => this.carte(c)).join('') || G.vide('Aucune relance prévue')}</div>
  <div class="carte c4"><h2>Dernier échange</h2>${dernier ? `<div class="fil"><div style="--c:${G.V(dernier.sens === 'recu' ? 'vert' : 'accent')};cursor:pointer" data-fiche="${G.esc(dernier.c.id)}">
    <time>${H.dateCourte(dernier.date)} · ${dernier.sens === 'recu' ? '← reçu' : dernier.sens === 'envoye' ? '→ envoyé' : '✎ note'}</time><b>${G.esc(dernier.c.nom)}</b>${dernier.texte ? `<br><span class="sous">${G.esc(dernier.texte.slice(0, 200))}</span>` : ''}</div></div>` : G.vide('Aucun échange noté')}</div>
</div>`;
  },

  barreEtapes() {
    const a = H.d.atlas, n = (id) => a.contacts.filter((c) => c.etape === id).length;
    return `<div style="display:flex;height:10px;border-radius:5px;overflow:hidden;margin-top:auto;background:var(--trait)">${a.etapes.filter((e) => e.id !== 'ecarte').map((e) => (n(e.id) ? `<i title="${e.nom} : ${n(e.id)}" style="flex:${n(e.id)};background:${G.V(e.couleur)}"></i>` : '')).join('')}</div>`;
  },

  paliers() {
    const a = H.d.atlas;
    return a.paliers.map((p) => {
      const dans = a.feuille.filter((e) => e.palier === p.id), n = (s) => dans.filter((e) => e.statut === s).length;
      return `<div style="display:grid;grid-template-columns:30px 1fr auto;gap:4px 12px;align-items:center;margin-bottom:12px">
        <span class="rond" style="--c:${G.V(p.couleur)}">${p.id}</span><span><b>${G.esc(p.nom)}</b> <span class="sous">${G.esc(p.sous)}</span></span><b>${n('fait')}/${dans.length}</b>
        <span></span><div class="barre" style="display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--trait);grid-column:span 2">${a.statuts.map((s) => (n(s.id) ? `<i title="${s.nom} : ${n(s.id)}" style="flex:${n(s.id)};background:${G.V(s.couleur)}"></i>` : '')).join('')}</div></div>`;
    }).join('');
  },

  // Les dates à venir sur une ligne de temps, aujourd'hui à gauche.
  frise(aVenir) {
    if (!aVenir.length) return G.vide('Aucune date à venir');
    const w = 760, x0 = 40, x1 = w - 30, plus = Math.max(...aVenir.map((e) => this.jours(e.date))), span = Math.min(300, Math.max(45, plus + 10));
    const X = (j) => x0 + Math.min(j, span) / span * (x1 - x0);
    const mois = []; for (let i = 0; i <= 10; i++) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + i); const j = this.jours(H.jour(d)); if (j > 0 && j <= span) mois.push({ j, nom: H.moisCourt(H.mois(d)) }); }
    return `<svg viewBox="0 0 ${w} 130" width="100%"><line x1="${x0}" x2="${x1}" y1="65" y2="65" stroke="${G.V('trait-fort')}" stroke-width="2"/>
      ${mois.map((m) => `<line x1="${X(m.j)}" x2="${X(m.j)}" y1="60" y2="70" stroke="${G.V('trait-fort')}"/><text x="${X(m.j)}" y="84" text-anchor="middle">${m.nom}</text>`).join('')}
      <circle cx="${x0}" cy="65" r="5" fill="${G.V('encre')}"/><text x="${x0}" y="84" text-anchor="middle" class="f">auj.</text>
      ${aVenir.map((e, i) => { const j = this.jours(e.date), x = X(j), haut = i % 2 === 0, proche = j <= 7, y = haut ? 32 : 108; const ancre = x < x0 + 70 ? 'start' : x > x1 - 70 ? 'end' : 'middle', xt = ancre === 'start' ? x - 8 : ancre === 'end' ? x + 8 : x;
        return `<line x1="${x}" x2="${x}" y1="${haut ? 38 : 70}" y2="${haut ? 60 : 98}" stroke="${G.V(proche ? 'vif' : 'encre-3')}" stroke-dasharray="2 2"/>
          <circle cx="${x}" cy="65" r="${proche ? 7 : 5.5}" fill="${G.V(proche ? 'vif' : 'surface')}" stroke="${G.V(proche ? 'vif' : 'encre')}" stroke-width="2.5"><title>${G.esc(e.titre)}</title></circle>
          <text x="${xt}" y="${y}" text-anchor="${ancre}" class="f" style="font-size:11px">${j > span ? '→ ' : ''}${H.dateCourte(e.date)}</text>
          <text x="${xt}" y="${y + (haut ? -13 : 13)}" text-anchor="${ancre}" style="font-size:10px">${G.esc(e.titre.length > 26 ? `${e.titre.slice(0, 24)}…` : e.titre)}</text>`; }).join('')}</svg>`;
  },

  listeEcheances() {
    const a = H.d.atlas, auj = H.jour();
    const passees = a.echeances.filter((e) => e.date < auj).slice(-3), aVenir = a.echeances.filter((e) => e.date >= auj);
    return [...aVenir, ...passees].map((e) => { const j = this.jours(e.date);
      return `<div style="display:grid;grid-template-columns:64px 1fr auto;gap:8px;align-items:center;padding:5px 0;border-top:1px solid var(--trait);font-size:13px;${j < 0 ? 'opacity:.45' : ''}">
        <b style="font-variant-numeric:tabular-nums;${j >= 0 && j <= 7 ? 'color:var(--vif)' : ''}">${j < 0 ? 'passé' : j === 0 ? "auj." : `J−${j}`}</b>
        <span>${G.esc(e.titre)} <span class="sous">· ${H.dateCourte(e.date)}${e.note ? ` · ${G.esc(e.note)}` : ''}</span></span>
        ${H.enLigne ? '<span></span>' : `<button class="suppr" data-retirer-ech="${G.esc(JSON.stringify({ date: e.date, titre: e.titre }))}" title="Retirer">×</button>`}</div>`; }).join('') || G.vide('Aucune date');
  },

  /* ================= Feuille de route ================= */
  feuille() {
    const a = H.d.atlas, faites = a.feuille.filter((e) => e.statut === 'fait' && e.date);
    const lundis = Array.from({ length: 8 }, (_, i) => H.lundi(H.jour(Date.now() - (7 - i) * 7 * 864e5)));
    const parSemaine = lundis.map((lu, i) => faites.filter((e) => e.date >= lu && (!lundis[i + 1] || e.date < lundis[i + 1])).length);
    const ordre = ['en_cours', 'a_faire', 'fait', 'plus_tard'];
    return `<div class="grille">
  ${G.kpi('Faites', String(faites.length), `sur ${a.feuille.length} étapes`, parSemaine, 'vert', 'c3')}
  ${G.kpi('En cours', String(a.feuille.filter((e) => e.statut === 'en_cours').length), 'en ce moment', null, 'orange', 'c3')}
  ${G.kpi('À faire', String(a.feuille.filter((e) => e.statut === 'a_faire').length), 'décidé, pas commencé', null, 'accent', 'c3')}
  ${G.kpi('Plus tard', String(a.feuille.filter((e) => e.statut === 'plus_tard').length), 'pas avant le palier 3', null, 'encre-3', 'c3')}
  ${a.paliers.map((p) => {
    const dans = a.feuille.filter((e) => e.palier === p.id).sort((x, y) => ordre.indexOf(x.statut) - ordre.indexOf(y.statut) || String(y.date).localeCompare(String(x.date)));
    const n = (s) => dans.filter((e) => e.statut === s).length;
    return `<div class="carte c4" style="border-top:4px solid ${G.V(p.couleur)}"><h2><span class="rond" style="--c:${G.V(p.couleur)};width:22px;height:22px">${p.id}</span>${G.esc(p.nom)}<em>${n('fait')}/${dans.length}</em></h2>
      <div class="sous" style="margin:-4px 0 8px">${G.esc(p.sous)}</div>
      <div style="display:flex;height:8px;border-radius:4px;overflow:hidden;background:var(--trait);margin-bottom:10px">${a.statuts.map((s) => (n(s.id) ? `<i style="flex:${n(s.id)};background:${G.V(s.couleur)}"></i>` : '')).join('')}</div>
      ${dans.map((e) => this.ligneEtape(e)).join('') || G.vide('Aucune étape')}
      ${H.enLigne ? '' : `<form class="ligne-form a-etape" data-palier="${p.id}" style="margin-top:10px"><input class="champ" name="titre" placeholder="Nouvelle étape…" required><button class="btn petit" type="submit">+</button></form>`}</div>`;
  }).join('')}
</div>`;
  },

  ligneEtape(e) {
    const a = H.d.atlas, s = a.statuts.find((x) => x.id === e.statut) || a.statuts[2];
    return `<div class="a-ligne${e.statut === 'fait' ? ' fait' : ''}" data-etape-id="${G.esc(e.id)}">
      ${H.enLigne ? `<span class="a-st" style="--c:${G.V(s.couleur)}">${s.nom}</span>` : `<select class="a-st" data-statut-etape style="--c:${G.V(s.couleur)}" aria-label="Statut">${a.statuts.map((x) => `<option value="${x.id}"${x.id === e.statut ? ' selected' : ''}>${x.nom}</option>`).join('')}</select>`}
      <span class="t">${G.esc(e.titre)}${e.date ? ` <span class="sous">· ${H.dateCourte(e.date)}</span>` : ''}${e.note ? `<small>${G.esc(e.note)}</small>` : ''}</span>
      ${H.enLigne ? '' : `<span class="a-outils"><button class="suppr" data-note-etape title="Ajouter ou changer la note">✎</button><button class="suppr" data-retirer-etape title="Retirer">×</button></span>`}</div>`;
  },

  /* ================= Contacts ================= */
  carte(c) {
    const auj = H.jour(), cat = H.d.atlas.categories.find((x) => x.id === c.categorie) || { couleur: 'encre-3', nom: '' };
    return `<div class="fiche" draggable="${H.enLigne ? 'false' : 'true'}" data-fiche="${G.esc(c.id)}"><span class="rond" style="--c:${G.V(cat.couleur)}" title="${G.esc(cat.nom)}">${G.esc(this.initiales(c.nom))}</span>
      <span style="min-width:0"><strong>${G.esc(c.nom.length > 46 ? `${c.nom.slice(0, 44)}…` : c.nom)}</strong>
      <span class="ligne">${c.interet ? `<span class="pts">${'●'.repeat(c.interet)}</span>` : ''}${c.verif === 'a_verifier' ? '<span title="Canal à vérifier avant d\'écrire">⚠ à vérifier</span>' : ''}${c.relance ? `<span class="${c.relance <= auj ? 'retard' : ''}">↻ ${H.dateCourte(c.relance)}</span>` : ''}${c.echanges.filter((x) => x.sens === 'recu').length ? '<span style="color:var(--vert)">← réponse</span>' : ''}</span></span></div>`;
  },

  contacts() {
    const a = H.d.atlas, e = (H.etat.atlas ??= { cat: '', cherche: '' });
    let liste = a.contacts;
    if (e.cat) liste = liste.filter((c) => c.categorie === e.cat);
    if (e.cherche) { const q = e.cherche.toLowerCase(); liste = liste.filter((c) => `${c.nom} ${c.pourquoi}`.toLowerCase().includes(q)); }
    const parCat = a.categories.map((cat) => ({ nom: cat.nom, v: a.contacts.filter((c) => c.categorie === cat.id).length, c: cat.couleur })).filter((x) => x.v);
    const verif = [['verifie', 'vérifié', 'vert'], ['partiel', 'partiel', 'orange'], ['a_verifier', 'à vérifier', 'rouge']];
    return `<div class="grille">
  <div class="carte c12"><h2>Carnet<em>clique pour la fiche${H.enLigne ? '' : ' · glisse pour changer d\'étape'}</em></h2>
    <div class="boutons" style="margin-top:0"><span class="seg"><button data-cat="" class="${e.cat ? '' : 'actif'}">Tous</button>${a.categories.filter((cat) => a.contacts.some((c) => c.categorie === cat.id)).map((cat) => `<button data-cat="${cat.id}" class="${e.cat === cat.id ? 'actif' : ''}">${G.esc(cat.nom)}</button>`).join('')}</span>
      <input class="champ" id="a-cherche" placeholder="Chercher…" value="${G.esc(e.cherche)}" style="flex:1;max-width:260px">${H.enLigne ? '' : '<button class="btn p" id="a-nouveau">+ Contact</button>'}</div>
    <div class="kanban" style="--n:${a.etapes.length}">${a.etapes.map((et) => { const dans = liste.filter((c) => c.etape === et.id).sort((x, y) => y.interet - x.interet || (x.verif === 'a_verifier') - (y.verif === 'a_verifier') || x.nom.localeCompare(y.nom));
      return `<div class="col" data-etape="${et.id}" style="--c:${G.V(et.couleur)}"><h3>${et.nom}<em>${dans.length}</em></h3>${dans.map((c) => this.carte(c)).join('')}</div>`; }).join('')}</div></div>
  <div class="carte c6"><h2>Par domaine</h2>${G.donut(parCat, String(a.contacts.length), 'contacts', 150)}${G.legende(parCat.map((x) => [x.c, `${x.nom} ${x.v}`]))}</div>
  <div class="carte c6"><h2>Canal vérifié ?<em>à confirmer avant d'écrire</em></h2>${G.barresH(verif.map(([id, nom, c]) => ({ nom, v: a.contacts.filter((x) => x.verif === id).length, c })))}</div>
</div>`;
  },

  fiche(id) {
    const a = H.d.atlas, c = a.contacts.find((x) => x.id === id); if (!c) return;
    const rang = a.etapes.findIndex((e) => e.id === c.etape), lecture = H.enLigne, auj = H.jour();
    const cat = a.categories.find((x) => x.id === c.categorie) || { nom: '', couleur: 'encre-3' };
    const sens = { envoye: ['→ envoyé', 'accent'], recu: ['← reçu', 'vert'], note: ['✎ note', 'encre-3'], etape: ['⇢ étape', 'orange'] };
    H.volet(`<h2 class="nom">${G.esc(c.nom)}</h2>
      <div><span class="puce" style="border-color:${G.V(cat.couleur)}">${G.esc(cat.nom)}</span> <span class="puce">${{ verifie: 'canal vérifié', partiel: 'vérifié en partie', a_verifier: '⚠ canal à vérifier' }[c.verif]}</span></div>
      ${lecture ? '' : `<div class="boutons">${c.courriel ? `<a class="btn p" href="mailto:${G.esc(c.courriel)}">Écrire un mail</a>` : ''}${c.url ? `<a class="btn" href="${G.esc(c.url)}" target="_blank" rel="noopener">Site ↗</a>` : ''}</div>
        <div class="sous">Rien ne part d'ici : écris depuis ta boîte, puis note l'envoi plus bas.</div>`}
      <section><h3>Étape</h3><div class="pas">${a.etapes.map((e, i) => `<button data-etape="${e.id}" style="--c:${G.V(e.couleur)}" class="${i === rang ? 'ici' : i < rang && e.id !== 'ecarte' && c.etape !== 'ecarte' ? 'fait' : ''}" ${lecture ? 'disabled' : ''}>${e.nom}</button>`).join('')}</div></section>
      <section style="display:flex;gap:24px;flex-wrap:wrap"><div><h3>Intérêt</h3><div class="interet">${[1, 2, 3].map((n) => `<button data-interet="${n}" class="${n <= c.interet ? 'on' : ''}" ${lecture ? 'disabled' : ''}>●</button>`).join('')}</div></div>
        <div><h3>Relance ${c.relance && c.relance <= auj ? '<span class="retard">à faire</span>' : ''}</h3>${lecture ? `<span>${c.relance ? H.dateCourte(c.relance) : '—'}</span>` : `<input type="date" class="champ" id="f-relance" value="${c.relance}">
          <span class="boutons" style="display:inline-flex;margin:0"><button class="btn petit" data-relance="7">+7 j</button><button class="btn petit" data-relance="14">+14 j</button><button class="btn petit" data-relance="0">aucune</button></span>`}</div></section>
      ${lecture ? '' : `<section><h3>Repères</h3><dl class="infos">${[['Pourquoi', c.pourquoi], ['Conditions', c.conditions], ['Canal', c.canal], ['État', c.etat]].filter(([, v]) => v).map(([n, v]) => `<dt>${n}</dt><dd>${G.esc(v)}</dd>`).join('')}</dl>
        <textarea class="champ" id="f-memo" rows="2" placeholder="Ta note sur ce contact (qui, ce qu'il fait, ce qu'on attend)…" style="width:100%;margin-top:8px">${G.esc(c.memo)}</textarea></section>`}
      <section><h3>Échanges</h3>
        ${lecture ? '' : `<div class="ligne-form" style="margin:0 0 10px"><select class="champ" id="f-canal" style="flex:0 1 120px">${a.canaux.map((x) => `<option>${x}</option>`).join('')}</select>
          <select class="champ" id="f-sens" style="flex:0 1 120px"><option value="envoye">j'ai envoyé</option><option value="recu">j'ai reçu</option><option value="note">note</option></select>
          <input class="champ" type="date" id="f-date" value="${auj}" style="flex:0 1 140px">
          <textarea class="champ" id="f-texte" rows="2" placeholder="Résume le message ou colle-le…" style="flex:1 1 100%"></textarea><button class="btn p" id="f-ajouter">Noter l'échange</button></div>`}
        ${c.echanges.length ? `<div class="fil">${c.echanges.map((x, i) => ({ x, i })).sort((p, q) => q.x.date.localeCompare(p.x.date) || q.i - p.i).map(({ x, i }) => `<div style="--c:${G.V(sens[x.sens][1])}"><time>${H.dateCourte(x.date)} · ${sens[x.sens][0]}${x.canal ? ` · ${G.esc(x.canal)}` : ''}${lecture ? '' : ` <button class="suppr" data-retirer="${i}" title="Retirer">×</button>`}</time>${G.esc(x.texte || '')}</div>`).join('')}</div>` : G.vide('Aucun échange noté')}
      </section>`);
    if (lecture) return;
    const volet = document.getElementById('volet');
    const maj = async (champs, message) => {
      const r = await H.essayer(() => H.api('PUT', `hub/atlas/contacts/${encodeURIComponent(id)}`, champs), message);
      if (!r) return;
      const i = a.contacts.findIndex((x) => x.id === id); a.contacts[i] = r;
      H.rendre(true); this.fiche(id);
    };
    volet.querySelectorAll('[data-etape]').forEach((b) => { b.onclick = () => maj({ etape: b.dataset.etape }, 'Étape changée'); });
    volet.querySelectorAll('[data-interet]').forEach((b) => { b.onclick = () => maj({ interet: Number(b.dataset.interet) === c.interet ? 0 : Number(b.dataset.interet) }); });
    volet.querySelectorAll('[data-relance]').forEach((b) => { b.onclick = () => maj({ relance: b.dataset.relance === '0' ? '' : H.jour(Date.now() + Number(b.dataset.relance) * 864e5) }, 'Relance réglée'); });
    volet.querySelector('#f-relance').onchange = (ev) => maj({ relance: ev.target.value }, 'Relance réglée');
    volet.querySelector('#f-memo').onchange = (ev) => maj({ memo: ev.target.value }, 'Note gardée');
    volet.querySelector('#f-ajouter').onclick = () => { const texte = volet.querySelector('#f-texte').value.trim(); if (!texte) return H.toast("Écris quelque chose d'abord", true);
      maj({ echange: { canal: volet.querySelector('#f-canal').value, sens: volet.querySelector('#f-sens').value, date: volet.querySelector('#f-date').value, texte } }, 'Échange noté'); };
    volet.querySelectorAll('[data-retirer]').forEach((b) => { b.onclick = () => maj({ retirerEchange: Number(b.dataset.retirer) }, 'Échange retiré'); });
  },

  nouveau() {
    const a = H.d.atlas;
    H.volet(`<form id="a-contact"><h2 class="nom">Nouveau contact</h2>
      <div class="champs-2" style="grid-template-columns:1fr"><label>Nom<input class="champ" name="nom" required placeholder="Personne, labo, agence…"></label>
        <label>Domaine<select class="champ" name="categorie">${a.categories.map((c) => `<option value="${c.id}">${G.esc(c.nom)}</option>`).join('')}</select></label>
        <label>Pourquoi lui<input class="champ" name="pourquoi" placeholder="Ce qu'il peut t'apporter"></label>
        <label>Canal<input class="champ" name="canal" placeholder="adresse mail, page contact, forum…"></label></div>
      <div class="boutons" style="justify-content:flex-end;margin-top:14px"><button class="btn p" type="submit">Ajouter</button></div></form>`);
    const f = document.getElementById('a-contact'); f.nom.focus();
    f.onsubmit = async (ev) => { ev.preventDefault();
      const c = await H.essayer(() => H.api('POST', 'hub/atlas/contacts', { nom: f.nom.value, categorie: f.categorie.value, pourquoi: f.pourquoi.value, canal: f.canal.value }), 'Contact ajouté');
      if (c) { a.contacts.push(c); H.rendre(true); this.fiche(c.id); } };
  },

  /* ================= Journal ================= */
  journal() {
    const a = H.d.atlas;
    const ev = [...a.contacts.flatMap((c) => c.echanges.map((x) => ({ date: x.date, type: x.sens, canal: x.canal, texte: x.texte, c }))),
      ...a.feuille.filter((e) => e.statut === 'fait' && e.date).map((e) => ({ date: e.date, type: 'fait', texte: e.titre, palier: e.palier })),
      ...a.notes.map((n, i) => ({ date: n.date, type: 'bord', texte: n.texte, i }))].sort((x, y) => y.date.localeCompare(x.date));
    const lundis = Array.from({ length: 6 }, (_, i) => H.lundi(H.jour(Date.now() - (5 - i) * 7 * 864e5)));
    const parSemaine = (t) => lundis.map((lu, i) => ev.filter((x) => x.type === t && x.date >= lu && (!lundis[i + 1] || x.date < lundis[i + 1])).length);
    const style = { envoye: ['→ envoyé', 'accent'], recu: ['← reçu', 'vert'], note: ['✎ note', 'encre-3'], etape: ['⇢ étape', 'orange'], fait: ['✓ fait', 'violet'], bord: ['● journal de bord', 'vif'] };
    return `<div class="grille">
  <div class="carte c8"><h2>Le rythme<em>par semaine</em></h2>${G.courbes([{ v: parSemaine('fait'), c: 'violet', aire: 1, nom: 'étapes faites' }, { v: parSemaine('envoye'), c: 'accent', nom: 'mails envoyés' }, { v: parSemaine('recu'), c: 'vert', nom: 'réponses' }], { x: lundis.map(H.dateCourte), h: 190 })}
    ${G.legende([['violet', 'étapes faites'], ['accent', 'mails envoyés'], ['vert', 'réponses']])}</div>
  <div class="carte c4"><h2>Journal de bord</h2>${H.enLigne ? '<div class="sous">Les notes se lisent sur le PC.</div>' : `<form id="a-note"><textarea class="champ" name="texte" rows="5" placeholder="Une idée, une décision, ce qu'on t'a dit…" style="width:100%;resize:vertical"></textarea>
    <div class="boutons" style="justify-content:flex-end;margin-bottom:0"><button class="btn p" type="submit">Noter</button></div></form>`}</div>
  <div class="carte c12"><h2>Tout ce qui s'est passé<em>${ev.length}</em></h2>${ev.length ? `<div class="fil">${ev.slice(0, 200).map((x) => `<div style="--c:${G.V(style[x.type][1])}${x.c ? ';cursor:pointer' : ''}"${x.c ? ` data-fiche="${G.esc(x.c.id)}"` : ''}>
      <time>${H.dateCourte(x.date)} · ${style[x.type][0]}${x.canal ? ` · ${G.esc(x.canal)}` : ''}${x.palier ? ` · palier ${x.palier}` : ''}${x.type === 'bord' && !H.enLigne ? ` <button class="suppr" data-retirer-note="${x.i}" title="Retirer">×</button>` : ''}</time>
      ${x.c ? `<b>${G.esc(x.c.nom)}</b>${x.texte ? '<br>' : ''}` : ''}${x.texte ? `<span${x.c ? ' class="sous"' : ''} style="white-space:pre-wrap">${G.esc(x.texte)}</span>` : ''}</div>`).join('')}</div>` : G.vide('Rien encore')}</div>
</div>`;
  },

  /* ================= Gestes ================= */
  apres() {
    const vue = document.getElementById('vue'), a = H.d.atlas, e = (H.etat.atlas ??= { cat: '', cherche: '' });
    if (!a) return;
    const recharger = async (msg) => { if (await H.recharger(true)) { H.rendre(); if (msg) H.toast(msg); } };
    vue.querySelectorAll('[data-fiche]').forEach((f) => { f.onclick = (ev) => { ev.stopPropagation(); this.fiche(f.dataset.fiche); }; });
    vue.querySelectorAll('[data-cat]').forEach((b) => { b.onclick = () => { e.cat = b.dataset.cat; H.rendre(); }; });
    const cherche = document.getElementById('a-cherche');
    if (cherche) cherche.oninput = () => { e.cherche = cherche.value; clearTimeout(this.minuterie); this.minuterie = setTimeout(() => { H.rendre(); const c = document.getElementById('a-cherche'); c.focus(); c.setSelectionRange(c.value.length, c.value.length); }, 300); };
    if (H.enLigne) return;
    const nouveau = document.getElementById('a-nouveau'); if (nouveau) nouveau.onclick = () => this.nouveau();

    // Feuille de route : statut, note, retirer, ajouter.
    vue.querySelectorAll('[data-statut-etape]').forEach((s) => { s.onclick = (ev) => ev.stopPropagation();
      s.onchange = async () => { const id = s.closest('[data-etape-id]').dataset.etapeId; if (await H.essayer(() => H.api('PUT', `hub/atlas/feuille/${encodeURIComponent(id)}`, { statut: s.value }))) recharger(s.value === 'fait' ? 'Bravo, c\'est fait' : 'Statut changé'); }; });
    vue.querySelectorAll('[data-note-etape]').forEach((b) => { b.onclick = async (ev) => { ev.stopPropagation(); const id = b.closest('[data-etape-id]').dataset.etapeId, et = a.feuille.find((x) => x.id === id);
      const note = prompt('Note sur cette étape (vide pour effacer) :', et.note || ''); if (note === null) return;
      if (await H.essayer(() => H.api('PUT', `hub/atlas/feuille/${encodeURIComponent(id)}`, { note }))) recharger(); }; });
    vue.querySelectorAll('[data-retirer-etape]').forEach((b) => { b.onclick = async (ev) => { ev.stopPropagation(); if (!confirm('Retirer cette étape ?')) return;
      if (await H.essayer(() => H.api('DELETE', `hub/atlas/feuille/${encodeURIComponent(b.closest('[data-etape-id]').dataset.etapeId)}`))) recharger('Étape retirée'); }; });
    vue.querySelectorAll('form.a-etape').forEach((f) => { f.onsubmit = async (ev) => { ev.preventDefault();
      if (await H.essayer(() => H.api('POST', 'hub/atlas/feuille', { palier: Number(f.dataset.palier), titre: f.titre.value }))) recharger('Étape ajoutée'); }; });

    // Dates, journal de bord.
    const ech = document.getElementById('a-echeance');
    if (ech) ech.onsubmit = async (ev) => { ev.preventDefault(); if (await H.essayer(() => H.api('PUT', 'hub/atlas/echeances', { ajouter: { date: ech.date.value, titre: ech.titre.value } }))) recharger('Date ajoutée'); };
    vue.querySelectorAll('[data-retirer-ech]').forEach((b) => { b.onclick = async (ev) => { ev.stopPropagation(); if (!confirm('Retirer cette date ?')) return;
      if (await H.essayer(() => H.api('PUT', 'hub/atlas/echeances', { retirer: JSON.parse(b.dataset.retirerEch) }))) recharger('Date retirée'); }; });
    const note = document.getElementById('a-note');
    if (note) note.onsubmit = async (ev) => { ev.preventDefault(); if (!note.texte.value.trim()) return; if (await H.essayer(() => H.api('POST', 'hub/atlas/notes', { texte: note.texte.value }))) recharger('Noté'); };
    vue.querySelectorAll('[data-retirer-note]').forEach((b) => { b.onclick = async (ev) => { ev.stopPropagation(); if (!confirm('Retirer cette note ?')) return;
      if (await H.essayer(() => H.api('DELETE', `hub/atlas/notes/${b.dataset.retirerNote}`))) recharger('Note retirée'); }; });

    // Glisser un contact d'une colonne à l'autre change son étape.
    vue.querySelectorAll('.fiche[draggable="true"]').forEach((f) => { f.ondragstart = (ev) => ev.dataTransfer.setData('text/plain', f.dataset.fiche); });
    vue.querySelectorAll('.col[data-etape]').forEach((col) => {
      col.ondragover = (ev) => { ev.preventDefault(); col.classList.add('cible'); };
      col.ondragleave = () => col.classList.remove('cible');
      col.ondrop = async (ev) => {
        ev.preventDefault(); col.classList.remove('cible');
        const id = ev.dataTransfer.getData('text/plain'), c = a.contacts.find((x) => x.id === id);
        if (!c || c.etape === col.dataset.etape) return;
        const r = await H.essayer(() => H.api('PUT', `hub/atlas/contacts/${encodeURIComponent(id)}`, { etape: col.dataset.etape }), 'Étape changée');
        if (r) { Object.assign(c, r); H.rendre(); }
      };
    });
  },
};
