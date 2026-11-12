// Cœur du hub : charge les données (serveur du pilotage sur le PC, copie Supabase en ligne), gère la colonne
// d'icônes, l'adresse (#vue/onglet), le volet de droite et le rafraîchissement. Chaque vue s'ajoute dans H.vues.
'use strict';

const H = window.H = {
  d: null,                 // toutes les données (/api/hub/tout)
  vues: {},                // id -> { nom, icone, rendre(onglet), apres(onglet), plein, vivant, pastille() }
  ordre: ['Mon temps', 'agenda', 'Le site', 'cockpit', 'argent', 'clients', 'serveurs', 'extractions', 'Le travail', 'taches', 'atelier', 'conso', 'Projet à part', 'atlas'],
  enLigne: !!(window.HUB_CONFIG && window.HUB_CONFIG.url),
  charge: 0,               // heure du dernier chargement réussi
  etat: {},                // ce que les vues veulent garder d'un affichage à l'autre (globe, curseurs, filtres)
};

/* ---------- Dates ---------- */
const pad = (n) => String(n).padStart(2, '0');
H.jour = (d = new Date()) => { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
H.mois = (d = new Date()) => H.jour(d).slice(0, 7);
H.derniersJours = (n, fin = new Date()) => Array.from({ length: n }, (_, i) => H.jour(new Date(new Date(fin).getTime() - (n - 1 - i) * 864e5)));
H.derniersMois = (n, decalage = 0) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (n - 1 - i) + decalage); return H.mois(d); });
H.lundi = (jour) => { const d = new Date(`${jour}T12:00:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return H.jour(d); };
const MOIS_COURTS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
H.dateCourte = (iso) => { if (!iso) return ''; const [a, m, j] = String(iso).slice(0, 10).split('-').map(Number); return `${j} ${MOIS_COURTS[m - 1]}`; };
H.moisCourt = (aaaamm) => MOIS_COURTS[Number(aaaamm.slice(5, 7)) - 1];
H.ilya = (t) => { const s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000); return s < 90 ? "à l'instant" : s < 5400 ? `il y a ${Math.round(s / 60)} min` : s < 129600 ? `il y a ${Math.round(s / 3600)} h` : `il y a ${Math.round(s / 86400)} j`; };

/* ---------- Données ---------- */
function jetonLecture() {
  const m = /[#&]k=([\w-]+)/.exec(location.hash);
  if (m) {
    try { localStorage.setItem('hub.jeton', m[1]); } catch { /* stockage indisponible */ }
    history.replaceState(null, '', location.pathname);      // le jeton ne reste pas dans l'adresse
    return m[1];
  }
  try { return localStorage.getItem('hub.jeton'); } catch { return null; }
}

H.charger = async () => {
  if (!H.enLigne) {
    const rep = await fetch('/api/hub/tout', { cache: 'no-store' });
    if (!rep.ok) throw new Error(`Serveur du pilotage : ${rep.status}`);
    H.d = await rep.json(); H.charge = Date.now(); H.source = 'pc';
    return H.d;
  }
  const jeton = jetonLecture();
  if (!jeton) throw new Error("Lien incomplet : ouvre une première fois l'adresse complète (avec #k=…).");
  try {
    const lire = async (fonction) => { const rep = await fetch(`${HUB_CONFIG.url}/rest/v1/rpc/${fonction}`, { method: 'POST',
      headers: { apikey: HUB_CONFIG.cle, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_jeton: jeton }) }); return rep.ok ? rep.json() : null; };
    // La table dédiée du hub ; à défaut, la copie rangée avec la Conso (clé « pilotage »).
    let j = await lire('pilotage_lire');
    if (!j || !j.donnees) { const c = await lire('conso_lire'); j = c && c.donnees && c.donnees.pilotage ? { donnees: c.donnees.pilotage, maj: c.donnees.pilotage.genere } : null; }
    if (!j || !j.donnees) throw new Error('Jeton refusé ou aucune donnée publiée.');
    H.d = j.donnees; H.charge = new Date(j.maj || j.donnees.genere).getTime(); H.source = 'en ligne';
    try { localStorage.setItem('hub.copie', JSON.stringify(j)); } catch { /* trop gros : tant pis */ }
  } catch (e) {
    let copie = null;
    try { copie = JSON.parse(localStorage.getItem('hub.copie')); } catch { /* rien */ }
    if (!copie) throw e;
    H.d = copie.donnees; H.charge = new Date(copie.maj || copie.donnees.genere).getTime(); H.source = 'copie hors connexion';
  }
  return H.d;
};

H.api = async (methode, chemin, corps) => {
  if (H.enLigne) throw new Error('La version en ligne est en lecture seule : modifie depuis le PC.');
  const rep = await fetch(`/api/${chemin}`, { method: methode, headers: corps ? { 'Content-Type': 'application/json' } : {}, body: corps ? JSON.stringify(corps) : undefined });
  const j = await rep.json().catch(() => ({}));
  if (!rep.ok) throw new Error(j.erreur || `Erreur ${rep.status}`);
  return j;
};

/* ---------- Interface commune ---------- */
let minuterieToast = 0;
H.toast = (texte, erreur = false) => {
  const t = document.getElementById('toast');
  t.textContent = texte; t.hidden = false; t.classList.toggle('err', erreur);
  clearTimeout(minuterieToast); minuterieToast = setTimeout(() => { t.hidden = true; }, erreur ? 6000 : 2500);
};
// Lance une action qui écrit ; affiche l'erreur au lieu de la laisser passer en silence.
H.essayer = async (action, ok) => { try { const r = await action(); if (ok) H.toast(ok); return r; } catch (e) { H.toast(e.message, true); return null; } };

H.volet = (html, large = false) => { const v = document.getElementById('volet'); v.innerHTML = `<button class="fermer" aria-label="Fermer">×</button>${html}`; v.classList.toggle('large', large); v.classList.add('ouvert'); };
H.fermerVolet = () => { document.getElementById('volet').classList.remove('ouvert'); H.voletFerme && H.voletFerme(); H.voletFerme = null; };

H.entete = (titre, { onglets = null, actif = '', base = '', droite = '' } = {}) => {
  const vieux = Date.now() - H.charge > (H.enLigne ? 3 * 3600e3 : 180e3);
  return `<div class="haut"><h1>${G.esc(titre)}</h1>
    ${onglets ? `<div class="onglets">${onglets.map(([id, nom]) => `<button data-aller="${base}/${id}" class="${id === actif ? 'actif' : ''}">${G.esc(nom)}</button>`).join('')}</div>` : ''}
    <div class="droite">${droite}
      ${H.enLigne ? '' : '<input class="noter" id="noter" placeholder="Noter une idée… (Entrée)" aria-label="Note rapide">'}
      <span class="frais${vieux ? ' vieux' : ''}" title="Source : ${G.esc(H.source || '')}"><i></i>${H.enLigne ? 'copie du PC, ' : ''}${H.ilya(H.charge)}</span>
      <button class="btn petit" id="rafraichir" title="Relire les données">↻</button>
    </div></div>`;
};

const ICONES = {
  agenda: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4M7.5 14h2M11 14h2M14.5 14h2M7.5 17.5h2M11 17.5h2"/>',
  cockpit: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  argent: '<path d="M3 17l5-5 4 3 8-9"/><path d="M15 6h5v5"/>',
  clients: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-4 3-6 6.5-6s6 2 6.5 6M16 5a3.5 3.5 0 010 6.5M18 14c2 .8 3.2 2.8 3.5 6"/>',
  serveurs: '<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01"/>',
  extractions: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  taches: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/>',
  atelier: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 7v10M18 11c0 4-6 3-12 5"/>',
  atlas: '<circle cx="12" cy="12" r="5.5"/><path d="M3.2 15.6c-1.6 1.6.4 3.1 4.6 2.1 3.4-.8 7.4-2.9 10.4-5.4 3.2-2.7 4.4-5.2 2.6-5.9-.8-.3-2 0-3.4.6"/>',
  conso: '<path d="M12 3a9 9 0 109 9h-9z"/><path d="M15 3.5A9 9 0 0120.5 9H15z"/>',
};

function route() {
  const [id, onglet] = location.hash.replace(/^#/, '').split('/');
  return H.vues[id] ? [id, onglet || ''] : ['cockpit', ''];
}

H.aller = (cible) => { const h = `#${String(cible).replace(/^#/, '')}`; if (location.hash === h) H.rendre(); else location.hash = h; };

H.rendre = (garderVolet = false) => {
  const [id, onglet] = route();
  const vue = H.vues[id], main = document.getElementById('vue');
  if (garderVolet !== true) H.fermerVolet();
  main.classList.toggle('plein', !!(vue.plein && vue.plein(onglet)));
  try {
    main.innerHTML = vue.rendre(onglet);
    main.querySelectorAll('iframe[data-incruste]').forEach((cadre) => { cadre.style.visibility = 'hidden';
      cadre.addEventListener('load', () => { try { const doc = cadre.contentDocument, lien = doc.createElement('link'); lien.rel = 'stylesheet'; lien.href = 'hub/incruste.css';
        lien.onload = lien.onerror = () => { cadre.style.visibility = ''; }; doc.head.append(lien); } catch { cadre.style.visibility = ''; } }); });
    if (vue.apres) vue.apres(onglet);
  }
  catch (e) { console.error(e); main.innerHTML = `${H.entete(vue.nom)}<div class="carte c12">${G.vide(`Cette vue a rencontré une erreur : ${e.message}`, '!')}</div>`; }
  document.querySelectorAll('#nav button').forEach((b) => {
    b.classList.toggle('actif', b.dataset.id === id);
    const n = H.d && H.vues[b.dataset.id].pastille ? H.vues[b.dataset.id].pastille() : 0;
    b.querySelector('b')?.remove();
    if (n) b.insertAdjacentHTML('beforeend', `<b>${n}</b>`);
  });
  H.vueActive = id;
  // Bloc « État » en bas de la barre latérale, comme dans Ašru.
  const s = H.d.site, debout = s.instances.filter((i) => !i.releves.length || i.releves[i.releves.length - 1].ok).length;
  document.getElementById('etat').innerHTML = `<h6>État</h6>
    <div><i class="${s.reglages.enLigne.url ? '' : 'gris'}"></i>${s.reglages.enLigne.url ? 'Site en ligne' : 'Site pas encore en ligne'}</div>
    <div><i class="${!s.instances.length ? 'gris' : debout === s.instances.length ? '' : 'att'}"></i>${debout} / ${s.instances.length} instances</div>
    <div><i class="${Date.now() - H.charge > 9e5 ? 'att' : ''}"></i>Données ${H.ilya(H.charge)}</div>
    <div class="sous" style="padding-left:17px">version ${G.esc(s.versionMain || '—')}</div>`;
  try { localStorage.setItem('hub.vue', location.hash); } catch { /* rien */ }
};

H.recharger = async (silencieux = false) => {
  try { await H.charger(); if (!silencieux) H.rendre(); return true; }
  catch (e) { if (!silencieux) H.toast(e.message, true); return false; }
};

// Écran d'accueil sans jeton : coller le lien du téléphone (ou le jeton seul). Rien ne part ailleurs que dans ce téléphone.
H.demanderLien = (main, message) => {
  document.querySelector('aside').style.display = 'none';
  main.innerHTML = `<div class="carte" style="max-width:440px;margin:12vh auto 0;text-align:center;padding:28px 24px">
    <img src="icone-hub-192.png" alt="" width="84" height="84" style="border-radius:20px;margin-bottom:10px">
    <h1 style="margin:0 0 6px">Pilotage</h1>
    <div class="sous" style="margin-bottom:18px">${G.esc(/refus/i.test(message) ? 'Ce lien ne marche plus.' : 'Première ouverture sur ce téléphone.')} Colle le lien que tu as reçu (celui avec #k=…).</div>
    <form id="coller-lien" style="display:grid;gap:10px"><input class="champ" name="lien" placeholder="Colle le lien ici" autocomplete="off" style="text-align:center;padding:10px">
      <button class="btn p" type="submit" style="justify-content:center;padding:10px">Ouvrir</button></form></div>`;
  const f = document.getElementById('coller-lien');
  f.onsubmit = (ev) => {
    ev.preventDefault();
    const v = f.lien.value.trim(), m = /[#&?]k=([\w-]+)/.exec(v) || /^([\w-]{16,})$/.exec(v);
    if (!m) { H.toast('Je ne trouve pas la clé dans ce lien', true); return; }
    try { localStorage.setItem('hub.jeton', m[1]); } catch { H.toast('Ce navigateur refuse de garder la clé', true); return; }
    location.replace(location.pathname);
  };
};

H.demarrer = async () => {
  const nav = document.getElementById('nav');
  nav.innerHTML = H.ordre.map((id) => (H.vues[id] ? `<button data-id="${id}" title="${H.vues[id].nom}"><svg viewBox="0 0 24 24">${ICONES[id]}</svg>${H.vues[id].nom}</button>` : `<h6>${id}</h6>`)).join('');
  const nouvelle = document.getElementById('nouvelle-tache');
  nouvelle.hidden = H.enLigne;
  nouvelle.onclick = () => H.vues.taches.nouvelle();
  nav.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { H.aller(b.dataset.id); window.scrollTo(0, 0); } });

  const main = document.getElementById('vue');
  main.addEventListener('click', (e) => {
    const a = e.target.closest('[data-aller]');
    if (a) { H.aller(a.dataset.aller); return; }
    if (e.target.closest('#rafraichir')) H.recharger().then((ok) => ok && H.toast('Données relues'));
  });
  main.addEventListener('keydown', (e) => {
    if (e.target.id !== 'noter' || e.key !== 'Enter' || !e.target.value.trim()) return;
    const texte = e.target.value.trim(); e.target.value = '';
    H.essayer(() => H.api('POST', 'boite', { texte, projet: 'sitescope' }), 'Noté dans la boîte à notes').then(() => H.vues.taches.relire());
  });
  document.getElementById('volet').addEventListener('click', (e) => { if (e.target.closest('.fermer')) H.fermerVolet(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') H.fermerVolet(); });
  window.addEventListener('hashchange', () => { if (!/[#&]k=/.test(location.hash)) H.rendre(); });

  try {
    await H.charger();
    if (!location.hash || /[#&]k=/.test(location.hash)) { let h = ''; try { h = localStorage.getItem('hub.vue') || ''; } catch { /* rien */ } history.replaceState(null, '', h && H.vues[h.slice(1).split('/')[0]] ? h : '#cockpit'); }
    H.rendre();
  } catch (e) {
    main.innerHTML = `<div class="carte c12" style="max-width:520px;margin:60px auto">${G.vide(e.message, '!')}</div>`;
    if (H.enLigne) H.demanderLien(main, e.message);
  }

  // Relit les données chaque minute ; ne redessine que les vues « vivantes », et jamais pendant une saisie.
  setInterval(async () => {
    if (document.hidden) return;
    const occupe = document.getElementById('volet').classList.contains('ouvert') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    const ok = await H.recharger(true);
    if (ok && !occupe && H.vues[H.vueActive]?.vivant) H.rendre();
  }, H.enLigne ? 5 * 60000 : 60000);

  if (H.enLigne && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
};
