// src/utils/statusTheme.js

// Tableau des couleurs par statut
export const STATUS_THEME = {
  "A commencer": {
    bgSoft: "#E3F2FD",
    border: "#64B5F6",
    text: "#0D47A1",
  },
  "En cours": {
    bgSoft: "#FFF3E0",
    border: "#FFB74D",
    text: "#E65100",
  },
  "En pause": {
    bgSoft: "#F3E5F5",
    border: "#CE93D8",
    text: "#6A1B9A",
  },
  "Terminée": {
    bgSoft: "#E8F5E9",
    border: "#81C784",
    text: "#1B5E20",
  },
  "Annulée": {
    bgSoft: "#FFEBEE",
    border: "#B71C21",
    text:  "#B71C21",
  },
  default: {
    bgSoft: "#ECEFF1",
    border: "#B0BEC5",
    text:  "#263238",
  },
};

// ✅ Export nommé *fonction*
export function getStatusTheme(statut) {
  return STATUS_THEME[statut] || STATUS_THEME.default;
}

// (optionnel) export par défaut de la map si tu veux l'utiliser ailleurs
export default STATUS_THEME;
