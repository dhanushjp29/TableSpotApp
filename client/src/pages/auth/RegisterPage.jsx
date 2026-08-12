import { useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { ArrowLeft, Mail, Phone, Shield, User } from "lucide-react";

import { registerUser } from "../../store/slices/authSlice.js";
import { ROUTES } from "../../routes/routeConstants.js";
import { USER_ROLE } from "../../constants/roles.js";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import PasswordInput from "../../components/ui/PasswordInput.jsx";
import Select from "../../components/ui/Select.jsx";
import AuthFooter from "../../components/ui/AuthFooter.jsx";
import AuthHero from "../../components/auth/AuthHero.jsx";
import { useTheme } from "../../hooks/useTheme.js";

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
  const { resolvedTheme } = useTheme();
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

  const logo = resolvedTheme === "dark" ? "/authtop_dark.png" : "/authtop_light.png";

  return (
    <>
      <div className="auth-page auth-page--register relative z-10 flex flex-1">
        <div className="auth-hero-layout relative z-10 mx-auto grid w-full max-w-7xl flex-1 items-center gap-10 px-4 py-12 sm:px-6 lg:gap-14 lg:px-8">
          <div className="auth-enter auth-card-wrap mx-auto w-full max-w-md">
            <div className="auth-card">
              <div className="flex items-center gap-3">
                <img src={logo} alt="TableSpot" className="h-10 w-auto object-contain" />
              </div>
              <p className="auth-eyebrow">Join the table</p>
              <h1 className="mt-2 text-2xl font-bold text-text">Create your account</h1>
              <p className="mt-1 text-sm text-muted">Join TableSpot today.</p>

              <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
                <Input
                  label="Full Name"
                  placeholder="John Doe"
                  autoComplete="name"
                  leftIcon={<User size={17} aria-hidden="true" />}
                  error={errors.fullName?.message}
                  {...register("fullName")}
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  leftIcon={<Mail size={17} aria-hidden="true" />}
                  error={errors.email?.message}
                  {...register("email")}
                />
                <Input
                  label="Phone Number"
                  type="tel"
                  placeholder="+91 98765 43210"
                  autoComplete="tel"
                  leftIcon={<Phone size={17} aria-hidden="true" />}
                  error={errors.phoneNumber?.message}
                  {...register("phoneNumber")}
                />
                <PasswordInput
                  label="Password"
                  placeholder="Create a password"
                  autoComplete="new-password"
                  error={errors.password?.message}
                  {...register("password")}
                />
                <Select
                  label="I want to"
                  leftIcon={<Shield size={17} aria-hidden="true" />}
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
                <Link to={ROUTES.LOGIN} className="inline-flex items-center gap-1 font-semibold text-primary transition-colors hover:text-primary-dark">
                  <ArrowLeft size={14} aria-hidden="true" /> Login
                </Link>
              </p>
            </div>
          </div>

          <AuthHero />
        </div>
      </div>

      <AuthFooter />
    </>
  );
}

export default RegisterPage;
