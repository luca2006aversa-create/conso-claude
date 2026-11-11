// Atelier : le code. Branches (le graphe du pilotage d'origine : un seul tracé vertical, le plus récent en haut,
// dates à gauche, une ligne détaillée par point), comparaison de deux versions du site, et la page « Comprendre ».
'use strict';

H.vues.atelier = {
  nom: 'Atelier',
  get onglets() { return [['', 'Branches'], ['versions', 'Versions'], ...(H.enLigne ? [] : [['comprendre', 'Comprendre']])]; },
  plein: (onglet) => !H.enLigne && onglet === 'comprendre',
  STATUTS: { fait: 'vert', a_valider: 'rose', en_cours: 'orange', a_faire: 'accent', idee: 'violet', en_pause: 'encre-3', abandon: 'encre-3' },

  rendre(onglet) {
    const tete = H.entete('Atelier', { onglets: this.onglets, actif: onglet, base: 'atelier' });
    if (onglet === 'comprendre' && !H.enLigne) return `${tete}<iframe src="projet.html" data-incruste title="Comprendre le projet"></iframe>`;
    return tete + (onglet === 'versions' ? this.versions() : this.branches());
  },

  /* ================= Branches ================= */
  branches() {
    const h = H.d.historique, e = (H.etat.atelier ??= { filtre: 'tout', debuts: false }), enLigne = H.d.site.reglages.enLigne;
    if (h.erreur || !h.branches) return `<div class="carte c12">${G.vide(h.erreur || 'Historique indisponible', '!')}</div>`;
    const T = (iso) => new Date(iso).getTime(), COL = 22, X0 = 18, PAL = ['turquoise', 'vert', 'violet', 'rouge', 'orange', 'rose'];
    const duree = (a, b) => { const j = Math.round((T(b) - T(a)) / 864e5); return j <= 0 ? 'le jour même' : j === 1 ? '1 jour' : `${j} jours`; };

    // 1. Une ligne par point : fin (ou état) d'un chantier, début d'un chantier, version, gros commit direct.
    const branches = (e.filtre === 'versions' ? [] : h.branches).map((b, i) => ({ ...b, i }));
    const evenements = e.filtre === 'chantiers' ? [] : e.filtre === 'versions' ? h.evenements.filter((x) => x.type === 'version' && x.niveau !== 'sauvegarde') : h.evenements;
    const lignes = [];
    for (const b of branches) { lignes.push({ type: b.ouverte ? 'ouverte' : 'fusion', date: b.fin, b, h: 52 }); if (e.debuts) lignes.push({ type: 'debut', date: b.debut, b, h: 30 }); }
    for (const ev of evenements) lignes.push({ type: ev.type, date: ev.date, e: ev, h: ev.type === 'jalon' ? 52 : 34 });
    lignes.sort((a, b) => T(b.date) - T(a.date) || (a.type === 'debut') - (b.type === 'debut'));
    let hauteur = 0;
    for (const l of lignes) { l.haut = hauteur; l.y = hauteur + l.h / 2; hauteur += l.h; }
    hauteur += 10;
    const travail = lignes.find((l) => l.type !== 'ouverte' && l.type !== 'debut');

    // 2. Départ de chaque chantier, puis sa voie : la première libre sur toute sa hauteur.
    const yDate = (iso) => { const l = lignes.find((x) => T(x.date) <= T(iso)); return l ? Math.max(l.haut, 4) : hauteur - 6; };
    for (const b of branches) {
      b.yFin = lignes.find((l) => l.b === b && l.type !== 'debut').y;
      const ld = lignes.find((l) => l.b === b && l.type === 'debut');
      b.yDebut = Math.max(ld ? ld.y : yDate(b.debut), b.yFin + 24);
    }
    const finVoie = [];
    [...branches].sort((a, z) => a.yFin - z.yFin).forEach((b, k) => {
      let v = finVoie.findIndex((y) => y < b.yFin - 6);
      if (v < 0) { v = finVoie.length; finVoie.push(0); }
      finVoie[v] = b.yDebut; b.voie = v + 1; b.couleur = G.V(PAL[k % PAL.length]);
    });
    const largeur = X0 + (finVoie.length + 1) * COL;

    // 3. Le tracé.
    const traits = [`<line x1="${X0}" y1="${travail ? travail.y : 0}" x2="${X0}" y2="${hauteur}" stroke="${G.V('encre')}" stroke-width="3" stroke-linecap="round"/>`], points = [];
    for (const b of branches) {
      const x = X0 + b.voie * COL, r = 12, court = b.yDebut - b.yFin < r * 3.4;
      const d = court ? (b.ouverte ? `M${X0},${b.yDebut} C${x},${b.yDebut} ${x},${b.yDebut} ${x},${b.yFin}` : `M${X0},${b.yDebut} C${x},${b.yDebut} ${x},${b.yFin} ${X0},${b.yFin}`)
        : b.ouverte ? `M${X0},${b.yDebut} C${X0},${b.yDebut - r} ${x},${b.yDebut - r} ${x},${b.yDebut - r * 1.6} L${x},${b.yFin}`
          : `M${X0},${b.yDebut} C${X0},${b.yDebut - r} ${x},${b.yDebut - r} ${x},${b.yDebut - r * 1.6} L${x},${b.yFin + r * 1.6} C${x},${b.yFin + r} ${X0},${b.yFin + r} ${X0},${b.yFin}`;
      traits.push(`<path d="${d}" fill="none" stroke="${b.couleur}" stroke-width="2.4"${b.ouverte ? ' stroke-dasharray="5 4"' : ''}/>`);
      points.push(`<circle cx="${X0}" cy="${b.yDebut}" r="3" fill="${b.couleur}"/>`);
      points.push(b.ouverte ? `<circle cx="${x}" cy="${b.yFin}" r="5.5" fill="${G.V('surface')}" stroke="${b.couleur}" stroke-width="2.5"/>`
        : `<circle cx="${X0}" cy="${b.yFin}" r="6.5" fill="${b.rapide ? G.V('surface') : b.couleur}" stroke="${b.couleur}" stroke-width="3"/>`);
    }
    for (const l of lignes) {
      if (l.type === 'jalon') points.push(`<rect x="${X0 - 5}" y="${l.y - 5}" width="10" height="10" transform="rotate(45 ${X0} ${l.y})" fill="${G.V('encre')}"/>`);
      if (l.type === 'version') { const r = l.e.niveau === 'retouche' ? 4 : l.e.niveau === 'version' ? 8 : 6;
        points.push(`<rect x="${X0 - r}" y="${l.y - r}" width="${2 * r}" height="${2 * r}" rx="3" fill="${G.V(l.e.niveau === 'sauvegarde' ? 'orange' : 'vert')}" stroke="${G.V('surface')}" stroke-width="2"/>`); }
    }

    // 4. Les dates (une marque au premier point de chaque jour) et les libellés.
    let jourPrec = '';
    const dates = lignes.map((l) => { const j = H.jour(l.date); if (j === jourPrec) return ''; jourPrec = j;
      return `<div class="hi-date" style="top:${l.haut}px"><b>${H.dateCourte(j)}</b>${['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'][new Date(l.date).getDay()]}</div>`; }).join('');
    const poids = (plus, moins) => { const t = plus + moins; if (!t) return ''; const w = Math.min(110, 12 + Math.sqrt(t) * 1.2);
      return `<span title="${G.nb(plus)} lignes ajoutées, ${G.nb(moins)} retirées"><span class="poids" style="width:${w}px"><i style="width:${plus / t * 100}%;background:var(--vert)"></i><i style="width:${moins / t * 100}%;background:var(--rouge)"></i></span>+${G.court(plus)} −${G.court(moins)}</span>`; };
    const puces = (taches) => (taches || []).slice(0, 3).map((t) => `<span class="hi-puce" data-ouvrir="${t.id}" title="${G.esc(t.titre)}"><i style="background:${G.V(this.STATUTS[t.statut] || 'encre-3')}"></i>#${t.id} ${G.esc(t.titre.length > 34 ? `${t.titre.slice(0, 32)}…` : t.titre)}</span>`).join('') + ((taches || []).length > 3 ? `<span class="hi-puce">+${taches.length - 3}</span>` : '');
    const ici = (l) => (l === travail ? '<span class="hi-version travail">en travail</span>' : '');
    const libelles = lignes.map((l) => {
      const st = `top:${l.haut}px;height:${l.h}px`;
      if (l.type === 'debut') return `<div class="hi-ligne" style="${st}"><span class="hi-debut">↳ début de <b style="color:${l.b.couleur}">${G.esc(l.b.nom.replace(/^feature\//, ''))}</b></span></div>`;
      if (l.type === 'version') {
        const v = l.e, texte = v.niveau === 'sauvegarde' ? 'sauvegarde : on peut revenir à cet état' : (v.message || '').replace(/^Version [\d.]+ ?:? ?/, '') || (v.niveau === 'version' ? 'nouvelle version' : 'retouche');
        return `<div class="hi-ligne hi-v" style="${st}"><div class="hi-l1"><span class="hi-version ${v.niveau}">${G.esc(v.niveau === 'sauvegarde' ? v.nom : v.nom.replace(/^v/, ''))}</span>${ici(l)}${enLigne.version && v.nom === `v${enLigne.version}` ? '<span class="hi-version ligne">en ligne</span>' : ''}<span class="hi-titre" title="${G.esc(texte)}">${G.esc(texte)}</span></div></div>`;
      }
      if (l.type === 'jalon') return `<div class="hi-ligne hi-jalon" style="${st}"><div class="hi-l1">${ici(l)}<span class="hi-titre" title="${G.esc(l.e.sujet)}">${G.esc(l.e.sujet)}</span></div>
        <div class="hi-l2"><span>directement sur main</span>${poids(l.e.plus, l.e.moins)}${puces(l.e.taches)}</div></div>`;
      const b = l.b;
      return `<div class="hi-ligne cliquable" style="${st}" data-b="${b.i}"><div class="hi-l1"><span class="hi-nom" style="color:${b.couleur}">${G.esc(b.nom.replace(/^feature\//, ''))}</span>${b.ouverte ? '<span class="hi-ouverte">ouvert</span>' : ici(l)}
          <span class="hi-titre" title="${G.esc(b.titre || '')}">${b.titre && !b.titre.startsWith(b.nom) ? G.esc(b.titre) : ''}</span></div>
        <div class="hi-l2"><span>${b.nb} commit${b.nb > 1 ? 's' : ''} · ${duree(b.debut, b.fin)}</span>${poids(b.plus, b.moins)}${puces(b.taches)}</div></div>`;
    }).join('');

    // Rythme : fusions et versions par semaine sur 12 semaines.
    const lundis = Array.from({ length: 12 }, (_, i) => H.lundi(H.jour(Date.now() - (11 - i) * 7 * 864e5)));
    const parSemaine = (ds) => lundis.map((lu, i) => ds.filter((d) => H.jour(d) >= lu && (!lundis[i + 1] || H.jour(d) < lundis[i + 1])).length);
    const c = h.chiffres;
    return `<div class="grille">
  ${G.kpi('Chantiers fusionnés', String(c.fusionnees), 'revenus dans main', parSemaine(h.branches.filter((b) => !b.ouverte).map((b) => b.fin)), 'vert', 'c3')}
  ${G.kpi('Chantiers ouverts', String(c.ouvertes), 'pas encore dans main', null, 'orange', 'c3')}
  ${G.kpi('Versions', String(c.versions), `dernière : ${G.esc(H.d.site.versionMain || '')}`, parSemaine(h.evenements.filter((x) => x.type === 'version').map((x) => x.date)), 'accent', 'c3')}
  ${G.kpi('Commits', G.nb(c.commits), `depuis le ${H.dateCourte(c.premier)} · ${duree(c.premier, c.dernier)}`, null, 'violet', 'c3')}
  <div class="carte c12"><h2>L'histoire du site<em>le plus récent en haut · clique un chantier pour son détail</em></h2>
    <div class="boutons" style="margin-top:0;gap:14px"><span class="seg">${[['tout', 'Tout'], ['chantiers', 'Chantiers'], ['versions', 'Versions']].map(([id, nom]) => `<button data-filtre-arbre="${id}" class="${e.filtre === id ? 'actif' : ''}">${nom}</button>`).join('')}</span>
      <label class="sous" style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" id="voir-debuts"${e.debuts ? ' checked' : ''}> débuts de branche</label>
      <div class="hi-leg" style="margin-left:auto"><span><i style="width:3px;height:14px;border-radius:2px;background:var(--encre)"></i>main</span><span><i style="background:var(--turquoise)"></i>chantier fusionné</span>
        <span><i style="border:2.5px solid var(--violet)"></i>ouvert</span><span><i style="border-radius:3px;background:var(--vert)"></i>version</span><span><i style="border-radius:3px;background:var(--orange)"></i>sauvegarde</span>
        <span><i style="border-radius:1px;transform:rotate(45deg) scale(.8);background:var(--encre)"></i>commit direct</span></div></div>
    ${lignes.length ? `<div class="hi-graphe"><div class="hi-grille" style="--l-svg:${largeur}px;height:${hauteur}px"><div class="hi-dates">${dates}</div>
      <svg width="${largeur}" height="${hauteur}" viewBox="0 0 ${largeur} ${hauteur}" aria-hidden="true" style="max-width:none">${traits.join('')}${points.join('')}</svg><div class="hi-libelles">${libelles}</div></div></div>` : G.vide('Rien à montrer avec ce filtre')}</div>
</div>`;
  },

  // Volet d'un chantier : ses chiffres, ses tâches, ses commits.
  detail(i) {
    const b = H.d.historique.branches[i], T = (iso) => new Date(iso).getTime(), j = Math.max(0, Math.round((T(b.fin) - T(b.debut)) / 864e5));
    H.volet(`<div id="b-detail"><h2 class="nom">${G.esc(b.nom.replace(/^feature\//, ''))}</h2><div class="sous">${G.esc(b.titre || '')}</div>
      <div class="resultats" style="grid-template-columns:1fr 1fr;margin-top:12px"><div><span class="sous">État</span><b style="font-size:15px">${b.ouverte ? 'ouvert' : b.rapide ? 'fusionné (avance directe)' : 'fusionné'}</b></div>
        <div><span class="sous">Durée</span><b style="font-size:15px">${j ? `${j} j` : 'le jour même'}</b><span class="sous">${H.dateCourte(b.debut)} → ${H.dateCourte(b.fin)}</span></div>
        <div><span class="sous">Commits</span><b>${b.nb}</b></div><div><span class="sous">Lignes</span><b><span class="plus">+${G.court(b.plus)}</span> <span class="moins">−${G.court(b.moins)}</span></b></div></div>
      <section><h3>Tâches</h3>${b.taches.length ? b.taches.map((t) => `<div style="margin-bottom:5px"><span class="lien-t" data-ouvrir="${t.id}">#${t.id}</span> ${G.esc(t.titre)} <span class="statut-t" style="--c:${G.V(this.STATUTS[t.statut] || 'encre-3')}">${G.esc(String(t.statut).replace('_', ' '))}</span></div>`).join('') : '<div class="sous">Aucune tâche reliée.</div>'}</section>
      <section><h3>Commits${b.commits.length >= 40 ? '<small>les 40 derniers</small>' : ''}</h3><div class="fil">${b.commits.map((c) => `<div><time>${H.dateCourte(c.date)} · ${G.esc(c.h)}</time>${G.esc(c.sujet)}</div>`).join('')}</div></section></div>`);
    document.getElementById('b-detail').onclick = (ev) => { const l = ev.target.closest('[data-ouvrir]'); if (l) H.vues.taches.ouvrir(l.dataset.ouvrir); };
  },

  /* ================= Comparer deux versions ================= */
  versions() {
    const s = H.d.site, e = (H.etat.versions ??= { a: '', b: '', mode: 'rideau' });
    const court = (nom) => (nom === 'sitescope-api' ? 'principal' : nom.replace(/^sitescope-?/, '') || 'principal');
    // Ce qu'on peut mettre de chaque côté : le site en ligne (quand il existe) et chaque instance qui tourne.
    const points = [...(s.reglages.enLigne.url ? [{ id: 'en-ligne', nom: 'Site en ligne', branche: null, version: s.reglages.enLigne.version, url: s.reglages.enLigne.url }] : []),
      ...s.instances.map((i) => ({ id: i.nom, nom: i.nom === 'sitescope-api' ? 'main (principal)' : court(i.nom), branche: i.branche, version: i.version, url: `http://localhost:${i.port}/`, chantier: s.chantiers.find((c) => c.nom === i.chantier) }))];
    if (!points.some((p) => p.id === e.a)) e.a = (points.find((p) => p.id === 'en-ligne') || points.find((p) => p.id === 'sitescope-api') || points[0] || {}).id || '';
    if (!points.some((p) => p.id === e.b) || e.b === e.a) {
      const autres = points.filter((p) => p.id !== e.a).sort((x, y) => String(y.chantier?.dernier?.date || '').localeCompare(String(x.chantier?.dernier?.date || '')));
      e.b = (autres[0] || {}).id || '';
    }
    const A = points.find((p) => p.id === e.a), B = points.find((p) => p.id === e.b);
    const photo = (p) => H.d.photos.find((x) => x.nom === p.id.replace(/[^\w-]/g, '_'));
    const cote = (p, lettre, coul) => (!p ? G.vide('Rien à comparer') : `<div class="cote" style="border-top:4px solid ${G.V(coul)}">
      <select class="champ" data-cote="${lettre}" style="width:100%">${points.map((x) => `<option value="${G.esc(x.id)}"${x.id === p.id ? ' selected' : ''}>${G.esc(x.nom)}${x.version ? ` · ${G.esc(x.version)}` : ''}</option>`).join('')}</select>
      <div class="chiffre" style="margin-top:8px">${G.esc(p.version || '—')}</div><div class="sous">${G.esc(p.branche || (p.id === 'en-ligne' ? 'ce que voient les utilisateurs' : 'sans branche'))}</div>
      ${p.chantier?.dernier ? `<div class="sous" style="margin-top:4px">dernier changement : ${H.dateCourte(p.chantier.dernier.date)} — ${G.esc(p.chantier.dernier.sujet.slice(0, 90))}</div>` : ''}
      <div class="boutons"><a class="btn" href="${G.esc(p.url)}" target="_blank" rel="noopener">Ouvrir</a>${photo(p) ? `<span class="sous">photo ${H.ilya(photo(p).date)}</span>` : ''}</div></div>`);
    const max = Math.max(1, ...s.chantiers.map((c) => Math.max(c.avance, c.retard)));
    const chantiers = [...s.chantiers].filter((c) => c.nom !== 'sitescope').sort((x, y) => String(y.dernier?.date || '').localeCompare(String(x.dernier?.date || '')));

    return `<div class="grille">
  ${H.enLigne ? '' : `<div class="carte c12"><h2>Deux versions face à face<em>choisis ce que tu compares</em></h2>
    <div class="duo">${cote(A, 'a', 'vert')}${cote(B, 'b', 'orange')}</div></div>

  <div class="carte c12"><h2>À l'écran<em>photos de la page d'accueil de chaque version</em></h2>
    <div class="boutons" style="margin-top:0"><span class="seg">${[['rideau', 'Rideau'], ['cote', 'Côte à côte'], ['bascule', 'Bascule']].map(([id, nom]) => `<button data-mode="${id}" class="${e.mode === id ? 'actif' : ''}">${nom}</button>`).join('')}</span>
      <button class="btn p" id="photographier">Photographier les deux</button><span class="sous" id="photo-etat"></span></div>
    <div id="ecrans">${A && B && photo(A) && photo(B) ? this.ecrans(A, B, e.mode) : G.vide('Clique « Photographier les deux » : le hub ouvre chaque version sans fenêtre et garde une image.', '◫')}</div></div>

  <div class="carte c12"><h2>Ce qui change entre les deux<em id="diff-titre"></em></h2><div id="diff">${A?.branche && B?.branche ? '<div class="sous">Calcul…</div>' : G.vide('Choisis deux versions qui ont une branche')}</div></div>`}

  <div class="carte c12"><h2>Tous les chantiers<em>par rapport à main (${G.esc(s.versionMain || '')})</em></h2>
    <div class="barres-h">${chantiers.map((c) => `<div title="${G.esc(c.dernier?.sujet || '')}" style="grid-template-columns:minmax(90px,22%) 1fr 1fr auto"><span>${G.esc(court(c.nom))}</span>
      <span style="display:flex;justify-content:flex-end"><i style="width:${c.retard / max * 100}%;--c:var(--encre-3)" title="${c.retard} commits de main qu'il n'a pas"></i></span>
      <i style="width:${Math.max(c.avance ? 2 : 0, c.avance / max * 100)}%;--c:var(--vert)" title="${c.avance} commits pas encore dans main"></i>
      <b class="sous" style="font-weight:400">${c.avance ? `<b class="plus">+${c.avance}</b> ` : ''}−${c.retard} · ${G.esc(c.version || '?')}${c.dernier ? ` · ${H.dateCourte(c.dernier.date)}` : ''}</b></div>`).join('')}</div>
    ${G.legende([['encre-3', 'retard : ce que main a de plus'], ['vert', 'avance : pas encore dans main']])}</div>
</div>`;
  },

  ecrans(A, B, mode) {
    const src = (p) => `/api/hub/photos/${encodeURIComponent(p.id.replace(/[^\w-]/g, '_'))}.png?t=${Date.now()}`;
    if (mode === 'cote') return `<div class="duo"><div><div class="sous">${G.esc(A.nom)}</div><img src="${src(A)}" alt="" style="width:100%;border:1px solid var(--trait);border-radius:8px"></div><div><div class="sous">${G.esc(B.nom)}</div><img src="${src(B)}" alt="" style="width:100%;border:1px solid var(--trait);border-radius:8px"></div></div>`;
    if (mode === 'bascule') return `<div class="comparer" id="bascule" style="cursor:pointer" title="Clique pour passer de l'une à l'autre"><img src="${src(A)}" alt="" data-autre="${src(B)}"><span class="etiq" style="left:8px" data-noms="${G.esc(A.nom)}|${G.esc(B.nom)}">${G.esc(A.nom)}</span></div>`;
    return `<div class="comparer" id="rideau"><img src="${src(B)}" alt=""><div class="dessus"><img src="${src(A)}" alt=""></div><div class="poignee"></div>
      <span class="etiq" style="left:8px">${G.esc(A.nom)}</span><span class="etiq" style="right:8px">${G.esc(B.nom)}</span></div>`;
  },

  apres(onglet) {
    const vue = document.getElementById('vue');
    vue.querySelectorAll('[data-filtre-arbre]').forEach((b) => { b.onclick = () => { H.etat.atelier.filtre = b.dataset.filtreArbre; H.rendre(); }; });
    const debuts = document.getElementById('voir-debuts');
    if (debuts) debuts.onchange = () => { H.etat.atelier.debuts = debuts.checked; H.rendre(); };
    const graphe = vue.querySelector('.hi-graphe');
    if (graphe) graphe.onclick = (ev) => {
      const tache = ev.target.closest('[data-ouvrir]');
      if (tache) { H.vues.taches.ouvrir(tache.dataset.ouvrir); return; }
      const ligne = ev.target.closest('[data-b]');
      if (ligne) { graphe.querySelectorAll('.choisie').forEach((x) => x.classList.remove('choisie')); ligne.classList.add('choisie'); this.detail(Number(ligne.dataset.b)); }
    };
    if (onglet !== 'versions' || H.enLigne) return;

    const e = H.etat.versions, s = H.d.site;
    vue.querySelectorAll('[data-cote]').forEach((sel) => { sel.onchange = () => { e[sel.dataset.cote] = sel.value; H.rendre(); }; });
    vue.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => { e.mode = b.dataset.mode; H.rendre(); }; });
    const photographier = document.getElementById('photographier');
    if (photographier) photographier.onclick = async () => {
      photographier.disabled = true; const etat = document.getElementById('photo-etat');
      for (const id of [e.a, e.b]) { etat.textContent = `photo de ${id.replace(/^sitescope-?/, '') || 'principal'}… (jusqu'à 20 s)`; await H.essayer(() => H.api('POST', `hub/photos/${encodeURIComponent(id)}`)); }
      await H.recharger();
    };
    // Rideau : la poignée découvre la version de gauche.
    const rideau = document.getElementById('rideau');
    if (rideau) {
      const placer = (ev) => { const b = rideau.getBoundingClientRect(), p = Math.max(2, Math.min(98, (ev.clientX - b.left) / b.width * 100)); rideau.querySelector('.dessus').style.width = `${p}%`; rideau.querySelector('.poignee').style.left = `${p}%`; };
      rideau.onpointerdown = (ev) => { rideau.setPointerCapture(ev.pointerId); placer(ev); rideau.onpointermove = placer; };
      rideau.onpointerup = () => { rideau.onpointermove = null; };
    }
    const bascule = document.getElementById('bascule');
    if (bascule) bascule.onclick = () => { const img = bascule.querySelector('img'), et = bascule.querySelector('.etiq'), noms = et.dataset.noms.split('|'), autre = img.dataset.autre;
      img.dataset.autre = img.src; img.src = autre; et.textContent = et.textContent === noms[0] ? noms[1] : noms[0]; };

    // Différences entre les deux branches choisies.
    const brancheDe = (id) => s.instances.find((i) => i.nom === id)?.branche;
    const a = brancheDe(e.a), b = brancheDe(e.b), boite = document.getElementById('diff');
    const connue = (x) => x && (x === 'main' || s.chantiers.some((c) => c.branche === x) || s.etiquettes.some((t) => t.nom === x));
    if (boite && connue(a) && connue(b) && a !== b) {
      H.api('GET', `hub/diff?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`).then((d) => {
        document.getElementById('diff-titre').textContent = `de ${a} vers ${b}`;
        if (!d.fichiers) { boite.innerHTML = G.vide(`${b} n'apporte rien de plus que ${a}`, '='); return; }
        boite.innerHTML = `<div class="grille" style="gap:14px"><div style="grid-column:span 4"><div class="resultats" style="grid-template-columns:1fr 1fr"><div><span class="sous">Commits</span><b>${d.commits.length}${d.commits.length >= 60 ? '+' : ''}</b></div><div><span class="sous">Fichiers</span><b>${d.fichiers}</b></div>
            <div><span class="sous">Lignes ajoutées</span><b class="plus">+${G.court(d.plus)}</b></div><div><span class="sous">Lignes retirées</span><b class="moins">−${G.court(d.moins)}</b></div></div>
            <ul style="margin:8px 0 0;padding-left:16px;font-size:12px;color:var(--encre-2)">${d.commits.slice(0, 8).map((c) => `<li>${G.esc(c.sujet.slice(0, 110))}</li>`).join('')}</ul></div>
          <div style="grid-column:span 8"><div class="sous" style="margin-bottom:6px">Où ça change (lignes touchées par dossier)</div>${G.barresH(d.zones.map((z) => ({ nom: z.zone, v: z.plus + z.moins, c: z.zone.startsWith('backend') ? 'violet' : z.zone.startsWith('frontend') ? 'accent' : z.zone.startsWith('tests') ? 'turquoise' : 'encre-3', txt: `+${G.court(z.plus)} −${G.court(z.moins)}` })))}
            ${G.legende([['accent', 'interface'], ['violet', 'serveur'], ['turquoise', 'tests'], ['encre-3', 'autre']])}</div></div>`;
      }).catch((err) => { boite.innerHTML = G.vide(err.message, '!'); });
    } else if (boite && a === b && a) boite.innerHTML = G.vide('Les deux côtés sont sur la même branche', '=');
  },
};
