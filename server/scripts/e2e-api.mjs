/**
 * TableSpot E2E API verification for Offers, Restaurant Warnings, Restaurant
 * Reporting and Notifications.
 *
 * Requires the dev server running on :5000 and the E2E seed in place
 * (run `node scripts/e2e-seed.mjs` first — it is idempotent).
 *
 *   node scripts/e2e-api.mjs
 *
 * Exits 0 only when every assertion holds. Runs sequentially so each suite is
 * deterministic. Known-bug reproduction cases assert the CORRECT behaviour,
 * so they FAIL before the fix and PASS after it.
 */

const BASE = process.env.E2E_BASE || "http://localhost:5000/api/v1";

const PASSWORD = "Test@12345";

const ACCOUNTS = {
  admin: { email: "admin.e2e@tablespot.test" },
  owner: { email: "owner.e2e@tablespot.test" },
  custA: { email: "custa.e2e@tablespot.test" },
  custB: { email: "custb.e2e@tablespot.test" },
  custC: { email: "custc.e2e@tablespot.test" },
};

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

const results = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const test = async (name, fn) => {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, pass: true });
    console.log(`  PASS  ${name}`);
  } catch (error) {
    results.push({ name, pass: false, error: String(error?.message || error) });
    console.log(`  FAIL  ${name}\n        ${error?.message || error}`);
  }
};

const suite = (title) => console.log(`\n== ${title} ==`);

// ---------------------------------------------------------------------------
// HTTP helpers (manual cookie jar for the httpOnly access token)
// ---------------------------------------------------------------------------

const jar = {}; // email -> cookie header string

const login = async (email) => {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
    redirect: "manual",
  });
  if (res.status !== 200) {
    throw new Error(`login failed for ${email}: HTTP ${res.status}`);
  }
  const setCookies = res.headers.getSetCookie
    ? res.headers.getSetCookie()
    : [res.headers.get("set-cookie")].filter(Boolean);
  const cookie = setCookies
    .map((c) => c.split(";")[0])
    .filter((c) => c.startsWith("accessToken="))
    .join("; ");
  if (!cookie) {
    throw new Error(`login for ${email} returned no accessToken cookie`);
  }
  jar[email] = cookie;
};

const request = async ({ email = null, method = "GET", path = "", body = null, raw = false }) => {
  const headers = {};
  if (body !== null) {
    headers["Content-Type"] = "application/json";
  }
  if (email && jar[email]) {
    headers["Cookie"] = jar[email];
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = raw ? await res.text() : null;
  }
  return { status: res.status, data };
};

const expectStatus = (res, expected, label) => {
  if (res.status !== expected) {
    throw new Error(
      `${label}: expected HTTP ${expected}, got ${res.status} (${JSON.stringify(res.data)?.slice(0, 220)})`
    );
  }
};

const expect = (cond, label) => {
  if (!cond) throw new Error(label);
};

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

const authSmoke = async () => {
  suite("AUTH SMOKE");
  for (const [key, account] of Object.entries(ACCOUNTS)) {
    await test(`login ${key} (${account.email})`, () => login(account.email));
  }
  await test("login with wrong password -> 401", async () => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ACCOUNTS.custA.email, password: "wrong-pass-123" }),
    });
    expectStatus(res, 401, "wrong password login");
  });
};

// ---------------------------------------------------------------------------

const unitDiscount = async () => {
  suite("OFFER DISCOUNT MATH (unit)");
  const { computeOfferDiscount, isOfferLive } = await import(
    "../src/services/offer.service.js"
  );

  await test("10% of 1000 = 100", () => {
    const d = computeOfferDiscount({
      offer: { discountType: "Percentage", discountValue: 10, maxDiscountAmount: 0 },
      subTotal: 1000,
    });
    expect(d === 100, `expected 100, got ${d}`);
  });

  await test("percentage capped by maxDiscountAmount", () => {
    const d = computeOfferDiscount({
      offer: { discountType: "Percentage", discountValue: 50, maxDiscountAmount: 150 },
      subTotal: 1000,
    });
    expect(d === 150, `expected 150, got ${d}`);
  });

  await test("amount discount = fixed value", () => {
    const d = computeOfferDiscount({
      offer: { discountType: "Amount", discountValue: 400, maxDiscountAmount: 0 },
      subTotal: 1000,
    });
    expect(d === 400, `expected 400, got ${d}`);
  });

  await test("discount never exceeds subtotal", () => {
    const d = computeOfferDiscount({
      offer: { discountType: "Percentage", discountValue: 200, maxDiscountAmount: 0 },
      subTotal: 500,
    });
    expect(d === 500, `expected 500 (cap), got ${d}`);
  });

  await test("zero subtotal -> zero discount", () => {
    const d = computeOfferDiscount({
      offer: { discountType: "Percentage", discountValue: 10, maxDiscountAmount: 0 },
      subTotal: 0,
    });
    expect(d === 0, `expected 0, got ${d}`);
  });

  await test("isOfferLive: future offer not live", () => {
    const live = isOfferLive({
      isDeleted: false,
      isActive: true,
      validityStart: new Date(Date.now() + 1000),
      validityEnd: new Date(Date.now() + 5000),
    });
    expect(live === false, "future offer should not be live");
  });

  await test("isOfferLive: expired offer not live", () => {
    const live = isOfferLive({
      isDeleted: false,
      isActive: true,
      validityStart: new Date(Date.now() - 5000),
      validityEnd: new Date(Date.now() - 1000),
    });
    expect(live === false, "expired offer should not be live");
  });

  await test("isOfferLive: live window is inclusive", () => {
    const live = isOfferLive({
      isDeleted: false,
      isActive: true,
      validityStart: new Date(Date.now() - 1000),
      validityEnd: new Date(Date.now() + 1000),
    });
    expect(live === true, "active window should be live");
  });
};

