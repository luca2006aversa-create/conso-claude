// Globe du cockpit : agences, extractions, serveurs et villes à prospecter, sur une Terre qu'on fait tourner et
// qu'on peut agrandir. Dessiné sur un canvas avec d3-geo ; fond de carte embarqué (vendor/), aucun appel extérieur.
'use strict';

(() => {
  let terre = null, frontieres = null, tour = 0;

  async function fonds() {
    if (terre !== null) return;
    try {
      const [t, p] = await Promise.all([fetch('vendor/land-110m.json').then((r) => r.json()), fetch('vendor/countries-110m.json').then((r) => r.json())]);
      terre = topojson.feature(t, t.objects.land);
      frontieres = topojson.mesh(p, p.objects.countries, (a, b) => a !== b);
    } catch { terre = false; frontieres = false; }
  }

  // points = [{ couche, lon, lat, r, t (texte de la bulle), etat, aller }], arcs = [{ de: [lon, lat], a: [lon, lat], poids }]
  H.globe = async ({ points = [], arcs = [] }) => {
    const cv = document.getElementById('globe');
    if (!cv || !window.d3) return;
    const moi = ++tour, ctx = cv.getContext('2d');
    const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(`--${n}`).trim();
    await fonds();
    if (moi !== tour) return;

    const e = (H.etat.globe ??= { rot: [-62, -24], zoom: 1, libre: true, couches: { agences: true, extractions: true, serveurs: true, cibles: true } });
    document.querySelectorAll('.couches input').forEach((i) => { i.checked = e.couches[i.dataset.c] !== false; i.onchange = () => { e.couches[i.dataset.c] = i.checked; }; });
    document.querySelectorAll('.zoom button').forEach((b) => { b.onclick = () => { e.zoom = Math.max(1, Math.min(12, e.zoom * (b.dataset.z === '+' ? 1.6 : 1 / 1.6))); e.libre = false; }; });

    let w = 0, h = 0, proj, path, glisse = false, t = 0, visibles = [];
    const taille = () => {
      const dpr = window.devicePixelRatio || 1; w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      proj = d3.geoOrthographic().translate([w / 2, h / 2]).clipAngle(90); path = d3.geoPath(proj, ctx);
    };
    taille();

    d3.select(cv).call(d3.drag().on('start', () => { glisse = true; e.libre = false; })
      .on('drag', (ev) => { const k = .35 / e.zoom; e.rot[0] += ev.dx * k; e.rot[1] = Math.max(-80, Math.min(80, e.rot[1] - ev.dy * k)); })
      .on('end', () => { glisse = false; }));
    cv.onwheel = (ev) => { ev.preventDefault(); e.zoom = Math.max(1, Math.min(12, e.zoom * Math.exp(-ev.deltaY * .0015))); e.libre = false; };
    const bulle = document.getElementById('bulle');
    const sous = (ev) => { const b = cv.getBoundingClientRect(), x = ev.clientX - b.left, y = ev.clientY - b.top; return [x, y, visibles.find((p) => Math.hypot(p.x - x, p.y - y) < p.r + 5)]; };
    cv.onmousemove = (ev) => { const [x, y, p] = sous(ev); bulle.style.display = p ? 'block' : 'none'; cv.style.cursor = p && p.aller ? 'pointer' : glisse ? 'grabbing' : 'grab';
      if (p) { bulle.textContent = p.t; bulle.style.left = `${Math.min(x + 12, w - 180)}px`; bulle.style.top = `${y - 10}px`; } };
    cv.onmouseleave = () => { bulle.style.display = 'none'; };
    cv.onclick = (ev) => { const p = sous(ev)[2]; if (p && p.aller) H.aller(p.aller); };

    (function dessin() {
      if (moi !== tour || !document.body.contains(cv)) return;
      if (cv.clientWidth !== w || cv.clientHeight !== h) taille();
      if (e.libre && !glisse) e.rot[0] += .06;
      t += .6; visibles = [];
      const R = (Math.min(w, h) / 2 - 8) * e.zoom;
      proj.scale(R).rotate(e.rot);
      const centre = [-e.rot[0], -e.rot[1]], vis = (p) => d3.geoDistance(p, centre) < Math.PI / 2 - .03;
      ctx.clearRect(0, 0, w, h);
      ctx.beginPath(); path({ type: 'Sphere' }); ctx.fillStyle = css('mer'); ctx.fill(); ctx.strokeStyle = css('trait-fort'); ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); path(d3.geoGraticule10()); ctx.strokeStyle = css('trait'); ctx.lineWidth = .6; ctx.stroke();
      if (terre) { ctx.beginPath(); path(terre); ctx.fillStyle = css('terre'); ctx.fill(); }
      if (frontieres) { ctx.beginPath(); path(frontieres); ctx.strokeStyle = css('mer'); ctx.lineWidth = .7; ctx.stroke(); }

      if (e.couches.extractions) {
        ctx.setLineDash([5, 7]); ctx.lineDashOffset = -t; ctx.strokeStyle = css('orange'); ctx.lineWidth = 1.5;
        for (const a of arcs) { ctx.globalAlpha = .3 + Math.min(.5, (a.poids || 1) / 12); ctx.beginPath(); path({ type: 'LineString', coordinates: [a.de, a.a] }); ctx.stroke(); }
        ctx.globalAlpha = 1; ctx.setLineDash([]);
      }
      const dessiner = { // une fonction par couche
        cibles: (p, x, y) => { ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.setLineDash([3, 3]); ctx.strokeStyle = css('accent'); ctx.lineWidth = 1.6; ctx.stroke(); ctx.setLineDash([]); return 7; },
        extractions: (p, x, y) => { const r = 2.5 + Math.sqrt(p.r || 1) * 1.6; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = css('orange'); ctx.globalAlpha = .85; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = css('surface'); ctx.lineWidth = 1; ctx.stroke(); return r; },
        agences: (p, x, y) => { const r = 4 + Math.sqrt(p.r || 1) * 1.1;
          ctx.beginPath(); ctx.arc(x, y, r + 4 + 3 * Math.sin(t / 9), 0, 7); ctx.fillStyle = css('accent'); ctx.globalAlpha = .16; ctx.fill();
          ctx.globalAlpha = .85; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = css('surface'); ctx.lineWidth = 1.2; ctx.stroke(); return r; },
        serveurs: (p, x, y) => { ctx.beginPath(); ctx.rect(x - 6, y - 6, 12, 12);
          if (p.etat === 'prevu') { ctx.fillStyle = css('surface'); ctx.fill(); ctx.setLineDash([3, 2]); ctx.strokeStyle = css('vert'); } else { ctx.fillStyle = css('vert'); ctx.fill(); ctx.strokeStyle = css('surface'); }
          ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); return 8; },
      };
      for (const couche of ['cibles', 'agences', 'extractions', 'serveurs']) {
        if (e.couches[couche] === false) continue;
        for (const p of points) {
          if (p.couche !== couche || !vis([p.lon, p.lat])) continue;
          const [x, y] = proj([p.lon, p.lat]);
          if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
          const r = dessiner[couche](p, x, y);
          visibles.unshift({ x, y, r, t: p.t, aller: p.aller });
        }
      }
      requestAnimationFrame(dessin);
    })();
  };
})();
