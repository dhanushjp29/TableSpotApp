import { useCallback, useEffect, useState } from "react";
import { EVENTS, Joyride, STATUS } from "react-joyride";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";
import "./TableSpotJoyride.css";

/*
 * Single Joyride controller for the whole app.
 * react-joyride v3 API: events are delivered through `onEvent(data, controls)`,
 * NOT the removed v2 `callback` prop.
 *
 * The tour only starts AFTER the splash screen has fully finished: the
 * `splashDone` prop is driven by App's existing `showSplash` state, and the
 * tour only runs for first-time users. Completion is persisted in localStorage
 * under `tablespot_joyride_completed` (separate from the splash's
 * sessionStorage `tablespot_splash_seen` flag).
 *
 * Route changes never advance a step before the target page exists:
 * every cross-page step is started only after the target DOM node is mounted
 * and visible (see waitForTarget below). Missing targets end the tour
 * gracefully instead of trapping the user behind the overlay.
 */

const COMPLETED_KEY = "tablespot_joyride_completed";
const TARGET_LOGIN = "[data-joyride='quick-login']";
const TARGET_RESTAURANTS = "[data-joyride='restaurants-content']";
const TARGET_NAVBAR = "[data-joyride='main-navbar']";

const steps = [
  {
    target: TARGET_LOGIN,
    title: "Welcome to TableSpot",
    content:
      "Choose a role to explore TableSpot from a different perspective. Customers discover and book, owners manage restaurants, and admins manage the platform.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: TARGET_RESTAURANTS,
    title: "Discover restaurants",
    content:
      "Explore restaurants, cuisines and dining options available on TableSpot.",
    placement: "center",
    skipBeacon: true,
  },
  {
    target: TARGET_NAVBAR,
    title: "Your TableSpot navigation",
    content:
      "Use the navigation bar to explore restaurants, food, your dashboard and account options.",
    placement: "bottom",
    skipBeacon: true,
  },
];

const joyrideStyles = {
  tooltip: {
    border: "1px solid rgba(255,255,255,.14)",
    borderRadius: 20,
    boxShadow: "0 24px 70px rgba(45, 4, 12, .38)",
    padding: "20px",
    width: "min(360px, calc(100vw - 32px))",
  },
  tooltipTitle: { fontSize: 17, fontWeight: 800, marginBottom: 8 },
  tooltipContent: {
    color: "rgba(255,255,255,.72)",
    fontSize: 13,
    lineHeight: 1.55,
    padding: 0,
  },
  buttonPrimary: {
    background: "#c2221f",
    borderRadius: 10,
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    padding: "9px 14px",
  },
  buttonBack: { color: "rgba(255,255,255,.62)", fontSize: 12 },
  buttonSkip: { color: "rgba(255,255,255,.55)", fontSize: 12 },
};

const joyrideOptions = {
  arrowColor: "#381018",
  backgroundColor: "#381018",
  blockTargetInteraction: true,
  overlayColor: "rgba(17, 3, 8, .66)",
  primaryColor: "#e24a45",
  textColor: "#fff",
  zIndex: 10000,
  buttons: ["back", "primary", "skip"],
  overlayClickAction: false,
  dismissKeyAction: false,
  showProgress: true,
  spotlightPadding: 8,
};

function isElementVisible(el) {
  if (!el || !(el instanceof Element)) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  let node = el;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
    node = node.parentElement;
  }
  return true;
}

function targetAvailable(selector) {
  try {
    const el = document.querySelector(selector);
    return !!el && isElementVisible(el);
  } catch {
    return false;
  }
}

function waitForTarget(selector, timeout = 2500) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const poll = () => {
      if (targetAvailable(selector)) {
        resolve(true);
        return;
      }
      if (Date.now() - startTime >= timeout) {
        resolve(false);
        return;
      }
      setTimeout(poll, 50);
    };
    poll();
  });
}

