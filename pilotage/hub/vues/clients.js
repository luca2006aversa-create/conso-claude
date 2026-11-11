// Clients : les agences repérées, de « repéré » à « client ». Parcours en colonnes, fiche dans le volet de droite
// (boutons Zalo / WhatsApp / mail, étape, intérêt, relance, échanges), et un onglet Échanges pour le suivi.
'use strict';

H.vues.clients = {
  nom: 'Clients',
  onglets: [['', 'Parcours'], ['echanges', 'Échanges']],
  pastille: () => (H.d ? H.calc.clients().relances.length : 0),

  TYPES: { conception_construction: 'Conception-construction', agence_auteur: "Agence d'auteur", ecole: 'École', sig_topographie: 'SIG et topographie',
    reseau_francais: 'Réseau français', innovation: 'Innovation', promoteur: 'Promoteur', bureau_etudes: "Bureau d'études", paysage: 'Paysage',
    urbanisme: 'Urbanisme', internationale: 'Internationale', institut_public: 'Institut public', association: 'Association', media: 'Média' },

  rendre(onglet) {
    const tete = H.entete('Clients', { onglets: this.onglets, actif: onglet, base: 'clients' });
    return tete + (onglet === 'echanges' ? this.echanges() : this.parcours());
  },

  initiales: (nom) => nom.replace(/^(Công ty|Cty|CTCP|TNHH)\s+/i, '').split(/[\s(]+/).filter((m) => /^[A-Za-zÀ-ỹ0-9]/.test(m)).slice(0, 2).map((m) => m[0].toUpperCase()).join(''),

  carte(c) {
    const e = H.d.clients.etapes.find((x) => x.id === c.etape), auj = H.jour();
    return `<div class="fiche" draggable="${H.enLigne ? 'false' : 'true'}" data-fiche="${G.esc(c.id)}"><span class="rond" style="--c:${G.V(e.couleur)}">${G.esc(this.initiales(c.nom))}</span>
      <span style="min-width:0"><strong>${c.top ? '<span class="etoile" title="Dans tes 15 premières">★</span> ' : ''}${G.esc(c.nom.length > 44 ? `${c.nom.slice(0, 42)}…` : c.nom)}</strong>
      <span class="ligne">${c.interet ? `<span class="pts">${'●'.repeat(c.interet)}</span>` : ''}${c.canal ? `<span>${G.esc(c.canal)}</span>` : ''}${c.relance ? `<span class="${c.relance <= auj ? 'retard' : ''}">↻ ${H.dateCourte(c.relance)}</span>` : ''}</span></span></div>`;
  },

  parcours() {
    const d = H.d.clients, k = H.calc.clients(), e = (H.etat.clients ??= { filtre: 'tous', cherche: '', tout: false });
    const rangPrio = (c) => (c.top ? 0 : { A: 1, B: 2, C: 3 }[c.priorite] || 4);
    let liste = d.liste;
    if (e.filtre === 'top') liste = liste.filter((c) => c.top);
    if (e.filtre === 'a') liste = liste.filter((c) => c.priorite === 'A');
    if (e.cherche) { const q = e.cherche.toLowerCase(); liste = liste.filter((c) => `${c.nom} ${c.quartier} ${c.type}`.toLowerCase().includes(q)); }
    const compter = (champ, noms = {}) => { const m = {}; for (const c of d.liste) { const v = noms[c[champ]] || c[champ] || 'non précisé'; m[v] = (m[v] || 0) + 1; } return Object.entries(m).sort((a, b) => b[1] - a[1]); };
    const canaux = compter('canal'), couleursCanal = { Zalo: 'accent', Visite: 'orange', Téléphone: 'turquoise', Email: 'violet', Messenger: 'rose' };

    return `<div class="grille">
  <div class="carte c8"><h2>Du premier message au contrat<em>${k.total} agences</em></h2>${G.entonnoir(k.entonnoir)}</div>
  <div class="carte c4"><h2>Par où les joindre<em>canal conseillé</em></h2>${G.donut(canaux.map(([nom, v]) => ({ nom, v, c: couleursCanal[nom] || 'encre-3' })), String(k.contactes), 'contactées', 150)}
    ${G.legende(canaux.slice(0, 5).map(([nom, v]) => [couleursCanal[nom] || 'encre-3', `${nom} ${v}`]))}</div>

  <div class="carte c12"><h2>Agences<em>clique pour ouvrir la fiche${H.enLigne ? '' : ' · glisse pour changer d\'étape'}</em></h2>
    <div class="boutons" style="margin-top:0"><span class="seg">${[['tous', 'Toutes'], ['top', '★ Mes 15'], ['a', 'Priorité A']].map(([id, nom]) => `<button data-filtre="${id}" class="${e.filtre === id ? 'actif' : ''}">${nom}</button>`).join('')}</span>
      <input class="champ" id="cherche" placeholder="Chercher une agence, un quartier…" value="${G.esc(e.cherche)}" style="flex:1;max-width:320px"></div>
    <div class="kanban" style="--n:${d.etapes.length}">${d.etapes.map((et) => {
      const dans = liste.filter((c) => c.etape === et.id).sort((a, b) => rangPrio(a) - rangPrio(b) || b.interet - a.interet || a.nom.localeCompare(b.nom));
      const limite = et.id === 'repere' && !e.tout && !e.cherche ? 12 : 400;
      return `<div class="col" data-etape="${et.id}" style="--c:${G.V(et.couleur)}"><h3>${et.nom}<em>${dans.length}</em></h3>${dans.slice(0, limite).map((c) => this.carte(c)).join('')}
        ${dans.length > limite ? `<button class="btn petit" id="voir-tout" style="width:100%">voir les ${dans.length - limite} autres</button>` : ''}</div>`; }).join('')}</div></div>

  <div class="carte"><h2>Par quartier<em>Hanoï</em></h2>${G.barresH(compter('quartier').slice(0, 12).map(([nom, v]) => ({ nom, v, c: nom === 'non précisé' ? 'encre-3' : 'accent' })))}</div>
  <div class="carte"><h2>Par type d'agence</h2>${G.barresH(compter('type', this.TYPES).slice(0, 12).map(([nom, v]) => ({ nom, v, c: 'violet' })))}</div>
</div>`;
  },

  echanges() {
    const k = H.calc.clients(), auj = H.jour(), vrais = k.echanges.filter((x) => x.sens !== 'etape');
    const lundis = Array.from({ length: 12 }, (_, i) => H.lundi(H.jour(Date.now() - (11 - i) * 7 * 864e5)));
    const parSemaine = (sens) => lundis.map((lu, i) => vrais.filter((x) => x.sens === sens && x.date >= lu && (!lundis[i + 1] || x.date < lundis[i + 1])).length);
    const canaux = {}; for (const x of vrais) canaux[x.canal || 'Autre'] = (canaux[x.canal || 'Autre'] || 0) + 1;
    const couleurs = { Zalo: 'accent', Mail: 'violet', WhatsApp: 'vert', Téléphone: 'turquoise', Visite: 'orange', LinkedIn: 'rose' };
    const prochains = H.derniersJours(28, new Date(`${H.lundi(auj)}T12:00:00`).getTime() + 27 * 864e5);   // 4 semaines, du lundi de cette semaine
    const aVenir = H.d.clients.liste.filter((c) => c.relance && !['client', 'ecarte'].includes(c.etape));
    const semaines = [0, 1, 2, 3].map((s) => prochains.slice(s * 7, s * 7 + 7).map((j) => aVenir.filter((c) => c.relance === j).length));
    const sens = { envoye: ['→', 'accent', 'envoyé'], recu: ['←', 'vert', 'reçu'], note: ['✎', 'encre-3', 'note'], etape: ['⇢', 'orange', 'étape'] };

    return `<div class="grille">
  ${G.kpi('Messages envoyés', String(vrais.filter((x) => x.sens === 'envoye').length), 'en tout', parSemaine('envoye'), 'accent')}
  ${G.kpi('Réponses reçues', String(vrais.filter((x) => x.sens === 'recu').length), 'en tout', parSemaine('recu'), 'vert')}
  ${G.kpi('Relances à faire', `<span class="${k.relances.length ? 'moins' : ''}">${k.relances.length}</span>`, "aujourd'hui ou en retard", null)}
  ${G.kpi('Relances prévues', String(aVenir.filter((c) => c.relance > auj).length), 'dans les jours qui viennent', null)}

  <div class="carte c8"><h2>Envoyés et reçus<em>par semaine</em></h2>${G.courbes([{ v: parSemaine('envoye'), c: 'accent', nom: 'envoyés' }, { v: parSemaine('recu'), c: 'vert', aire: 1, nom: 'reçus' }], { x: lundis.map(H.dateCourte), h: 200 })}
    ${G.legende([['accent', 'envoyés'], ['vert', 'reçus']])}</div>
  <div class="carte c4"><h2>Par canal</h2>${G.donut(Object.entries(canaux).map(([nom, v]) => ({ nom, v, c: couleurs[nom] || 'encre-3' })), String(vrais.length), 'échanges', 150)}
    ${G.legende(Object.entries(canaux).map(([nom, v]) => [couleurs[nom] || 'encre-3', `${nom} ${v}`]))}</div>

  <div class="carte"><h2>Relances<em>4 semaines qui viennent</em></h2>
    ${G.chaleur(semaines, 'orange', { lignes: ['cette', '+1', '+2', '+3'], cols: ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'], cw: 40, ch: 26, titre: (v, j, i) => `${H.dateCourte(prochains[j * 7 + i])} : ${v} relance(s)` })}
    <div style="margin-top:10px">${[...k.relances, ...aVenir.filter((c) => c.relance > auj)].sort((a, b) => a.relance.localeCompare(b.relance)).slice(0, 8).map((c) => this.carte(c)).join('') || G.vide('Aucune relance prévue')}</div></div>
  <div class="carte"><h2>Journal<em>du plus récent au plus ancien</em></h2>
    ${k.echanges.length ? `<div class="fil">${k.echanges.slice(0, 40).map((x) => `<div style="--c:${G.V(sens[x.sens][1])};cursor:pointer" data-fiche="${G.esc(x.client.id)}"><time>${H.dateCourte(x.date)} · ${sens[x.sens][0]} ${sens[x.sens][2]}${x.canal ? ` · ${G.esc(x.canal)}` : ''}</time><b>${G.esc(x.client.nom.slice(0, 50))}</b>${x.texte ? `<br><span class="sous">${G.esc(x.texte.slice(0, 160))}</span>` : ''}</div>`).join('')}</div>` : G.vide('Aucun échange noté')}</div>
</div>`;
  },

  /* ---------- Fiche d'une agence (volet de droite) ---------- */
  fiche(id) {
    const c = H.d.clients.liste.find((x) => x.id === id); if (!c) return;
    const etapes = H.d.clients.etapes, rang = etapes.findIndex((e) => e.id === c.etape), lecture = H.enLigne, auj = H.jour();
    const chiffres = (c.tel || '').split(/[;,/]/)[0].replace(/[^\d+]/g, ''), local = chiffres.replace(/^\+?84/, '0'), inter = chiffres.replace(/^\+/, '').replace(/^0/, '84');
    const lien = (url, nom, principal) => `<a class="btn${principal ? ' p' : ''}" href="${G.esc(url)}" target="_blank" rel="noopener">${nom}</a>`;
    const http = (u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
    const sens = { envoye: ['→ envoyé', 'accent'], recu: ['← reçu', 'vert'], note: ['✎ note', 'encre-3'], etape: ['⇢ étape', 'orange'] };
    H.voletFiche = id;
    H.volet(`<h2 class="nom">${c.top ? '<span class="etoile">★</span> ' : ''}${G.esc(c.nom)}</h2>
      <div>${[c.priorite && `priorité ${c.priorite}`, this.TYPES[c.type] || c.type, c.quartier, c.langue && `langue ${c.langue}`].filter(Boolean).map((x) => `<span class="puce">${G.esc(x)}</span>`).join(' ')}</div>
      ${lecture ? '<div class="sous" style="margin-top:8px">Coordonnées et textes des échanges : seulement sur le PC.</div>' : `<div class="boutons">
        ${local && c.zalo ? lien(`https://zalo.me/${local}`, 'Zalo', c.canal === 'Zalo') : ''}${inter ? lien(`https://wa.me/${inter}`, 'WhatsApp') : ''}
        ${c.email ? lien(`mailto:${c.email.split(/[;,\s]/)[0]}`, 'Mail', c.canal === 'Email') : ''}${chiffres ? lien(`tel:${chiffres}`, 'Appeler', c.canal === 'Téléphone') : ''}
        ${c.site ? lien(http(c.site), 'Site') : ''}${c.carte ? lien(c.carte, 'Carte', c.canal === 'Visite') : ''}${c.facebook ? lien(http(c.facebook), 'Facebook') : ''}${c.linkedin ? lien(http(c.linkedin), 'LinkedIn') : ''}</div>`}
      <section><h3>Étape</h3><div class="pas">${etapes.map((e, i) => `<button data-etape="${e.id}" style="--c:${G.V(e.couleur)}" class="${i === rang ? 'ici' : i < rang && e.id !== 'ecarte' && c.etape !== 'ecarte' ? 'fait' : ''}" ${lecture ? 'disabled' : ''}>${e.nom}</button>`).join('')}</div></section>
      <section style="display:flex;gap:24px;flex-wrap:wrap"><div><h3>Intérêt</h3><div class="interet">${[1, 2, 3].map((n) => `<button data-interet="${n}" class="${n <= c.interet ? 'on' : ''}" ${lecture ? 'disabled' : ''}>●</button>`).join('')}</div></div>
        <div><h3>Relance ${c.relance && c.relance <= auj ? '<span class="retard">à faire</span>' : ''}</h3>${lecture ? `<span>${c.relance ? H.dateCourte(c.relance) : '—'}</span>` : `<input type="date" class="champ" id="f-relance" value="${c.relance}">
          <span class="boutons" style="display:inline-flex;margin:0"><button class="btn petit" data-relance="3">+3 j</button><button class="btn petit" data-relance="7">+7 j</button><button class="btn petit" data-relance="0">aucune</button></span>`}</div></section>
      ${lecture ? '' : `<section><h3>Repères</h3><dl class="infos">${[['Projet', c.projet], ['Dirigeants', c.dirigeants], ['Spécialités', c.specialites], ['Taille', c.taille], ['Adresse', c.adresse], ['Téléphone', c.tel], ['Mail', c.email], ['Note', c.note]]
        .filter(([, v]) => v).map(([n, v]) => `<dt>${n}</dt><dd>${G.esc(v)}</dd>`).join('')}</dl></section>`}
      <section><h3>Échanges</h3>
        ${lecture ? '' : `<div class="ligne-form" style="margin:0 0 10px"><select class="champ" id="f-canal" style="flex:0 1 110px">${H.d.clients.canaux.map((x) => `<option${x === (c.canal === 'Email' ? 'Mail' : c.canal) ? ' selected' : ''}>${x}</option>`).join('')}</select>
          <select class="champ" id="f-sens" style="flex:0 1 110px"><option value="envoye">j'ai envoyé</option><option value="recu">j'ai reçu</option><option value="note">note</option></select>
          <textarea class="champ" id="f-texte" rows="2" placeholder="Colle le message ou résume l'échange…" style="flex:1 1 100%"></textarea><button class="btn p" id="f-ajouter">Noter l'échange</button></div>`}
        ${c.echanges.length ? `<div class="fil">${c.echanges.map((x, i) => ({ x, i })).reverse().map(({ x, i }) => `<div style="--c:${G.V(sens[x.sens][1])}"><time>${H.dateCourte(x.date)} · ${sens[x.sens][0]}${x.canal ? ` · ${G.esc(x.canal)}` : ''}${lecture ? '' : ` <button class="suppr" data-retirer="${i}" title="Retirer">×</button>`}</time>${G.esc(x.texte || '')}</div>`).join('')}</div>` : G.vide('Aucun échange noté')}
      </section>`);
    if (lecture) return;
    const volet = document.getElementById('volet');
    const maj = async (champs, message) => {
      const r = await H.essayer(() => H.api('PUT', `hub/clients/${encodeURIComponent(id)}`, champs), message);
      if (!r) return;
      const i = H.d.clients.liste.findIndex((x) => x.id === id); H.d.clients.liste[i] = { ...H.d.clients.liste[i], ...r };
      H.rendre(true); this.fiche(id);
    };
    volet.querySelectorAll('[data-etape]').forEach((b) => { b.onclick = () => maj({ etape: b.dataset.etape }, 'Étape changée'); });
    volet.querySelectorAll('[data-interet]').forEach((b) => { b.onclick = () => maj({ interet: Number(b.dataset.interet) === c.interet ? 0 : Number(b.dataset.interet) }); });
    volet.querySelectorAll('[data-relance]').forEach((b) => { b.onclick = () => maj({ relance: b.dataset.relance === '0' ? '' : H.jour(Date.now() + Number(b.dataset.relance) * 864e5) }, 'Relance réglée'); });
    volet.querySelector('#f-relance').onchange = (ev) => maj({ relance: ev.target.value }, 'Relance réglée');
    volet.querySelector('#f-ajouter').onclick = () => { const texte = volet.querySelector('#f-texte').value.trim(); if (!texte) return H.toast("Écris ou colle quelque chose d'abord", true);
      maj({ echange: { canal: volet.querySelector('#f-canal').value, sens: volet.querySelector('#f-sens').value, texte } }, 'Échange noté'); };
    volet.querySelectorAll('[data-retirer]').forEach((b) => { b.onclick = () => maj({ retirerEchange: Number(b.dataset.retirer) }, 'Échange retiré'); });
  },

  apres() {
    const vue = document.getElementById('vue'), e = (H.etat.clients ??= { filtre: 'tous', cherche: '', tout: false });
    vue.querySelectorAll('[data-fiche]').forEach((f) => { f.onclick = () => this.fiche(f.dataset.fiche); });
    vue.querySelectorAll('[data-filtre]').forEach((b) => { b.onclick = () => { e.filtre = b.dataset.filtre; H.rendre(); }; });
    const voir = document.getElementById('voir-tout'); if (voir) voir.onclick = () => { e.tout = true; H.rendre(); };
    const cherche = document.getElementById('cherche');
    if (cherche) cherche.oninput = () => { e.cherche = cherche.value; clearTimeout(this.minuterie); this.minuterie = setTimeout(() => { H.rendre(); const c = document.getElementById('cherche'); c.focus(); c.setSelectionRange(c.value.length, c.value.length); }, 350); };
    if (H.enLigne) return;
    // Glisser une agence d'une colonne à l'autre change son étape.
    vue.querySelectorAll('.fiche[draggable="true"]').forEach((f) => { f.ondragstart = (ev) => ev.dataTransfer.setData('text/plain', f.dataset.fiche); });
    vue.querySelectorAll('.col[data-etape]').forEach((col) => {
      col.ondragover = (ev) => { ev.preventDefault(); col.classList.add('cible'); };
      col.ondragleave = () => col.classList.remove('cible');
      col.ondrop = async (ev) => {
        ev.preventDefault(); col.classList.remove('cible');
        const id = ev.dataTransfer.getData('text/plain'), c = H.d.clients.liste.find((x) => x.id === id);
        if (!c || c.etape === col.dataset.etape) return;
        const r = await H.essayer(() => H.api('PUT', `hub/clients/${encodeURIComponent(id)}`, { etape: col.dataset.etape }), 'Étape changée');
        if (r) { Object.assign(c, r); H.rendre(); }
      };
    });
  },
};
