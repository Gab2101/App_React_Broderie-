import React from "react";
import "./NewButton.css";

/**
 * NewButton – rétro-compatible avec l'API actuelle.
 *
 * Props:
 * - onClick?: () => void
 * - children?: React.ReactNode
 * - type?: "button" | "submit" | "reset" (default "button")
 * - disabled?: boolean
 * - isLoading?: boolean
 * - variant?: "primary" | "secondary" | "danger" | "ghost" (default "primary")
 * - size?: "sm" | "md" | "lg" (default "md")
 * - fullWidth?: boolean
 * - leftIcon?: React.ReactNode
 * - rightIcon?: React.ReactNode
 * - ariaLabel?: string  // utile si children est une icône seule
 * - className?: string  // classes additionnelles optionnelles
 */
export default function NewButton({
  children,
  onClick,
  type = "button",
  disabled = false,
  isLoading = false,
  variant = "primary",
  size = "md",
  fullWidth = false,
  leftIcon,
  rightIcon,
  ariaLabel,
  className = "",
  ...rest
}) {
  const isDisabled = disabled || isLoading;

  const handleClick = (e) => {
    if (isDisabled) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  const classes = [
    "new-button",
    className,
    fullWidth ? "new-button--full" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      onClick={handleClick}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      aria-label={ariaLabel}
      data-variant={variant}
      data-size={size}
      {...rest}
    >
      {leftIcon && <span className="new-button__icon new-button__icon--left">{leftIcon}</span>}
      <span className="new-button__content">
        {isLoading ? "Chargement…" : children}
      </span>
      {rightIcon && <span className="new-button__icon new-button__icon--right">{rightIcon}</span>}
    </button>
  );
}
