import { useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";

import { registerUser } from "../../store/slices/authSlice.js";
import { ROUTES } from "../../routes/routeConstants.js";
import { USER_ROLE } from "../../constants/roles.js";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import Select from "../../components/ui/Select.jsx";

const registerSchema = z
  .object({
    fullName: z.string().min(2, "Full name is required."),
    email: z.string().email("Enter a valid email address."),
    phoneNumber: z.string().min(10, "Enter a valid phone number."),
    password: z.string().min(6, "Password must be at least 6 characters."),
    role: z.enum([USER_ROLE.CUSTOMER, USER_ROLE.OWNER]),
  })
  .strict();

function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: USER_ROLE.CUSTOMER,
    },
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const response = await dispatch(registerUser(data));
      toast.success(response?.data?.message || "Registration successful! Please verify your email.");
      navigate(ROUTES.VERIFY_EMAIL, {
        state: { email: data.email },
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Registration failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card p-8">
      <h1 className="text-2xl font-bold text-text">Create your account</h1>
      <p className="mt-1 text-sm text-muted">Join TableSpot today.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <Input
          label="Full Name"
          placeholder="John Doe"
          error={errors.fullName?.message}
          {...register("fullName")}
        />
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <Input
          label="Phone Number"
          type="tel"
          placeholder="+91 98765 43210"
          error={errors.phoneNumber?.message}
          {...register("phoneNumber")}
        />
        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register("password")}
        />
        <Select
          label="I want to"
          error={errors.role?.message}
          {...register("role")}
        >
          <option value={USER_ROLE.CUSTOMER}>Book tables as a customer</option>
          <option value={USER_ROLE.OWNER}>Manage a restaurant as an owner</option>
        </Select>

        <Button type="submit" className="w-full" isLoading={isSubmitting} loadingText="Creating account...">
          Register
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link to={ROUTES.LOGIN} className="font-medium text-primary hover:text-primary-dark">
          Login
        </Link>
      </p>
    </div>
  );
}

export default RegisterPage;
