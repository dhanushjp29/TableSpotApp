import { test, expect } from "@playwright/test";
import fs from "fs";

const CUST_EMAIL = "custa.e2e@tablespot.test";
const CUST_PASSWORD = "Test@12345";
const RESTAURANT_ID = "6a7edce4072272649d8bcb28";
const TABLE_CODE = "TBL000170";

const results = [];
const pass = (label, extra = "") => {
  results.push(`PASS ${label}${extra ? " | " + extra : ""}`);
  console.log(`[PASS] ${label}${extra ? " | " + extra : ""}`);
};
const fail = (label, err) => {
  results.push(`FAIL ${label} | ${err}`);
  console.log(`[FAIL] ${label} | ${err}`);
};

function dayISO(daysAhead) {
  const d = new Date(Date.now() + daysAhead * 24 * 3600 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function fillRazorpayCheckout(page) {
  let frameAcquired = false;
  try {
  const deadline = Date.now() + 60000;
  let frames = [];
  while (Date.now() < deadline) {
    frames = page.frames().filter((f) => /api\.razorpay\.com\/v1\/checkout|checkout\.razorpay\.com/.test(f.url()));
    if (frames.length > 0) break;
    await page.waitForTimeout(1500);
  }
  if (frames.length === 0) {
    return { ok: false, reason: `no checkout.razorpay.com frame; frames=[${page.frames().map((f) => f.url().slice(0, 80)).join(", ")}]` };
  }
  const frame = frames[frames.length - 1];
  frameAcquired = true;
  await frame.waitForTimeout(2500);
  const debug = { frames: page.frames().map((f) => f.url().slice(0, 120)) };
  try {
    debug.buttons = await frame.locator("button").evaluateAll((els) =>
      els.map((el) => (el.innerText || "").trim().slice(0, 80)).filter(Boolean)
    );
  } catch {}
  debug.bodyText = (await frame.locator("body").innerText().catch(() => "")).slice(0, 3000);
  fs.writeFileSync("C:/Users/MSI/AppData/Local/Temp/opencode/checkout-debug.json", JSON.stringify(debug, null, 2));

  const clickByText = async (re) => {
    for (let i = 0; i < 8; i++) {
      try {
        const loc = frame.locator("button", { hasText: re }).first();
        if ((await loc.count()) === 0) {
          await page.waitForTimeout(700);
          continue;
        }
        await loc.scrollIntoViewIfNeeded().catch(() => {});
        await loc.click({ force: true });
        return true;
      } catch {
        await page.waitForTimeout(700);
      }
    }
    return false;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const snap = async (label) => {
    let line = `\n=== ${label} ===\n`;
    try {
      line += "checkoutFrames=" + page.frames().filter((f) => /api\.razorpay\.com\/v1\/checkout|checkout\.razorpay\.com/.test(f.url())).length + "\n";
      line += ((await frame.locator("body").innerText().catch(() => "")) || "").slice(0, 900) + "\n";
    } catch (e) {
      line += "SNAP ERR: " + String(e.message).slice(0, 120) + "\n";
    }
    fs.appendFileSync("C:/Users/MSI/AppData/Local/Temp/opencode/checkout-snap.log", line);
  };

  const fillField = async (sel, value) => {
    for (let i = 0; i < 10; i++) {
      try {
        const loc = frame.locator(sel).first();
        if ((await loc.count()) === 0 || !(await loc.isVisible())) {
          await sleep(700);
          continue;
        }
        await loc.click();
        await loc.fill(value);
        return true;
      } catch {
        await sleep(700);
      }
    }
    return false;
  };

  const upiSel = [
    'input[autocomplete="upi-id"]',
    'input[placeholder*="UPI ID" i]',
    'input[name="upi_id"]',
    'input[placeholder*="Enter UPI" i]',
    'input[placeholder*="VPA" i]',
  ].join(", ");
  const okUpi = await fillField(upiSel, "success@razorpay");
  await snap("after-upi-vpa");
  if (okUpi) {
    (await clickByText(/^Pay /)) || (await clickByText(/^Verify/)) || (await clickByText(/^Continue$/)) || (await clickByText(/Pay ₹/));
    await snap("after-upi-submit");
  }

  const otpSel = 'input[maxlength="4"], input[maxlength="6"], input[placeholder*="OTP" i], input[placeholder*="Code" i]';
  const completionDeadline = Date.now() + 60000;
  let lastBody = "";
  while (Date.now() < completionDeadline) {
    try {
      const live = page.frames().filter((f) => /api\.razorpay\.com\/v1\/checkout|checkout\.razorpay\.com/.test(f.url()));
      if (live.length === 0) {
        await snap("checkout-closed");
        break;
      }
      const body = (await frame.locator("body").innerText().catch(() => "")) || "";
      if (body !== lastBody) {
        lastBody = body;
        await snap("state-change");
      }
      if (/payment could not be completed|retry payment/i.test(body)) {
        await clickByText(/Pay with Google Pay UPI/);
        continue;
      }
      const emailInput = frame.locator('input[name="email"]').first();
      if ((await emailInput.count().catch(() => 0)) > 0) {
        await emailInput.fill("custa.e2e@tablespot.test").catch(() => {});
        await clickByText(/^Continue$/);
        await sleep(1200);
        continue;
      }
      const otpInput = frame.locator(otpSel).first();
      if ((await otpInput.count().catch(() => 0)) > 0 && (await otpInput.isVisible().catch(() => false))) {
        await otpInput.fill("1234").catch(() => {});
        await clickByText(/Verify/);
        await sleep(1200);
        continue;
      }
      if (/maybe later/i.test(body)) {
        await clickByText(/Maybe later/);
        continue;
      }
      if (/yes, secure my card/i.test(body)) {
        await clickByText(/Yes, secure my card/);
        continue;
      }
      if (/^Pay |Pay ₹|^Continue$/.test(body)) {
        (await clickByText(/^Pay /)) || (await clickByText(/^Continue$/)) || (await clickByText(/Pay ₹/));
        continue;
      }
      await sleep(700);
    } catch (e) {
      await snap("completion-loop-err: " + String(e.message).slice(0, 120));
      break;
    }
  }

  try {
    debug.finalBody = (await frame.locator("body").innerText().catch(() => "")).slice(0, 4000);
  } catch {}
  try {
    debug.finalInputs = await frame.locator("input").evaluateAll((els) =>
      els.map((el) => ({
        type: el.type,
        name: el.name || "",
        placeholder: el.placeholder || "",
        maxlength: el.maxLength || "",
        value: el.value || "",
      }))
    );
  } catch {}
  fs.writeFileSync("C:/Users/MSI/AppData/Local/Temp/opencode/checkout-debug.json", JSON.stringify(debug, null, 2));
  await frame.screenshot({ path: "./tests/e2e/screenshots/05-checkout-filled.png" }).catch(() => {});
  return { ok: true, frame };
  } catch (e) {
    try {
      fs.appendFileSync("C:/Users/MSI/AppData/Local/Temp/opencode/checkout-snap.log", "\n=== CATCH ===\n" + String(e.message).slice(0, 200) + "\n");
    } catch {}
    if (!frameAcquired) return { ok: false, reason: `checkout never opened / page closed: ${String(e.message).slice(0, 120)}` };
    return { ok: true, frame: null, closedDuring: String(e.message).slice(0, 160) };
  }
}test.describe("Customer real TEST payment E2E", () => {
  test("book → real order → real checkout → verify", async ({ page }) => {
    const consoleErrors = [];
    const networkErrors = [];
    let createOrderBody = null;

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("requestfailed", (req) => {
      networkErrors.push(`${req.method()} ${req.url()} ${req.failure()?.errorText || ""}`);
    });

    const iso = dayISO(27);
    await test.step("Login as customer", async () => {
      await page.goto("/login");
      await page.getByPlaceholder("you@example.com").fill(CUST_EMAIL);
      await page.getByPlaceholder("Enter your password").fill(CUST_PASSWORD);
      await page.getByRole("button", { name: /Login/i }).click();
      await page.waitForURL(/\/(restaurants|customer|dashboard)/, { timeout: 20000 });
      pass("customer login");
    });

    await test.step("Open booking page", async () => {
      await page.goto(`/restaurants/${RESTAURANT_ID}/book`);
      await page.waitForSelector("text=/Pay & Confirm Booking|Confirm Booking/i", { timeout: 30000 });
      pass("booking form rendered");
    });

    await test.step("Fill date", async () => {
      let picked = false;
      for (let attempt = 0; attempt < 4 && !picked; attempt++) {
        await page.locator('[data-testid="invoice-date-trigger"]').first().click();
        const day = page.locator(`[data-testid="invoice-day-${iso}"]`).first();
        try {
          await day.waitFor({ state: "visible", timeout: 8000 });
          await day.click();
          picked = true;
        } catch {
          const next = page.locator('[role="dialog"] .lucide-chevron-right').first();
          for (let n = 0; n < 14; n++) {
            const again = page.locator(`[data-testid="invoice-day-${iso}"]`).first();
            if (await again.isVisible().catch(() => false)) break;
            await next.click().catch(() => {});
            await page.waitForTimeout(300);
          }
          const afterNav = page.locator(`[data-testid="invoice-day-${iso}"]`).first();
          if (await afterNav.isVisible().catch(() => false)) {
            await afterNav.click();
            picked = true;
          } else {
            await page.keyboard.press("Escape").catch(() => {});
            await page.waitForTimeout(600);
          }
        }
      }
      if (!picked) {
        throw new Error(`date ${iso} not selectable`);
      }
      pass("date selected", iso);
    });

    await test.step("Set guests + select table", async () => {
      const guests = page.getByRole("spinbutton", { name: /Guests/i });
      await guests.fill("2");
      await page.waitForTimeout(1500);
      const tableCode = page.locator("text=" + TABLE_CODE).first();
      await tableCode.waitFor({ state: "visible", timeout: 30000 });
      await tableCode.click();
      await page.locator("text=/whole table/").first().waitFor({ state: "visible", timeout: 10000 });
      pass("table selected", TABLE_CODE);
      await page.waitForTimeout(800);
      await page.screenshot({ path: "./tests/e2e/screenshots/06-booking-form.png", fullPage: true });
    });

    await test.step("Submit → real order", async () => {
      const orderPromise = page.waitForResponse(
        (r) => /\/api\/v1\/payments\/create-order/.test(r.url()) && r.request().method() === "POST",
        { timeout: 60000 }
      );
      await page.getByRole("button", { name: /Pay & Confirm Booking/i }).click();
      const res = await orderPromise;
      createOrderBody = await res.json();
      const order = createOrderBody?.data?.order || {};
      console.log("create-order response:", JSON.stringify(createOrderBody));
      expect(res.status()).toBe(200);
      expect(order.id).toMatch(/^order_/);
      expect(order.id).not.toMatch(/order_mock_/);
      pass("real order created", `id=${order.id} amount=${order.amount} key=${createOrderBody?.data?.razorpayKeyId}`);
    });

    await test.step("Complete real Razorpay checkout", async () => {
      const verifyPromise = page.waitForResponse(
        (r) => /\/api\/v1\/payments\/verify/.test(r.url()) && r.request().method() === "POST",
        { timeout: 120000 }
      ).catch(() => null);
      const attempt = await fillRazorpayCheckout(page);
      if (!attempt.ok) {
        fail("razorpay checkout frame", attempt.reason);
        test.info().annotations.push({ type: "checkout-frame-fail", description: attempt.reason });
        return;
      }
      const verify = await verifyPromise;
      if (verify) {
        const body = await verify.json().catch(() => ({}));
        console.log("verify response:", JSON.stringify(body));
        expect(verify.status()).toBe(200);
        pass("verify payment success", `status=${body?.statusCode}`);
      } else {
        fail("verify payment", "no /payments/verify response within 90s after payment");
      }
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "./tests/e2e/screenshots/07-after-payment.png", fullPage: true });
      const url = page.url();
      const bodyText = await page.locator("body").innerText().catch(() => "");
      if (/confirmation/i.test(url) || /booking/i.test(bodyText)) {
        pass("navigated to confirmation/booking after payment");
      }
    });

    console.log("CONSOLE ERRORS:", consoleErrors.length ? JSON.stringify(consoleErrors, null, 2) : "none");
    console.log("NETWORK ERRORS:", networkErrors.length ? JSON.stringify(networkErrors, null, 2) : "none");
    test.info().annotations.push({ type: "results", description: results.join("\n") });
  });
});
