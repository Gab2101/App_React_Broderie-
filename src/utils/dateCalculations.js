// src/utils/dateCalculations.js
// Pure date calculation functions - extracted from form hooks for separation of concerns
// Business logic separated from UI state management

/**
 * Force a date to be at midnight in the local timezone (Europe/Paris)
 * @param {Date|string} dateLike - Date to convert
 * @returns {Date} Date object at midnight local time
 */
export function toMidnightLocal(dateLike) {
  const d = new Date(dateLike);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Calculate delivery urgency based on delivery date
 * @param {Date|string} deliveryDate - Delivery date
 * @returns {number} Urgency level (1-5)
 */
export function calculateUrgencyFromDeliveryDate(deliveryDate) {
  if (!deliveryDate) return 3; // Default medium priority

  const selectedDate = toMidnightLocal(deliveryDate);
  const today = toMidnightLocal(new Date());

  // Calculate difference in calendar days
  const diffDays = Math.ceil((selectedDate - today) / (1000 * 60 * 60 * 24));

  // Determine urgency level
  if (diffDays < 2) return 5; // Very urgent
  if (diffDays < 5) return 4; // Urgent
  if (diffDays < 10) return 3; // Normal
  if (diffDays < 15) return 2; // Low priority
  return 1; // Very low priority
}

/**
 * Calculate delivery date and urgency from date input
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {Object} { date: Date, urgence: number }
 */
export function calculateDeliveryDateAndUrgency(dateString) {
  if (!dateString) {
    return { date: "", urgence: 3 };
  }

  const deliveryDate = toMidnightLocal(dateString);
  const urgence = calculateUrgencyFromDeliveryDate(deliveryDate);

  return {
    date: dateString, // Keep string format for form input
    urgence
  };
}

/**
 * Get human-readable urgency description
 * @param {number} urgencyLevel - Urgency level (1-5)
 * @returns {string} Human description
 */
export function getUrgencyDescription(urgencyLevel) {
  const descriptions = {
    1: "Très faible priorité",
    2: "Priorité faible",
    3: "Priorité normale",
    4: "Urgent",
    5: "Très urgent"
  };
  return descriptions[urgencyLevel] || "Priorité inconnue";
}

/**
 * Check if a date is overdue
 * @param {Date|string} deliveryDate - Delivery date
 * @returns {boolean} True if overdue
 */
export function isOverdue(deliveryDate) {
  if (!deliveryDate) return false;

  const delivery = toMidnightLocal(deliveryDate);
  const today = toMidnightLocal(new Date());

  return delivery < today;
}

/**
 * Get days until delivery
 * @param {Date|string} deliveryDate - Delivery date
 * @returns {number} Days until delivery (negative if overdue)
 */
export function getDaysUntilDelivery(deliveryDate) {
  if (!deliveryDate) return 0;

  const delivery = toMidnightLocal(deliveryDate);
  const today = toMidnightLocal(new Date());

  return Math.ceil((delivery - today) / (1000 * 60 * 60 * 24));
}
