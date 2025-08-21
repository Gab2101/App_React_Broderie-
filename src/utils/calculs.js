// utils/calculs.js
function toNumber(v, def = 0) {
  if (v === null || v === undefined || v === "") return def;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : def;
}
function ceilWithEpsilon(x, eps = 1e-9) {
  return Math.ceil(x - eps);
}

/**
 * vitesse = points/minute (PPM)
 * nbTetes = têtes actives (≤ quantite)
 * nettoyageParArticleSec = secondes par article
 */
export function calculerDurees({
  quantite,
  points,
  vitesse,
  nbTetes,
  nettoyageParArticleSec,
}) {
  const qte = Math.max(0, Math.floor(toNumber(quantite, 0)));
  const pts = Math.max(0, Math.floor(toNumber(points, 0)));        // points par article
  const vitPPM = Math.max(1, toNumber(vitesse, 680));               // pts/min
  const nbTetesEff = Math.max(1, Math.floor(toNumber(nbTetes, 1)));
  const nettoyageSec = Math.max(0, Math.floor(toNumber(nettoyageParArticleSec, 0)));

  const effectiveHeads = Math.max(1, Math.min(nbTetesEff, Math.max(1, qte)));

  const pointsTotaux = qte * pts;                                   // points totaux
  const vitesseEffectivePPM = vitPPM * effectiveHeads;              // pts/min

  const dureeBroderieMinutes = pointsTotaux / vitesseEffectivePPM;  // min
  const dureeBroderieHeures = dureeBroderieMinutes / 60;            // h

  const dureeNettoyageHeures = (qte * nettoyageSec) / 3600;         // h

  const dureeTotaleHeures = dureeBroderieHeures + dureeNettoyageHeures;
  const dureeTotaleMs = Math.round(dureeTotaleHeures * 3600 * 1000);

  return {
    dureeBroderieHeures,
    dureeNettoyageHeures,
    dureeTotaleHeures,
    dureeTotaleMs,                                // 👈 à utiliser pour endMs
    dureeTotaleHeuresArrondie: ceilWithEpsilon(dureeTotaleHeures),
  };
}

// utils/time
export const ONE_HOUR_MS = 60 * 60 * 1000;

const floorToHour = (dateMs) => {
  const d = new Date(dateMs);
  d.setMinutes(0, 0, 0);
  return d.getTime();
};

const ceilToHour = (dateMs) => {
  const floored = floorToHour(dateMs);
  return (dateMs === floored) ? floored : (floored + ONE_HOUR_MS);
};

// Intervalle demi-ouvert [startHour, endHour[
export const hoursSpanAligned = (startMs, endMs) => {
  const startHour = floorToHour(startMs);
  const endHour = ceilToHour(endMs);
  const span = Math.max(0, endHour - startHour);
  return {
    startHour,
    endHour,
    slotsCount: span / ONE_HOUR_MS,             // pas de ceil/floor ici
  };
};
