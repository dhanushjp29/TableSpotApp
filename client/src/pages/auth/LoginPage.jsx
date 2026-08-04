import { useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";

import { loginUser } from "../../store/slices/authSlice.js";
import { ROUTES } from "../../routes/routeConstants.js";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const response = await dispatch(loginUser(data));
      const userRole = response?.data?.data?.user?.role ||
        response?.data?.user?.role;
      toast.success(response?.data?.message || "Login successful!");
      const from = location.state?.from?.pathname;

      // Redirect based on role
      const rolePath =
        userRole === "owner"
          ? ROUTES.OWNER_DASHBOARD
          : userRole === "admin"
            ? ROUTES.ADMIN_DASHBOARD
            : ROUTES.CUSTOMER_DASHBOARD;

      navigate(from || rolePath, { replace: true });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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

      <p className="mt-6 text-center text-sm text-muted">
        Don't have an account?{" "}
        <Link to={ROUTES.REGISTER} className="font-medium text-primary hover:text-primary-dark">
          Register
        </Link>
      </p>
    </div>
  );
}

export default LoginPage;
