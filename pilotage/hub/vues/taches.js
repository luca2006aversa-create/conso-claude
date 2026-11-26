// Tâches : le tableau du pilotage d'origine, refait dans le hub. Tableau par statut (glisser-déposer), liste par
// priorité, boîte à notes, activité, et le volet d'une tâche (champs, sections, pièces jointes, notes).
// Sur le PC : lit et écrit par l'API du pilotage (/api/tout, /api/taches…). En ligne : lecture seule, copie de H.d.taches.
'use strict';

(() => {
  const esc = G.esc;
  const COUL = { fait: 'vert', a_valider: 'rose', en_cours: 'orange', a_faire: 'accent', idee: 'violet', en_pause: 'encre-3', abandon: 'encre-3' };
  const PRIO = { urgent: 'rouge', important: 'orange', normal: 'encre-3', un_jour: 'encre-3' };
  const PAL = ['rouge', 'turquoise', 'violet', 'vert', 'orange', 'rose', 'encre-3'];
  const ORDRE_STATUT = ['en_cours', 'a_faire', 'a_valider', 'en_pause', 'idee', 'fait', 'abandon'];
  const ORDRE_PRIO = ['urgent', 'important', 'normal', 'un_jour'];
  const AIDE = { 'Pour toi': 'ce que ça change concrètement', 'Dans le code': 'comment ça marche, quels fichiers', 'Ce que ça touche': 'effets ailleurs, risques' };
  const MEMO = 'hub.taches';
  const dateFr = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}${d.length > 10 ? ` ${d.slice(11, 16)}` : ''}` : '');
  const kio = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`);
  const estImage = (p) => /^image\//.test(p.mime || '') || /\.(png|jpe?g|gif|webp)$/i.test(p.nom || '');
  const hote = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

  const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])#(\d+)\b/g, '$1<span class="lien-t" data-ouvrir="$2">#$2</span>');
  // Petit Markdown : paragraphes, listes « - », **gras**, `code`, liens #42.
  function riche(texte) {
    const html = [];
    for (const bloc of String(texte).split(/\n\s*\n/)) {
      let para = [], liste = null;
      const fermerPara = () => { if (para.length) html.push(`<p>${inline(para.join(' '))}</p>`); para = []; };
      const fermerListe = () => { if (liste) html.push(`<ul>${liste.map((li) => `<li>${inline(li)}</li>`).join('')}</ul>`); liste = null; };
      for (const brute of bloc.split('\n')) {
        const ligne = brute.trim(); if (!ligne) continue;
        const m = ligne.match(/^[-*] (.*)$/);
        if (m) { fermerPara(); (liste = liste || []).push(m[1]); } else if (liste) liste[liste.length - 1] += ` ${ligne}`; else para.push(ligne);
      }
      fermerPara(); fermerListe();
    }
    return html.join('');
  }

  const V = H.vues.taches = {
    nom: 'Tâches',
    onglets: [['', 'Tableau'], ['edition', 'Éditer'], ['priorites', 'Priorités'], ['notes', 'Notes'], ['activite', 'Activité']],
    D: null, lu: 0, brut: '', ouverte: null, edition: false, depliees: new Set(), onglet: '', corbeille: null, file: Promise.resolve(),
    // statutEd, ech et tri servent à l'onglet « Éditer » (statut, échéance, ordre de la liste).
    e: Object.assign({ projet: 'tous', categorie: '', priorite: '', chantier: '', qui: '', recherche: '', faites: false, statutEd: 'ouvertes', ech: '', tri: 'echeance' },
      (() => { try { return JSON.parse(localStorage.getItem(MEMO) || '{}'); } catch { return {}; } })()),
    pastille: () => (H.d && H.d.taches.notes) || 0,

    C() { return this.D.constantes; },
    nomDe(liste, id) { return ((this.C()[liste] || []).find((x) => x.id === id) || { nom: id || '—' }).nom; },
    tache(id) { return this.D.taches.find((t) => t.id === Number(id)); },
    options(liste, choisi) { return (this.C()[liste] || []).map((x) => `<option value="${esc(x.id)}"${x.id === choisi ? ' selected' : ''}>${esc(x.nom)}</option>`).join(''); },
    coulCat(id) { const i = (this.C().categories || []).findIndex((c) => c.id === id); return G.V(PAL[(i < 0 ? PAL.length - 1 : i) % PAL.length]); },
    memoriser() { try { const { projet, categorie, priorite, chantier, qui, statutEd, ech, tri } = this.e; localStorage.setItem(MEMO, JSON.stringify({ projet, categorie, priorite, chantier, qui, statutEd, ech, tri })); } catch { /* rien */ } },

    /* ---------- Données ---------- */
    async charger(force = false) {
      if (H.enLigne) {
        const t = H.d.taches;
        this.D = { taches: t.liste.map((x) => ({ chantiers: [], depend_de: [], conflit_avec: [], pieces: [], ...x, notes: Array(x.nbNotes || 0).fill(0),
          sections: x.pourToi ? [{ titre: 'Pour toi', texte: x.pourToi }] : [] })), boite: t.boite || [], journal: t.journal || [],
        constantes: { projets: t.projets, statuts: t.statuts, priorites: t.priorites || [], categories: t.categories || [], qui: t.quis || [], sections: ['Pour toi'] } };
        this.lu = Date.now(); return true;
      }
      if (this.D && !force && Date.now() - this.lu < 20000) return false;
      const rep = await fetch('/api/tout', { cache: 'no-store' });
      if (!rep.ok) throw new Error(`Tableau des tâches : ${rep.status}`);
      const txt = await rep.text(), change = txt !== this.brut;
      this.brut = txt; this.D = JSON.parse(txt); this.lu = Date.now();
      return change;
    },
    // Relit puis redessine ce qui est à l'écran (liste et volet), sans toucher à une saisie en cours.
    async relire() {
      try { await this.charger(true); } catch (err) { H.toast(err.message, true); return; }
      if (H.vueActive === 'taches' && document.getElementById('t-contenu')) { this.filtres(); this.peindre(); }
      if (this.ouverte && !this.edition) this.fiche();
      H.recharger(true);
    },
    filtrees() {
      const e = this.e, q = e.recherche.trim().toLowerCase();
      return this.D.taches.filter((t) => {
        if (e.projet !== 'tous' && t.projet !== e.projet) return false;
        if (!H.garder(H.espaceProjet(t.projet))) return false;
        if (e.categorie && t.categorie !== e.categorie) return false;
        if (e.priorite && t.priorite !== e.priorite) return false;
        if (e.chantier && !t.chantiers.includes(e.chantier)) return false;
        if (e.qui && t.qui !== e.qui) return false;
        if (!q) return true;
        if (/^#?\d+$/.test(q)) return t.id === Number(q.replace('#', ''));
        const tout = [t.titre, t.branche, ...t.chantiers, ...t.sections.map((s) => s.texte), ...t.notes.map((n) => n.texte || '')].join(' ').toLowerCase();
        return q.split(/\s+/).every((mot) => tout.includes(mot));
      });
    },
    async enregistrer(id, corps) {
      const t = this.tache(id);
      await H.essayer(() => H.api('PUT', `taches/${id}`, { version: t.version, ...corps }));
      this.edition = false;
      await this.relire();
    },

    /* ---------- Page ---------- */
    rendre(onglet) {
      this.onglet = onglet;
      return `${H.entete('Tâches', { onglets: this.onglets, actif: onglet, base: 'taches', filtre: true })}
        <div id="t-zone"><div class="filtres" id="t-filtres"></div><div class="avance" id="t-avance"></div><div id="t-contenu"><div class="attente">Chargement…</div></div></div>`;
    },
    apres() {
      const zone = document.getElementById('t-zone');
      if (this.D) { this.filtres(); this.peindre(); }
      if (!this.D || Date.now() - this.lu > 20000) this.charger(true).then((change) => { if (change && document.getElementById('t-contenu')) { this.filtres(); this.peindre(); } }).catch((err) => { const c = document.getElementById('t-contenu'); if (c) c.innerHTML = G.vide(err.message, '!'); });
      this.brancher(zone);
    },
    filtres() {
      const e = this.e, c = this.C(), boite = document.getElementById('t-filtres'); if (!boite) return;
      const sel = (id, liste, valeur, vide) => `<select class="champ" data-filtre="${id}"><option value="">${vide}</option>${liste.map((x) => `<option value="${esc(x.id)}"${x.id === valeur ? ' selected' : ''}>${esc(x.nom)}</option>`).join('')}</select>`;
      const projets = `<span class="seg">${[{ id: 'tous', nom: 'Tous' }, ...c.projets].map((p) => `<button data-projet="${esc(p.id)}" class="${p.id === e.projet ? 'actif' : ''}">${esc(p.nom)}</button>`).join('')}</span>`;
      if (this.onglet === 'edition') {
        // Onglet « Éditer » : projet, statut, échéance (avec le nombre de tâches dans chaque case), recherche.
        const base = this.baseEd(), n = (id) => base.filter((t) => this.casEch(t, id)).length;
        const ech = [['', 'Toutes'], ['retard', 'En retard'], ['semaine', '7 jours'], ['mois', '30 jours'], ['sans', 'Sans date']];
        boite.innerHTML = `${projets}
          <select class="champ" data-filtre="statutEd" aria-label="Statut"><option value="ouvertes"${e.statutEd === 'ouvertes' ? ' selected' : ''}>Pas finies</option><option value=""${e.statutEd === '' ? ' selected' : ''}>Tous les statuts</option>${c.statuts.map((s) => `<option value="${esc(s.id)}"${s.id === e.statutEd ? ' selected' : ''}>${esc(s.nom)}</option>`).join('')}</select>
          <span class="seg seg-ech" aria-label="Échéance">${ech.map(([id, nom]) => `<button data-ech="${id}" class="${e.ech === id ? 'actif' : ''}${id === 'retard' && n('retard') ? ' rouge' : ''}">${nom}${id ? `<em>${n(id)}</em>` : ''}</button>`).join('')}</span>
          <input class="champ" id="t-recherche" type="search" placeholder="Chercher… (mot ou #numéro)" value="${esc(e.recherche)}" style="flex:1 1 160px;border-radius:999px">`;
        return;
      }
      const chantiers = [...new Set(this.D.taches.flatMap((t) => t.chantiers))].sort((a, b) => a.localeCompare(b, 'fr'));
      boite.innerHTML = `${projets}
        ${c.categories.length ? sel('categorie', c.categories, e.categorie, 'Toutes catégories') : ''}${c.priorites.length ? sel('priorite', c.priorites, e.priorite, 'Toutes priorités') : ''}
        ${chantiers.length ? sel('chantier', chantiers.map((x) => ({ id: x, nom: x })), e.chantier, 'Tous chantiers') : ''}
        ${sel('qui', [{ id: 'toi', nom: 'À toi' }, { id: 'claude', nom: 'À Claude' }], e.qui, 'Peu importe qui')}
        <input class="champ" id="t-recherche" type="search" placeholder="Chercher… (mot ou #numéro)" value="${esc(e.recherche)}" style="flex:1 1 160px;border-radius:999px">`;
    },
    peindre() {
      const e = this.e, c = this.C();
      const ordre = ['fait', 'a_valider', 'en_cours', 'en_pause', 'a_faire', 'idee'];
      document.getElementById('t-avance').innerHTML = ['', 'priorites'].includes(this.onglet) ? c.projets.filter((p) => (e.projet === 'tous' || p.id === e.projet) && H.garder(H.espaceProjet(p.id))).map((p) => {
        const tp = this.D.taches.filter((t) => t.projet === p.id && t.statut !== 'abandon'); if (!tp.length) return '';
        const n = (s) => tp.filter((t) => t.statut === s).length;
        return `<div class="p"><div class="tete"><strong>${esc(p.nom)}</strong><span>${n('fait')} / ${tp.length}</span></div>
          <div class="barre">${ordre.map((s) => (n(s) ? `<i style="width:${100 * n(s) / tp.length}%;background:${G.V(COUL[s])}" title="${esc(this.nomDe('statuts', s))} : ${n(s)}"></i>` : '')).join('')}</div>
          <div class="tete"><span>${ordre.filter((s) => s !== 'fait' && n(s)).map((s) => `${n(s)} ${this.nomDe('statuts', s).toLowerCase()}`).join(' · ')}</span></div></div>`;
      }).join('') : '';
      document.getElementById('t-contenu').innerHTML = ({ '': () => this.tableau(), edition: () => this.editer(), priorites: () => this.priorites(), notes: () => this.notes(), activite: () => this.activite() }[this.onglet] || (() => this.tableau()))();
      if (this.onglet === 'edition' && !H.enLigne && !this.corbeille) this.chargerCorbeille();
    },

    /* ---------- Onglet « Éditer » : tout se modifie directement dans la liste ---------- */
    // Les tâches du projet (et de l'espace) choisis, filtrées par statut et recherche ; le filtre d'échéance vient ensuite.
    baseEd() {
      const e = this.e, q = e.recherche.trim().toLowerCase();
      return this.D.taches.filter((t) => {
        if (e.projet !== 'tous' && t.projet !== e.projet) return false;
        if (!H.garder(H.espaceProjet(t.projet))) return false;
        if (e.statutEd === 'ouvertes' ? ['fait', 'abandon'].includes(t.statut) : (e.statutEd && t.statut !== e.statutEd)) return false;
        if (!q) return true;
        if (/^#?\d+$/.test(q)) return t.id === Number(q.replace('#', ''));
        return q.split(/\s+/).every((mot) => [t.titre, ...t.chantiers].join(' ').toLowerCase().includes(mot));
      });
    },
    enRetard(t) { return !!t.echeance && t.echeance < H.jour() && !['fait', 'abandon'].includes(t.statut); },
    casEch(t, cas) {
      const j = H.jour(), dans = (n) => H.jour(new Date(Date.now() + n * 864e5));
      if (cas === 'retard') return this.enRetard(t);
      if (cas === 'semaine') return !!t.echeance && t.echeance >= j && t.echeance <= dans(7);
      if (cas === 'mois') return !!t.echeance && t.echeance >= j && t.echeance <= dans(30);
      if (cas === 'sans') return !t.echeance;
      return true;
    },
    trier(liste) {
      const rang = (t) => ORDRE_PRIO.indexOf(t.priorite), ech = (t) => t.echeance || '9999';
      const ordres = {
        echeance: (a, b) => ech(a).localeCompare(ech(b)) || rang(a) - rang(b) || b.id - a.id,
        priorite: (a, b) => rang(a) - rang(b) || ech(a).localeCompare(ech(b)) || b.id - a.id,
        statut: (a, b) => ORDRE_STATUT.indexOf(a.statut) - ORDRE_STATUT.indexOf(b.statut) || ech(a).localeCompare(ech(b)) || b.id - a.id,
        id: (a, b) => b.id - a.id,
      };
      return liste.sort(ordres[this.e.tri] || ordres.echeance);
    },
    ligneEd(t) {
      const ro = H.enLigne, bloque = ro ? ' disabled' : '';
      const sel = (champ, liste, nom) => `<select class="champ" data-ed="${champ}" aria-label="${nom} de #${t.id}"${bloque}>${this.options(liste, t[champ])}</select>`;
      const date = (champ, nom) => `<label class="ed-d"><small>${nom}</small><input class="champ${champ === 'echeance' && this.enRetard(t) ? ' en-retard' : ''}" type="date" data-ed="${champ}" value="${esc(t[champ] || '')}" aria-label="${nom} de #${t.id}"${bloque}></label>`;
      return `<div class="ed-ligne${t.id === this.derniere ? ' neuve' : ''}" data-id="${t.id}" style="--c:${G.V(COUL[t.statut] || 'encre-3')}">
        <button class="ed-num" data-ouvrir="${t.id}" title="Ouvrir la fiche">#${t.id}</button>
        <input class="champ ed-titre" data-ed="titre" value="${esc(t.titre)}" aria-label="Titre de #${t.id}"${ro ? ' readonly' : ''}>
        ${sel('statut', 'statuts', 'Statut')}${sel('priorite', 'priorites', 'Priorité')}${sel('projet', 'projets', 'Projet')}${date('debut', 'Début')}${date('echeance', 'Échéance')}
        <span class="ed-actions"><button class="btn-ic" data-ouvrir="${t.id}" title="Notes et détails">${H.icone('journal')}${t.notes.length ? `<small>${t.notes.length}</small>` : ''}</button>${ro ? '' : `<button class="btn-ic" data-jeter="${t.id}" title="Mettre à la corbeille">${H.icone('corbeille')}</button>`}</span></div>`;
    },
    editer() {
      const ro = H.enLigne, c = this.C(), e = this.e;
      const liste = this.trier(this.baseEd().filter((t) => this.casEch(t, e.ech)));
      const colonnes = [['id', 'N°'], ['titre', 'Titre'], ['statut', 'Statut'], ['priorite', 'Priorité'], ['projet', 'Projet'], ['debut', 'Début'], ['echeance', 'Échéance']];
      const tete = `<div class="ed-ligne ed-tete">${colonnes.map(([id, nom]) => (['id', 'statut', 'priorite', 'echeance'].includes(id)
        ? `<button data-tri="${id}" class="${e.tri === id ? 'actif' : ''}" title="Trier par ${nom.toLowerCase()}">${nom}${e.tri === id ? ' ↓' : ''}</button>` : `<span>${nom}</span>`)).join('')}<span></span></div>`;
      const projet = e.projet !== 'tous' ? e.projet : (c.projets.find((p) => H.garder(H.espaceProjet(p.id))) || c.projets[0] || {}).id;
      const nouvelle = ro ? '' : `<form class="ed-ligne ed-nouvelle" id="ed-nouvelle" autocomplete="off">
          <span class="ed-num">${H.icone('ajouter')}</span>
          <input class="champ ed-titre" name="titre" placeholder="Nouvelle tâche : que faut-il faire ?" aria-label="Titre de la nouvelle tâche">
          <select class="champ" name="statut" aria-label="Statut">${this.options('statuts', 'a_faire')}</select>
          <select class="champ" name="priorite" aria-label="Priorité">${this.options('priorites', 'normal')}</select>
          <select class="champ" name="projet" aria-label="Projet">${this.options('projets', projet)}</select>
          <label class="ed-d"><small>Début</small><input class="champ" type="date" name="debut" aria-label="Début"></label>
          <label class="ed-d"><small>Échéance</small><input class="champ" type="date" name="echeance" aria-label="Échéance"></label>
          <span class="ed-actions"><button class="btn p petit" type="submit">Créer</button></span></form>`;
      return `<div class="grille"><div class="carte c12 ed-carte">${nouvelle}${tete}
          <div class="ed-liste">${liste.map((t) => this.ligneEd(t)).join('') || '<div class="sous" style="padding:14px 10px">Aucune tâche ici.</div>'}</div></div>
        ${ro ? '' : `<details class="carte c12 ed-corbeille" id="ed-corbeille"${this.corbeilleOuverte ? ' open' : ''}><summary>${H.icone('corbeille')}Corbeille<em>${this.corbeille ? this.corbeille.length : ''}</em><small>récupérable</small></summary>
          <div class="ed-jetees">${this.corbeilleHtml()}</div></details>`}</div>`;
    },
    corbeilleHtml() {
      const l = this.corbeille;
      if (!l) return '<div class="sous">Chargement…</div>';
      if (!l.length) return '<div class="sous" style="padding:6px 4px">Vide.</div>';
      return l.map((t) => `<div class="ed-jetee"><span class="ed-num">#${t.id}</span><span>${esc(t.titre)}</span><span class="sous cache-m">${esc(this.nomDe('projets', t.projet))} · ${dateFr(t.jete_le)}</span>
        <button class="btn petit" data-restaurer="${t.id}">${H.icone('restaurer')}Remettre</button></div>`).join('');
    },
    async chargerCorbeille() {
      if (H.enLigne) return;
      try { const r = await H.api('GET', 'taches/corbeille'); this.corbeille = Array.isArray(r) ? r : (r.taches || []); } catch { this.corbeille = []; }
      const boite = document.getElementById('ed-corbeille'); if (!boite) return;
      boite.querySelector('summary em').textContent = this.corbeille.length;
      boite.querySelector('.ed-jetees').innerHTML = this.corbeilleHtml();
    },
    // Enregistre un champ changé dans la liste sans la redessiner : la saisie suivante n'est pas coupée.
    // Les enregistrements passent l'un après l'autre (file), chacun avec la version rendue par le précédent.
    enregistrerEd(id, champs, el) {
      this.file = this.file.then(async () => {
        const t = this.tache(id); if (!t) return;
        try {
          Object.assign(t, await H.api('PUT', `taches/${id}`, { version: t.version, champs }));
          const ligne = el.closest('.ed-ligne');
          if (ligne) { ligne.style.setProperty('--c', G.V(COUL[t.statut] || 'encre-3')); ligne.querySelector('[data-ed="echeance"]')?.classList.toggle('en-retard', this.enRetard(t)); }
          el.classList.add('ok'); setTimeout(() => el.classList.remove('ok'), 1400);
          H.toast(`#${id} enregistrée`); H.recharger(true);
        } catch (err) { H.toast(err.message, true); await this.relire(); }
      });
      return this.file;
    },
    async jeter(id) {
      if (!(await H.essayer(() => H.api('DELETE', `taches/${id}`)))) return;
      if (this.ouverte === Number(id)) H.fermerVolet();
      await this.relire(); this.chargerCorbeille();
      H.toast(`#${id} mise à la corbeille`, false, { nom: 'Annuler', faire: () => this.restaurer(id) });
    },
    async restaurer(id) {
      if (!(await H.essayer(() => H.api('POST', `taches/${id}/restaurer`), `#${id} remise dans la liste`))) return;
      await this.relire(); this.chargerCorbeille();
    },

    carte(t) {
      const prio = t.priorite && t.priorite !== 'normal' ? `<span class="puce prio" style="--c:${G.V(PRIO[t.priorite])}">${esc(this.nomDe('priorites', t.priorite))}</span>` : '';
      const qui = t.qui === 'toi' && !['fait', 'abandon'].includes(t.statut) ? '<span class="puce toi">à toi</span>' : '';
      return `<article class="fiche tcarte" draggable="${!H.enLigne}" tabindex="0" data-id="${t.id}" style="--c:${this.coulCat(t.categorie)}">
        <div class="meta"><span>#${t.id}</span>${this.e.projet === 'tous' ? `<span>· ${esc(this.nomDe('projets', t.projet))}</span>` : ''}${t.statut === 'fait' && t.fait_le ? `<span>· ${dateFr(t.fait_le)}</span>` : ''}</div>
        <div class="titre">${esc(t.titre)}</div>
        <div class="bas">${t.echeance && !['fait', 'abandon'].includes(t.statut) ? `<span class="puce" style="${t.echeance < H.jour() ? 'border-color:var(--rouge);color:var(--rouge)' : 'border-color:var(--vif);color:var(--vif)'}">⏱ ${H.dateCourte(t.echeance)}</span>` : ''}${qui}${prio}${t.categorie ? `<span class="puce">${esc(this.nomDe('categories', t.categorie))}</span>` : ''}${t.chantiers.map((x) => `<span class="puce">${esc(x)}</span>`).join('')}${t.notes.length ? `<span class="sous">${t.notes.length} note${t.notes.length > 1 ? 's' : ''}</span>` : ''}</div></article>`;
    },
    tableau() {
      const taches = this.filtrees(), rang = (t) => ORDRE_PRIO.indexOf(t.priorite);
      const colonnes = this.C().statuts.filter((s) => s.id !== 'abandon' || taches.some((t) => t.statut === 'abandon'));
      return `<div class="kanban" style="--n:${colonnes.length}">${colonnes.map((s) => {
        let liste = taches.filter((t) => t.statut === s.id);
        liste = s.id === 'fait' ? liste.sort((a, b) => (b.fait_le || '').localeCompare(a.fait_le || '') || b.id - a.id) : liste.sort((a, b) => rang(a) - rang(b) || b.id - a.id);
        const limite = s.id === 'fait' && !this.e.faites ? 8 : Infinity;
        return `<section class="col" data-statut="${s.id}" style="--c:${G.V(COUL[s.id] || 'encre-3')}"><h3>${esc(s.nom)}<em>${liste.length}</em></h3>
          ${liste.slice(0, limite).map((t) => this.carte(t)).join('') || '<div class="sous" style="text-align:center;padding:10px">—</div>'}
          ${liste.length > limite ? `<button class="btn petit discret" data-faites>Voir les ${liste.length - limite} autres</button>` : ''}</section>`;
      }).join('')}</div>`;
    },
    priorites() {
      const ouvertes = this.filtrees().filter((t) => !['fait', 'abandon'].includes(t.statut));
      return `<div class="grille">${this.C().priorites.map((p) => {
        const liste = ouvertes.filter((t) => t.priorite === p.id).sort((a, b) => ORDRE_STATUT.indexOf(a.statut) - ORDRE_STATUT.indexOf(b.statut) || b.id - a.id);
        return `<div class="carte c12 groupe-prio"><h2><i style="width:9px;height:9px;border-radius:50%;background:${G.V(PRIO[p.id] || 'encre-3')};align-self:center"></i>${esc(p.nom)}<em>${liste.length}</em></h2>
          <div class="lignes">${liste.map((t) => `<div class="ligne" data-id="${t.id}" tabindex="0" role="button"><span class="num">#${t.id}</span>
            <span>${esc(t.titre)}${t.chantiers.length ? ` <span class="puce">${esc(t.chantiers.join(', '))}</span>` : ''}${t.qui === 'toi' ? ' <span class="retard">à toi</span>' : ''}</span>
            <span class="sous cache-m">${esc(this.nomDe('projets', t.projet))}</span><span class="statut-t cache-m" style="--c:${G.V(COUL[t.statut] || 'encre-3')}">${esc(this.nomDe('statuts', t.statut))}</span>
            ${H.enLigne ? '<span></span>' : `<select class="champ" data-prio="${t.id}" aria-label="Priorité de #${t.id}" style="font-size:12px;padding:2px 8px">${this.options('priorites', t.priorite)}</select>`}</div>`).join('') || '<div class="sous" style="padding:8px 6px">Rien ici</div>'}</div></div>`;
      }).join('')}</div>`;
    },
    notes() {
      const notes = [...this.D.boite].reverse(), a = notes.filter((n) => !n.rangee), r = notes.filter((n) => n.rangee).slice(0, 40);
      const bloc = (n) => `<div class="note-b${n.rangee ? ' rangee' : ''}" data-note="${esc(n.id)}"><div class="meta"><span>${dateFr(n.date)}</span>${n.projet ? `<span class="puce">${esc(this.nomDe('projets', n.projet))}</span>` : ''}
          ${n.rangee ? `<span>rangée${n.tache ? ` dans <span class="lien-t" data-ouvrir="${n.tache}">#${n.tache}</span>` : ''}</span>` : '<span class="retard">à ranger</span>'}
          ${H.enLigne ? '' : `<span style="margin-left:auto;display:flex;gap:4px">${n.rangee ? '' : '<button class="btn petit" data-note-tache>→ Tâche</button><button class="btn petit discret" data-note-modif>Modifier</button>'}<button class="btn petit discret" data-note-suppr>Supprimer</button></span>`}</div>
        <div class="texte">${esc(n.texte)}</div>${H.enLigne ? '' : this.pieces(n.id, n.pieces)}</div>`;
      return `<div class="grille"><div class="carte c7"><h2>À ranger<em>${a.length}</em></h2>
          ${H.enLigne ? '' : `<form id="t-noter" style="display:flex;gap:6px;margin-bottom:12px"><textarea class="champ" rows="2" placeholder="Écris ce qui te passe par la tête…" style="flex:1;resize:vertical"></textarea><button class="btn p" type="submit">Noter</button></form>`}
          ${a.map(bloc).join('') || G.vide('Aucune note à ranger', '✓')}</div>
        <div class="carte c5"><h2>Déjà rangées<em>${r.length}</em></h2>${r.map(bloc).join('') || G.vide('Rien encore')}</div></div>`;
    },
    decrire(ev) {
      const t = ev.tache ? `<span class="lien-t" data-ouvrir="${ev.tache}">#${ev.tache}</span> ${esc(ev.titre || '')}` : '';
      const val = (champ, v) => { if (Array.isArray(v)) return esc(v.join(', ') || '(vide)');
        const listes = { statut: 'statuts', priorite: 'priorites', categorie: 'categories', projet: 'projets' };
        return esc(listes[champ] ? this.nomDe(listes[champ], v) : (v || '(vide)')); };
      switch (ev.action) {
        case 'champ': return `${t} — ${esc(ev.champ)} : ${val(ev.champ, ev.de)} → <strong>${val(ev.champ, ev.vers)}</strong>`;
        case 'note': return `${t} — note : « ${esc(String(ev.texte || '').slice(0, 160))} »`;
        case 'section': return `${t} — section « ${esc(ev.section)} » réécrite`;
        case 'creation': return `Nouvelle tâche ${t}`;
        case 'boite': return `Note dans la boîte : « ${esc(String(ev.texte || '').slice(0, 160))} »`;
        case 'boite_modif': return `Note ${esc(ev.note)} modifiée`;
        case 'boite_suppr': return `Note ${esc(ev.note)} supprimée`;
        case 'corbeille': return `#${esc(ev.tache)} ${esc(ev.titre || '')} — mise à la corbeille`;
        case 'restauration': return `${t} — remise depuis la corbeille`;
        case 'piece': case 'piece_suppr': { const n = /^t\d+$/.test(ev.cible || '') ? ev.cible.slice(1) : '';
          return `${n ? `<span class="lien-t" data-ouvrir="${n}">#${n}</span> ` : ''}${esc(ev.titre || '')} — « ${esc(ev.nom || '')} » ${ev.action === 'piece' ? 'ajoutée' : 'retirée'}`; }
        default: return esc(ev.action);
      }
    },
    activite() {
      const j = this.D.journal; if (!j.length) return G.vide('Rien encore');
      // Qui a bougé quoi, par jour, sur 30 jours ; puis le détail.
      const jours = H.derniersJours(30), compte = (qui) => jours.map((d) => j.filter((x) => String(x.date).slice(0, 10) === d && (x.auteur === 'toi') === qui).length);
      return `<div class="grille"><div class="carte c12"><h2>Rythme<em>30 jours</em></h2>${G.barres([{ nom: 'toi', c: 'orange', v: compte(true) }, { nom: 'Claude', c: 'violet', v: compte(false) }], { x: jours.map(H.dateCourte), h: 120 })}${G.legende([['orange', 'toi'], ['violet', 'Claude']])}</div>
        <div class="carte c12"><h2>Journal<em>${j.length} lignes</em></h2><div class="activite">${j.slice(0, 300).map((x) => `<div><span class="date">${dateFr(x.date)}</span><span class="qui ${x.auteur === 'toi' ? '' : 'claude'}">${x.auteur === 'toi' ? 'Toi' : 'Claude'}</span><span>${this.decrire(x)}</span></div>`).join('')}</div></div></div>`;
    },

    /* ---------- Pièces jointes ---------- */
    pieces(cible, pieces) {
      const cartes = (pieces || []).map((p) => {
        const supp = H.enLigne ? '' : `<button class="suppr" data-piece-suppr="${esc(p.id)}" title="Retirer">×</button>`;
        if (p.type === 'lien') return `<div class="piece"><a class="piece-corps" href="${esc(p.url)}" target="_blank" rel="noopener"><span>🔗</span><span><strong>${esc(p.nom)}</strong><small>${esc(hote(p.url))}</small></span></a>${supp}</div>`;
        const href = encodeURI(p.chemin);
        if (estImage(p)) return `<div class="piece image"><a href="${href}" target="_blank"><img src="${href}" alt="${esc(p.nom)}" loading="lazy"></a><div class="legende"><span>${esc(p.nom)}</span>${supp}</div></div>`;
        return `<div class="piece"><a class="piece-corps" href="${href}" target="_blank"><span>📄</span><span><strong>${esc(p.nom)}</strong><small>${kio(p.taille || 0)}</small></span></a>${supp}</div>`;
      }).join('');
      return `<div class="pieces" data-cible="${esc(cible)}"><div class="pieces-liste">${cartes}</div>
        ${H.enLigne ? '' : `<div class="ligne-form" style="margin:0"><label class="btn petit">+ Fichier<input type="file" multiple hidden data-fichier></label>
          <form class="lien-form" style="display:flex;gap:6px;flex:1"><input class="champ" type="url" placeholder="Coller un lien https://…" style="flex:1;font-size:12px"><button class="btn petit" type="submit">Ajouter</button></form></div>
        <div class="depot">ou dépose un fichier ici · Ctrl+V colle une image</div>`}</div>`;
    },
    async envoyer(cible, fichiers) {
      let n = 0;
      for (const f of fichiers) {
        const nom = f.name && f.name !== 'image.png' ? f.name : `capture-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}.png`;
        try { const r = await fetch(`/api/pieces/${cible}?nom=${encodeURIComponent(nom)}&mime=${encodeURIComponent(f.type)}`, { method: 'POST', body: f });
          const d = await r.json(); if (!r.ok) throw new Error(d.erreur); n++; } catch (err) { H.toast(`${nom} : ${err.message}`, true); }
      }
      if (n) { H.toast(n > 1 ? `${n} fichiers ajoutés` : 'Fichier ajouté'); await this.relire(); }
    },

    /* ---------- Volet d'une tâche ---------- */
    async ouvrir(id) {
      if (!this.D) { try { await this.charger(); } catch (err) { H.toast(err.message, true); return; } }
      if (!this.tache(id)) { H.toast(`Tâche #${id} introuvable`, true); return; }
      this.ouverte = Number(id); this.edition = false;
      this.fiche();
    },
    fiche() {
      const t = this.tache(this.ouverte); if (!t) { H.fermerVolet(); return; }
      const ro = H.enLigne, c = this.C(), bloque = ro ? ' disabled' : '';
      const pause = t.statut === 'en_pause' ? '<button class="btn petit" data-raccourci="reprendre">Reprendre</button>' : (['fait', 'abandon'].includes(t.statut) ? '' : '<button class="btn petit" data-raccourci="en_pause">Mettre en pause</button>');
      const raccourcis = ro ? '' : [t.statut === 'a_valider' ? '<button class="btn petit p" data-raccourci="fait">✓ C\'est validé</button>' : '', pause,
        !['fait', 'a_valider', 'abandon'].includes(t.statut) ? '<button class="btn petit discret" data-raccourci="abandon">Abandonner</button>' : '',
        `<button class="btn petit discret t-jeter" data-jeter="${t.id}" title="Mettre à la corbeille (récupérable)">${H.icone('corbeille')}Corbeille</button>`].join('');
      const sections = [...c.sections.map((titre) => t.sections.find((s) => s.titre === titre) || { titre, texte: '' }), ...t.sections.filter((s) => !c.sections.includes(s.titre))];
      this.sections = sections;
      const section = (s, i) => { const long = s.texte.length > 700 && !this.depliees.has(`${t.id}:${s.titre}`);
        return `<section class="bloc" data-section="${i}"><h3>${esc(s.titre)}<small>${esc(AIDE[s.titre] || '')}</small>${ro ? '' : '<button class="btn petit discret" data-editer>Modifier</button>'}</h3>
          <div class="texte-riche${s.texte ? '' : ' vide-txt'}${long ? ' replie' : ''}">${s.texte ? riche(s.texte) : 'Pas encore écrit.'}</div>${long ? '<button class="btn petit discret" data-deplier>Tout afficher</button>' : ''}</section>`; };
      const liens = [t.chantiers.join(', '), t.branche, t.depend_de.length ? `dépend de ${t.depend_de.map((x) => `#${x}`).join(', ')}` : '', t.conflit_avec.length ? `en conflit avec ${t.conflit_avec.map((x) => `#${x}`).join(', ')}` : ''].filter(Boolean).join(' · ');
      const champ = (nom, liste, valeur) => (c[liste] && c[liste].length ? `<label>${nom}<select class="champ" data-champ="${liste === 'qui' ? 'qui' : { statuts: 'statut', priorites: 'priorite', categories: 'categorie', projets: 'projet' }[liste]}"${bloque}>${this.options(liste, valeur)}</select></label>` : '');
      H.volet(`<div id="t-fiche">
        <div class="t-haut"><span class="statut-t" style="--c:${G.V(COUL[t.statut] || 'encre-3')}">#${t.id}</span><span>· créée le ${dateFr(t.cree)}</span>${t.fait_le ? `<span>· faite le ${dateFr(t.fait_le)}</span>` : ''}</div>
        <textarea id="t-titre" rows="1" data-champ="titre" aria-label="Titre"${ro ? ' readonly' : ''}>${esc(t.titre)}</textarea>
        <div class="champs">${champ('Statut', 'statuts', t.statut)}${champ('Priorité', 'priorites', t.priorite)}${champ('Catégorie', 'categories', t.categorie)}${champ('Projet', 'projets', t.projet)}${champ('Qui agit ?', 'qui', t.qui || '')}
          <label>Début<input class="champ" type="date" data-champ="debut" value="${esc(t.debut || '')}"${bloque}></label><label>Échéance<input class="champ" type="date" data-champ="echeance" value="${esc(t.echeance || '')}"${bloque}></label></div>
        ${raccourcis ? `<div class="boutons">${raccourcis}</div>` : ''}
        ${ro ? (liens ? `<div class="sous" style="margin-top:10px">${esc(liens)}</div>` : '') : `<details class="plus-champs"${t.depend_de.length || t.conflit_avec.length ? ' open' : ''}><summary>${esc(liens || 'Chantiers, branche, liens')}</summary><div class="champs-2">
          <label>Chantiers<input class="champ" data-champ="chantiers" data-liste value="${esc(t.chantiers.join(', '))}" placeholder="ex. Mise en ligne, Carnet"></label>
          <label>Branche<input class="champ" data-champ="branche" value="${esc(t.branche || '')}" placeholder="feature/…"></label>
          <label>Dépend de<input class="champ" data-champ="depend_de" data-liste value="${esc(t.depend_de.join(', '))}" placeholder="ex. 12, 15"></label>
          <label>En conflit avec<input class="champ" data-champ="conflit_avec" data-liste value="${esc(t.conflit_avec.join(', '))}" placeholder="ex. 30"></label></div></details>`}
        ${sections.map(section).join('')}
        ${ro ? '' : `<section><h3>Pièces jointes<small>images, documents, liens</small></h3>${this.pieces(`t${t.id}`, t.pieces)}</section>`}
        <section><h3>Notes<small>${t.notes.length || ''}</small></h3>
          ${ro ? '' : t.notes.map((n) => `<div class="msg${n.auteur === 'claude' ? ' claude' : ''}"><div class="meta"><span class="qui${n.auteur === 'claude' ? ' claude' : ''}">${n.auteur === 'claude' ? 'Claude' : 'Toi'}</span><span>${dateFr(n.date)}</span></div><div class="texte">${esc(n.texte)}</div></div>`).join('') || '<div class="sous">Aucune note.</div>'}
          ${ro ? '<div class="sous">Le détail des notes se lit sur le PC.</div>' : '<form class="ajout-note" style="margin-top:8px"><textarea rows="2" placeholder="Ajouter une note à cette tâche…"></textarea><div class="boutons" style="justify-content:flex-end;margin-bottom:0"><button class="btn p petit" type="submit">Ajouter la note</button></div></form>'}</section></div>`, true);
      H.voletFerme = () => { this.ouverte = null; this.edition = false; };
      const titre = document.getElementById('t-titre'); titre.style.height = 'auto'; titre.style.height = `${titre.scrollHeight + 2}px`;
      this.brancher(document.getElementById('t-fiche'));
    },

    /* ---------- Nouvelle tâche ---------- */
    async nouvelle() {
      if (!this.D) { try { await this.charger(); } catch (err) { H.toast(err.message, true); return; } }
      const e = this.e;
      H.volet(`<form id="t-nouvelle"><h2 class="nom">Nouvelle tâche</h2>
        <textarea class="champ" name="titre" rows="2" placeholder="Que faut-il faire ?" required style="width:100%;font-size:16px;margin:8px 0 12px"></textarea>
        <div class="champs"><label>Projet<select class="champ" name="projet">${this.options('projets', e.projet === 'tous' ? 'sitescope' : e.projet)}</select></label>
          <label>Catégorie<select class="champ" name="categorie">${this.options('categories', 'ajout')}</select></label>
          <label>Statut<select class="champ" name="statut">${this.options('statuts', 'a_faire')}</select></label>
          <label>Priorité<select class="champ" name="priorite">${this.options('priorites', 'normal')}</select></label></div>
        <div class="champs-2" style="grid-template-columns:1fr"><label>Chantiers<input class="champ" name="chantiers" placeholder="ex. Mise en ligne, Carnet"></label></div>
        <div class="boutons" style="justify-content:flex-end;margin-top:16px"><button class="btn p" type="submit">Créer la tâche</button></div></form>`);
      const f = document.getElementById('t-nouvelle'); f.titre.focus();
      f.onsubmit = async (ev) => { ev.preventDefault(); if (!f.titre.value.trim()) return;
        const t = await H.essayer(() => H.api('POST', 'taches', { titre: f.titre.value.trim(), projet: f.projet.value, categorie: f.categorie.value, statut: f.statut.value, priorite: f.priorite.value,
          chantiers: f.chantiers.value.split(',').map((s) => s.trim()).filter(Boolean) }), 'Tâche créée');
        if (!t) return; await this.relire(); this.ouvrir(t.id); };
    },

    /* ---------- Gestes (liste et volet) ---------- */
    brancher(zone) {
      zone.onclick = async (ev) => {
        const c = ev.target, lien = c.closest('[data-ouvrir]');
        if (lien) { this.ouvrir(lien.dataset.ouvrir); return; }
        const projet = c.closest('[data-projet]');
        if (projet) { this.e.projet = projet.dataset.projet; this.memoriser(); this.filtres(); this.peindre(); return; }
        if (c.closest('[data-faites]')) { this.e.faites = true; this.peindre(); return; }
        const ech = c.closest('[data-ech]');
        if (ech) { this.e.ech = ech.dataset.ech; this.memoriser(); this.filtres(); this.peindre(); return; }
        const tri = c.closest('[data-tri]');
        if (tri) { this.e.tri = tri.dataset.tri; this.memoriser(); this.peindre(); return; }
        const jeter = c.closest('[data-jeter]');
        if (jeter) { await this.jeter(jeter.dataset.jeter); return; }
        const remettre = c.closest('[data-restaurer]');
        if (remettre) { await this.restaurer(remettre.dataset.restaurer); return; }
        if (c.closest('#ed-corbeille > summary')) { this.corbeilleOuverte = !c.closest('details').open; return; }
        const raccourci = c.closest('[data-raccourci]');
        if (raccourci) { const t = this.tache(this.ouverte); let vers = raccourci.dataset.raccourci;
          if (vers === 'reprendre') { const j = this.D.journal.find((x) => x.tache === t.id && x.champ === 'statut' && x.vers === 'en_pause'); vers = j && j.de && j.de !== 'en_pause' ? j.de : 'a_faire'; }
          await this.enregistrer(t.id, { champs: { statut: vers } }); return; }
        const bloc = c.closest('[data-section]');
        if (bloc && c.closest('[data-editer]')) { const s = this.sections[Number(bloc.dataset.section)]; this.edition = true;
          bloc.querySelector('.texte-riche').outerHTML = `<textarea>${esc(s.texte)}</textarea><div class="boutons" style="justify-content:flex-end"><button class="btn petit" data-annuler>Annuler</button><button class="btn petit p" data-enregistrer>Enregistrer</button></div>`;
          c.closest('[data-editer]').remove(); bloc.querySelector('[data-deplier]')?.remove();
          const ta = bloc.querySelector('textarea'); ta.style.height = `${Math.max(160, Math.min(innerHeight * 0.6, ta.scrollHeight + 4))}px`; ta.focus(); return; }
        if (bloc && c.closest('[data-deplier]')) { this.depliees.add(`${this.ouverte}:${this.sections[bloc.dataset.section].titre}`); this.fiche(); return; }
        if (bloc && c.closest('[data-annuler]')) { this.edition = false; this.fiche(); return; }
        if (bloc && c.closest('[data-enregistrer]')) { await this.enregistrer(this.ouverte, { sections: [{ titre: this.sections[Number(bloc.dataset.section)].titre, texte: bloc.querySelector('textarea').value.trim() }] }); return; }

        const note = c.closest('[data-note]');
        if (note && c.closest('[data-note-suppr]')) { if (confirm('Supprimer cette note ?')) { await H.essayer(() => H.api('DELETE', `boite/${note.dataset.note}`)); await this.relire(); } return; }
        if (note && c.closest('[data-note-tache]')) { const t = await H.essayer(() => H.api('POST', `boite/${note.dataset.note}/tache`), 'Tâche créée'); if (t) { await this.relire(); this.ouvrir(t.id); } return; }
        if (note && c.closest('[data-note-modif]')) { const n = this.D.boite.find((x) => x.id === note.dataset.note); this.edition = true;
          note.querySelector('.texte').outerHTML = `<textarea rows="4">${esc(n.texte)}</textarea><div class="boutons" style="justify-content:flex-end;margin-bottom:0"><button class="btn petit" data-note-annuler>Annuler</button><button class="btn petit p" data-note-enreg>Enregistrer</button></div>`;
          c.closest('[data-note-modif]').remove(); return; }
        if (note && c.closest('[data-note-annuler]')) { this.edition = false; this.peindre(); return; }
        if (note && c.closest('[data-note-enreg]')) { await H.essayer(() => H.api('PUT', `boite/${note.dataset.note}`, { texte: note.querySelector('textarea').value })); this.edition = false; await this.relire(); return; }

        const sup = c.closest('[data-piece-suppr]');
        if (sup) { if (confirm('Retirer cette pièce jointe ?')) { await H.essayer(() => H.api('DELETE', `pieces/${sup.closest('.pieces').dataset.cible}/${sup.dataset.pieceSuppr}`)); await this.relire(); } return; }
        if (c.closest('select,input,textarea,button,label,.pieces a')) return;
        const el = c.closest('.tcarte,.lignes .ligne');
        if (el) this.ouvrir(el.dataset.id);
      };
      zone.onchange = async (ev) => {
        const el = ev.target;
        if (el.matches('[data-fichier]')) { const cible = el.closest('.pieces').dataset.cible, fichiers = [...el.files]; el.value = ''; await this.envoyer(cible, fichiers); return; }
        if (el.dataset.filtre) { this.e[el.dataset.filtre] = el.value; this.memoriser(); if (this.onglet === 'edition') this.filtres(); this.peindre(); return; }
        if (el.dataset.ed && !el.closest('#ed-nouvelle')) { const id = el.closest('.ed-ligne').dataset.id, valeur = el.value.trim();
          if (el.dataset.ed === 'titre' && !valeur) { el.value = this.tache(id)?.titre || ''; return; }
          await this.enregistrerEd(id, { [el.dataset.ed]: valeur }, el); return; }
        if (el.dataset.prio) { await this.enregistrer(el.dataset.prio, { champs: { priorite: el.value } }); return; }
        if (el.dataset.champ && this.ouverte) { let valeur = el.value.trim();
          if ('liste' in el.dataset) valeur = valeur.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean);
          if (el.dataset.champ === 'titre' && !valeur) { this.fiche(); return; }
          await this.enregistrer(this.ouverte, { champs: { [el.dataset.champ]: valeur } }); }
      };
      zone.oninput = (ev) => {
        if (ev.target.id === 't-recherche') { this.e.recherche = ev.target.value; this.peindre();
          if (this.onglet === 'edition') { const base = this.baseEd(); document.querySelectorAll('.seg-ech [data-ech] em').forEach((em) => { em.textContent = base.filter((t) => this.casEch(t, em.parentNode.dataset.ech)).length; }); } }
        if (ev.target.id === 't-titre') { ev.target.style.height = 'auto'; ev.target.style.height = `${ev.target.scrollHeight + 2}px`; }
      };
      zone.onkeydown = (ev) => {
        if (ev.key === 'Enter' && ev.target.id === 't-titre') { ev.preventDefault(); ev.target.blur(); }
        if (ev.key === 'Enter' && ev.target.matches('.ed-liste [data-ed="titre"]')) { ev.preventDefault(); ev.target.blur(); }
        if (ev.key === 'Escape' && ev.target.matches('.ed-liste [data-ed="titre"]')) { ev.target.value = this.tache(ev.target.closest('.ed-ligne').dataset.id)?.titre || ''; ev.target.blur(); }
        if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('.tcarte,.lignes .ligne')) { ev.preventDefault(); this.ouvrir(ev.target.dataset.id); }
      };
      zone.onsubmit = async (ev) => {
        const f = ev.target;
        if (f.id === 'ed-nouvelle') { ev.preventDefault(); const titre = f.titre.value.trim(); if (!titre) { f.titre.focus(); return; }
          const t = await H.essayer(() => H.api('POST', 'taches', { titre, statut: f.statut.value, priorite: f.priorite.value, projet: f.projet.value, debut: f.debut.value, echeance: f.echeance.value }), 'Tâche créée');
          if (!t) return; this.derniere = t.id; await this.relire();
          document.querySelector('#ed-nouvelle [name="titre"]')?.focus(); return; }
        if (f.id === 't-noter') { ev.preventDefault(); const texte = f.querySelector('textarea').value.trim(); if (!texte) return;
          await H.essayer(() => H.api('POST', 'boite', { texte, projet: this.e.projet === 'tous' ? '' : this.e.projet }), 'Noté'); await this.relire(); return; }
        if (f.classList.contains('lien-form')) { ev.preventDefault(); const url = f.querySelector('input').value.trim(); if (!url) return;
          await H.essayer(() => H.api('POST', `pieces/${f.closest('.pieces').dataset.cible}`, { url, nom: '' })); await this.relire(); return; }
        if (f.classList.contains('ajout-note')) { ev.preventDefault(); const texte = f.querySelector('textarea').value.trim(); if (!texte) return;
          await H.essayer(() => H.api('POST', `taches/${this.ouverte}/notes`, { texte })); await this.relire(); }
      };
      if (H.enLigne) return;
      // Glisser une carte dans une autre colonne change son statut ; déposer un fichier sur une zone de pièces l'ajoute.
      zone.ondragstart = (ev) => { const c = ev.target.closest?.('.tcarte'); if (c) { ev.dataTransfer.setData('text/plain', c.dataset.id); c.classList.add('glisse'); } };
      zone.ondragend = (ev) => ev.target.closest?.('.tcarte')?.classList.remove('glisse');
      zone.ondragover = (ev) => { const cible = ev.dataTransfer.types.includes('Files') ? ev.target.closest('.pieces') : ev.target.closest('.col[data-statut]'); if (!cible) return;
        ev.preventDefault(); zone.querySelectorAll('.cible,.survol').forEach((x) => x !== cible && x.classList.remove('cible', 'survol')); cible.classList.add(cible.matches('.pieces') ? 'survol' : 'cible'); };
      zone.ondragleave = (ev) => { if (!ev.relatedTarget?.closest?.('.col,.pieces')) zone.querySelectorAll('.cible,.survol').forEach((x) => x.classList.remove('cible', 'survol')); };
      zone.ondrop = async (ev) => {
        zone.querySelectorAll('.cible,.survol').forEach((x) => x.classList.remove('cible', 'survol'));
        const pieces = ev.target.closest('.pieces');
        if (pieces && ev.dataTransfer.files.length) { ev.preventDefault(); await this.envoyer(pieces.dataset.cible, [...ev.dataTransfer.files]); return; }
        const col = ev.target.closest('.col[data-statut]'); if (!col) return;
        ev.preventDefault(); const t = this.tache(Number(ev.dataTransfer.getData('text/plain')));
        if (t && t.statut !== col.dataset.statut) await this.enregistrer(t.id, { champs: { statut: col.dataset.statut } });
      };
    },
  };

  // Coller une image pendant qu'une tâche est ouverte l'ajoute à ses pièces jointes.
  document.addEventListener('paste', (ev) => {
    const fichiers = [...(ev.clipboardData?.files || [])];
    if (!fichiers.length || !V.ouverte || H.enLigne) return;
    ev.preventDefault(); V.envoyer(`t${V.ouverte}`, fichiers);
  });
})();
