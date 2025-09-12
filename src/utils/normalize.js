export function normLabel(s = "") {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // retire accents
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[-_]/g, "-")
    .trim();
}
