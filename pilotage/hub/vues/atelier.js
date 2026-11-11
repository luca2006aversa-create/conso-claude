// Atelier : le code. Branches à la verticale (le plus récent en haut, chaque point détaillé sur sa ligne),
// comparaison de deux versions du site, tâches et page « Comprendre » (les pages d'origine, gardées telles quelles).
'use strict';

H.vues.atelier = {
  nom: 'Atelier',
  get onglets() { return [['', 'Branches'], ['versions', 'Versions'], ['taches', 'Tâches'], ...(H.enLigne ? [] : [['comprendre', 'Comprendre']])]; },
  plein: (onglet) => !H.enLigne && ['taches', 'comprendre'].includes(onglet),
  STATUTS: { fait: 'vert', a_valider: 'rose', en_cours: 'orange', a_faire: 'accent', idee: 'violet', en_pause: 'encre-3', abandon: 'encre-3' },

  rendre(onglet) {
    const tete = H.entete('Atelier', { onglets: this.onglets, actif: onglet, base: 'atelier' });
    if (onglet === 'taches') return tete + (H.enLigne ? this.taches() : '<iframe src="index.html" title="Tableau des tâches"></iframe>');
    if (onglet === 'comprendre' && !H.enLigne) return `${tete}<iframe src="projet.html" title="Comprendre le projet"></iframe>`;
    return tete + (onglet === 'versions' ? this.versions() : this.branches());
  },

  /* ================= Branches à la verticale ================= */
  branches() {
    const h = H.d.historique, e = (H.etat.atelier ??= { filtre: 'tout' }), enLigne = H.d.site.reglages.enLigne;
    if (h.erreur || !h.branches) return `<div class="carte c12">${G.vide(h.erreur || 'Historique indisponible', '!')}</div>`;
    const temps = (iso) => new Date(iso).getTime();

    // 1. Une ligne par point de l'histoire : fusion d'un chantier, chantier ouvert, version, gros commit direct.
    let rangs = [];
    for (const b of h.branches) rangs.push({ type: b.ouverte ? 'ouverte' : 'fusion', date: b.fin, b, h: b.h, versions: [] });
    for (const ev of h.evenements) if (ev.type === 'jalon') rangs.push({ type: 'jalon', date: ev.date, ev, h: ev.h, versions: [] });
    for (const ev of h.evenements.filter((x) => x.type === 'version')) {
      const r = rangs.find((x) => x.type !== 'ouverte' && (x.h === ev.h || (x.b && x.b.commits.some((c) => c.h === ev.h))));
      if (r) r.versions.push(ev); else rangs.push({ type: 'version', date: ev.date, h: ev.h, versions: [ev] });
    }
    if (e.filtre === 'versions') rangs = rangs.filter((r) => r.versions.some((v) => v.niveau !== 'sauvegarde'));
    if (e.filtre === 'chantiers') rangs = rangs.filter((r) => r.b);
    rangs.sort((a, b) => temps(b.date) - temps(a.date));

    // 2. Une voie (colonne) par chantier, du rang de sa fusion jusqu'au dernier rang plus récent que son départ.
    const palette = ['vert', 'accent', 'violet', 'turquoise', 'rose'], occupe = [];
    rangs.forEach((r, i) => {
      r.i = i; if (!r.b) return;
      const depart = temps(r.b.debut);
      let bas = i; while (bas + 1 < rangs.length && temps(rangs[bas + 1].date) >= depart) bas++;
      let k = 0; while (occupe[k] !== undefined && occupe[k] >= i) k++;
      occupe[k] = bas; r.voie = k; r.bas = bas; r.couleur = r.type === 'ouverte' ? 'orange' : palette[k % palette.length];
    });
    const pas = occupe.length > 7 ? 12 : 16, lg = 28 + Math.max(1, occupe.length) * pas, X = (k) => 12 + (k + 1) * pas;
    const chantiers = rangs.filter((r) => r.b);

    const poids = (plus, moins) => { const t = plus + moins; if (!t) return ''; const w = Math.min(130, 12 + Math.sqrt(t) * 1.3);
      return `<span title="${G.nb(plus)} lignes ajoutées, ${G.nb(moins)} retirées"><span class="poids" style="width:${w}px"><i style="width:${plus / t * 100}%;background:var(--vert)"></i><i style="width:${moins / t * 100}%;background:var(--rouge)"></i></span> +${G.court(plus)} −${G.court(moins)}</span>`; };
    const pastilles = (taches) => (taches || []).slice(0, 4).map((t) => `<span class="puce tache" title="${G.esc(t.titre)}"><i style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${G.V(this.STATUTS[t.statut] || 'encre-3')};margin-right:4px"></i>#${t.id} ${G.esc(t.titre.length > 46 ? `${t.titre.slice(0, 44)}…` : t.titre)}</span>`).join('') + ((taches || []).length > 4 ? `<span class="sous">+ ${taches.length - 4}</span>` : '');
    const badges = (versions) => versions.map((v) => (v.niveau === 'sauvegarde' ? `<span class="puce" title="${G.esc(v.message)}">⚑ ${G.esc(v.nom)}</span>`
      : `<span class="version-b" style="--c:${G.V(v.niveau === 'version' ? 'accent' : 'encre-2')}" title="${G.esc(v.message)}">${G.esc(v.nom.replace(/^v/, ''))}</span>${enLigne.version && v.nom === `v${enLigne.version}` ? '<span class="version-b" style="--c:var(--vert)">en ligne</span>' : ''}`)).join(' ');
    const premierMain = rangs.findIndex((r) => r.type !== 'ouverte');

    const lignes = rangs.map((r, i) => {
      // Voies qui traversent ce rang.
      let voies = `<i class="voie" style="left:10.5px;--c:var(--encre)${i === premierMain ? ';top:22px' : i < premierMain ? ';display:none' : ''}"></i>`, noeud = '';
      for (const c of chantiers) {
        if (i < c.i || i > c.bas) continue;
        const x = X(c.voie), coul = G.V(c.couleur), ouverte = c.type === 'ouverte';
        let haut = 0;
        if (i === c.i) {
          haut = ouverte ? 22 : 40;
          noeud += ouverte ? `<circle cx="${x}" cy="22" r="6" fill="${G.V('surface')}" stroke="${coul}" stroke-width="3"/>`
            : `<path d="M12 22C12 34 ${x} 26 ${x} 40" fill="none" stroke="${coul}" stroke-width="3"/>`;
        }
        voies += `<i class="voie${ouverte ? ' ouverte' : ''}" style="left:${x - 1.5}px;top:${haut}px;bottom:${i === c.bas ? 16 : 0}px;--c:${coul}"></i>`;
        if (i === c.bas) voies += `<svg width="${lg}" height="16" style="position:absolute;left:0;bottom:0;overflow:visible"><path d="M${x} 0C${x} 10 12 6 12 16" fill="none" stroke="${coul}" stroke-width="3"${ouverte ? ' stroke-dasharray="6 5"' : ''}/></svg>`;
      }
      if (r.type === 'fusion') noeud += `<circle cx="12" cy="22" r="7" fill="${G.V(r.couleur)}" stroke="${G.V('surface')}" stroke-width="2"/>`;
      if (r.type === 'version') noeud += `<circle cx="12" cy="22" r="7" fill="${G.V('surface')}" stroke="${G.V('encre')}" stroke-width="3"/>`;
      if (r.type === 'jalon') noeud += `<rect x="7" y="17" width="10" height="10" rx="2" fill="${G.V('encre-3')}" stroke="${G.V('surface')}" stroke-width="2"/>`;

      let corps = '';
      if (r.b) {
        const b = r.b, joursDe = Math.max(1, Math.round((temps(b.fin) - temps(b.debut)) / 864e5)), titre = b.titre || b.nom;
        const sujets = b.commits.filter((c) => c.sujet !== titre && !/^Version \d/.test(c.sujet)).slice(0, 4);
        corps = `<div class="tete"><time>${H.dateCourte(r.date)}</time>${badges(r.versions)}${i === premierMain ? '<span class="version-b" style="--c:var(--accent)">en travail</span>' : ''}
            <strong>${G.esc(titre)}</strong><span class="nomb">${G.esc(b.nom.replace(/^feature\//, ''))}${r.type === 'ouverte' ? ' · <b style="color:var(--orange)">ouvert</b>' : ''}</span></div>
          <div class="detail"><span>⑂ ${b.nb} commit${b.nb > 1 ? 's' : ''}</span><span>${joursDe} j</span>${poids(b.plus, b.moins)}${pastilles(b.taches)}</div>
          ${sujets.length ? `<ul>${sujets.map((c) => `<li title="${G.esc(c.sujet)}">${G.esc(c.sujet)}</li>`).join('')}${b.commits.length > sujets.length + 1 ? `<li class="sous">et ${b.nb - sujets.length} autres commits</li>` : ''}</ul>` : ''}`;
      } else if (r.type === 'jalon') {
        corps = `<div class="tete"><time>${H.dateCourte(r.date)}</time>${badges(r.versions)}<strong>${G.esc(r.ev.sujet)}</strong><span class="nomb">directement sur main</span></div>
          <div class="detail">${poids(r.ev.plus, r.ev.moins)}${pastilles(r.ev.taches)}</div>`;
      } else {
        const v = r.versions.find((x) => x.niveau !== 'sauvegarde') || r.versions[0];
        corps = `<div class="tete"><time>${H.dateCourte(r.date)}</time>${badges(r.versions)}${i === premierMain ? '<span class="version-b" style="--c:var(--accent)">en travail</span>' : ''}
          <strong>${G.esc((v.message || v.nom).replace(/^Version [\d.]+\s*:\s*/, ''))}</strong></div>`;
      }
      return `<div class="rang"><div class="voies">${voies}<svg class="noeud" width="${lg}" height="44">${noeud}</svg></div><div class="corps">${corps}</div></div>`;
    }).join('');

    // Rythme : fusions et versions par semaine sur 12 semaines.
    const lundis = Array.from({ length: 12 }, (_, i) => H.lundi(H.jour(Date.now() - (11 - i) * 7 * 864e5)));
    const parSemaine = (dates) => lundis.map((lu, i) => dates.filter((d) => H.jour(d) >= lu && (!lundis[i + 1] || H.jour(d) < lundis[i + 1])).length);
    const c = h.chiffres;
    return `<div class="grille">
  ${G.kpi('Chantiers fusionnés', String(c.fusionnees), 'revenus dans main', parSemaine(h.branches.filter((b) => !b.ouverte).map((b) => b.fin)), 'vert', 'c3')}
  ${G.kpi('Chantiers ouverts', String(c.ouvertes), 'pas encore dans main', null, 'orange', 'c3')}
  ${G.kpi('Versions', String(c.versions), `dernière : ${G.esc(H.d.site.versionMain || '')}`, parSemaine(h.evenements.filter((x) => x.type === 'version').map((x) => x.date)), 'accent', 'c3')}
  ${G.kpi('Commits', G.nb(c.commits), `depuis le ${H.dateCourte(c.premier)}`, null, 'violet', 'c3')}
  <div class="carte c12"><h2>L'histoire du site<em>le plus récent en haut · la ligne noire est main</em></h2>
    <div class="boutons" style="margin-top:0"><span class="seg">${[['tout', 'Tout'], ['chantiers', 'Chantiers'], ['versions', 'Versions']].map(([id, nom]) => `<button data-filtre-arbre="${id}" class="${e.filtre === id ? 'actif' : ''}">${nom}</button>`).join('')}</span>
      ${G.legende([['encre', 'main'], ['vert', 'chantier fusionné'], ['orange', 'chantier ouvert']])}</div>
    <div class="arbre" style="--lg:${lg}px">${lignes || G.vide('Rien à montrer avec ce filtre')}</div></div>
</div>`;
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

  /* ================= Tâches (version en ligne, en lecture) ================= */
  taches() {
    const t = H.d.taches, e = (H.etat.taches ??= { projet: 'sitescope' });
    const liste = t.liste.filter((x) => !e.projet || x.projet === e.projet), prio = { urgent: 0, important: 1, normal: 2, un_jour: 3 };
    const statuts = t.statuts.filter((s) => s.id !== 'abandon');
    return `<div class="grille"><div class="carte c12"><div class="boutons" style="margin-top:0"><span class="seg">${[{ id: '', nom: 'Tous' }, ...t.projets].map((p) => `<button data-projet="${p.id}" class="${e.projet === p.id ? 'actif' : ''}">${G.esc(p.nom)}</button>`).join('')}</span></div>
      <div class="kanban" style="--n:${statuts.length}">${statuts.map((s) => { const dans = liste.filter((x) => x.statut === s.id).sort((a, b) => (prio[a.priorite] ?? 2) - (prio[b.priorite] ?? 2) || b.id - a.id);
        return `<div class="col" style="--c:${G.V(this.STATUTS[s.id])}"><h3>${s.nom}<em>${dans.length}</em></h3>${dans.slice(0, s.id === 'fait' ? 15 : 60).map((x) => `<div class="fiche" data-tache="${x.id}" style="border-left:3px solid ${G.V({ urgent: 'rouge', important: 'orange' }[x.priorite] || 'trait')}"><span><strong>${G.esc(x.titre.length > 70 ? `${x.titre.slice(0, 68)}…` : x.titre)}</strong><span class="ligne">#${x.id}${x.qui === 'toi' ? ' · <b class="retard">à toi</b>' : ''}</span></span></div>`).join('')}</div>`; }).join('')}</div></div></div>`;
  },

  apres(onglet) {
    const vue = document.getElementById('vue');
    vue.querySelectorAll('[data-filtre-arbre]').forEach((b) => { b.onclick = () => { H.etat.atelier.filtre = b.dataset.filtreArbre; H.rendre(); }; });
    vue.querySelectorAll('[data-projet]').forEach((b) => { b.onclick = () => { H.etat.taches.projet = b.dataset.projet; H.rendre(); }; });
    vue.querySelectorAll('[data-tache]').forEach((f) => { f.onclick = () => { const t = H.d.taches.liste.find((x) => x.id === Number(f.dataset.tache));
      H.volet(`<h2 class="nom">#${t.id} ${G.esc(t.titre)}</h2><span class="puce">${G.esc(t.statut.replace('_', ' '))}</span> <span class="puce">${G.esc(t.priorite || '')}</span><section><h3>Pour toi</h3><div style="white-space:pre-wrap;font-size:13px">${G.esc(t.pourToi || '—')}</div></section>`); }; });
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
