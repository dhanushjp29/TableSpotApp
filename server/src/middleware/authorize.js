import ApiError from "../utils/ApiError.js";

const authorize = (...allowedRoles) => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required."));
    }

    if (
      allowedRoles.length > 0 &&
      !allowedRoles.includes(req.user.role)
    ) {
      return next(
        new ApiError(
          403,
          "You do not have permission to access this resource."
        )
      );
    }

    return next();
  };
};

export default authorize;