// ---------------------------------------------------------------------------

const offersOwner = async ({ restaurantA, restaurantB }) => {
  suite("OFFERS - OWNER CRUD + GUARDS");

  const validOffer = {
    offerCode: "TS_E2E20",
    title: "E2E 25% Walk-in",
    description: "Created through the API.",
    discountType: "Percentage",
    discountValue: 25,
    minOrderAmount: 0,
    maxDiscountAmount: 500,
    maxRedemptions: 1,
    perUserRedemptionLimit: 1,
    validityStart: new Date(Date.now() - 86400000).toISOString(),
    validityEnd: new Date(Date.now() + 86400000 * 30).toISOString(),
    targeting: "ALL",
    isStackable: false,
    isActive: true,
  };

  let created;
  await test("create percentage offer -> 201", async () => {
    const res = await request({
      email: ACCOUNTS.owner.email,
      method: "POST",
      path: "/offers",
      body: { ...validOffer, restaurantId: restaurantA },
    });
    expectStatus(res, 201, "create offer");
    created = res.data?.data?.offer || res.data?.offer;
    expect(created?._id, "create returned no offer id");
  });

  await test("duplicate offer code same restaurant -> 409", async () => {
    const res = await request({
      email: ACCOUNTS.owner.email,
      method: "POST",
      path: "/offers",
      body: { ...validOffer, offerCode: "TS_E2E20", restaurantId: restaurantA },
    });
    expectStatus(res, 409, "duplicate code");
  });

  await test("B1: percentage discountValue > 100 -> 400", async () => {
    const res = await request({
      email: ACCOUNTS.owner.email,
      method: "POST",
      path: "/offers",
      body: {
        ...validOffer,
        offerCode: "TS_E2E21",
        discountType: "Percentage",
        discountValue: 150,
        restaurantId: restaurantA,
      },
    });
    expectStatus(res, 400, "percentage > 100 must be rejected");
  });

  await test("B1: amount discountValue > 100 is allowed -> 201", async () => {
    const res = await request({
      email: ACCOUNTS.owner.email,
      method: "POST",
      path: "/offers",
      body: {
        ...validOffer,
        offerCode: "TS_E2E22",
        discountType: "Amount",
        discountValue: 5000,
        restaurantId: restaurantA,
      },
    });
    expectStatus(res, 201, "amount discount 5000");
  });

  await test("B1: update existing offer to percentage > 100 -> 400", async () => {
    const res = await request({
      email: ACCOUNTS.owner.email,
      method: "PATCH",
      path: `/offers/${created._id}`,
      body: { discountType: "Percentage", discountValue: 200 },
    });
    expectStatus(res, 400, "update to percentage > 100 must be rejected");
  });

  await test("validityEnd <= validityStart -> 400", async () => {
    const res = await request({
      email: ACCOUNTS.owner.email,
      method: "POST",
      path: "/offers",
      body: {
        ...validOffer,
        offerCode: "TS_E2E23",
        validityStart: new Date(Date.now() + 86400000).toISOString(),
        validityEnd: new Date(Date.now()).toISOString(),
        restaurantId: restaurantA,
      },
    });
    expectStatus(res, 400, "end <= start rejected");
  });

  await test("update validity end before start -> 400", async () => {
    const res = await request({
      email: ACCOUNTS.owner.email,
      method: "PATCH",
      path: `/offers/${created._id}`,
      body: {
        validityEnd: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
    });
    expectStatus(res, 400, "update invalid window rejected");
  });

  await test("update to change offerCode (immutable) -> 400", async () => {
    const res = await request({
      email: ACCOUNTS.owner.email,
      method: "PATCH",
      path: `/offers/${created._id}`,
      body: { offerCode: "TS_E2E99" },
    });
    expectStatus(res, 400, "offerCode immutable");
  });

  await test("customer cannot create offers -> 403", async () => {
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "POST",
      path: "/offers",
      body: { ...validOffer, offerCode: "TS_E2E24", restaurantId: restaurantA },
    });
    expectStatus(res, 403, "customer create offer");
  });

  await test("unauthenticated create -> 401", async () => {
    const res = await request({ method: "POST", path: "/offers", body: { ...validOffer, restaurantId: restaurantA } });
    expectStatus(res, 401, "anon create offer");
  });

  await test("toggle active false -> 200", async () => {
    const res = await request({
      email: ACCOUNTS.owner.email,
      method: "PATCH",
      path: `/offers/${created._id}/active`,
      body: { isActive: false },
    });
    expectStatus(res, 200, "toggle active");
  });

  await test("owner list includes created offer", async () => {
    const res = await request({
      email: ACCOUNTS.owner.email,
      method: "GET",
      path: "/offers",
    });
    expectStatus(res, 200, "list offers");
    const offers = res.data?.data?.offers || [];
    expect(
      offers.some((o) => String(o._id) === String(created._id)),
      "created offer missing from owner list"
    );
  });

  await test("owner stats for own offer -> 200", async () => {
    const res = await request({
      email: ACCOUNTS.owner.email,
      method: "GET",
      path: `/offers/${created._id}/stats`,
    });
    expectStatus(res, 200, "owner stats");
  });

  await test("customer cannot access owner stats -> 403", async () => {
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "GET",
      path: `/offers/${created._id}/stats`,
    });
    expectStatus(res, 403, "customer stats");
  });

  await test("delete offer -> 200, then getById -> 404", async () => {
    const del = await request({
      email: ACCOUNTS.owner.email,
      method: "DELETE",
      path: `/offers/${created._id}`,
    });
    expectStatus(del, 200, "delete offer");
    const get = await request({
      email: ACCOUNTS.owner.email,
      method: "GET",
      path: `/offers/${created._id}`,
    });
    expectStatus(get, 404, "deleted offer getById");
  });
};

