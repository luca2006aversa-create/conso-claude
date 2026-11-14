// Contacts : tout le carnet d'un coup, les agences d'Ašru et les contacts de Kibsu ensemble (filtre Tout / Ašru /
// Kibsu en haut). Chaque ligne ouvre la fiche de son espace (celle des clients ou celle de Kibsu), sans rien recopier.
'use strict';

H.vues.contacts = {
  nom: 'Contacts',
  pastille() {
    if (!H.d) return 0;
    const auj = H.jour(), dues = (l, fin) => l.filter((c) => c.relance && c.relance <= auj && !fin.includes(c.etape)).length;
    return dues(H.d.clients.liste, ['client', 'ecarte']) + dues((H.d.atlas || {}).contacts || [], ['ecarte']);
  },

  // Une liste commune : { espace, id, nom, sous, etape, relance, rang (avancement 0..1), ouvrir }.
  tous() {
    const d = H.d, a = d.atlas || { contacts: [], etapes: [], categories: [] };
    const villes = Object.fromEntries((d.clients.villes || []).map((v) => [v.cle, v.nom]));
    const rangDe = (etapes, id) => { const utiles = etapes.filter((e) => e.id !== 'ecarte'); const i = utiles.findIndex((e) => e.id === id); return i < 0 ? -1 : i / Math.max(1, utiles.length - 1); };
    return [
      ...d.clients.liste.map((c) => ({ espace: 'asru', id: c.id, nom: c.nom, sous: [villes[c.ville] || c.ville, c.quartier].filter(Boolean).join(' · '),
        etape: d.clients.etapes.find((e) => e.id === c.etape) || { nom: c.etape, couleur: 'encre-3' }, relance: c.relance, rang: rangDe(d.clients.etapes, c.etape),
        fin: ['client', 'ecarte'].includes(c.etape), echanges: (c.echanges || []).length })),
      ...a.contacts.map((c) => ({ espace: 'kibsu', id: c.id, nom: c.nom, sous: (a.categories.find((x) => x.id === c.categorie) || {}).nom || '',
        etape: a.etapes.find((e) => e.id === c.etape) || { nom: c.etape, couleur: 'encre-3' }, relance: c.relance, rang: rangDe(a.etapes, c.etape),
        fin: c.etape === 'ecarte', echanges: (c.echanges || []).length })),
    ];
  },

  rendre() {
    const e = (H.etat.contacts ??= { cherche: '', tri: 'actifs' }), auj = H.jour();
    const tous = this.tous().filter((c) => H.garder(c.espace));
    let liste = tous;
    if (e.tri === 'actifs') liste = liste.filter((c) => c.rang > 0 || c.relance || c.echanges);
    if (e.cherche) { const q = e.cherche.toLowerCase(); liste = liste.filter((c) => `${c.nom} ${c.sous}`.toLowerCase().includes(q)); }
    liste = liste.slice().sort((x, y) => ((y.relance && y.relance <= auj && !y.fin) - (x.relance && x.relance <= auj && !x.fin)) || y.rang - x.rang || x.nom.localeCompare(y.nom, 'fr'));
    const dues = tous.filter((c) => c.relance && c.relance <= auj && !c.fin).length, actifs = tous.filter((c) => c.rang > 0 && !c.fin).length;
    const parEspace = Object.entries(H.espaces).map(([id, s]) => ({ nom: s.nom, v: tous.filter((c) => c.espace === id).length, c: s.couleur })).filter((x) => x.v);
    const ligne = (c) => { const s = H.espaces[c.espace];
      return `<div class="ct-ligne" data-ct="${c.espace}:${G.esc(c.id)}" tabindex="0" role="button">
        <span class="rond" style="--c:${G.V(s.couleur)}" title="${s.nom}">${G.esc(H.vues.atlas.initiales(c.nom) || '?')}</span>
        <span style="min-width:0"><strong>${G.esc(c.nom)}</strong><small>${s.nom}${c.sous ? ` · ${G.esc(c.sous)}` : ''}${c.echanges ? ` · ${c.echanges} échange(s)` : ''}</small></span>
        <span class="ct-relance sous">${c.relance ? `<span class="${c.relance <= auj && !c.fin ? 'retard' : ''}">↻ ${H.dateCourte(c.relance)}</span>` : ''}</span>
        <span class="puce" style="border-color:${G.V(c.etape.couleur)}">${G.esc(c.etape.nom)}</span></div>`; };
    const MAX = 150;
    return `${H.entete('Contacts', { filtre: true })}
<div class="grille">
  ${G.kpi('Contacts', String(tous.length), H.filtre() === 'tout' ? parEspace.map((x) => `${x.v} ${x.nom}`).join(' · ') : 'dans ce projet', null, 'accent', 'c4')}
  ${G.kpi('En cours', String(actifs), 'écrits, ont répondu, en échange…', null, 'violet', 'c4')}
  ${G.kpi('Relances à faire', String(dues), dues ? "aujourd'hui ou en retard" : 'rien en retard', null, dues ? 'rouge' : 'vert', 'c4')}
  <div class="carte c12"><h2>Le carnet<em>clique pour la fiche</em></h2>
    <div class="boutons" style="margin-top:0"><span class="seg"><button data-ct-tri="actifs" class="${e.tri === 'actifs' ? 'actif' : ''}">En cours</button><button data-ct-tri="tous" class="${e.tri === 'tous' ? 'actif' : ''}">Tous</button></span>
      <input class="champ" id="ct-cherche" placeholder="Chercher un nom, une ville…" value="${G.esc(e.cherche)}" style="flex:1;max-width:280px">
      ${H.enLigne ? '' : `${H.garder('kibsu') ? '<button class="btn" id="ct-kibsu">+ Contact Kibsu</button>' : ''}`}</div>
    ${liste.length ? liste.slice(0, MAX).map(ligne).join('') : G.vide(e.tri === 'actifs' ? 'Aucun contact en cours : passe sur « Tous »' : 'Aucun contact')}
    ${liste.length > MAX ? `<div class="sous" style="padding:8px">… et ${liste.length - MAX} autres : cherche un nom pour les trouver.</div>` : ''}</div>
</div>`;
  },

  apres() {
    const vue = document.getElementById('vue'), e = H.etat.contacts;
    vue.querySelectorAll('[data-ct]').forEach((x) => { x.onclick = () => { const [esp, id] = x.dataset.ct.split(/:(.*)/s); if (esp === 'asru') H.vues.clients.fiche(id); else H.vues.atlas.fiche(id); }; });
    vue.querySelectorAll('[data-ct-tri]').forEach((b) => { b.onclick = () => { e.tri = b.dataset.ctTri; H.rendre(); }; });
    const c = document.getElementById('ct-cherche');
    if (c) c.oninput = () => { e.cherche = c.value; clearTimeout(this.minuterie); this.minuterie = setTimeout(() => { H.rendre(); const n = document.getElementById('ct-cherche'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 300); };
    const k = document.getElementById('ct-kibsu'); if (k) k.onclick = () => H.vues.atlas.nouveau();
  },
};
