import { UAParser } from "ua-parser-js";

const getDeviceInfo = (req) => {
  const parser = new UAParser(req.headers["user-agent"]);

  const result = parser.getResult();

  const ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.ip ||
    "";

  return {
    deviceName:
      result.device.model ||
      result.device.vendor ||
      "Desktop",

    browser: result.browser.name || "",

    operatingSystem: result.os.name
      ? `${result.os.name} ${result.os.version || ""}`.trim()
      : "",

    ipAddress: ipAddress,

    userAgent: req.headers["user-agent"] || "",
  };
};

export default getDeviceInfo;
