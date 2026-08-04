const badgeVariants = {
  success: "bg-green-100 text-success",
  error: "bg-red-100 text-error",
  warning: "bg-amber-100 text-accent",
  info: "bg-blue-100 text-blue-700",
  neutral: "bg-gray-100 text-muted",
  primary: "bg-primary/10 text-primary",
};

function Badge({ children, variant = "neutral", className = "" }) {
  return (
    <span className={`badge ${badgeVariants[variant]} ${className}`}>
      {children}
    </span>
  );
}

export default Badge;
