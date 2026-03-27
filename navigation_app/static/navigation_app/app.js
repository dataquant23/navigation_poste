(() => {
  const cfg = window.POSTE_NAV_APP;
  const state = {
    selectedPoste: null,
    userLocation: null,
    routeLine: null,
    userMarker: null,
    posteMarker: null,
  };

  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");
  const infoPanel = document.getElementById("infoPanel");
  const statusText = document.getElementById("statusText");
  const resultCount = document.getElementById("resultCount");
  const locateBtn = document.getElementById("locateBtn");
  const routeBtn = document.getElementById("routeBtn");
  const startBtn = document.getElementById("startBtn");

  const map = L.map("map").setView([5.348, -4.027], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  function setStatus(msg) {
    statusText.textContent = msg || "Prête";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function hasValidLatLon(poste) {
    const lat = Number(poste?.lat);
    const lon = Number(poste?.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  }

  function formatCoord(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num.toFixed(6) : "-";
  }

  function setActionState() {
    const ready = Boolean(state.selectedPoste) && hasValidLatLon(state.selectedPoste);
    routeBtn.disabled = !ready;
    startBtn.disabled = !ready;
  }

  function clearRoute() {
    if (state.routeLine) {
      map.removeLayer(state.routeLine);
      state.routeLine = null;
    }
  }

  function setUserMarker(lat, lon) {
    state.userLocation = { lat, lon };

    if (state.userMarker) {
      state.userMarker.setLatLng([lat, lon]);
    } else {
      state.userMarker = L.circleMarker([lat, lon], {
        radius: 8,
        color: "#ffffff",
        weight: 3,
        fillColor: "#0f766e",
        fillOpacity: 1,
      }).addTo(map);

      state.userMarker.bindPopup("<strong>Votre position</strong>");
    }

    // Met à jour le panneau si un poste est déjà sélectionné
    if (state.selectedPoste) {
      renderInfoPanel(state.selectedPoste);
    }
  }

  function setPosteMarker(poste) {
    if (!poste || !hasValidLatLon(poste)) {
      return false;
    }

    if (state.posteMarker) {
      map.removeLayer(state.posteMarker);
      state.posteMarker = null;
    }

    state.posteMarker = L.circleMarker([Number(poste.lat), Number(poste.lon)], {
      radius: 10,
      color: "#ffffff",
      weight: 3,
      fillColor: "#f97316",
      fillOpacity: 1,
    }).addTo(map);

    state.posteMarker.bindPopup(`
      <div style="min-width:220px">
        <div><strong>${escapeHtml(poste.nom_poste || "Poste")}</strong></div>
        <div><b>Libellé</b> : ${escapeHtml(poste.libelle || "-")}</div>
        <div><b>Commune</b> : ${escapeHtml(poste.commune || "-")}</div>
        <div><b>Quartier</b> : ${escapeHtml(poste.quartier || "-")}</div>
      </div>
    `);

    return true;
  }

  function renderInfoPanel(poste) {
    if (!poste) {
      infoPanel.innerHTML = '<div class="muted">Recherche puis sélectionne un poste pour afficher ses informations.</div>';
      return;
    }

    const userCoords = state.userLocation
      ? `${formatCoord(state.userLocation.lat)} / ${formatCoord(state.userLocation.lon)}`
      : "Position non disponible";

    infoPanel.innerHTML = `
      <div class="info-grid">
        <div class="info-item"><b>Nom poste</b> ${escapeHtml(poste.nom_poste || "-")}</div>
        <div class="info-item"><b>Libellé</b> ${escapeHtml(poste.libelle || "-")}</div>
        <div class="info-item"><b>Commune</b> ${escapeHtml(poste.commune || "-")}</div>
        <div class="info-item"><b>Quartier</b> ${escapeHtml(poste.quartier || "-")}</div>
        <div class="info-item"><b>Départ</b> ${escapeHtml(poste.depart || "-")}</div>
        <div class="info-item"><b>Coordonnées GPS décimales</b> ${formatCoord(poste.lat)} / ${formatCoord(poste.lon)}</div>
        <div class="info-item"><b>Ma position</b> ${userCoords}</div>
      </div>
    `;
  }

  async function fetchPosteDetail(id) {
    const url = new URL(cfg.detailUrl, window.location.origin);
    url.searchParams.set("id", id);

    const res = await fetch(url, { credentials: "same-origin" });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data?.error || "Poste introuvable");
    }

    return data.poste;
  }

  async function selectPoste(id) {
    try {
      setStatus("Chargement du poste...");

      const poste = await fetchPosteDetail(id);
      state.selectedPoste = poste;

      renderInfoPanel(poste);
      const markerOk = setPosteMarker(poste);

      setActionState();
      resultCount.textContent = "1";

      if (markerOk) {
        const bounds = [];
        if (state.userLocation) {
          bounds.push([state.userLocation.lat, state.userLocation.lon]);
        }
        bounds.push([Number(poste.lat), Number(poste.lon)]);

        if (bounds.length > 1) {
          map.fitBounds(bounds, { padding: [40, 40] });
        } else {
          map.setView([Number(poste.lat), Number(poste.lon)], 15);
        }

        setStatus("Poste sélectionné");
      } else {
        setStatus("Poste chargé, mais coordonnées carte invalides");
        alert("Le poste a été chargé, mais ses coordonnées GPS sont invalides. Vérifie le CRS source dans services.py.");
      }
    } catch (err) {
      console.error(err);
      state.selectedPoste = null;
      setActionState();
      resultCount.textContent = "0";
      setStatus("Erreur de chargement du poste");
      alert("Impossible de charger ce poste.");
    }
  }

  async function fetchSearch(query) {
    const url = new URL(cfg.searchUrl, window.location.origin);
    url.searchParams.set("q", query);

    const res = await fetch(url, { credentials: "same-origin" });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data?.error || "Erreur recherche");
    }

    return data.results || [];
  }

  function renderSearchResults(results) {
    searchResults.innerHTML = "";
    resultCount.textContent = String(results.length);

    if (!results.length) return;

    const panel = document.createElement("div");
    panel.className = "search-results-panel";

    results.forEach((item) => {
      const row = document.createElement("div");
      row.className = "search-item";
      row.innerHTML = `
        <div class="search-title">${escapeHtml(item.nom_poste || "-")}</div>
        <div class="search-meta">${escapeHtml(item.libelle || "-")} • ${escapeHtml(item.commune || "-")} • ${escapeHtml(item.quartier || "-")}</div>
      `;

      row.addEventListener("click", async () => {
        searchResults.innerHTML = "";
        searchInput.value = `${item.libelle || ""} - ${item.nom_poste || ""}`;
        await selectPoste(item.id);
      });

      panel.appendChild(row);
    });

    searchResults.appendChild(panel);
  }

  function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Géolocalisation non supportée"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
        },
        (err) => reject(err),
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  }

  async function locateUser() {
    try {
      setStatus("Récupération de votre position...");
      const pos = await getCurrentPosition();
      setUserMarker(pos.lat, pos.lon);

      if (state.selectedPoste && hasValidLatLon(state.selectedPoste)) {
        map.fitBounds(
          [
            [pos.lat, pos.lon],
            [Number(state.selectedPoste.lat), Number(state.selectedPoste.lon)],
          ],
          { padding: [40, 40] }
        );
      } else {
        map.setView([pos.lat, pos.lon], 15);
      }

      setStatus("Position actuelle détectée");
    } catch (err) {
      console.error(err);
      setStatus("Impossible de récupérer la position");
      alert("Impossible de récupérer votre position actuelle.");
    }
  }

  async function drawRoute() {
    if (!state.selectedPoste) {
      alert("Choisis d'abord un poste.");
      return;
    }

    if (!hasValidLatLon(state.selectedPoste)) {
      alert("Coordonnées GPS du poste invalides.");
      return;
    }

    try {
      if (!state.userLocation) {
        await locateUser();
      }

      if (!state.userLocation) {
        alert("Position actuelle indisponible.");
        return;
      }

      setStatus("Calcul de l'itinéraire...");
      clearRoute();

      const start = {
        lat: Number(state.userLocation.lat),
        lon: Number(state.userLocation.lon),
      };

      const dest = {
        lat: Number(state.selectedPoste.lat),
        lon: Number(state.selectedPoste.lon),
      };

      const url = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${dest.lon},${dest.lat}?overview=full&geometries=geojson`;

      const res = await fetch(url);
      const data = await res.json();

      if (!data.routes || !data.routes.length) {
        throw new Error("Itinéraire indisponible");
      }

      const route = data.routes[0];
      const coords = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);

      state.routeLine = L.polyline(coords, {
        color: "#f97316",
        weight: 5,
        opacity: 0.92,
      }).addTo(map);

      const distanceKm = (route.distance / 1000).toFixed(1);
      const durationMin = Math.round(route.duration / 60);

      state.routeLine.bindPopup(`
        <div style="min-width:220px">
          <div><strong>Itinéraire calculé</strong></div>
          <div><b>Distance</b> : ${distanceKm} km</div>
          <div><b>Durée estimée</b> : ${durationMin} min</div>
        </div>
      `);

      const bounds = L.latLngBounds([
        [start.lat, start.lon],
        [dest.lat, dest.lon],
      ]);

      map.fitBounds(bounds.extend(state.routeLine.getBounds()), {
        padding: [30, 30],
      });

      setStatus(`Itinéraire prêt • ${distanceKm} km • ${durationMin} min`);
    } catch (err) {
      console.error(err);
      setStatus("Impossible de calculer l'itinéraire");
      alert("Impossible de calculer l'itinéraire.");
    }
  }

  function openInMaps() {
    if (!state.selectedPoste) {
      alert("Choisis d'abord un poste.");
      return;
    }

    if (!hasValidLatLon(state.selectedPoste)) {
      alert("Coordonnées GPS du poste invalides. Vérifie le CRS source dans services.py.");
      return;
    }

    const dest = state.selectedPoste;
    const ua = navigator.userAgent || "";

    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPad|iPhone|iPod/i.test(ua);

    let appUrl = "";
    let fallbackUrl = "";

    if (isAndroid) {
      appUrl = `google.navigation:q=${dest.lat},${dest.lon}`;
      fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lon}&travelmode=driving`;

      if (state.userLocation) {
        fallbackUrl = `https://www.google.com/maps/dir/?api=1&origin=${state.userLocation.lat},${state.userLocation.lon}&destination=${dest.lat},${dest.lon}&travelmode=driving`;
      }

      window.location.href = appUrl;

      setTimeout(() => {
        window.location.href = fallbackUrl;
      }, 1200);

      return;
    }

    if (isIOS) {
      appUrl = `maps://?daddr=${dest.lat},${dest.lon}&dirflg=d`;
      fallbackUrl = `https://maps.apple.com/?daddr=${dest.lat},${dest.lon}&dirflg=d`;

      if (state.userLocation) {
        appUrl = `maps://?saddr=${state.userLocation.lat},${state.userLocation.lon}&daddr=${dest.lat},${dest.lon}&dirflg=d`;
        fallbackUrl = `https://maps.apple.com/?saddr=${state.userLocation.lat},${state.userLocation.lon}&daddr=${dest.lat},${dest.lon}&dirflg=d`;
      }

      window.location.href = appUrl;

      setTimeout(() => {
        window.location.href = fallbackUrl;
      }, 1200);

      return;
    }

    fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lon}&travelmode=driving`;

    if (state.userLocation) {
      fallbackUrl = `https://www.google.com/maps/dir/?api=1&origin=${state.userLocation.lat},${state.userLocation.lon}&destination=${dest.lat},${dest.lon}&travelmode=driving`;
    }

    window.open(fallbackUrl, "_blank");
  }

  let timer = null;
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim();
    clearTimeout(timer);

    if (!q) {
      searchResults.innerHTML = "";
      resultCount.textContent = "0";
      return;
    }

    timer = setTimeout(async () => {
      try {
        const results = await fetchSearch(q);
        renderSearchResults(results);
      } catch (err) {
        console.error(err);
        searchResults.innerHTML = "";
      }
    }, 250);
  });

  document.addEventListener("click", (e) => {
    if (!searchResults.contains(e.target) && e.target !== searchInput) {
      searchResults.innerHTML = "";
    }
  });

  locateBtn?.addEventListener("click", locateUser);
  routeBtn?.addEventListener("click", drawRoute);
  startBtn?.addEventListener("click", openInMaps);

  resultCount.textContent = "0";
  setActionState();
  setStatus("Prête");
})();