export default function TableSpotJoyride({ splashDone = true }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isInitialized } = useAuth();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(() => {
    try {
      return localStorage.getItem(COMPLETED_KEY) === "true";
    } catch {
      return false;
    }
  });

  const isJoyrideLogin =
    location.pathname === "/login" &&
    new URLSearchParams(location.search).get("joyride") === "true";

  const endTour = useCallback(() => {
    try {
      localStorage.setItem(COMPLETED_KEY, "true");
    } catch {
      // Storage can be blocked in privacy-restricted environments; still end the tour in-memory.
    }
    setCompleted(true);
    setStarted(false);
    setRun(false);
    navigate("/restaurants", { replace: true });
  }, [navigate]);

  // Kick off the tour for a fresh session that lands on the app root or the
  // restaurants page. Normal /login keeps its existing behavior. The tour is
  // held until the splash screen has fully finished (splashDone) so the first
  // tooltip never appears on top of the splash.
  useEffect(() => {
    if (!isInitialized || completed || started) return;
    if (!splashDone) return;
    if (location.pathname === "/" || location.pathname === "/restaurants") {
      setStarted(true);
      navigate("/login?joyride=true", { replace: true });
    }
  }, [isInitialized, completed, started, splashDone, location.pathname, navigate]);

  // STEP 0 — login page: wait for the quick-login target before starting.
  useEffect(() => {
    if (completed || !started || run) return;
    if (stepIndex !== 0 || !isJoyrideLogin) return;
    let cancelled = false;
    waitForTarget(TARGET_LOGIN).then((found) => {
      if (cancelled) return;
      if (!found) {
        console.warn("Joyride target not found:", TARGET_LOGIN);
        endTour();
        return;
      }
      setRun(true);
    });
    return () => {
      cancelled = true;
    };
  }, [completed, started, run, stepIndex, isJoyrideLogin, endTour]);

  // STEP 1 — restaurants page: wait for the route AND the content target before starting.
  useEffect(() => {
    if (completed || !started || run) return;
    if (stepIndex !== 1 || location.pathname !== "/restaurants") return;
    let cancelled = false;
    waitForTarget(TARGET_RESTAURANTS).then((found) => {
      if (cancelled) return;
      if (!found) {
        console.warn("Joyride target not found:", TARGET_RESTAURANTS);
        endTour();
        return;
      }
      setRun(true);
    });
    return () => {
      cancelled = true;
    };
  }, [completed, started, run, stepIndex, location.pathname, endTour]);

  // Safety net: if the tour is running on a page that has no step target, end it
  // instead of trapping the user behind the overlay.
  useEffect(() => {
    if (completed || !run) return;
    const onLogin = isJoyrideLogin && stepIndex === 0;
    const onRestaurants =
      location.pathname === "/restaurants" && (stepIndex === 1 || stepIndex === 2);
    if (!onLogin && !onRestaurants) {
      console.warn("Joyride running outside its tour pages; ending tour.");
      endTour();
    }
  }, [completed, run, stepIndex, isJoyrideLogin, location.pathname, endTour]);

  const handleEvent = useCallback(
    (data) => {
      if (data.type === EVENTS.TOUR_END) {
        if (data.status === STATUS.SKIPPED || data.status === STATUS.FINISHED) {
          endTour();
        }
        return;
      }
      if (data.type === EVENTS.TARGET_NOT_FOUND) {
        console.warn("Joyride target not found:", data.step?.target);
        return;
      }
      if (data.type === EVENTS.ERROR) {
        console.warn("Joyride error:", data.error?.message || String(data.error));
        return;
      }
      if (data.type !== EVENTS.STEP_AFTER) return;

      const { action, index } = data;

      // STEP 0 -> 1: stop the tour, navigate, and let the restaurants effect
      // wait for the target before resuming. Never start a step on a page
      // that does not exist yet.
      if (action === "next" && index === 0) {
        setRun(false);
        setStepIndex(1);
        navigate("/restaurants", { replace: true });
        return;
      }

      // Last step -> complete the tour.
      if (action === "next" && index === steps.length - 1) {
        endTour();
        return;
      }

      if (action === "next") {
        const nextStep = steps[index + 1];
        if (!nextStep || !targetAvailable(nextStep.target)) {
          console.warn("Joyride target not found:", nextStep?.target);
          endTour();
          return;
        }
        setStepIndex(index + 1);
        return;
      }

      // STEP 1 -> 0: go back to the login tour step.
      if (action === "prev" && index === 1) {
        setRun(false);
        setStepIndex(0);
        navigate("/login?joyride=true", { replace: true });
        return;
      }

      if (action === "prev") {
        setStepIndex(Math.max(0, index - 1));
        return;
      }

      // Close (safety net: close button / overlay / ESC). End gracefully.
      if (action === "close") {
        endTour();
      }
    },
    [navigate, endTour]
  );

  if (completed) return null;

  return (
    <Joyride
      continuous
      run={run}
      stepIndex={stepIndex}
      steps={steps}
      onEvent={handleEvent}
      styles={joyrideStyles}
      options={joyrideOptions}
      locale={{ back: "Back", last: "Done", next: "Next", skip: "Skip" }}
      scrollToFirstStep
    />
  );
}
