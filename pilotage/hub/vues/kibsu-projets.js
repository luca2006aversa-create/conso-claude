// Kibsu : les projets (qui y participe, ce qu'ils contiennent, à quel concours ils vont) et les concours et
// conférences (dates limites, état du dossier). Ajouté à la vue Kibsu (vues/atlas.js) : onglets « projets » et
// « concours ». Aussi : le tableau de bord Kibsu du cockpit. Données : kibsu/suivi/suivi.json (hub/atlas.js).
'use strict';

(() => {
  const esc = G.esc;
  const jours = (date) => Math.round((new Date(`${date}T12:00:00`) - new Date(`${H.jour()}T12:00:00`)) / 864e5);
  const etat = (liste, id) => (H.d.atlas[liste] || []).find((x) => x.id === id) || { nom: id || '—', couleur: 'encre-3' };
  const pastille = (e) => `<span class="puce" style="border-color:${G.V(e.couleur)};color:${G.V(e.couleur)}">${esc(e.nom)}</span>`;
  const compte = (date) => { if (!date) return ''; const n = jours(date); return n < 0 ? `il y a ${-n} j` : n === 0 ? 'J-0' : `J-${n}`; };
  const prochaine = (c) => [c.limite, c.date].filter((x) => x && x >= H.jour()).sort()[0] || '';

  Object.assign(H.vues.atlas, {
    /* ================= Projets ================= */
    projets() {
      const a = H.d.atlas, P = a.projets || [], C = a.concours || [];
      const enCours = P.filter((p) => p.etat === 'en_cours'), gens = new Set(P.flatMap((p) => p.personnes));
      const aVenir = C.filter((c) => prochaine(c) && !['refuse', 'abandon'].includes(c.etat)).sort((x, y) => prochaine(x).localeCompare(prochaine(y)));
      const nom = (id) => (a.contacts.find((c) => c.id === id) || { nom: id }).nom;
      const carte = (p) => {
        const e = etat('etatsProjet', p.etat);
        return `<div class="carte c6 kp-carte" data-projet="${esc(p.id)}" style="border-top:3px solid ${G.V(e.couleur)}">
          <h2>${esc(p.nom)}<em>${pastille(e)}</em></h2>
          ${p.debut || p.fin ? `<div class="kp-dates">${p.debut ? `<span>depuis le ${H.dateCourte(p.debut)}</span>` : ''}${p.fin ? `<span>jusqu'au ${H.dateCourte(p.fin)}</span>` : ''}</div>` : ''}
          ${p.resume ? `<div class="sous" style="margin-bottom:6px">${esc(p.resume)}</div>` : ''}
          ${p.contenu.length ? `<ul style="margin:4px 0 0;padding-left:18px;font-size:13px">${p.contenu.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
          ${p.personnes.length ? `<div class="kp-puces">${p.personnes.map((id) => `<span title="Personne impliquée">👤 ${esc(nom(id))}</span>`).join('')}</div>` : ''}
          ${p.concours.length ? `<div class="kp-puces">${p.concours.map((id) => { const c = C.find((x) => x.id === id); return c ? `<span title="Concours ou conférence">⚑ ${esc(c.nom)}${prochaine(c) ? ` · ${compte(prochaine(c))}` : ''}</span>` : ''; }).join('')}</div>` : ''}
        </div>`;
      };
      return `<div class="grille">
  ${G.kpi('Projets en cours', String(enCours.length), `${P.length} en tout`, null, 'orange', 'c4')}
  ${G.kpi('Personnes impliquées', String(gens.size), 'dans les projets', null, 'violet', 'c4')}
  <div class="carte kpi c4 lien" data-aller="atlas/concours"><h2>Prochaine date</h2>${aVenir[0] ? `<div class="chiffre">${compte(prochaine(aVenir[0]))}<small>${H.dateCourte(prochaine(aVenir[0]))}</small></div><div class="sous">${esc(aVenir[0].nom)}</div>` : G.vide('Aucune date')}</div>
  ${H.enLigne ? '' : '<div class="carte c12" style="padding:10px 14px"><div class="boutons" style="margin:0"><button class="btn p" id="kp-nouveau">+ Projet</button><span class="sous">Clique un projet pour le modifier.</span></div></div>'}
  ${P.length ? P.slice().sort((x, y) => ['en_cours', 'idee', 'pause', 'fini'].indexOf(x.etat) - ['en_cours', 'idee', 'pause', 'fini'].indexOf(y.etat)).map(carte).join('') : `<div class="carte c12">${G.vide('Aucun projet pour le moment')}</div>`}
</div>`;
    },

    /* ================= Concours et conférences ================= */
    concours() {
      const a = H.d.atlas, C = a.concours || [], auj = H.jour();
      const actifs = C.filter((c) => !['refuse', 'abandon'].includes(c.etat));
      const frise = actifs.flatMap((c) => [c.limite && c.limite >= auj ? { jour: c.limite, titre: `limite : ${c.nom}`, c: 'violet' } : null, c.date && c.date >= auj ? { jour: c.date, titre: c.nom, c: 'accent' } : null]).filter(Boolean).sort((x, y) => x.jour.localeCompare(y.jour));
      const carte = (c) => { const t = (a.typesConcours || []).find((x) => x.id === c.type) || { nom: '' }, p = prochaine(c), n = p ? jours(p) : null;
        return `<div class="fiche" data-concours="${esc(c.id)}"><span class="rond" style="--c:${G.V(c.type === 'conference' ? 'accent' : c.type === 'appel' ? 'vert' : 'violet')}">${c.type === 'conference' ? 'C' : c.type === 'appel' ? 'A' : '⚑'}</span>
          <span style="min-width:0"><strong>${esc(c.nom)}</strong><span class="ligne"><span>${esc(t.nom)}</span>${c.lieu ? `<span>${esc(c.lieu)}</span>` : ''}
          ${p ? `<span class="kp-j${n <= 7 ? ' urgent' : ''}">${p === c.limite ? 'limite ' : ''}${compte(p)}</span>` : ''}</span></span></div>`; };
      const colonnes = (a.etatsConcours || []).filter((e) => e.id !== 'abandon');
      return `<div class="grille">
  ${G.kpi('À venir', String(actifs.filter((c) => prochaine(c)).length), 'concours et conférences', null, 'violet', 'c4')}
  ${G.kpi('Dossiers en préparation', String(C.filter((c) => c.etat === 'prepare').length), 'à envoyer', null, 'orange', 'c4')}
  ${G.kpi('Envoyés', String(C.filter((c) => ['envoye', 'accepte', 'refuse'].includes(c.etat)).length), `${C.filter((c) => c.etat === 'accepte').length} accepté(s)`, null, 'vert', 'c4')}
  <div class="carte c12"><h2>Ce qui arrive<em>⚑ date limite · ● date de l'événement</em></h2>${H.vues.agenda.ligne(frise)}</div>
  <div class="carte c12"><h2>Les dossiers<em>clique pour la fiche</em>${H.enLigne ? '' : '<button class="btn p petit" id="kc-nouveau" style="margin-left:auto">+ Concours ou conférence</button>'}</h2>
    <div class="kanban" style="--n:${colonnes.length}">${colonnes.map((e) => { const dans = C.filter((c) => c.etat === e.id).sort((x, y) => (prochaine(x) || '9').localeCompare(prochaine(y) || '9'));
      return `<div class="col" style="--c:${G.V(e.couleur)}"><h3>${esc(e.nom)}<em>${dans.length}</em></h3>${dans.map(carte).join('')}</div>`; }).join('')}</div></div>
</div>`;
    },

    /* ================= Fiches (volet) ================= */
    ficheProjet(id) {
      const a = H.d.atlas, p = id ? (a.projets || []).find((x) => x.id === id) : { nom: '', etat: 'en_cours', debut: H.jour(), fin: '', resume: '', contenu: [], personnes: [], concours: [] };
      if (!p) return;
      if (H.enLigne) return H.volet(`<h2 class="nom">${esc(p.nom)}</h2>${pastille(etat('etatsProjet', p.etat))}<p>${esc(p.resume || '')}</p>`);
      const gens = a.contacts.slice().sort((x, y) => (p.personnes.includes(y.id) - p.personnes.includes(x.id)) || (y.etape !== 'repere') - (x.etape !== 'repere') || x.nom.localeCompare(y.nom));
      H.volet(`<form id="kp-form"><h2 class="nom">${id ? 'Projet' : 'Nouveau projet'}</h2>
        <div class="champs-2" style="grid-template-columns:1fr 1fr">
          <label style="grid-column:1/-1">Nom<input class="champ" name="nom" required value="${esc(p.nom)}"></label>
          <label>État<select class="champ" name="etat">${a.etatsProjet.map((e) => `<option value="${e.id}"${e.id === p.etat ? ' selected' : ''}>${esc(e.nom)}</option>`).join('')}</select></label>
          <label>Début<input class="champ" type="date" name="debut" value="${esc(p.debut)}"></label>
          <label>Fin prévue<input class="champ" type="date" name="fin" value="${esc(p.fin)}"></label>
          <label style="grid-column:1/-1">En deux phrases<textarea class="champ" name="resume" rows="2">${esc(p.resume)}</textarea></label>
          <label style="grid-column:1/-1">Ce qu'il contient (une ligne par élément)<textarea class="champ" name="contenu" rows="4">${esc(p.contenu.join('\n'))}</textarea></label>
          <label style="grid-column:1/-1">Personnes impliquées (Ctrl + clic pour en choisir plusieurs)<select class="champ" name="personnes" multiple size="7">${gens.map((c) => `<option value="${esc(c.id)}"${p.personnes.includes(c.id) ? ' selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
          <fieldset style="grid-column:1/-1;border:0;padding:0;margin:0"><legend class="sous">Concours et conférences liés</legend>${(a.concours || []).map((c) => `<label style="display:flex;gap:6px;align-items:center;font-weight:400"><input type="checkbox" name="concours" value="${esc(c.id)}"${p.concours.includes(c.id) ? ' checked' : ''}>${esc(c.nom)}</label>`).join('') || '<span class="sous">aucun pour le moment</span>'}</fieldset>
        </div>
        <div class="boutons" style="justify-content:space-between;margin-top:14px">${id ? '<button class="btn" type="button" id="kp-suppr">Supprimer</button>' : '<span></span>'}<button class="btn p" type="submit">${id ? 'Enregistrer' : 'Ajouter'}</button></div></form>`);
      const f = document.getElementById('kp-form');
      f.onsubmit = async (ev) => { ev.preventDefault();
        const champs = { nom: f.nom.value, etat: f.etat.value, debut: f.debut.value, fin: f.fin.value, resume: f.resume.value, contenu: f.contenu.value,
          personnes: [...f.personnes.selectedOptions].map((o) => o.value), concours: [...f.querySelectorAll('[name=concours]:checked')].map((x) => x.value) };
        const r = await H.essayer(() => (id ? H.api('PUT', `hub/atlas/projets/${encodeURIComponent(id)}`, champs) : H.api('POST', 'hub/atlas/projets', champs)), id ? 'Projet enregistré' : 'Projet ajouté');
        if (r && await H.recharger(true)) { H.fermerVolet(); H.rendre(); } };
      const s = document.getElementById('kp-suppr');
      if (s) s.onclick = async () => { if (!confirm(`Supprimer le projet « ${p.nom} » ?`)) return;
        if (await H.essayer(() => H.api('DELETE', `hub/atlas/projets/${encodeURIComponent(id)}`), 'Projet supprimé') && await H.recharger(true)) { H.fermerVolet(); H.rendre(); } };
    },

    ficheConcours(id) {
      const a = H.d.atlas, c = id ? (a.concours || []).find((x) => x.id === id) : { nom: '', type: 'concours', etat: 'repere', organisateur: '', lieu: '', limite: '', date: '', lien: '', note: '', contacts: [] };
      if (!c) return;
      if (H.enLigne) return H.volet(`<h2 class="nom">${esc(c.nom)}</h2>${pastille(etat('etatsConcours', c.etat))}
        <dl class="infos">${[['Limite', c.limite && `${H.dateCourte(c.limite)} (${compte(c.limite)})`], ['Date', c.date && H.dateCourte(c.date)], ['Lieu', c.lieu], ['Organisateur', c.organisateur]].filter(([, v]) => v).map(([n, v]) => `<dt>${n}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`);
      const gens = a.contacts.slice().sort((x, y) => (c.contacts.includes(y.id) - c.contacts.includes(x.id)) || x.nom.localeCompare(y.nom));
      const projets = (a.projets || []).filter((p) => p.concours.includes(c.id));
      H.volet(`<form id="kc-form"><h2 class="nom">${id ? 'Concours ou conférence' : 'Nouveau concours ou conférence'}</h2>
        ${projets.length ? `<div class="kp-puces" style="margin:0 0 10px">${projets.map((p) => `<span>Projet : ${esc(p.nom)}</span>`).join('')}</div>` : ''}
        <div class="champs-2" style="grid-template-columns:1fr 1fr">
          <label style="grid-column:1/-1">Nom<input class="champ" name="nom" required value="${esc(c.nom)}"></label>
          <label>Type<select class="champ" name="type">${a.typesConcours.map((t) => `<option value="${t.id}"${t.id === c.type ? ' selected' : ''}>${esc(t.nom)}</option>`).join('')}</select></label>
          <label>État du dossier<select class="champ" name="etat">${a.etatsConcours.map((e) => `<option value="${e.id}"${e.id === c.etat ? ' selected' : ''}>${esc(e.nom)}</option>`).join('')}</select></label>
          <label>Date limite<input class="champ" type="date" name="limite" value="${esc(c.limite)}"></label>
          <label>Date de l'événement<input class="champ" type="date" name="date" value="${esc(c.date)}"></label>
          <label>Organisateur<input class="champ" name="organisateur" value="${esc(c.organisateur)}"></label>
          <label>Lieu<input class="champ" name="lieu" value="${esc(c.lieu)}"></label>
          <label style="grid-column:1/-1">Lien<input class="champ" name="lien" value="${esc(c.lien)}" placeholder="https://…"></label>
          <label style="grid-column:1/-1">Note<textarea class="champ" name="note" rows="2">${esc(c.note)}</textarea></label>
          <label style="grid-column:1/-1">Contacts liés (Ctrl + clic pour en choisir plusieurs)<select class="champ" name="contacts" multiple size="6">${gens.map((x) => `<option value="${esc(x.id)}"${c.contacts.includes(x.id) ? ' selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
        </div>
        <div class="boutons" style="justify-content:space-between;margin-top:14px">${id ? '<button class="btn" type="button" id="kc-suppr">Supprimer</button>' : '<span></span>'}<span class="boutons" style="margin:0">${c.lien ? `<a class="btn" href="${esc(c.lien)}" target="_blank" rel="noopener">Site ↗</a>` : ''}<button class="btn p" type="submit">${id ? 'Enregistrer' : 'Ajouter'}</button></span></div></form>`);
      const f = document.getElementById('kc-form');
      f.onsubmit = async (ev) => { ev.preventDefault();
        const champs = Object.fromEntries(['nom', 'type', 'etat', 'limite', 'date', 'organisateur', 'lieu', 'lien', 'note'].map((k) => [k, f[k].value]));
        champs.contacts = [...f.contacts.selectedOptions].map((o) => o.value);
        const r = await H.essayer(() => (id ? H.api('PUT', `hub/atlas/concours/${encodeURIComponent(id)}`, champs) : H.api('POST', 'hub/atlas/concours', champs)), id ? 'Enregistré' : 'Ajouté');
        if (r && await H.recharger(true)) { H.fermerVolet(); H.rendre(); } };
      const s = document.getElementById('kc-suppr');
      if (s) s.onclick = async () => { if (!confirm(`Supprimer « ${c.nom} » ?`)) return;
        if (await H.essayer(() => H.api('DELETE', `hub/atlas/concours/${encodeURIComponent(id)}`), 'Supprimé') && await H.recharger(true)) { H.fermerVolet(); H.rendre(); } };
    },

    // Gestes des onglets Projets et Concours (appelé par apres() de la vue Kibsu).
    apresProjets() {
      const vue = document.getElementById('vue');
      vue.querySelectorAll('[data-projet]').forEach((x) => { x.onclick = () => this.ficheProjet(x.dataset.projet); });
      vue.querySelectorAll('[data-concours]').forEach((x) => { x.onclick = (ev) => { ev.stopPropagation(); this.ficheConcours(x.dataset.concours); }; });
      const np = document.getElementById('kp-nouveau'); if (np) np.onclick = () => this.ficheProjet('');
      const nc = document.getElementById('kc-nouveau'); if (nc) nc.onclick = () => this.ficheConcours('');
    },

    /* ================= Cockpit : Kibsu d'un coup d'œil ================= */
    // dansAsru = true : une rangée sous le cockpit d'Ašru (filtre « Tout ») ; sinon le tableau de bord entier.
    cockpit(dansAsru = false) {
      const a = H.d.atlas; if (!a) return '';
      const P = a.projets || [], C = (a.concours || []).filter((c) => !['refuse', 'abandon'].includes(c.etat)), K = a.kibsu || [];
      const faites = K.filter((e) => e.statut === 'fait').length, F = a.feuille || [], fF = F.filter((e) => e.statut === 'fait').length;
      const aVenir = C.filter((c) => prochaine(c)).sort((x, y) => prochaine(x).localeCompare(prochaine(y)));
      const contacts = a.contacts.filter((c) => c.etape !== 'ecarte');
      const parEtape = a.etapes.filter((e) => e.id !== 'ecarte').map((e) => ({ nom: e.nom, v: contacts.filter((c) => c.etape === e.id).length, c: e.couleur }));
      const relances = a.contacts.filter((c) => c.relance && c.relance <= H.jour() && c.etape !== 'ecarte').length;
      const titre = dansAsru ? `<div class="carte c12" style="padding:8px 14px;background:none;border:0;box-shadow:none"><h2 style="margin:0;color:${G.V('violet')}">● Kibsu</h2></div>` : '';
      const cartes = `${titre}
  <div class="carte kpi c3 lien" data-aller="atlas/projets"><h2>Projets Kibsu</h2><div class="chiffre">${P.filter((p) => p.etat === 'en_cours').length}<small>en cours</small></div><div class="sous">${esc((P.find((p) => p.etat === 'en_cours') || {}).nom || '—')}</div></div>
  <div class="carte kpi c3 lien" data-aller="atlas/concours"><h2>Prochaine date</h2>${aVenir[0] ? `<div class="chiffre">${compte(prochaine(aVenir[0]))}<small>${H.dateCourte(prochaine(aVenir[0]))}</small></div><div class="sous">${esc(aVenir[0].nom)}</div>` : G.vide('Aucune date')}</div>
  <div class="carte c3 lien" data-aller="atlas"><h2>Avancement</h2><div class="anneaux">${G.anneau(F.length ? fF / F.length * 100 : 0, 'violet', 'Feuille de route', `${fF}/${F.length}`)}${K.length ? G.anneau(faites / K.length * 100, 'accent', 'Refonte', `${faites}/${K.length}`) : ''}</div></div>
  <div class="carte c3 lien" data-aller="contacts"><h2>Contacts Kibsu<em>${relances ? `${relances} relance(s) à faire` : ''}</em></h2>${G.barresH(parEtape)}</div>`;
      if (dansAsru) return cartes;
      return `<div class="grille">${cartes}
  <div class="carte c12"><h2>Ce qui arrive<em>concours, conférences et dates de Kibsu</em></h2>${H.vues.agenda.ligne([...aVenir.map((c) => ({ jour: prochaine(c), titre: c.nom, c: 'violet' })), ...(a.echeances || []).filter((e) => e.date >= H.jour()).map((e) => ({ jour: e.date, titre: e.titre, c: 'accent' }))].sort((x, y) => x.jour.localeCompare(y.jour)))}</div>
</div>`;
    },
  });
})();
