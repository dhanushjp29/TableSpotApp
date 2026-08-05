import { Component } from "react";
import { AlertTriangle } from "lucide-react";

import Button from "../ui/Button.jsx";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
          <AlertTriangle size={48} className="text-error" />
          <h1 className="mt-4 text-2xl font-bold text-text">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <Button
            className="mt-4"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