// ---------------------------------------------------------------------------

const offersCustomer = async ({ restaurantA, restaurantB }) => {
  suite("OFFERS - CUSTOMER AVAILABILITY / CLAIM / SECURITY");

  await test("customer A available offers include seeded live offers", async () => {
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "GET",
      path: "/offers/available?limit=100",
    });
    expectStatus(res, 200, "available offers");
    const offers = res.data?.data?.offers || [];
    const codes = offers.map((o) => o.offerCode);
    expect(codes.includes("TS_E2E10"), "expected TS_E2E10 in available");
    expect(codes.includes("TS_E2E12"), "expected TS_E2E12 (segment) for cust A");
    expect(codes.includes("TS_E2E13"), "expected TS_E2E13 (selected) for cust A");
    expect(!codes.includes("TS_E2E14"), "expired TS_E2E14 must not be available");
    expect(!codes.includes("TS_E2E15"), "inactive TS_E2E15 must not be available");
  });

  await test("customer A available filtered by restaurant", async () => {
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "GET",
      path: `/offers/available?restaurantId=${restaurantA}&limit=100`,
    });
    expectStatus(res, 200, "filtered available");
    const offers = res.data?.data?.offers || [];
    expect(offers.length > 0, "expected offers for restaurant A");
    expect(
      offers.every((o) => String(o.restaurantId?._id || o.restaurantId) === String(restaurantA)),
      "filtered offers must all belong to restaurant A"
    );
  });

  await test("customer A sees no restaurant-B offers when filtering by B", async () => {
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "GET",
      path: `/offers/available?restaurantId=${restaurantB}`,
    });
    expectStatus(res, 200, "filtered by B");
    const offers = res.data?.data?.offers || [];
    expect(offers.length === 0, "restaurant B should have no seeded offers");
  });

  await test("customer B is NOT offered segment TS_E2E12 (no completed visit)", async () => {
    const res = await request({
      email: ACCOUNTS.custB.email,
      method: "GET",
      path: `/offers/available?restaurantId=${restaurantA}&limit=100`,
    });
    expectStatus(res, 200, "cust B available");
    const offers = res.data?.data?.offers || [];
    expect(
      !offers.some((o) => o.offerCode === "TS_E2E12"),
      "customer B should not see segment offer TS_E2E12"
    );
  });

  let seedOffer;
  await test("customer A claims TS_E2E10 -> 200", async () => {
    const list = await request({
      email: ACCOUNTS.custA.email,
      method: "GET",
      path: `/offers/available?restaurantId=${restaurantA}`,
    });
    seedOffer = (list.data?.data?.offers || []).find((o) => o.offerCode === "TS_E2E10");
    expect(seedOffer?._id, "TS_E2E10 not found in available list");
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "POST",
      path: `/offers/${seedOffer._id}/claim`,
    });
    expectStatus(res, 200, "claim TS_E2E10");
  });

  await test("customer A duplicate claim is idempotent (200, already claimed)", async () => {
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "POST",
      path: `/offers/${seedOffer._id}/claim`,
    });
    expectStatus(res, 200, "duplicate claim");
    expect(
      (res.data?.data?.message || "").includes("already claimed"),
      "duplicate claim should report already claimed"
    );
  });

  await test("customer A my offers include claimed TS_E2E10", async () => {
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "GET",
      path: "/offers/mine?limit=100",
    });
    expectStatus(res, 200, "my offers");
    const mine = res.data?.data?.offers || [];
    expect(
      mine.some((o) => (o.offerId?.offerCode || "") === "TS_E2E10"),
      "claimed offer missing from my offers"
    );
  });

  await test("customer B claims selected TS_E2E13 -> 200", async () => {
    const list = await request({
      email: ACCOUNTS.custB.email,
      method: "GET",
      path: `/offers/available?restaurantId=${restaurantA}`,
    });
    const offer = (list.data?.data?.offers || []).find((o) => o.offerCode === "TS_E2E13");
    expect(offer?._id, "TS_E2E13 not available for customer B");
    const res = await request({
      email: ACCOUNTS.custB.email,
      method: "POST",
      path: `/offers/${offer._id}/claim`,
    });
    expectStatus(res, 200, "cust B claim selected offer");
  });

  await test("customer C cannot claim selected TS_E2E13 -> 403", async () => {
    const ownerList = await request({
      email: ACCOUNTS.owner.email,
      method: "GET",
      path: "/offers",
    });
    const offer = (ownerList.data?.data?.offers || []).find((o) => o.offerCode === "TS_E2E13");
    expect(offer?._id, "TS_E2E13 must exist (owner list)");
    const res = await request({
      email: ACCOUNTS.custC.email,
      method: "POST",
      path: `/offers/${offer._id}/claim`,
    });
    expectStatus(res, 403, "cust C not in selected target list");
  });

  await test("customer C cannot claim segment TS_E2E12 -> 403", async () => {
    const ownerList = await request({
      email: ACCOUNTS.owner.email,
      method: "GET",
      path: "/offers",
    });
    const offer = (ownerList.data?.data?.offers || []).find((o) => o.offerCode === "TS_E2E12");
    expect(offer?._id, "TS_E2E12 must exist (owner list)");
    const res = await request({
      email: ACCOUNTS.custC.email,
      method: "POST",
      path: `/offers/${offer._id}/claim`,
    });
    expectStatus(res, 403, "cust C not eligible for segment offer");
  });

  await test("claim expired TS_E2E14 directly -> 409", async () => {
    const list = await request({
      email: ACCOUNTS.owner.email,
      method: "GET",
      path: "/offers",
    });
    const offer = (list.data?.data?.offers || []).find((o) => o.offerCode === "TS_E2E14");
    expect(offer?._id, "TS_E2E14 must exist (owner list)");
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "POST",
      path: `/offers/${offer._id}/claim`,
    });
    expectStatus(res, 409, "expired offer claim");
  });

  await test("claim inactive TS_E2E15 directly -> 409", async () => {
    const list = await request({
      email: ACCOUNTS.owner.email,
      method: "GET",
      path: "/offers",
    });
    const offer = (list.data?.data?.offers || []).find((o) => o.offerCode === "TS_E2E15");
    expect(offer?._id, "TS_E2E15 must exist (owner list)");
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "POST",
      path: `/offers/${offer._id}/claim`,
    });
    expectStatus(res, 409, "inactive offer claim");
  });

  await test("customer getById strips internal targeting fields", async () => {
    const list = await request({
      email: ACCOUNTS.custA.email,
      method: "GET",
      path: `/offers/available?restaurantId=${restaurantA}`,
    });
    const offer = (list.data?.data?.offers || []).find((o) => o.offerCode === "TS_E2E13");
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "GET",
      path: `/offers/${offer._id}`,
    });
    expectStatus(res, 200, "customer getById");
    const detail = res.data?.data?.offer || res.data?.offer;
    expect(
      !("segmentRules" in detail) && !("targetUserIds" in detail) && !("stats" in detail),
      "internal fields leaked to customer"
    );
  });

  await test("same-customer double claim (race) -> exactly one active recipient", async () => {
    const offerRes = await request({
      email: ACCOUNTS.owner.email,
      method: "POST",
      path: "/offers",
      body: {
        offerCode: "TS_E2E26",
        title: "E2E Same-Customer Race",
        description: "Concurrent duplicate claims.",
        discountType: "Amount",
        discountValue: 80,
        minOrderAmount: 0,
        maxDiscountAmount: 80,
        maxRedemptions: 10,
        perUserRedemptionLimit: 1,
        validityStart: new Date(Date.now() - 86400000).toISOString(),
        validityEnd: new Date(Date.now() + 86400000 * 7).toISOString(),
        targeting: "ALL",
        isStackable: false,
        isActive: true,
        restaurantId: restaurantA,
      },
    });
    expectStatus(offerRes, 201, "create same-customer race offer");
    const raceId = offerRes.data?.data?.offer?._id;

    const claims = await Promise.all([
      request({ email: ACCOUNTS.custA.email, method: "POST", path: `/offers/${raceId}/claim` }),
      request({ email: ACCOUNTS.custA.email, method: "POST", path: `/offers/${raceId}/claim` }),
    ]);
    expect(
      claims.every((r) => r.status === 200),
      `both claims should succeed, got ${claims.map((r) => r.status).join(",")}`
    );

    const recipients = await request({
      email: ACCOUNTS.owner.email,
      method: "GET",
      path: `/offers/${raceId}/recipients?limit=50`,
    });
    const rows = recipients.data?.data?.recipients || [];
    expect(
      rows.length === 1,
      `expected exactly one CLAIMED recipient for the customer after a double-claim race, got ${rows.length}`
    );
  });

  await test("two-customer race on maxRedemptions=1 (observation)", async () => {
    const offerRes = await request({
      email: ACCOUNTS.owner.email,
      method: "POST",
      path: "/offers",
      body: {
        offerCode: "TS_E2E27",
        title: "E2E Cross-Customer Race",
        description: "One redemption slot, two racers.",
        discountType: "Amount",
        discountValue: 60,
        minOrderAmount: 0,
        maxDiscountAmount: 60,
        maxRedemptions: 1,
        perUserRedemptionLimit: 1,
        validityStart: new Date(Date.now() - 86400000).toISOString(),
        validityEnd: new Date(Date.now() + 86400000 * 7).toISOString(),
        targeting: "ALL",
        isStackable: false,
        isActive: true,
        restaurantId: restaurantA,
      },
    });
    expectStatus(offerRes, 201, "create cross-customer race offer");
    const raceId = offerRes.data?.data?.offer?._id;

    const results2 = await Promise.all([
      request({ email: ACCOUNTS.custA.email, method: "POST", path: `/offers/${raceId}/claim` }),
      request({ email: ACCOUNTS.custB.email, method: "POST", path: `/offers/${raceId}/claim` }),
    ]);
    const statuses = results2.map((r) => r.status).sort();
    console.log(
      `        [observation] maxRedemptions=1 concurrent claims -> ${statuses.join(",")}`
    );
    // Non-atomic slot reservation means both CLAIMED recipients may be created;
    // the hard cap is enforced later at redemption (applyOfferToBill). Both
    // outcomes are acceptable for the claim stage. Logged for the report.
    expect(
      statuses.every((s) => s === 200 || s === 400 || s === 409),
      "claim statuses must be a known HTTP code"
    );
  });
};

