import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

import Input from "./Input.jsx";

function PasswordInput({
  label = "Password",
  leftIcon,
  id,
  className = "",
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || props.name;

  return (
    <Input
      id={inputId}
      label={label}
      type={showPassword ? "text" : "password"}
      leftIcon={leftIcon || <Lock size={17} aria-hidden="true" />}
      rightIcon={
        <button
          type="button"
          onClick={() => setShowPassword((s) => !s)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          tabIndex={0}
        >
          {showPassword ? (
            <EyeOff size={17} aria-hidden="true" />
          ) : (
            <Eye size={17} aria-hidden="true" />
          )}
        </button>
      }
      className={className}
      {...props}
    />
  );
}

export default PasswordInput;
