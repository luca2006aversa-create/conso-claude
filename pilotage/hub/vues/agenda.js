// Agenda : semaine (heures), mois, et frise (les dates qui arrivent + les tâches dans le temps, façon ligne temporelle
// d'Atlas). Les rendez-vous sont dans donnees/hub/agenda.json ; les échéances des tâches, les dates d'Kibsu et
// les relances (Atlas, agences) sont lues à leur place et posées sur le calendrier.
'use strict';

(() => {
  const esc = G.esc, H_PX = 44;
  const plus = (jour, n) => H.jour(new Date(`${jour}T12:00:00`).getTime() + n * 864e5);
  const ecart = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 864e5);
  const min = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
  const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const JOURS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  const STATUT = { fait: 'vert', a_valider: 'rose', en_cours: 'orange', a_faire: 'accent', idee: 'violet', en_pause: 'encre-3', abandon: 'encre-3' };
  const etroit = () => matchMedia('(max-width: 700px)').matches;

  const V = H.vues.agenda = {
    nom: 'Agenda',
    vivant: true,
    pastille() {
      if (!H.d || !H.d.agenda) return 0;
      const auj = H.jour();
      return this.evenements(auj, auj).length + H.d.taches.liste.filter((t) => t.echeance && t.echeance < auj && !['fait', 'abandon'].includes(t.statut)).length;
    },
    e() { return (H.etat.agenda ??= { debut: H.lundi(H.jour()), mois: H.mois() }); },
    cat(id) { return (H.d.agenda.categories.find((c) => c.id === id) || { couleur: 'encre-3', nom: '' }); },

    /* ---------- Ce qui tombe entre deux jours ---------- */
    // Les rendez-vous, répétitions comprises : [{ ...événement, jour }].
    evenements(a, b) {
      const r = [];
      for (const e of H.d.agenda.evenements) {
        if (!e.repete) { if (e.date >= a && e.date <= b) r.push({ ...e, jour: e.date }); continue; }
        let j = e.date > a ? e.date : a;
        j = plus(j, (new Date(`${e.date}T12:00:00`).getDay() - new Date(`${j}T12:00:00`).getDay() + 7) % 7);
        for (; j <= b && (!e.jusqua || j <= e.jusqua); j = plus(j, 7)) if (!(e.exceptions || []).includes(j)) r.push({ ...e, jour: j });
      }
      return r.sort((x, y) => x.jour.localeCompare(y.jour) || (x.debut || '').localeCompare(y.debut || ''));
    },
    // Les repères d'une journée entière : échéances des tâches, dates d'Atlas, relances.
    reperes(a, b) {
      const d = H.d, auj = H.jour(), r = [];
      for (const t of d.taches.liste) {
        const ouverte = !['fait', 'abandon'].includes(t.statut);
        if (t.echeance && t.echeance >= a && t.echeance <= b && t.statut !== 'abandon') r.push({ jour: t.echeance, type: 'tache', id: t.id, titre: `#${t.id} ${t.titre}`, c: !ouverte ? 'vert' : t.echeance < auj ? 'rouge' : 'vif', icone: !ouverte ? '✓' : '⏱' });
        if (t.debut && t.debut >= a && t.debut <= b && ouverte) r.push({ jour: t.debut, type: 'tache', id: t.id, titre: `début #${t.id} ${t.titre}`, c: 'encre-3', icone: '▸' });
      }
      for (const e of (d.atlas || {}).echeances || []) if (e.date >= a && e.date <= b) r.push({ jour: e.date, type: 'atlas', titre: e.titre, c: 'rose', icone: '★' });
      for (const c of (d.atlas || {}).contacts || []) if (c.relance && c.etape !== 'ecarte' && c.relance >= a && c.relance <= b) r.push({ jour: c.relance, type: 'atlas-contact', id: c.id, titre: `relancer ${c.nom}`, c: 'rose', icone: '↻' });
      for (const c of d.clients.liste) if (c.relance && !['client', 'ecarte'].includes(c.etape) && c.relance >= a && c.relance <= b) r.push({ jour: c.relance, type: 'client', id: c.id, titre: `relancer ${c.nom}`, c: 'orange', icone: '↻' });
      return r;
    },
    pilule(x) {
      return `<button class="ag-pil" style="--c:${G.V(x.c)}" data-repere="${esc(x.type)}" data-rid="${esc(x.id ?? '')}" title="${esc(x.titre)}">${x.icone} ${esc(x.titre)}</button>`;
    },

    rendre(onglet) {
      const tete = H.entete('Agenda', { droite: H.enLigne ? '' : '<button class="btn p petit" id="ag-nouveau">+ Rendez-vous</button>' });
      if (!H.d.agenda) return `${tete}<div class="carte c12">${G.vide('Pas encore d\'agenda dans cette copie', '!')}</div>`;
      // Tout sur la même page : la semaine, ce qui arrive, le mois, puis les tâches dans le temps.
      return tete + this.semaine() + this.frise('ligne') + this.mois() + this.frise('taches');
    },

    /* ================= Semaine ================= */
    semaine() {
      const e = this.e(), n = etroit() ? 3 : 7, auj = H.jour();
      if (n === 3 && !e.depuis3) e.depuis3 = auj;
      const debut = n === 3 ? e.depuis3 : e.debut, fin = plus(debut, n - 1);
      const jours = Array.from({ length: n }, (_, i) => plus(debut, i));
      const evs = this.evenements(debut, fin), reps = this.reperes(debut, fin);
      const heures = evs.filter((x) => x.debut);
      const hMin = Math.min(8, ...heures.map((x) => Math.floor(min(x.debut) / 60))), hMax = Math.max(21, ...heures.map((x) => Math.ceil(min(x.fin) / 60)));
      const haut = (hMax - hMin) * H_PX;
      const titre = `${H.dateCourte(debut)} – ${H.dateCourte(fin)} ${fin.slice(0, 4)}`;

      const colonne = (j) => {
        const dans = heures.filter((x) => x.jour === j).map((x) => ({ ...x, a: min(x.debut), b: Math.max(min(x.fin), min(x.debut) + 20) }));
        // Rendez-vous qui se chevauchent : côte à côte.
        let groupe = [], finGroupe = -1;
        const fermer = () => { const nb = Math.max(1, ...groupe.map((x) => x.col + 1)); groupe.forEach((x) => { x.nb = nb; }); groupe = []; };
        for (const x of dans) {
          if (x.a >= finGroupe) { fermer(); finGroupe = -1; }
          const pris = groupe.filter((y) => y.b > x.a).map((y) => y.col);
          x.col = 0; while (pris.includes(x.col)) x.col++;
          groupe.push(x); finGroupe = Math.max(finGroupe, x.b);
        }
        fermer();
        const maintenant = j === auj ? (new Date().getHours() * 60 + new Date().getMinutes() - hMin * 60) / 60 * H_PX : -1;
        return `<div class="ag-col${j === auj ? ' auj' : ''}" data-jour="${j}" style="height:${haut}px;background-size:100% ${H_PX}px">
          ${dans.map((x) => { const c = this.cat(x.categorie);
            return `<div class="ag-ev" data-ev="${esc(x.id)}" data-jour="${j}" style="--c:${G.V(c.couleur)};top:${(x.a - hMin * 60) / 60 * H_PX}px;height:${Math.max(18, (x.b - x.a) / 60 * H_PX - 2)}px;left:calc(${x.col} * 100% / ${x.nb});width:calc(100% / ${x.nb} - 3px)" title="${esc(`${x.debut}-${x.fin} ${x.titre}${x.lieu ? ` · ${x.lieu}` : ''}`)}">
              <b>${esc(x.titre)}</b><span>${x.debut}–${x.fin}${x.lieu ? ` · ${esc(x.lieu)}` : ''}${x.repete ? ' · ↻' : ''}${x.tache ? ` · #${x.tache}` : ''}</span></div>`; }).join('')}
          ${maintenant >= 0 && maintenant <= haut ? `<i class="ag-maintenant" style="top:${maintenant}px"></i>` : ''}</div>`;
      };

      const prochain = this.evenements(auj, plus(auj, 1)).find((x) => x.jour > auj || !x.debut || min(x.fin) > new Date().getHours() * 60 + new Date().getMinutes());
      const ouvertes = H.d.taches.liste.filter((t) => !['fait', 'abandon'].includes(t.statut));
      const retard = ouvertes.filter((t) => t.echeance && t.echeance < auj), semaine = ouvertes.filter((t) => t.echeance && t.echeance >= auj && t.echeance <= plus(auj, 6));
      return `<div class="grille">
  <div class="carte kpi c4"><h2>Prochain</h2>${prochain ? `<div class="chiffre" style="font-size:24px">${prochain.debut ? prochain.debut : 'journée'}<small>${prochain.jour === auj ? "aujourd'hui" : 'demain'}</small></div>
    <div class="sous"><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${G.V(this.cat(prochain.categorie).couleur)};margin-right:6px"></i>${esc(prochain.titre)}${prochain.lieu ? ` · ${esc(prochain.lieu)}` : ''}</div>` : G.vide("Rien aujourd'hui ni demain")}</div>
  <div class="carte kpi c4 lien" data-defiler="ag-taches"><h2>Échéances cette semaine</h2><div class="chiffre">${semaine.length}<small>tâche${semaine.length > 1 ? 's' : ''}</small></div><div class="sous">${semaine.slice(0, 2).map((t) => `#${t.id} · ${H.dateCourte(t.echeance)}`).join(' · ') || '—'}</div></div>
  <div class="carte kpi c4 lien" data-defiler="ag-taches"><h2>En retard</h2><div class="chiffre" style="${retard.length ? 'color:var(--rouge)' : ''}">${retard.length}<small>échéance${retard.length > 1 ? 's' : ''} dépassée${retard.length > 1 ? 's' : ''}</small></div><div class="sous">${retard.slice(0, 3).map((t) => `#${t.id}`).join(' · ') || 'rien en retard'}</div></div>
  <div class="carte c12 ag">
    <div class="ag-barre"><span class="seg"><button data-dec="-1" title="Avant">‹</button><button data-dec="0">Aujourd'hui</button><button data-dec="1" title="Après">›</button></span><b>${titre}</b>
      <span class="ag-leg">${H.d.agenda.categories.map((c) => `<span><i style="background:${G.V(c.couleur)}"></i>${esc(c.nom)}</span>`).join('')}</span></div>
    <div class="ag-grille" style="--n:${n}">
      <div></div>${jours.map((j) => { const d = new Date(`${j}T12:00:00`); return `<div class="ag-tete${j === auj ? ' auj' : ''}"><span>${JOURS[d.getDay()]}</span><b>${d.getDate()}</b></div>`; }).join('')}
      <div class="ag-heure" style="align-self:center">journée</div>${jours.map((j) => `<div class="ag-bande" data-jour="${j}">${[...evs.filter((x) => x.jour === j && !x.debut).map((x) => `<button class="ag-pil plein" style="--c:${G.V(this.cat(x.categorie).couleur)}" data-ev="${esc(x.id)}" data-jour="${j}">${esc(x.titre)}</button>`),
        ...reps.filter((x) => x.jour === j).map((x) => this.pilule(x))].join('')}</div>`).join('')}
      <div class="ag-heures" style="height:${haut}px">${Array.from({ length: hMax - hMin }, (_, i) => `<span style="top:${i * H_PX}px">${hMin + i}h</span>`).join('')}</div>
      ${jours.map(colonne).join('')}
    </div>
    ${H.enLigne ? '' : '<div class="sous" style="margin-top:8px">Clique un créneau vide pour ajouter un rendez-vous ; clique un rendez-vous pour le changer.</div>'}
  </div>
</div>`;
    },

    /* ================= Mois ================= */
    mois() {
      const e = this.e(), auj = H.jour(), premier = `${e.mois}-01`, debut = H.lundi(premier), fin = plus(debut, 41);
      const evs = this.evenements(debut, fin), reps = this.reperes(debut, fin);
      const nomMois = new Date(`${premier}T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      const cases = Array.from({ length: 42 }, (_, i) => plus(debut, i));
      return `<div class="grille ag-suite"><div class="carte c12 ag-m">
    <div class="ag-barre"><span class="seg"><button data-mois="-1">‹</button><button data-mois="0">Ce mois</button><button data-mois="1">›</button></span><b style="text-transform:capitalize">${nomMois}</b></div>
    <div class="ag-mois">${['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map((j) => `<div class="ag-jsem">${j}</div>`).join('')}
      ${cases.map((j) => { const items = [...evs.filter((x) => x.jour === j).map((x) => `<div class="ag-m-ev" style="--c:${G.V(this.cat(x.categorie).couleur)}" data-ev="${esc(x.id)}" data-jour="${j}">${x.debut ? `<em>${x.debut}</em> ` : ''}${esc(x.titre)}</div>`),
        ...reps.filter((x) => x.jour === j).map((x) => `<div class="ag-m-ev rep" style="--c:${G.V(x.c)}" data-repere="${esc(x.type)}" data-rid="${esc(x.id ?? '')}">${x.icone} ${esc(x.titre)}</div>`)];
        return `<div class="ag-case${j.slice(0, 7) !== e.mois ? ' hors' : ''}${j === auj ? ' auj' : ''}" data-semaine="${j}"><b>${Number(j.slice(8))}</b>${items.slice(0, 4).join('')}${items.length > 4 ? `<span class="sous">+ ${items.length - 4}</span>` : ''}</div>`; }).join('')}</div>
  </div></div>`;
    },

    /* ================= Dans le temps ================= */
    frise(partie) {
      const auj = H.jour(), d = H.d, a = plus(auj, -21), b = plus(auj, 63);
      const ouvertes = d.taches.liste.filter((t) => !['fait', 'abandon'].includes(t.statut));
      // 1. Ce qui arrive : la ligne temporelle (façon Kibsu).
      const arrive = [...this.reperes(auj, plus(auj, 120)).filter((x) => x.type === 'tache' && x.icone !== '▸' || x.type === 'atlas'),
        ...this.evenements(auj, plus(auj, 120)).filter((x) => !x.repete && (x.categorie !== 'cours' || /EXAMEN|RENDU/.test(x.titre))).map((x) => ({ jour: x.jour, titre: x.titre, c: this.cat(x.categorie).couleur }))].sort((x, y) => x.jour.localeCompare(y.jour));
      // 2. Les tâches dans le temps : de leur début (ou création) à leur échéance (ou aujourd'hui).
      const noms = Object.fromEntries((d.taches.projets || []).map((p) => [p.id, p.nom])), nomP = (t) => noms[t.projet] || t.projet;
      const lignes = ouvertes.filter((t) => t.echeance || t.debut || t.statut === 'en_cours')
        .concat(d.taches.liste.filter((t) => t.statut === 'fait' && t.fait_le && t.fait_le >= plus(auj, -14) && (t.echeance || t.debut)))
        .sort((x, y) => (nomP(x) || '').localeCompare(nomP(y) || '') || String(x.echeance || '9999').localeCompare(String(y.echeance || '9999')));
      const sans = ouvertes.filter((t) => t.statut === 'en_cours' && !t.echeance).length;
      if (partie === 'ligne') return `<div class="grille ag-suite"><div class="carte c12"><h2>Ce qui arrive<em>${arrive.length} dates dans les 4 mois</em></h2>${this.ligne(arrive)}</div></div>`;
      return `<div class="grille ag-suite">
  <div class="carte c12" id="ag-taches"><h2>Les tâches dans le temps<em>3 semaines en arrière · 9 semaines devant${sans ? ` · ${sans} en cours sans échéance` : ''}</em></h2>${lignes.length ? this.gantt(lignes, a, b) : G.vide('Aucune tâche datée : ouvre une tâche et pose une échéance', '⏱')}
    ${G.legende([['orange', 'en cours'], ['accent', 'à faire'], ['vert', 'faite'], ['rouge', 'échéance dépassée']])}</div>
</div>`;
    },

    // La ligne temporelle (façon Atlas) : aujourd'hui à gauche, une marque par jour qui a quelque chose.
    // Échelle en racine carrée : les jours proches ont plus de place que les mois lointains.
    ligne(liste) {
      if (!liste.length) return G.vide('Aucune date à venir');
      const auj = H.jour(), w = 900, x0 = 40, x1 = w - 40, span = Math.min(120, Math.max(21, ecart(auj, liste[liste.length - 1].jour) + 3));
      const X = (jr) => x0 + Math.sqrt(Math.min(ecart(auj, jr), span) / span) * (x1 - x0);
      const jours = [];
      for (const e of liste) { const g = jours.find((x) => x.jour === e.jour); if (g) g.items.push(e); else jours.push({ jour: e.jour, items: [e] }); }
      const reperes = [7, 14, 30, 60, 90].filter((k) => k <= span).map((k) => ({ k, jr: plus(auj, k) }));
      const NIV = [36, 64, 128, 156], Y = 96;
      return `<svg viewBox="0 0 ${w} 190" width="100%"><line x1="${x0}" x2="${x1}" y1="${Y}" y2="${Y}" stroke="${G.V('trait-fort')}" stroke-width="2"/>
        ${reperes.map((r) => `<line x1="${X(r.jr)}" x2="${X(r.jr)}" y1="${Y - 5}" y2="${Y + 5}" stroke="${G.V('encre-3')}"/><text x="${X(r.jr)}" y="${Y + 112 > 190 ? Y - 9 : Y - 9}" text-anchor="middle" style="font-size:9.5px">+${r.k < 30 ? `${r.k / 7} sem` : `${r.k / 30} mois`}</text>`).join('')}
        <circle cx="${x0}" cy="${Y}" r="5" fill="${G.V('encre')}"/><text x="${x0}" y="${Y - 9}" text-anchor="middle" class="f">auj.</text>
        ${jours.slice(0, 20).map((g, i) => { const k = ecart(auj, g.jour), x = X(g.jour), niv = NIV[[0, 2, 1, 3][i % 4]], haut = niv < Y, proche = k <= 7;
          const ancre = x < x0 + 60 ? 'start' : x > x1 - 60 ? 'end' : 'middle', xt = ancre === 'start' ? x - 6 : ancre === 'end' ? x + 6 : x;
          const t = g.items[0].titre, titre = g.items.length > 1 ? `${g.items.length} choses` : t.length > 24 ? `${t.slice(0, 22)}…` : t;
          return `<line x1="${x}" x2="${x}" y1="${haut ? niv + 4 : Y + 6}" y2="${haut ? Y - 6 : niv - 22}" stroke="${G.V(proche ? 'vif' : 'encre-3')}" stroke-dasharray="2 2"/>
            <circle cx="${x}" cy="${Y}" r="${proche ? 6.5 : 5}" fill="${G.V(proche ? 'vif' : 'surface')}" stroke="${G.V(proche ? 'vif' : g.items[0].c)}" stroke-width="2.5"><title>${esc(g.items.map((e) => e.titre).join(' · '))}</title></circle>
            <g><title>${esc(g.items.map((e) => e.titre).join(' · '))}</title><text x="${xt}" y="${haut ? niv - 12 : niv - 12}" text-anchor="${ancre}" class="f" style="font-size:11px">${H.dateCourte(g.jour)}${k <= 7 ? ` · J−${k}` : ''}</text>
            <text x="${xt}" y="${niv + 1}" text-anchor="${ancre}" style="font-size:10px">${esc(titre)}</text></g>`; }).join('')}</svg>`;
    },

    gantt(lignes, a, b) {
      const auj = H.jour(), total = ecart(a, b), P = (j) => Math.max(0, Math.min(100, ecart(a, j) / total * 100));
      const projets = Object.fromEntries((H.d.taches.projets || []).map((p) => [p.id, p.nom]));
      const lundis = []; for (let j = H.lundi(a); j <= b; j = plus(j, 7)) if (j >= a) lundis.push(j);
      let projet = null;
      return `<div class="ag-gantt"><div class="ag-g-axe"><b></b><div>${lundis.map((j) => `<span style="left:${P(j)}%">${H.dateCourte(j)}</span>`).join('')}<i class="ag-g-auj" style="left:${P(auj)}%"></i></div></div>
        ${lignes.map((t) => {
          const nom = projets[t.projet] || t.projet || '', tete = nom !== projet ? `<div class="ag-g-projet">${esc(nom)}</div>` : ''; projet = nom;
          const de = t.debut || t.cree || auj, ouverte = !['fait', 'abandon'].includes(t.statut);
          const jusqua = t.statut === 'fait' ? (t.fait_le || t.echeance) : t.echeance || auj, retard = ouverte && t.echeance && t.echeance < auj;
          const c = retard ? 'rouge' : STATUT[t.statut] || 'encre-3', g = P(de), dr = P(jusqua < de ? de : jusqua);
          return `${tete}<div class="ag-g-ligne" data-tache="${t.id}" title="${esc(`#${t.id} ${t.titre}`)}"><span class="ag-g-nom"><em>#${t.id}</em> ${esc(t.titre)}</span>
            <div class="ag-g-piste">${lundis.map((j) => `<i class="ag-g-trait" style="left:${P(j)}%"></i>`).join('')}<i class="ag-g-auj" style="left:${P(auj)}%"></i>
              <span class="ag-g-barre${!t.echeance && ouverte ? ' ouverte' : ''}" style="left:${g}%;width:${Math.max(0.8, dr - g)}%;--c:${G.V(c)}"></span>
              ${t.echeance ? `<span class="ag-g-ech" style="left:${P(t.echeance)}%;--c:${G.V(c)}" title="échéance ${H.dateCourte(t.echeance)}"></span><span class="ag-g-date" style="left:${P(t.echeance)}%">${H.dateCourte(t.echeance)}</span>` : ''}</div></div>`;
        }).join('')}</div>`;
    },

    /* ================= Formulaire d'un rendez-vous ================= */
    formulaire(ev = {}, jour) {
      const neuf = !ev.id, cats = H.d.agenda.categories, lecture = H.enLigne;
      const taches = H.d.taches.liste.filter((t) => !['fait', 'abandon'].includes(t.statut)).sort((x, y) => y.id - x.id);
      if (lecture) {
        H.volet(`<h2 class="nom">${esc(ev.titre)}</h2><div><span class="puce">${esc(this.cat(ev.categorie).nom)}</span>${ev.repete ? ' <span class="puce">chaque semaine</span>' : ''}</div>
          <dl class="infos" style="margin-top:12px"><dt>Quand</dt><dd>${H.dateCourte(jour || ev.date)}${ev.debut ? ` · ${ev.debut}–${ev.fin}` : ' · journée'}</dd>${ev.lieu ? `<dt>Lieu</dt><dd>${esc(ev.lieu)}</dd>` : ''}${ev.tache ? `<dt>Tâche</dt><dd>#${ev.tache}</dd>` : ''}${ev.note ? `<dt>Note</dt><dd style="white-space:pre-wrap">${esc(ev.note)}</dd>` : ''}</dl>`);
        return;
      }
      H.volet(`<form id="ag-form"><h2 class="nom">${neuf ? 'Nouveau rendez-vous' : 'Rendez-vous'}</h2>
        <input class="champ" name="titre" required placeholder="Quoi ?" value="${esc(ev.titre || '')}" style="width:100%;font-size:17px;padding:9px 12px;margin:6px 0 12px">
        <div class="ag-cats">${cats.map((c) => `<label style="--c:${G.V(c.couleur)}"><input type="radio" name="categorie" value="${c.id}"${(ev.categorie || 'rdv') === c.id ? ' checked' : ''}><span>${esc(c.nom)}</span></label>`).join('')}</div>
        <div class="champs" style="margin-top:12px"><label>Jour<input class="champ" type="date" name="date" required value="${ev.date && !ev.repete ? ev.date : jour || ev.date || H.jour()}"></label>
          <label>Début<input class="champ" type="time" name="debut" step="300" value="${ev.debut || ''}"></label><label>Fin<input class="champ" type="time" name="fin" step="300" value="${ev.fin || ''}"></label></div>
        <div class="boutons"><span class="sous">Durée :</span>${[30, 60, 90, 120, 180].map((m) => `<button type="button" class="btn petit" data-duree="${m}">${m < 60 ? `${m} min` : `${m / 60} h`.replace('.5', ' h 30').replace(' h h', ' h')}</button>`).join('')}<button type="button" class="btn petit discret" data-duree="0">journée</button></div>
        <div class="champs-2"><label>Lieu<input class="champ" name="lieu" value="${esc(ev.lieu || '')}" placeholder="adresse, salle, visio…"></label>
          <label>Tâche liée<select class="champ" name="tache"><option value="">—</option>${taches.map((t) => `<option value="${t.id}"${ev.tache === t.id ? ' selected' : ''}>#${t.id} ${esc(t.titre.slice(0, 60))}</option>`).join('')}</select></label></div>
        <div class="ligne-form"><label class="sous" style="display:flex;gap:6px;align-items:center"><input type="checkbox" name="repete"${ev.repete ? ' checked' : ''}> chaque semaine (emploi du temps)</label>
          <label class="sous" style="display:flex;gap:6px;align-items:center">jusqu'au <input class="champ" type="date" name="jusqua" value="${ev.jusqua || ''}"></label></div>
        <textarea class="champ" name="note" rows="3" placeholder="Note (à préparer, à apporter…)" style="width:100%;margin-top:10px">${esc(ev.note || '')}</textarea>
        <div class="boutons" style="justify-content:space-between;margin-top:14px"><span style="display:flex;gap:6px">${neuf ? '' : `<button type="button" class="btn discret" data-suppr="tout">Supprimer${ev.repete ? ' la série' : ''}</button>${ev.repete && jour ? '<button type="button" class="btn discret" data-suppr="jour">Seulement ce jour</button>' : ''}`}</span>
          <button class="btn p" type="submit">${neuf ? 'Ajouter' : 'Enregistrer'}</button></div></form>`);
      const f = document.getElementById('ag-form');
      if (neuf) f.titre.focus();
      f.querySelectorAll('[data-duree]').forEach((b) => { b.onclick = () => { const m = Number(b.dataset.duree);
        if (!m) { f.debut.value = ''; f.fin.value = ''; return; } if (!f.debut.value) f.debut.value = '09:00'; f.fin.value = hm(Math.min(23 * 60 + 55, min(f.debut.value) + m)); }; });
      f.onsubmit = async (e2) => {
        e2.preventDefault();
        const corps = { titre: f.titre.value, categorie: f.categorie.value, date: f.date.value, debut: f.debut.value, fin: f.fin.value, lieu: f.lieu.value,
          tache: f.tache.value || null, repete: f.repete.checked ? 'semaine' : '', jusqua: f.jusqua.value, note: f.note.value };
        // Pour une série, on garde son premier jour (changer le jour d'une série la déplace entière).
        if (!neuf && ev.repete && jour && corps.date === jour) corps.date = ev.date;
        const r = await H.essayer(() => (neuf ? H.api('POST', 'hub/agenda', corps) : H.api('PUT', `hub/agenda/${encodeURIComponent(ev.id)}`, corps)), neuf ? 'Ajouté à l\'agenda' : 'Enregistré');
        if (r) { H.fermerVolet(); await H.recharger(); }
      };
      f.querySelectorAll('[data-suppr]').forEach((b) => { b.onclick = async () => {
        const seul = b.dataset.suppr === 'jour';
        if (!confirm(seul ? 'Retirer ce jour seulement ?' : 'Supprimer ce rendez-vous ?')) return;
        if (await H.essayer(() => H.api('DELETE', `hub/agenda/${encodeURIComponent(ev.id)}${seul ? `?jour=${jour}` : ''}`), 'Retiré')) { H.fermerVolet(); await H.recharger(); }
      }; });
    },
    nouveau(jour, debut) { this.formulaire({ debut: debut || '', fin: debut ? hm(Math.min(23 * 60 + 55, min(debut) + 60)) : '' }, jour); },

    ouvrirRepere(type, id) {
      if (type === 'tache') return H.vues.taches.ouvrir(id);
      if (type === 'atlas-contact') return H.vues.atlas.fiche(id);
      if (type === 'client') return H.vues.clients.fiche(id);
      if (type === 'atlas') return H.aller('atlas');
    },

    /* ================= Gestes ================= */
    apres() {
      const vue = document.getElementById('vue'), e = this.e();
      if (!H.d.agenda) return;
      const nouveau = document.getElementById('ag-nouveau'); if (nouveau) nouveau.onclick = () => this.nouveau(H.jour());
      vue.querySelectorAll('[data-dec]').forEach((b) => { b.onclick = () => { const k = Number(b.dataset.dec);
        if (etroit()) e.depuis3 = k ? plus(e.depuis3 || H.jour(), 3 * k) : H.jour(); else e.debut = k ? plus(e.debut, 7 * k) : H.lundi(H.jour()); H.rendre(); }; });
      vue.querySelectorAll('[data-mois]').forEach((b) => { b.onclick = () => { const k = Number(b.dataset.mois);
        if (!k) e.mois = H.mois(); else { const d = new Date(`${e.mois}-15T12:00:00`); d.setMonth(d.getMonth() + k); e.mois = H.mois(d); } H.rendre(); }; });
      vue.querySelectorAll('[data-ev]').forEach((x) => { x.onclick = (ev) => { ev.stopPropagation(); this.formulaire(H.d.agenda.evenements.find((y) => y.id === x.dataset.ev), x.dataset.jour); }; });
      vue.querySelectorAll('[data-repere]').forEach((x) => { x.onclick = (ev) => { ev.stopPropagation(); this.ouvrirRepere(x.dataset.repere, x.dataset.rid); }; });
      vue.querySelectorAll('[data-defiler]').forEach((x) => { x.onclick = () => document.getElementById(x.dataset.defiler)?.scrollIntoView({ block: 'start' }); });
      vue.querySelectorAll('[data-tache]').forEach((x) => { x.onclick = () => H.vues.taches.ouvrir(Number(x.dataset.tache)); });
      vue.querySelectorAll('[data-semaine]').forEach((x) => { x.onclick = () => { e.debut = H.lundi(x.dataset.semaine); e.depuis3 = x.dataset.semaine; H.rendre(); setTimeout(() => document.querySelector('.carte.ag')?.scrollIntoView({ block: 'start' }), 60); }; });
      if (H.enLigne) return;
      // Clic dans un créneau vide : nouveau rendez-vous à cette heure (arrondie à la demi-heure).
      vue.querySelectorAll('.ag-col').forEach((col) => { col.onclick = (ev) => {
        if (ev.target !== col) return;
        const hMin = Number(vue.querySelector('.ag-heures span')?.textContent.replace('h', '') || 8);
        this.nouveau(col.dataset.jour, hm(hMin * 60 + Math.floor(ev.offsetY / H_PX * 2) * 30));
      }; });
      vue.querySelectorAll('.ag-bande').forEach((b) => { b.ondblclick = (ev) => { if (ev.target === b) this.nouveau(b.dataset.jour); }; });
    },
  };
  void V;
})();
