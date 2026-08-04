import { useSelector } from "react-redux";

export function useAuth() {
  const { user, isAuthenticated, isLoading, error } = useSelector(
    (state) => state.auth
  );

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    role: user?.role || null,
  };
}

export default useAuth;