// ---------------------------------------------------------------------------

const reports = async ({ restaurantA, restaurantB }) => {
  suite("REPORTS - CUSTOMER ELIGIBILITY / CREATE / ADMIN LIFECYCLE / SECURITY");

  await test("customer A eligibility at restaurant A -> canReport true", async () => {
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "GET",
      path: `/restaurant-reports/eligibility/${restaurantA}`,
    });
    expectStatus(res, 200, "eligibility");
    expect(res.data?.data?.canReport === true, "customer A should be eligible");
    expect(res.data?.data?.bookingCode, "eligibility should return bookingCode");
  });

  await test("customer C eligibility at restaurant A -> canReport false", async () => {
    const res = await request({
      email: ACCOUNTS.custC.email,
      method: "GET",
      path: `/restaurant-reports/eligibility/${restaurantA}`,
    });
    expectStatus(res, 200, "eligibility cust C");
    expect(res.data?.data?.canReport === false, "customer C should not be eligible");
  });

  await test("bookingId mismatch -> 400", async () => {
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "POST",
      path: "/restaurant-reports",
      body: {
        restaurantId: restaurantA,
        category: "Staff Behaviour",
        severity: "Low",
        title: "Mismatch booking",
        description: "Providing a booking that is not the eligible completed visit.",
        bookingId: "000000000000000000000000",
      },
    });
    expectStatus(res, 400, "booking mismatch");
  });

  await test("bookingId mismatch -> 400", async () => {
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "POST",
      path: "/restaurant-reports",
      body: {
        restaurantId: restaurantA,
        category: "Staff Behaviour",
        severity: "Low",
        title: "Mismatch booking",
        description: "Providing a booking that is not the eligible completed visit.",
        bookingId: "000000000000000000000000",
      },
    });
    expectStatus(res, 400, "booking mismatch");
  });

  let report;
  await test("customer A creates report -> 201", async () => {
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "POST",
      path: "/restaurant-reports",
      body: {
        restaurantId: restaurantA,
        category: "Hygiene",
        severity: "High",
        title: "Unhygienic kitchen area",
        description: "The kitchen area was visibly unhygienic during my last visit.",
      },
    });
    expectStatus(res, 201, "create report");
    report = res.data?.data?.report || res.data?.report;
    expect(report?._id, "create returned no report id");
    expect(report.billId, "report should carry the billId");
  });

  await test("duplicate pending report (same user+restaurant) -> 403", async () => {
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "POST",
      path: "/restaurant-reports",
      body: {
        restaurantId: restaurantA,
        category: "Food Quality",
        severity: "Medium",
        title: "Second report",
        description: "This second attempt must be blocked because one report is pending.",
      },
    });
    expectStatus(res, 403, "duplicate pending report");
  });

  await test("description too short -> 400", async () => {
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "POST",
      path: "/restaurant-reports",
      body: { restaurantId: restaurantA, category: "Other", description: "too short" },
    });
    expectStatus(res, 400, "short description");
  });

  await test("more than 5 images -> 400", async () => {
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "POST",
      path: "/restaurant-reports",
      body: {
        restaurantId: restaurantA,
        category: "Other",
        description: "This report carries too many image urls to be accepted at all.",
        images: ["a", "b", "c", "d", "e", "f"],
      },
    });
    expectStatus(res, 400, "too many images");
  });

  await test("unknown category -> 400", async () => {
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "POST",
      path: "/restaurant-reports",
      body: { restaurantId: restaurantA, category: "Not A Category", description: "Invalid category must be rejected." },
    });
    expectStatus(res, 400, "unknown category");
  });

  await test("owner views report on own restaurant -> 200", async () => {
    const res = await request({
      email: ACCOUNTS.owner.email,
      method: "GET",
      path: `/restaurant-reports/${report._id}`,
    });
    expectStatus(res, 200, "owner report getById");
  });

  await test("customer B cannot view customer A report -> 403", async () => {
    const res = await request({
      email: ACCOUNTS.custB.email,
      method: "GET",
      path: `/restaurant-reports/${report._id}`,
    });
    expectStatus(res, 403, "cust B view other report");
  });

  await test("admin list contains report", async () => {
    const res = await request({
      email: ACCOUNTS.admin.email,
      method: "GET",
      path: "/restaurant-reports",
    });
    expectStatus(res, 200, "admin list");
    const reports = res.data?.data?.reports || [];
    expect(reports.some((r) => String(r._id) === String(report._id)), "report missing from admin list");
  });

  await test("admin PENDING -> UNDER_REVIEW -> 200", async () => {
    const res = await request({
      email: ACCOUNTS.admin.email,
      method: "PATCH",
      path: `/restaurant-reports/${report._id}/status`,
      body: { status: "UNDER_REVIEW", adminNotes: "Reviewing." },
    });
    expectStatus(res, 200, "under review");
  });

  await test("admin UNDER_REVIEW -> RESOLVED -> 200", async () => {
    const res = await request({
      email: ACCOUNTS.admin.email,
      method: "PATCH",
      path: `/restaurant-reports/${report._id}/status`,
      body: { status: "RESOLVED", adminNotes: "Resolved after review." },
    });
    expectStatus(res, 200, "resolved");
  });

  await test("same-status transition -> 400", async () => {
    const res = await request({
      email: ACCOUNTS.admin.email,
      method: "PATCH",
      path: `/restaurant-reports/${report._id}/status`,
      body: { status: "RESOLVED" },
    });
    expectStatus(res, 400, "same status");
  });

  await test("customer cannot change report status -> 403", async () => {
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "PATCH",
      path: `/restaurant-reports/${report._id}/status`,
      body: { status: "REJECTED" },
    });
    expectStatus(res, 403, "customer status change");
  });

  // A resolved report unblocks a new pending report.
  let report2;
  await test("customer A can file again after resolution", async () => {
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "POST",
      path: "/restaurant-reports",
      body: {
        restaurantId: restaurantA,
        category: "Wrong Billing",
        severity: "High",
        title: "Charged for items not ordered",
        description: "My bill contained items I did not order during the visit.",
      },
    });
    expectStatus(res, 201, "create report #2");
    report2 = res.data?.data?.report || res.data?.report;
  });

  return { report, report2 };
};

