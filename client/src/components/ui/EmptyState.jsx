import { PackageOpen } from "lucide-react";

function EmptyState({
  title = "No data found",
  description = "",
  action = null,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="mb-4 rounded-full bg-gray-100 p-4">
        <PackageOpen size={32} className="text-muted" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-text">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export default EmptyState;
