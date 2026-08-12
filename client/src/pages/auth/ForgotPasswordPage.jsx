import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";

import { authApi } from "../../api/auth.api.js";
import { ROUTES } from "../../routes/routeConstants.js";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const response = await authApi.forgotPassword(data);
      toast.success(response?.message || "Reset code sent to your email.");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to send reset code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card p-8">
      <h1 className="text-2xl font-bold text-text">Forgot Password</h1>
      <p className="mt-1 text-sm text-muted">
        Enter your email and we'll send you a reset code.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <Button type="submit" className="w-full" isLoading={isSubmitting} loadingText="Sending...">
          Send Reset Code
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

export default ForgotPasswordPage;
