import type { ButtonHTMLAttributes, Ref } from "react";

type Variant = "primary" | "secondary" | "danger" | "danger-outline";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent/85 active:bg-accent/75",
  secondary: "border border-line bg-card text-fg hover:bg-hover active:bg-line",
  // Confirming a destructive action.
  danger: "bg-danger text-white hover:bg-danger/85 active:bg-danger/75",
  // Starting a destructive action (opens a confirmation).
  "danger-outline": "border border-danger/50 bg-transparent text-danger hover:bg-danger/10 active:bg-danger/15",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({ variant = "secondary", className = "", type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}
