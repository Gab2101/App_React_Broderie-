import React from "react";
import "./Banner.css";
import defaultLogo from "../../assets/images/Logo_pubos.png";

/**
 * Banner – rétro‑compatible.
 * Props:
 * - title?: string (default: "Automatisation du Processus de Broderie")
 * - subtitle?: string
 * - logoSrc?: string (default: defaultLogo)
 * - logoAlt?: string (default: "Logo de la société")
 * - align?: "center" | "left" (default: "center")
 * - size?: "sm" | "md" | "lg" (default: "md")
 * - actions?: React.ReactNode  (ex: <NewButton>…</NewButton>)
 * - className?: string
 */
export default function Banner({
  title = "Automatisation du Processus de Broderie",
  subtitle,
  logoSrc = defaultLogo,
  logoAlt = "Logo de la société",
  align = "center",
  size = "md",
  actions,
  className = "",
}) {
  const h1Id = "banner-title";

  return (
    <header
      className={[
        "banner",
        `banner--${align}`,
        `banner--${size}`,
        className,
      ].join(" ")}
      role="banner"
      aria-labelledby={h1Id}
    >
      {logoSrc && (
        <img
          src={logoSrc}
          alt={logoAlt || ""}      /* si décoratif, passer logoAlt="" */
          className="banner__logo"
          width={80}
          height={80}
          loading="eager"
          decoding="async"
        />
      )}

      <div className="banner__content">
        <h1 id={h1Id} className="banner__title">
          {title}
        </h1>
        {subtitle && <p className="banner__subtitle">{subtitle}</p>}
      </div>

      {actions && <div className="banner__actions">{actions}</div>}
    </header>
  );
}
