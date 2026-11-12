// Pilotage en ligne : la page Conso est une partie du pilotage, plus une appli à part.
// Chargé seulement par conso.html dans la version en ligne (avant conso.js, qui n'est pas modifié) :
// la page croit lire Supabase, mais reçoit la copie que le pilotage a déjà chargée (même lien, même pause).
'use strict';

window.CONSO_CONFIG = { url: 'pilotage', cle: '' };

(() => {
  const vrai = window.fetch.bind(window);
  window.fetch = (adresse, options) => {
    if (!String(adresse).startsWith('pilotage/rest/v1/rpc/conso_lire')) return vrai(adresse, options);
    const H = window.parent !== window ? window.parent.H : null, d = H && H.d && H.d.consoComplet;
    const corps = d ? { donnees: { ...d }, maj: new Date(H.charge || Date.now()).toISOString() }
      : { message: 'La Conso n’est pas encore dans la copie du pilotage : rouvre le pilotage dans quelques minutes.' };
    return Promise.resolve(new Response(JSON.stringify(corps), { status: d ? 200 : 404, headers: { 'Content-Type': 'application/json' } }));
  };
})();
