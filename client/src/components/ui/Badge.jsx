const badgeVariants = {
  success: "badge-success",
  error: "badge-error",
  danger: "badge-error",
  warning: "badge-warning",
  info: "badge-info",
  neutral: "badge-default",
  primary: "badge-primary",
};

function Badge({ children, variant = "neutral", className = "" }) {
  return (
    <span className={`badge ${badgeVariants[variant] || badgeVariants.neutral} ${className}`}>
      {children}
    </span>
  );
}

export default Badge;
