// src/Pages/Admin/Planning/PlanningDayView.jsx
import React, { useMemo } from "react";
import "./PlanningDayView.css";
import { WORKDAY, floorToHour, ceilToHour } from "../../../utils/time";

export default function PlanningDayView({
  date,
  machines = [],
  commandes = [],
  onOpenCommande,
  // Par défaut, on se cale sur la journée de travail standard
  workStart = WORKDAY.start,
  workEnd = WORKDAY.end,
}) {
  // Date normalisée
  const day = useMemo(() => {
    if (date instanceof Date && !isNaN(date)) return new Date(date.getTime());
    const d = date ? new Date(date) : new Date();
    return isNaN(d) ? new Date() : d;
  }, [date]);

  // Créneaux (heures pleines)
  const slots = useMemo(() => {
    const arr = [];
    for (let h = workStart; h < workEnd; h++) arr.push(h);
    return arr;
  }, [workStart, workEnd]);

  // Bornes de la journée affichée
  const { startOfDay, endOfDay } = useMemo(() => {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), workStart, 0, 0, 0);
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), workEnd, 0, 0, 0);
    return { startOfDay: floorToHour(start), endOfDay: ceilToHour(end) };
  }, [day, workStart, workEnd]);

  // Chevauchement [s, e) avec [slotStart, slotEnd)
  const overlaps = (s, e, slotStart, slotEnd) => s < slotEnd && e > slotStart;

  // Regrouper les commandes par machine, limitées à la journée
  const ordersByMachineForDay = useMemo(() => {
    const map = new Map();
    for (const c of commandes || []) {
      if (!c?.start || !c?.end) continue; // start/end doivent être des Date (mappées côté parent)
      if (c.start < endOfDay && c.end > startOfDay) {
        const list = map.get(c.machineId) || [];
        list.push(c);
        map.set(c.machineId, list);
      }
    }
    // Tri pour stabilité d'affichage
    for (const [k, list] of map) {
      list.sort((a, b) => a.start - b.start || String(a.id).localeCompare(String(b.id)));
      map.set(k, list);
    }
    return map;
  }, [commandes, startOfDay, endOfDay]);

  // Helper: extraire uniquement le nom du client depuis o.title (ex: "Client — REF" -> "Client")
  const getClientLabel = (o) => {
    if (o?.client) return o.client;
    const t = o?.title ?? "";
    const idx = typeof t === "string" ? t.indexOf("—") : -1;
    return idx > -1 ? t.slice(0, idx).trim() : t;
  };

  return (
    <div className="planning-day">
      {/* Tableau jour UNIQUEMENT (pas de boutons/legend ici) */}
      <div className="dayview-table-container">
        <table className="dayview-table">
          <thead>
            <tr>
              <th className="machine-header">Machines</th>
              {slots.map((h) => (
                <th
                  key={h}
                  className={`hour-header ${h === WORKDAY.lunchStart ? "lunch-hour" : ""}`}
                >
                  {String(h).padStart(2, "0")}–{String(h + 1).padStart(2, "0")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => {
              const machineName = m.name ?? m.nom ?? `Machine ${m.id}`;
              const machineOrders = ordersByMachineForDay.get(m.id) || [];

              return (
                <tr key={m.id}>
                  <td className="machine-col">{machineName}</td>

                  {slots.map((h) => {
                    const slotStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 0, 0, 0);
                    const slotEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h + 1, 0, 0, 0);
                    const isLunch = h === WORKDAY.lunchStart;

                    const orders = isLunch
                      ? []
                      : machineOrders.filter((o) => overlaps(o.start, o.end, slotStart, slotEnd));

                    return (
                      <td
                        key={`${m.id}:${h}`}
                        className={`slot-cell ${isLunch ? "lunch" : orders.length === 0 ? "empty" : ""}`}
                      >
                        {isLunch ? (
                          <div className="pause">Pause</div>
                        ) : orders.length === 0 ? (
                          <div className="empty-dash">—</div>
                        ) : (
                          <div className="orders-list">
                            {orders.slice(0, 3).map((o) => {
                              const label = getClientLabel(o);
                              const borderColor = o?.color || "#000"; // même couleur que le planning général si transmise
                              return (
                                <span
                                  key={o.id}
                                  onClick={() => onOpenCommande?.(o.id)}
                                  className="order-badge"
                                  style={{
                                    border: "2px solid",
                                    borderColor,
                                    borderRadius: 10,
                                    background: "#fff",
                                    padding: "6px 8px",
                                    fontSize: 12,
                                    lineHeight: 1,
                                    maxWidth: 180,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    cursor: "pointer",
                                  }}
                                  title={`${label}\n${o.start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} – ${o.end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                                  role="button"
                                  tabIndex={0}
                                >
                                  {label}
                                </span>
                              );
                            })}
                            {orders.length > 3 && (
                              <span className="more-orders">+{orders.length - 3}</span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
