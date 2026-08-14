import { useState, useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Mail, ArrowRight } from "lucide-react";

import { loginUser, googleLoginUser } from "../../store/slices/authSlice.js";
import { ROUTES } from "../../routes/routeConstants.js";
import { QUICK_LOGIN_ACCOUNTS } from "../../constants/quickLogin.js";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import PasswordInput from "../../components/ui/PasswordInput.jsx";
import AuthFooter from "../../components/ui/AuthFooter.jsx";
import AuthHero from "../../components/auth/AuthHero.jsx";
import { useTheme } from "../../hooks/useTheme.js";

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
  const { resolvedTheme } = useTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [quickRole, setQuickRole] = useState(null);
  const googleButtonRef = useRef(null);

  const {
    register,
    handleSubmit,
    setValue,
    trigger,
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

  // Bind a pre-saved account into the form and run the existing login flow.
  const handleQuickLogin = async (account) => {
    if (isSubmitting) return;
    setQuickRole(account.role);
    setValue("email", account.email);
    setValue("password", account.password);
    const valid = await trigger();
    if (valid) handleSubmit(onSubmit)();
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

  const logo = resolvedTheme === "dark" ? "/authtop_dark.png" : "/authtop_light.png";

  return (
    <>
      <div className="auth-page auth-page--login relative z-10 flex flex-1">
        <div className="auth-hero-layout relative z-10 mx-auto grid w-full max-w-7xl flex-1 items-center gap-10 px-4 py-12 sm:px-6 lg:gap-14 lg:px-8">
          <AuthHero />

          <div className="auth-enter auth-card-wrap mx-auto w-full max-w-md">
            <div className="auth-card">
              <div className="flex items-center gap-3">
                <img src={logo} alt="TableSpot" className="h-10 w-auto object-contain" />
              </div>
              <p className="auth-eyebrow">Secure access</p>
              <h1 className="mt-2 text-2xl font-bold text-text">Welcome back</h1>
              <p className="mt-1 text-sm text-muted">Sign in to your TableSpot account.</p>

              <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
                <Input
                  label="Email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  leftIcon={<Mail size={17} aria-hidden="true" />}
                  error={errors.email?.message}
                  {...register("email")}
                />
                <PasswordInput
                  label="Password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  error={errors.password?.message}
                  {...register("password")}
                />
                <div className="flex items-center justify-between text-sm">
                  <Link to={ROUTES.FORGOT_PASSWORD} className="font-medium text-primary transition-colors hover:text-primary-dark">
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
                  <div className="auth-divider">
                    <span>or continue with</span>
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

              <div data-joyride="quick-login">
                <div className="auth-divider"><span>quick login</span></div>
                <div className="grid grid-cols-3 gap-2.5">
                  {QUICK_LOGIN_ACCOUNTS.map((account) => {
                    const Icon = account.icon;
                    const active = quickRole === account.role;
                    return (
                      <button key={account.role} type="button" onClick={() => handleQuickLogin(account)} disabled={isSubmitting} aria-label={`Quick login as ${account.label}`} className={`auth-quick-btn ${active ? "is-active" : ""}`}>
                        <Icon size={16} aria-hidden="true" />
                        <span>{account.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="mt-6 text-center text-sm text-muted">
                Don't have an account?{" "}
                <Link to={ROUTES.REGISTER} className="inline-flex items-center gap-1 font-semibold text-primary transition-colors hover:text-primary-dark">
                  Register <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <AuthFooter />
    </>
  );
}

export default LoginPage;
