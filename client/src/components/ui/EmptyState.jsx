import { PackageOpen } from "lucide-react";

function EmptyState({
  title = "No data found",
  description = "",
  action = null,
}) {
  return (
    <div className="card-theme flex flex-col items-center justify-center px-4 py-14 text-center">
      <div className="mb-5 rounded-2xl border border-border bg-surface-secondary/80 p-4 shadow-sm">
        <PackageOpen size={30} className="text-primary" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-bold tracking-tight text-text">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export default EmptyState;