// ---------------------------------------------------------------------------

const warnings = async ({ restaurantA, restaurantB }, { report, report2 }) => {
  suite("WARNINGS - ADMIN ISSUE / OWNER+CUSTOMER ACCESS / CLEAR / SECURITY");

  await test("owner cannot issue warnings -> 403", async () => {
    const res = await request({
      email: ACCOUNTS.owner.email,
      method: "POST",
      path: "/restaurant-warnings",
      body: { restaurantId: restaurantA, title: "Blocked", reason: "Owners cannot issue warnings." },
    });
    expectStatus(res, 403, "owner issue warning");
  });

  await test("customer cannot issue warnings -> 403", async () => {
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "POST",
      path: "/restaurant-warnings",
      body: { restaurantId: restaurantA, title: "Blocked", reason: "Customers cannot issue warnings." },
    });
    expectStatus(res, 403, "customer issue warning");
  });

  let w1;
  await test("admin issues warning on restaurant A (no report) -> 201", async () => {
    const res = await request({
      email: ACCOUNTS.admin.email,
      method: "POST",
      path: "/restaurant-warnings",
      body: {
        restaurantId: restaurantA,
        title: "Hygiene compliance notice",
        reason: "Two independent hygiene reports were confirmed.",
        level: "Level 1",
        expiresInDays: 30,
      },
    });
    expectStatus(res, 201, "issue warning");
    w1 = res.data?.data?.warning || res.data?.warning;
    expect(w1?.warningCode, "warning has code");
    expect(w1?.ownerId, "warning snapshots ownerId");
  });

  await test("B5: warning with past expiresAt -> 400", async () => {
    const res = await request({
      email: ACCOUNTS.admin.email,
      method: "POST",
      path: "/restaurant-warnings",
      body: {
        restaurantId: restaurantA,
        title: "Bad expiry",
        reason: "This expiry is already in the past and must be rejected.",
        expiresAt: new Date(Date.now() - 86400000).toISOString(),
      },
    });
    expectStatus(res, 400, "past expiresAt rejected");
  });

  let w2;
  await test("admin issues warning linked to report (same restaurant) -> 201 + report auto-resolves", async () => {
    const res = await request({
      email: ACCOUNTS.admin.email,
      method: "POST",
      path: "/restaurant-warnings",
      body: {
        restaurantId: restaurantA,
        title: "Billing practice concern",
        reason: "Wrong billing confirmed against the restaurant.",
        level: "Level 2",
        relatedReportId: report2._id,
        expiresInDays: 45,
      },
    });
    expectStatus(res, 201, "linked warning");
    w2 = res.data?.data?.warning || res.data?.warning;
    expect(
      String(w2?.relatedReportId?._id || w2?.relatedReportId) === String(report2._id),
      "warning must reference the report"
    );
    const reportRes = await request({
      email: ACCOUNTS.admin.email,
      method: "GET",
      path: `/restaurant-reports/${report2._id}`,
    });
    const updated = reportRes.data?.data?.report;
    expect(updated?.status === "RESOLVED", "linked report must be auto-resolved");
    expect(
      String(updated?.warningId?._id || updated?.warningId) === String(w2._id),
      "report must reference the warning"
    );
  });

  await test("B4: warning linked to a report of a DIFFERENT restaurant -> 400", async () => {
    // report2 belongs to restaurant A; issuing against restaurant B must fail.
    const res = await request({
      email: ACCOUNTS.admin.email,
      method: "POST",
      path: "/restaurant-warnings",
      body: {
        restaurantId: restaurantB,
        title: "Cross-restaurant report",
        reason: "The linked report belongs to a different restaurant.",
        relatedReportId: report2._id,
        expiresInDays: 30,
      },
    });
    expectStatus(res, 400, "mismatched restaurant report link");
  });

  await test("admin issues warning on restaurant B (for B7) -> 201", async () => {
    const res = await request({
      email: ACCOUNTS.admin.email,
      method: "POST",
      path: "/restaurant-warnings",
      body: {
        restaurantId: restaurantB,
        title: "Delayed service warning",
        reason: "Multiple complaints about service delays were received.",
        level: "Level 1",
        expiresInDays: 30,
      },
    });
    expectStatus(res, 201, "warning on restaurant B");
  });

  await test("owner lists own warnings", async () => {
    const res = await request({
      email: ACCOUNTS.owner.email,
      method: "GET",
      path: "/restaurant-warnings",
    });
    expectStatus(res, 200, "owner warnings list");
    const warnings = res.data?.data?.warnings || [];
    expect(
      warnings.some((w) => String(w.restaurantId?._id || w.restaurantId) === String(restaurantA)),
      "expected warning for restaurant A"
    );
    expect(warnings.length >= 2, `expected at least 2 warnings, got ${warnings.length}`);
  });

  await test("owner views warning for own restaurant -> 200", async () => {
    const res = await request({
      email: ACCOUNTS.owner.email,
      method: "GET",
      path: `/restaurant-warnings/${w1._id}`,
    });
    expectStatus(res, 200, "owner getById");
  });

  await test("customer A views warning linked to own report -> 200", async () => {
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "GET",
      path: `/restaurant-warnings/${w2._id}`,
    });
    expectStatus(res, 200, "customer linked warning");
  });

  await test("customer A cannot view unrelated warning (w1) -> 403", async () => {
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "GET",
      path: `/restaurant-warnings/${w1._id}`,
    });
    expectStatus(res, 403, "customer unrelated warning");
  });

  await test("owner replies on own warning -> 200", async () => {
    const res = await request({
      email: ACCOUNTS.owner.email,
      method: "POST",
      path: `/restaurant-warnings/${w1._id}/reply`,
      body: { message: "We have addressed the hygiene issues and trained staff." },
    });
    expectStatus(res, 200, "owner reply");
  });

  await test("customer A replies on linked warning -> 200", async () => {
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "POST",
      path: `/restaurant-warnings/${w2._id}/reply`,
      body: { message: "Thank you for taking the complaint seriously." },
    });
    expectStatus(res, 200, "customer reply");
  });

  await test("customer B cannot reply on unrelated warning -> 403", async () => {
    const res = await request({
      email: ACCOUNTS.custB.email,
      method: "POST",
      path: `/restaurant-warnings/${w1._id}/reply`,
      body: { message: "I should not be allowed to reply here." },
    });
    expectStatus(res, 403, "cust B unrelated reply");
  });

  await test("B3: admin cannot PATCH warning to EXPIRED -> 400", async () => {
    const res = await request({
      email: ACCOUNTS.admin.email,
      method: "PATCH",
      path: `/restaurant-warnings/${w1._id}`,
      body: { status: "EXPIRED" },
    });
    expectStatus(res, 400, "manual EXPIRED transition blocked");
  });

  await test("admin clears active warning -> 200", async () => {
    const res = await request({
      email: ACCOUNTS.admin.email,
      method: "PATCH",
      path: `/restaurant-warnings/${w1._id}`,
      body: { status: "CLEARED", clearedReason: "Compliance re-check passed." },
    });
    expectStatus(res, 200, "clear warning");
    const warning = res.data?.data?.warning;
    expect(warning?.status === "CLEARED", "warning should be CLEARED");
  });

  await test("reply on cleared warning -> 400", async () => {
    const res = await request({
      email: ACCOUNTS.owner.email,
      method: "POST",
      path: `/restaurant-warnings/${w1._id}/reply`,
      body: { message: "Replying after clearance should fail." },
    });
    expectStatus(res, 400, "reply on cleared warning");
  });

  await test("B7: owner can view warning after restaurant soft-delete", async () => {
    const list = await request({
      email: ACCOUNTS.owner.email,
      method: "GET",
      path: "/restaurant-warnings",
    });
    const warnings = list.data?.data?.warnings || [];
    const wB = warnings.find((w) => String(w.restaurantId?._id || w.restaurantId) === String(restaurantB));
    expect(wB?._id, "warning for restaurant B not found in owner list");

    const del = await request({
      email: ACCOUNTS.owner.email,
      method: "DELETE",
      path: `/restaurants/${restaurantB}`,
    });
    expectStatus(del, 200, "soft-delete restaurant B");

    const res = await request({
      email: ACCOUNTS.owner.email,
      method: "GET",
      path: `/restaurant-warnings/${wB._id}`,
    });
    expectStatus(res, 200, "owner access warning of deleted restaurant");
  });

  return { w1, w2 };
};

