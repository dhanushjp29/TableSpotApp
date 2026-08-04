import { AlertTriangle } from "lucide-react";
import Button from "./Button.jsx";

function ErrorState({
  title = "Something went wrong",
  description = "An unexpected error occurred. Please try again.",
  onRetry = null,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="mb-4 rounded-full bg-red-50 p-4">
        <AlertTriangle size={32} className="text-error" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-text">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      )}
      {onRetry && (
        <div className="mt-5">
          <Button variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}

export default ErrorState;
