// Chiffres tirés des données brutes, partagés par plusieurs vues (cockpit, clients, extractions, atelier…).
'use strict';

(() => {
  // Lieux connus pour nommer une extraction d'après son centre (à moins de ~60 km).
  const LIEUX = [['Hanoï', 105.85, 21.03], ['Hô Chi Minh-Ville', 106.7, 10.78], ['Đà Nẵng', 108.2, 16.05], ['Hải Phòng', 106.68, 20.86],
    ['Quan Lạn', 107.5, 20.89], ['Ninh Bình', 105.97, 20.25], ['Tú Lệ', 104.3, 21.8], ['Stockholm', 18.07, 59.33], ['Rouen', 1.1, 49.44],
    ['Paris', 2.35, 48.85], ['Rome', 12.5, 41.9], ['Bangkok', 100.5, 13.75], ['Tokyo', 139.7, 35.68], ['Singapour', 103.82, 1.35],
    ['La Réunion', 55.5, -21.1]];
  const lieu = (c) => {
    if (!c) return 'lieu inconnu';
    let mieux = null, d = .6;
    for (const [nom, lon, lat] of LIEUX) { const e = Math.hypot((c[0] - lon) * Math.cos(lat * Math.PI / 180), c[1] - lat); if (e < d) { d = e; mieux = nom; } }
    return mieux || `${c[1].toFixed(1)}°, ${c[0].toFixed(1)}°`;
  };
  const mediane = (v) => { if (!v.length) return 0; const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const jourDe = (e) => (e.debut ? H.jour(e.debut) : String(e.id).slice(0, 10));

  H.calc = {
    lieu, mediane,

    taches() {
      const l = H.d.taches.liste, par = {};
      for (const t of l) par[t.statut] = (par[t.statut] || 0) + 1;
      const ouvertes = l.filter((t) => !['fait', 'abandon'].includes(t.statut));
      const lundis = Array.from({ length: 12 }, (_, i) => H.lundi(H.jour(Date.now() - (11 - i) * 7 * 864e5)));
      const compter = (champ) => lundis.map((lu, i) => l.filter((t) => t[champ] && t[champ] >= lu && (!lundis[i + 1] || t[champ] < lundis[i + 1])).length);
      return { par, total: l.length, ouvertes: ouvertes.length, aValider: par.a_valider || 0, enCours: par.en_cours || 0,
        attendToi: ouvertes.filter((t) => t.qui === 'toi').length, notes: H.d.taches.notes || 0,
        semaines: { x: lundis.map(H.dateCourte), creees: compter('cree'), faites: compter('fait_le') } };
    },

    clients() {
      const l = H.d.clients.liste, etapes = H.d.clients.etapes, par = {}, auj = H.jour();
      for (const c of l) par[c.etape] = (par[c.etape] || 0) + 1;
      const rang = (id) => etapes.findIndex((e) => e.id === id);
      const suite = etapes.filter((e) => e.id !== 'ecarte');
      // Entonnoir : combien ont atteint au moins chaque étape.
      const entonnoir = suite.map((e) => ({ nom: e.nom, c: e.couleur, v: l.filter((c) => c.etape !== 'ecarte' && rang(c.etape) >= rang(e.id)).length }));
      const relances = l.filter((c) => c.relance && c.relance <= auj && !['client', 'ecarte'].includes(c.etape));
      const echanges = l.flatMap((c) => c.echanges.map((e, i) => ({ ...e, i, client: c }))).sort((a, b) => b.date.localeCompare(a.date));
      return { par, total: l.length, entonnoir, relances, echanges, contactes: l.filter((c) => !['repere', 'ecarte'].includes(c.etape)).length };
    },

    extractions() {
      const l = H.d.extractions, parJour = {}, sources = {}, groupes = {};
      for (const e of l) {
        const j = (parJour[jourDe(e)] ??= { termine: 0, echec: 0, en_cours: 0 });
        j[e.statut === 'termine' ? 'termine' : e.statut === 'echec' ? 'echec' : 'en_cours']++;
        for (const [s, n] of Object.entries(e.sources || {})) sources[s] = (sources[s] || 0) + n;
        if (e.centre) { const k = e.centre.map((v) => v.toFixed(1)).join(','); const g = (groupes[k] ??= { lon: 0, lat: 0, n: 0, lieu: lieu(e.centre) }); g.lon += e.centre[0]; g.lat += e.centre[1]; g.n++; }
      }
      const finies = l.filter((e) => e.statut === 'termine'), echecs = l.filter((e) => e.statut === 'echec');
      const lieux = {};
      for (const e of l) { const n = lieu(e.centre); lieux[n] = (lieux[n] || 0) + 1; }
      return { liste: l, total: l.length, finies: finies.length, echecs, parJour, sources, lieux,
        reussite: finies.length + echecs.length ? Math.round(finies.length / (finies.length + echecs.length) * 100) : 0,
        dureeMediane: mediane(finies.map((e) => e.duree).filter(Boolean)), aire: l.reduce((s, e) => s + (e.aire || 0), 0),
        groupes: Object.values(groupes).map((g) => ({ lon: g.lon / g.n, lat: g.lat / g.n, n: g.n, lieu: g.lieu })), jourDe };
    },

    conso() {
      const c = H.d.conso, auj = H.jour();
      const actif = c.limites.find((x) => x.actif) || [...c.limites].sort((a, b) => b.releve - a.releve)[0] || null;
      return { aujourdhui: c.jours[auj]?.tok || 0, actif, jours: (n) => H.derniersJours(n).map((j) => c.jours[j]?.tok || 0) };
    },

    // Dépenses réelles du mois donné (AAAA-MM), d'après le carnet de la vue Argent.
    depensesDuMois(mois) {
      return H.d.argent.depenses.reduce((s, d) => {
        if (d.debut && mois < d.debut) return s;
        if (d.fin && mois > d.fin) return s;
        if (d.rythme === 'mois') return s + d.montant;
        if (d.rythme === 'an') return s + d.montant / 12;
        return s + (d.debut === mois ? d.montant : 0);
      }, 0);
    },
    revenusDuMois(mois) { return H.d.argent.revenus.filter((r) => r.mois === mois).reduce((s, r) => s + r.montant, 0); },
  };
})();