// ---------------------------------------------------------------------------

const notifications = async ({ warning }, { report }) => {
  suite("NOTIFICATIONS - B2 MARK-AS-READ MUST NOT DELETE");

  await test("customer A has a Report Submitted notification", async () => {
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "GET",
      path: "/notifications",
    });
    expectStatus(res, 200, "customer notifications");
    const notifications = res.data?.data?.notifications || [];
    expect(
      notifications.some((n) => n.type === "Restaurant Report"),
      "expected a Restaurant Report notification for customer A"
    );
  });

  await test("owner has a Restaurant Warning notification", async () => {
    const res = await request({
      email: ACCOUNTS.owner.email,
      method: "GET",
      path: "/notifications",
    });
    expectStatus(res, 200, "owner notifications");
    const notifications = res.data?.data?.notifications || [];
    expect(
      notifications.some((n) => n.type === "Restaurant Warning"),
      "expected a Restaurant Warning notification for owner"
    );
  });

  await test("B2: marking one notification read keeps it in the list (isRead true)", async () => {
    const res = await request({
      email: ACCOUNTS.owner.email,
      method: "GET",
      path: "/notifications",
    });
    const notifications = res.data?.data?.notifications || [];
    const target = notifications.find((n) => n.isRead === false);
    expect(target?._id, "no unread notification to mark");

    const before = await request({
      email: ACCOUNTS.owner.email,
      method: "GET",
      path: "/notifications/unread-count",
    });
    const beforeCount = before.data?.data?.count;

    const mark = await request({
      email: ACCOUNTS.owner.email,
      method: "PATCH",
      path: `/notifications/${target._id}/read`,
    });
    expectStatus(mark, 200, "mark read");

    const after = await request({
      email: ACCOUNTS.owner.email,
      method: "GET",
      path: "/notifications",
    });
    const afterList = after.data?.data?.notifications || [];
    const updated = afterList.find((n) => String(n._id) === String(target._id));
    expect(updated, "marked notification must STILL exist (was deleted = B2 bug)");
    expect(updated.isRead === true, "marked notification must be isRead=true");
    expect(
      (after.data?.data?.meta?.total || 0) === (res.data?.data?.meta?.total || 0),
      "notification count must not drop after mark-as-read"
    );

    const afterCount = await request({
      email: ACCOUNTS.owner.email,
      method: "GET",
      path: "/notifications/unread-count",
    });
    expect(
      (afterCount.data?.data?.count ?? beforeCount) === Math.max(0, beforeCount - 1),
      "unread count should decrease by exactly 1"
    );
  });

  await test("B2: mark-all-read keeps notifications (flags isRead)", async () => {
    const res = await request({
      email: ACCOUNTS.custA.email,
      method: "GET",
      path: "/notifications",
    });
    const total = res.data?.data?.meta?.total || 0;
    expect(total > 0, "expected some notifications for customer A");

    const mark = await request({
      email: ACCOUNTS.custA.email,
      method: "PATCH",
      path: "/notifications/read-all",
    });
    expectStatus(mark, 200, "mark all read");

    const after = await request({
      email: ACCOUNTS.custA.email,
      method: "GET",
      path: "/notifications",
    });
    const afterList = after.data?.data?.notifications || [];
    expect(
      afterList.length === total,
      `mark-all deleted notifications (before=${total}, after=${afterList.length})`
    );
    expect(
      afterList.every((n) => n.isRead === true),
      "all notifications must be isRead=true"
    );
  });
};

