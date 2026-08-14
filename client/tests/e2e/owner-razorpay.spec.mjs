import { test, expect } from "@playwright/test";

const OWNER_EMAIL = "owner.e2e@tablespot.test";
const OWNER_PASSWORD = "Test@12345";
const SCREENSHOTS = "./tests/e2e/screenshots";

const results = [];
const pass = (label, extra = "") => {
  results.push(`PASS ${label}${extra ? " | " + extra : ""}`);
  console.log(`[PASS] ${label}${extra ? " | " + extra : ""}`);
};
const fail = (label, err) => {
  results.push(`FAIL ${label} | ${err}`);
  console.log(`[FAIL] ${label} | ${err}`);
};

test.describe("Owner Razorpay onboarding E2E (real TEST)", () => {
  test("login → connect → status refresh", async ({ page, context }) => {
    const consoleErrors = [];
    const networkErrors = [];
    const apiResponses = {};

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("requestfailed", (req) => {
      networkErrors.push(`${req.method()} ${req.url()} ${req.failure()?.errorText || ""}`);
    });
    page.on("response", (res) => {
      if (/\/api\/v1\/(auth|payments)/.test(res.url())) {
        apiResponses[res.url().split("/api/v1/")[1]] = res.status();
      }
    });

    const popupPromise = page.waitForEvent("popup", { timeout: 15000 }).catch(() => null);

    await test.step("Login as owner", async () => {
      await page.goto("/login");
      await page.getByPlaceholder("you@example.com").fill(OWNER_EMAIL);
      await page.getByPlaceholder("Enter your password").fill(OWNER_PASSWORD);
      await page.getByRole("button", { name: /Login/i }).click();
      await page.waitForURL(/\/owner/, { timeout: 20000 });
      pass("owner login + redirect");
      await page.screenshot({ path: `${SCREENSHOTS}/01-owner-login.png`, fullPage: true });
    });

    await test.step("Open restaurant page with connect UI", async () => {
      await page.goto("/owner/restaurant");
      await page.waitForLoadState("networkidle");

      const addBtn = page.getByRole("button", { name: /Add Restaurant/i }).first();
      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
        pass("owner restaurant list → Add Restaurant");
      } else {
        pass("restaurant form shown directly");
      }

      await page.waitForSelector("text=/Connect your Razorpay payment account|Connect Payment Account|Open KYC Form/i", {
        timeout: 20000,
      });
      pass("connect section visible");
      await page.screenshot({ path: `${SCREENSHOTS}/02-owner-restaurant.png`, fullPage: true });
    });

    await test.step("Connect Razorpay account", async () => {
      const connectResp = page.waitForResponse(
        (r) => /\/api\/v1\/payments\/account\/connect/.test(r.url()),
        { timeout: 60000 }
      );
      const btn = page.getByRole("button", { name: /Connect Payment Account|Open KYC Form/i }).first();
      await btn.click();

      const res = await connectResp;
      let body = {};
      try {
        body = await res.json();
      } catch {}
      const text = JSON.stringify(body);
      const hasUnknown = /unknown error/i.test(text);
      const data = body?.data || {};

      expect(res.status()).toBe(200);
      expect(data.accountId).toMatch(/^acc_/);
      expect(String(data.accountId)).not.toMatch(/^acc_mock_/);
      expect(data.onboardingLink).toMatch(/^https:\/\//);
      expect(hasUnknown).toBe(false);

      pass("connect HTTP 200 (real TEST account)", `accountId=${data.accountId} status=${data.status} activationStatus=${data.activationStatus || "n/a"} link=${data.onboardingLink}`);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${SCREENSHOTS}/03-owner-connected.png`, fullPage: true });
    });

    await test.step("Refresh status", async () => {
      const statusResp = page.waitForResponse(
        (r) => /\/api\/v1\/payments\/account\/status/.test(r.url()),
        { timeout: 60000 }
      );
      const refresh = page.getByRole("button", { name: /Refresh Status/i }).first();
      await refresh.click();
      const res = await statusResp;
      let body = {};
      try {
        body = await res.json();
      } catch {}
      const data = body?.data || {};
      expect(res.status()).toBe(200);
      expect(data.accountId).toMatch(/^acc_/);
      pass("status refresh HTTP 200", `accountId=${data.accountId} status=${data.status} activationStatus=${data.activationStatus || "n/a"}`);
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${SCREENSHOTS}/04-owner-status.png`, fullPage: true });
    });

    await test.step("Check for backend-internal leakage in UI", async () => {
      const bodyText = await page.locator("body").innerText();
      for (const needle of ["Unknown error", "Cannot read properties of undefined", "MongoError", "MongooseServerSelectionError", "No Route matched with those values"]) {
        expect(bodyText.toLowerCase()).not.toContain(needle.toLowerCase());
      }
      pass("no backend-internal text in UI");
    });

    const popup = await popupPromise;
    if (popup) await popup.close().catch(() => {});

    console.log("\nAPI statuses seen:", JSON.stringify(apiResponses));
    console.log("CONSOLE ERRORS:", consoleErrors.length ? JSON.stringify(consoleErrors, null, 2) : "none");
    console.log("NETWORK ERRORS:", networkErrors.length ? JSON.stringify(networkErrors, null, 2) : "none");

    test.info().annotations.push({
      type: "results",
      description: results.join("\n"),
    });
  });
});
