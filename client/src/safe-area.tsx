import { createElement, type CSSProperties } from "react";

/**
 * Local replacement for the SDK's SafeAreaTopScrim.
 * Fixed strip covering the device status-bar inset; the gradient variant's
 * extra fade collapses to zero height on desktop.
 */
export function SafeAreaTopScrim({
  variant = "gradient",
  backgroundColor = "#ffffff",
  zIndex = 40,
  className,
  style,
  ...props
}: {
  variant?: "gradient" | "solid" | "blur";
  backgroundColor?: string;
  zIndex?: number;
  className?: string;
  style?: CSSProperties;
  [key: string]: unknown;
}) {
  const mask =
    "linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.99) 10%, rgba(0, 0, 0, 0.96) 20%, rgba(0, 0, 0, 0.90) 30%, rgba(0, 0, 0, 0.80) 40%, rgba(0, 0, 0, 0.67) 50%, rgba(0, 0, 0, 0.52) 60%, rgba(0, 0, 0, 0.36) 70%, rgba(0, 0, 0, 0.20) 80%, rgba(0, 0, 0, 0.08) 90%, rgba(0, 0, 0, 0) 100%)";
  const managedStyle: CSSProperties = {
    ...style,
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex,
    pointerEvents: "none",
    height:
      variant === "gradient"
        ? "calc(env(safe-area-inset-top) + min(2rem, env(safe-area-inset-top)))"
        : "env(safe-area-inset-top)",
    backgroundColor,
  };
  if (variant === "gradient") {
    managedStyle.maskImage = mask;
    (managedStyle as Record<string, string>).WebkitMaskImage = mask;
  } else if (variant === "blur") {
    managedStyle.backdropFilter = "blur(12px)";
    (managedStyle as Record<string, string>).WebkitBackdropFilter = "blur(12px)";
  }
  return createElement("div", {
    ...props,
    "aria-hidden": true,
    className,
    style: managedStyle,
  });
}
