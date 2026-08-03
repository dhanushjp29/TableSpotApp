import * as registerService from "../services/auth/register.service.js";
import * as loginService from "../services/auth/login.service.js";
import * as logoutService from "../services/auth/logout.service.js";
import * as refreshTokenService from "../services/auth/refreshToken.service.js";
import * as verifyEmailService from "../services/auth/verifyEmail.service.js";
import * as forgotPasswordService from "../services/auth/forgotPassword.service.js";
import * as resetPasswordService from "../services/auth/resetPassword.service.js";
import * as changePasswordService from "../services/auth/changePassword.service.js";
import * as googleLoginService from "../services/auth/googleLogin.service.js";
import * as resendOTPService from "../services/auth/resendOTP.service.js";

import ApiResponse from "../utils/ApiResponse.js";
import COOKIE_OPTIONS from "../config/cookie.js";
import getDeviceInfo from "../utils/getDeviceInfo.js";
import buildUserResponse from "../utils/buildUserResponse.js";

const setAuthCookies = (res, accessToken, refreshToken) => {
    res.cookie("accessToken", accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);
};

export const register = async (req, res) => {
    const result = await registerService.register(req.validatedData);
    res.status(201).json(new ApiResponse(201, result.message, result));
};

export const login = async (req, res) => {
    const { email, password } = req.validatedData;
    const deviceInfo = getDeviceInfo(req);

    const result = await loginService.login({ email, password, deviceInfo });

    setAuthCookies(res, result.accessToken, result.refreshToken);

    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const googleLogin = async (req, res) => {
    const deviceInfo = getDeviceInfo(req);
    const result = await googleLoginService.googleLogin({
        ...req.validatedData,
        deviceInfo,
    });

    setAuthCookies(res, result.accessToken, result.refreshToken);

    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const logout = async (req, res) => {
    const { refreshToken } = req.validatedData;

    const result = await logoutService.logout({ refreshToken });

    res.clearCookie("accessToken", COOKIE_OPTIONS);
    res.clearCookie("refreshToken", COOKIE_OPTIONS);

    res.status(200).json(new ApiResponse(200, result.message));
};

export const refreshToken = async (req, res) => {
    const { refreshToken: currentRefreshToken } = req.validatedData;

    const result = await refreshTokenService.refreshToken({
        refreshToken: currentRefreshToken,
    });

    setAuthCookies(res, result.accessToken, result.refreshToken);

    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const verifyEmail = async (req, res) => {
    const deviceInfo = getDeviceInfo(req);
    const result = await verifyEmailService.verifyEmail({
        ...req.validatedData,
        deviceInfo,
    });

    setAuthCookies(res, result.accessToken, result.refreshToken);

    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const resendOTP = async (req, res) => {
    const result = await resendOTPService.resendOTP(req.validatedData);
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const forgotPassword = async (req, res) => {
    const result = await forgotPasswordService.forgotPassword(req.validatedData);
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const resetPassword = async (req, res) => {
    const result = await resetPasswordService.resetPassword(req.validatedData);
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const changePassword = async (req, res) => {
    const result = await changePasswordService.changePassword({
        ...req.validatedData,
        userId: req.user._id,
        sessionId: req.auth.sessionId,
    });

    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const getMe = async (req, res) => {
    res.status(200).json(
        new ApiResponse(200, "User profile retrieved.", {
            user: buildUserResponse(req.user),
        })
    );
};