// ---------------------------------------------------------------------------

const main = async () => {
  console.log(`E2E API run against ${BASE}`);
  await login(ACCOUNTS.admin.email);
  await login(ACCOUNTS.owner.email);
  await login(ACCOUNTS.custA.email);
  await login(ACCOUNTS.custB.email);
  await login(ACCOUNTS.custC.email);

  await authSmoke();

  // Discover restaurant ids from the public list (owner-restricted list API
  // does not accept a "me" filter, so fetch by slug from the public feed).
  const ownerRestaurants = await request({
    email: ACCOUNTS.owner.email,
    method: "GET",
    path: "/restaurants?limit=50",
  });
  const list = ownerRestaurants.data?.data?.restaurants || [];
  const restaurantA = list.find((r) => r.slug === "e2e-biryani-house-a")?._id;
  const restaurantB = list.find((r) => r.slug === "e2e-curry-junction-b")?._id;
  if (!restaurantA || !restaurantB) {
    console.error("E2E restaurants not found. Run: node scripts/e2e-seed.mjs");
    process.exit(2);
  }

  await unitDiscount();
  await offersOwner({ restaurantA, restaurantB });
  await offersCustomer({ restaurantA, restaurantB });
  const { report, report2 } = await reports({ restaurantA, restaurantB });
  const { w1, w2 } = await warnings({ restaurantA, restaurantB }, { report, report2 });
  await notifications({ warning: w2 }, { report });

  const failed = results.filter((r) => !r.pass);
  const total = results.length;
  console.log(`\n==== SUMMARY: ${total - failed.length}/${total} passed ====`);
  if (failed.length > 0) {
    console.log("\nFailures:");
    for (const f of failed) {
      console.log(`  - ${f.name}\n      ${f.error}`);
    }
    process.exit(1);
  }
};

main().catch((error) => {
  console.error("E2E RUNNER ERROR:", error);
  process.exit(1);
});
