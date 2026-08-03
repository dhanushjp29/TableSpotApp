const isProduction = process.env.NODE_ENV === "production";

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
};

export default COOKIE_OPTIONS;
