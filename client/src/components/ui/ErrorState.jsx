import { AlertTriangle } from "lucide-react";
import Button from "./Button.jsx";

function ErrorState({
  title = "Something went wrong",
  description = "An unexpected error occurred. Please try again.",
  onRetry = null,
}) {
  return (
    <div className="card-theme flex flex-col items-center justify-center px-4 py-14 text-center">
      <div className="mb-5 rounded-2xl border border-error/20 bg-error/10 p-4 shadow-sm">
        <AlertTriangle size={30} className="text-error" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-bold tracking-tight text-text">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted">{description}</p>
      )}
      {onRetry && (
        <div className="mt-6">
          <Button variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}

export default ErrorState;
