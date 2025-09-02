/**
 * Calcule automatiquement le niveau d'urgence basé sur la date de livraison
 * @param {string} dateLivraison - Date de livraison
 * @returns {number} Niveau d'urgence (1-5)
 */
export const calculateUrgency = (dateLivraison) => {
  if (!dateLivraison) return 1;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const livraison = new Date(dateLivraison);
  livraison.setHours(0, 0, 0, 0);
  
  const diffTime = livraison.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 2) return 5;
  if (diffDays < 5) return 4;
  if (diffDays < 10) return 3;
  if (diffDays < 15) return 2;
  return 1;
};

export const getUrgencyColor = (level) => {
  const urgencyColors = {
    1: "#4caf50",
    2: "#2196f3",
    3: "#ff9800",
    4: "#f44336",
    5: "#000000",
  };
  return urgencyColors[level] || "#000000";
};

export const getColorFromId = (id) => {
  const colors = [
    "#E3F2FD", "#FFF9C4", "#FFECB3", "#F8BBD0", "#D1C4E9",
    "#C8E6C9", "#B3E5FC", "#FFE0B2", "#F0F4C3", "#FFCDD2",
    "#D7CCC8", "#C5CAE9", "#E0F7FA", "#FFF3E0",
  ];
  const index = parseInt(String(id), 36) % colors.length;
  return colors[index];
};

// Alias pour compatibilité
export const computeUrgency = calculateUrgency;

export const sortByPriority = (a, b) => {
  const au = !!a.urgent;
  const bu = !!b.urgent;
  if (au !== bu) return au ? -1 : 1;
  const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
  const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
  if (da !== db) return da - db;
  const ca = a.created_at ? new Date(a.created_at).getTime() : Infinity;
  const cb = b.created_at ? new Date(b.created_at).getTime() : Infinity;
  return ca - cb;
};
