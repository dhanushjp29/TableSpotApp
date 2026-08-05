import { useSelector } from "react-redux";

export function useAuth() {
  const { user, isAuthenticated, isInitialized, isLoading, error } = useSelector(
    (state) => state.auth
  );

  return {
    user,
    isAuthenticated,
    isInitialized,
    isLoading,
    error,
    role: user?.role || null,
  };
}

export default useAuth;
