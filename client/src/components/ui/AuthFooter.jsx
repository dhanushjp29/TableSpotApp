import { Mail, Phone } from "lucide-react";
import { useTheme } from "../../hooks/useTheme.js";

const SUPPORT_EMAIL = "tablespotapp@gmail.com";
const SUPPORT_PHONE = "+916374428721";

function AuthFooter() {
  const { resolvedTheme } = useTheme();
  const logo = resolvedTheme === "dark" ? "/authfooter_dark.png" : "/authfooter_light.png";

  return (
    <footer
      className="mt-10 w-screen border-t border-border bg-surface-secondary/70 py-6 backdrop-blur-sm"
      style={{ marginLeft: "calc(50% - 50vw)" }}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <img src={logo} alt="TableSpot" className="h-10 w-auto object-contain" />
          <p className="text-sm text-text-secondary sm:border-l sm:border-border sm:pl-4">
            Smart restaurant reservations, billing and dining management.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-5">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-primary"
          >
            <Mail size={15} className="shrink-0 text-primary" />
            {SUPPORT_EMAIL}
          </a>
          <a
            href={`tel:${SUPPORT_PHONE}`}
            className="flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-primary"
          >
            <Phone size={15} className="shrink-0 text-primary" />
            {SUPPORT_PHONE}
          </a>
          <p className="text-sm text-text-secondary sm:border-l sm:border-border sm:pl-5">
            © {new Date().getFullYear()} TableSpot. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default AuthFooter;
