// src/Pages/Admin/Planning/PlanningDayView.jsx
import React, { useMemo, useEffect } from "react";
import "./PlanningDayView.css"; // ← styles dédiés

export default function PlanningDayView({
  date,
  machines = [],
  commandes = [],
  onBack,
  onPrevDay,
  onNextDay,
  onOpenCommande,
  workStart = 8,
  workEnd = 17,
}) {
  const day = useMemo(() => {
    if (date instanceof Date && !isNaN(date)) return date;
    const d = date ? new Date(date) : new Date();
    return isNaN(d) ? new Date() : d;
  }, [date]);

  const slots = useMemo(() => {
    const arr = [];
    for (let h = workStart; h < workEnd; h++) arr.push(h);
    return arr;
  }, [workStart, workEnd]);

  const formatDateFR = (d) =>
    d.toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const overlaps = (s, e, slotStart, slotEnd) => s < slotEnd && e > slotStart;

  const ordersForDay = useMemo(() => {
    const startOfDay = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      workStart,
      0,
      0,
      0
    );
    const endOfDay = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      workEnd,
      0,
      0,
      0
    );
    return (commandes || []).filter(
      (c) => c?.start && c?.end && c.start < endOfDay && c.end > startOfDay
    );
  }, [commandes, day, workStart, workEnd]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft") onPrevDay?.();
      if (e.key === "ArrowRight") onNextDay?.();
      if (e.key === "Escape") onBack?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPrevDay, onNextDay, onBack]);

  return (
    <div className="planning-day">
      {/* Barre de navigation */}
      <div className="dayview-nav">
        <button onClick={onBack}>Retour au tableau</button>
        <div className="dayview-nav-center">
          <button onClick={onPrevDay}>Jour précédent</button>
          <div className="dayview-date">{formatDateFR(day)}</div>
          <button onClick={onNextDay}>Jour suivant</button>
        </div>
        <div className="dayview-nav-right" />
      </div>

      {/* Tableau jour */}
      <div className="dayview-table-container">
        <table className="dayview-table">
          <thead>
            <tr>
              <th className="machine-header">Machines</th>
              {slots.map((h) => (
                <th
                  key={h}
                  className={`hour-header ${h === 12 ? "lunch-hour" : ""}`}
                >
                  {String(h).padStart(2, "0")}–{String(h + 1).padStart(2, "0")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.id}>
                <td className="machine-col">
                  {m.name ?? m.nom ?? `Machine ${m.id}`}
                </td>
                {slots.map((h) => {
                  const slotStart = new Date(
                    day.getFullYear(),
                    day.getMonth(),
                    day.getDate(),
                    h,
                    0,
                    0,
                    0
                  );
                  const slotEnd = new Date(
                    day.getFullYear(),
                    day.getMonth(),
                    day.getDate(),
                    h + 1,
                    0,
                    0,
                    0
                  );
                  const isLunch = h === 12;
                  const orders = ordersForDay.filter(
                    (o) =>
                      o.machineId === m.id &&
                      overlaps(o.start, o.end, slotStart, slotEnd)
                  );

                  return (
                    <td
                      key={`${m.id}:${h}`}
                      className={`slot-cell ${
                        isLunch ? "lunch" : orders.length === 0 ? "empty" : ""
                      }`}
                    >
                      {isLunch ? (
                        <div className="pause">Pause</div>
                      ) : orders.length === 0 ? (
                        <div className="empty-dash">—</div>
                      ) : (
                        <div className="orders-list">
                          {orders.slice(0, 3).map((o) => (
                            <span
                              key={o.id}
                              onClick={() => onOpenCommande?.(o.id)}
                              className={`order-badge ${
                                o.status === "En cours"
                                  ? "en-cours"
                                  : o.status === "A commencer"
                                  ? "a-commencer"
                                  : "autre"
                              } ${
                                o.urgentLevel === "high"
                                  ? "urgent-high"
                                  : o.urgentLevel === "medium"
                                  ? "urgent-medium"
                                  : ""
                              }`}
                              title={`${o.title}\n${o.start.toLocaleTimeString(
                                "fr-FR",
                                { hour: "2-digit", minute: "2-digit" }
                              )} – ${o.end.toLocaleTimeString("fr-FR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`}
                            >
                              {o.title}
                            </span>
                          ))}
                          {orders.length > 3 && (
                            <span className="more-orders">
                              +{orders.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
