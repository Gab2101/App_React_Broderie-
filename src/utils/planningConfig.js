// src/utils/planningConfig.js
export function getBusinessHours() {
  return {
    start: import.meta.env.VITE_DAY_START ?? '08:00',
    end: import.meta.env.VITE_DAY_END ?? '17:00',
  }
}

export function shouldSliceByDay() {
  return (import.meta.env.VITE_PLANNING_SLICE_BY_DAY ?? '1') === '1'
}
