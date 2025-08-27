export const parseISOAny = (v) => {
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const noTZ = !/[Zz]|[+-]\d{2}:\d{2}$/.test(v);
    return new Date(noTZ ? v + "Z" : v);
  }
  return new Date(v);
};
