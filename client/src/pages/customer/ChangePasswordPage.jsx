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

const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(6, "Current password is required."),
    newPassword: z
      .string()
      .min(6, "New password must be at least 6 characters."),
    confirmPassword: z.string().min(6, "Please confirm your new password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

function ChangePasswordPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const response = await authApi.changePassword({
        oldPassword: data.oldPassword,
        newPassword: data.newPassword,
      });
      toast.success(response?.message || "Password changed successfully!");
      reset();
      navigate(ROUTES.CUSTOMER_PROFILE, { replace: true });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to change password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">Change Password</h1>
        <p className="mt-1 text-sm text-muted">
          Update your password to keep your account secure.
        </p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            label="Current Password"
            type="password"
            placeholder="••••••••"
            error={errors.oldPassword?.message}
            {...register("oldPassword")}
          />
          <Input
            label="New Password"
            type="password"
            placeholder="••••••••"
            error={errors.newPassword?.message}
            {...register("newPassword")}
          />
          <Input
            label="Confirm New Password"
            type="password"
            placeholder="••••••••"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              isLoading={isSubmitting}
              loadingText="Changing password..."
            >
              Change Password
            </Button>
            <Link to={ROUTES.CUSTOMER_PROFILE}>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ChangePasswordPage;
