import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";

import { authApi } from "../../api/auth.api.js";
import { ROUTES } from "../../routes/routeConstants.js";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";

const resetPasswordSchema = z
  .object({
    email: z.string().email("Enter a valid email address."),
    otp: z.string().min(4, "Enter the OTP sent to your email."),
    newPassword: z.string().min(6, "Password must be at least 6 characters."),
  })
  .strict();

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const response = await authApi.resetPassword(data);
      toast.success(response?.message || "Password reset successfully!");
      navigate(ROUTES.LOGIN);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to reset password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card p-8">
      <h1 className="text-2xl font-bold text-text">Reset Password</h1>
      <p className="mt-1 text-sm text-muted">
        Enter your email, the OTP you received, and a new password.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <Input
          label="OTP Code"
          placeholder="Enter OTP"
          error={errors.otp?.message}
          {...register("otp")}
        />
        <Input
          label="New Password"
          type="password"
          placeholder="••••••••"
          error={errors.newPassword?.message}
          {...register("newPassword")}
        />
        <Button type="submit" className="w-full" isLoading={isSubmitting} loadingText="Resetting...">
          Reset Password
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Remembered your password?{" "}
        <Link to={ROUTES.LOGIN} className="font-medium text-primary hover:text-primary-dark">
          Login
        </Link>
      </p>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
