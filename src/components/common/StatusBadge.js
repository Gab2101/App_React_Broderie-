// src/components/common/StatusBadge.jsx
import React from "react";
import { getStatusTheme } from "../../utils/statusTheme";

function StatusBadge({ statut, size = "md" }) {
  const t = getStatusTheme(statut);
  const paddings = { sm: "2px 6px", md: "4px 10px", lg: "6px 12px" };
  const fontSizes = { sm: 11, md: 12, lg: 13 };

  return (
    <span
      className="status-badge"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: paddings[size] || paddings.md,
        fontSize: fontSizes[size] || fontSizes.md,
        fontWeight: 600,
        borderRadius: 999,
        backgroundColor: t.bgSoft,
        color: t.text,
        border: `1px solid ${t.border}`,
        lineHeight: 1.2,
      }}
      title={`Statut : ${statut}`}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          backgroundColor: t.border,
          display: "inline-block",
        }}
      />
      {statut || "—"}
    </span>
  );
}

export default StatusBadge;
