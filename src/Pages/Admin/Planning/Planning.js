import React, { useState, useEffect } from "react";
import "./Planning.css";

function Planning() {
  const [startDate, setStartDate] = useState(new Date());
  const [machines, setMachines] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [planning, setPlanning] = useState([]);

  useEffect(() => {
    const updateAndLoad = async () => {
      const [machinesData, commandesData, planningData] = await Promise.all([
        fetch("http://localhost:3001/machines").then((res) => res.json()),
        fetch("http://localhost:3001/commandes").then((res) => res.json()),
        fetch("http://localhost:3001/planning").then((res) => res.json()),
      ]);

      const now = new Date();

      for (const p of planningData) {
        const commande = commandesData.find((c) => c.id === p.commandeId);
        if (!commande || commande.status === "En cours") continue;

        const debutDate = new Date(p.debut);

        if (debutDate.getTime() < now.getTime()) {
          // Recalage à la prochaine heure entière future
          const newStart = new Date();
          newStart.setHours(newStart.getHours() + 1, 0, 0, 0);
          const dureeMs = new Date(p.fin) - new Date(p.debut);
          const newEnd = new Date(newStart.getTime() + dureeMs);

          await fetch(`http://localhost:3001/planning/${p.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...p,
              debut: newStart.toISOString(),
              fin: newEnd.toISOString(),
            }),
          });
        }
      }

      setMachines(machinesData);
      setCommandes(commandesData);
      setPlanning(await fetch("http://localhost:3001/planning").then((res) => res.json()));
    };

    updateAndLoad();
  }, []);

  const generateRows = () => {
    const rows = [];
    for (let i = 0; i < 14; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      for (let h = 8; h <= 17; h++) {
        const hour = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate(),
          h,
          0,
          0,
          0
        );
        rows.push({
          label: `${hour.toLocaleDateString()} ${hour.getHours()}h`,
          timestamp: hour.getTime(),
          dayOfWeek: hour.getDay(),
        });
      }
    }
    return rows;
  };

  const rows = generateRows();

  const getColorFromId = (id) => {
    const colors = [
      "#E3F2FD",
      "#FFF9C4",
      "#FFECB3",
      "#F8BBD0",
      "#D1C4E9",
      "#C8E6C9",
      "#B3E5FC",
      "#FFE0B2",
      "#F0F4C3",
      "#FFCDD2",
      "#D7CCC8",
      "#C5CAE9",
      "#E0F7FA",
      "#FFF3E0"
    ];
    const index = parseInt(id, 36) % colors.length;
    return colors[index];
  };

  const urgencyColors = {
    1: "#4caf50",
    2: "#2196f3",
    3: "#ff9800",
    4: "#f44336",
    5: "#000000"
  };

  const computeUrgency = (dateLivraison) => {
    const today = new Date();
    const livraison = new Date(dateLivraison);
    const diffDays = Math.ceil((livraison - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 2) return 5;
    if (diffDays < 5) return 4;
    if (diffDays < 10) return 3;
    if (diffDays < 15) return 2;
    return 1;
  };

  return (
    <div className="planning-page">
      <h2>Planning des machines (vue horaire)</h2>

      <div className="zoom-buttons">
        <button onClick={() => setStartDate(new Date())}>Aujourd’hui</button>
        <button
          onClick={() => {
            const prev = new Date(startDate);
            prev.setDate(prev.getDate() - 14);
            setStartDate(prev);
          }}
        >
          ← Semaine précédente
        </button>
        <button
          onClick={() => {
            const next = new Date(startDate);
            next.setDate(next.getDate() + 14);
            setStartDate(next);
          }}
        >
          Semaine suivante →
        </button>
      </div>

      <div className="planning-table">
        <table>
          <thead>
            <tr>
              <th>Date / Heure</th>
              {machines.map((m) => (
                <th key={m.id}>{m.nom}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td
                  style={{
                    backgroundColor: row.dayOfWeek % 2 === 0 ? "#eee" : "#ccc",
                    fontWeight: "bold",
                    borderLeft:
                      row.timestamp < Date.now()
                        ? "6px solid red"
                        : "1px solid #ddd"
                  }}
                >
                  {row.label}
                </td>
                {machines.map((machine) => {
                  const slot = planning.find((p) => {
                    if (!p.commandeId || p.machineId !== machine.id) return false;
                    const debut = new Date(p.debut);
                    const fin = new Date(p.fin);
                    return (
                      row.timestamp >= debut.getTime() &&
                      row.timestamp < fin.getTime()
                    );
                  });

                  const commandeAssociee = slot
                    ? commandes.find((c) => c.id === slot.commandeId)
                    : null;

                  const estDepassee =
                    slot &&
                    commandeAssociee &&
                    new Date(slot.fin) > new Date(commandeAssociee.dateLivraison);

                  const urgence = estDepassee
                    ? 5
                    : commandeAssociee
                    ? computeUrgency(commandeAssociee.dateLivraison)
                    : 1;

                  return (
                    <td
                      key={machine.id}
                      style={{
                        backgroundColor:
                          slot && commandeAssociee
                            ? getColorFromId(commandeAssociee.id)
                            : "white",
                        color: slot ? "#000" : "",
                        padding: "4px",
                        borderRadius: "4px",
                        borderLeft:
                          slot && commandeAssociee
                            ? `6px solid ${urgencyColors[urgence]}`
                            : "1px solid #ddd"
                      }}
                    >
                      {slot && commandeAssociee ? (
                        <>
                          <strong>#{commandeAssociee.numero}</strong>
                          <br />
                          {commandeAssociee.client}
                          {estDepassee && (
                            <div style={{ color: "red", fontSize: "0.8em", marginTop: "4px" }}>
                              ⚠️ Fin au-delà de la date
                            </div>
                          )}
                        </>
                      ) : (
                        <span style={{ color: "#999" }}>—</span>
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

export default Planning;
