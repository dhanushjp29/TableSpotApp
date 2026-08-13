import "./env.js";

import "./env.js";

const isProduction = process.env.NODE_ENV === "production";

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: isProduction,
    // Vercel/Netlify and Render/Railway are different sites, so production
    // auth cookies must be cross-site compatible.
    sameSite: isProduction ? "none" : "lax",
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
};

export default COOKIE_OPTIONS;
