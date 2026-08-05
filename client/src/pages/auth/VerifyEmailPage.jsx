import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";

import { authApi } from "../../api/auth.api.js";
import { ROUTES } from "../../routes/routeConstants.js";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";

const verifyEmailSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  otp: z.string().min(4, "Enter the OTP sent to your email."),
});

function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: {
      email: location.state?.email || "",
    },
  });



  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const response = await authApi.verifyEmail(data);
      toast.success(response?.message || "Email verified successfully!");
      navigate(ROUTES.LOGIN);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Verification failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    const emailValue = getValues("email");
    if (!emailValue) {
      toast.error("Please enter your email first.");
      return;
    }
    setIsResending(true);
    try {
      const response = await authApi.resendOTP({ email: emailValue });
      toast.success(response?.message || "OTP resent.");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to resend OTP.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="card p-8">
      <h1 className="text-2xl font-bold text-text">Verify Your Email</h1>
      <p className="mt-1 text-sm text-muted">
        Enter the OTP we sent to your email to activate your account.
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
        <Button type="submit" className="w-full" isLoading={isSubmitting} loadingText="Verifying...">
          Verify Email
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={handleResend}
          disabled={isResending}
          className="font-medium text-primary hover:text-primary-dark disabled:opacity-50"
        >
          {isResending ? "Resending..." : "Resend OTP"}
        </button>
        <Link to={ROUTES.LOGIN} className="font-medium text-primary hover:text-primary-dark">
          Back to Login
        </Link>
      </div>
    </div>
  );
}

export default VerifyEmailPage;
