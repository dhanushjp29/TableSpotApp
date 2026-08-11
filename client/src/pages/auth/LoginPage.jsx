import { useState, useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";

import { loginUser, googleLoginUser } from "../../store/slices/authSlice.js";
import { ROUTES } from "../../routes/routeConstants.js";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import AuthFooter from "../../components/ui/AuthFooter.jsx";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

// Decode Google JWT credential to extract user info
const decodeGoogleCredential = (credential) => {
  try {
    const payload = credential.split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return {
      email: decoded.email,
      fullName: decoded.name,
      providerId: decoded.sub,
      profileImage: decoded.picture,
    };
  } catch {
    return null;
  }
};

function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const googleButtonRef = useRef(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const handleRedirect = (userRole) => {
    const from = location.state?.from?.pathname;
    const rolePath =
      userRole === "owner"
        ? ROUTES.OWNER_DASHBOARD
        : userRole === "admin"
          ? ROUTES.ADMIN_DASHBOARD
          : ROUTES.CUSTOMER_DASHBOARD;
    navigate(from || rolePath, { replace: true });
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const response = await dispatch(loginUser(data));
      const userRole = response?.data?.data?.user?.role || response?.data?.user?.role;
      toast.success(response?.data?.message || "Login successful!");
      handleRedirect(userRole);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleCredential = async (response) => {
    const userInfo = decodeGoogleCredential(response.credential);
    if (!userInfo) {
      toast.error("Google login failed. Please try again.");
      return;
    }

    setIsGoogleLoading(true);
    try {
      const result = await dispatch(googleLoginUser(userInfo));
      const userRole = result?.data?.data?.user?.role || result?.data?.user?.role;
      toast.success(result?.data?.message || "Google login successful!");
      handleRedirect(userRole);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Google login failed.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Initialize Google Identity Services
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || !googleButtonRef.current) return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google && window.google.accounts) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredential,
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
          width: "100%",
          text: "continue_with",
          shape: "pill",
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="card p-8">
        <h1 className="text-2xl font-bold text-text">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Sign in to your TableSpot account.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register("password")}
          />
          <div className="flex items-center justify-between text-sm">
            <Link to={ROUTES.FORGOT_PASSWORD} className="text-primary hover:text-primary-dark">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" className="w-full" isLoading={isSubmitting} loadingText="Logging in...">
            Login
          </Button>
        </form>

        {/* Google Login */}
        {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
          <>
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-100" />
              <span className="text-xs text-muted">OR</span>
              <div className="h-px flex-1 bg-gray-100" />
            </div>
            <div className="flex justify-center" ref={googleButtonRef}>
              {isGoogleLoading && (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Signing in with Google...
                </div>
              )}
            </div>
          </>
        )}

        <p className="mt-6 text-center text-sm text-muted">
          Don't have an account?{" "}
          <Link to={ROUTES.REGISTER} className="font-medium text-primary hover:text-primary-dark">
            Register
          </Link>
        </p>
      </div>

      <AuthFooter />
    </>
  );
}

export default LoginPage;
