import { useEffect, useState } from "react";
import "./SplashScreen.css";

export default function SplashScreen({ onComplete }) {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const leaveAfter = reduced ? 220 : 3300;
    const completeAfter = reduced ? 520 : 4080;
    const leaveTimer = window.setTimeout(() => setIsLeaving(true), leaveAfter);
    const completeTimer = window.setTimeout(onComplete, completeAfter);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className={`ts-splash${isLeaving ? " ts-splash--leaving" : ""}`} role="status" aria-label="Loading TableSpot" aria-hidden={isLeaving}>
      <div className="ts-splash__ambient" />
      <div className="ts-splash__wave" aria-hidden="true" />
      <div className="ts-splash__logo-stage">
        <img className="ts-splash__logo" src="/blacklogo.svg" width="1414" height="1021" alt="TableSpot" />
      </div>
    </div>
  );
}
