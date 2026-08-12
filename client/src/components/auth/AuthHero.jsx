/**
 * "Book / Dine / Enjoy" hero statement for the TableSpot auth screens.
 *
 * Theme-aware purely through existing CSS variables and the `.dark` variant —
 * no JS theme logic needed here. "Dine" is the red focal point, with a subtle
 * hand-drawn swoosh accent. A matching swoosh sits under the subtitle.
 */
function AuthHero() {
  return (
    <section className="auth-hero" aria-label="TableSpot — Book, Dine, Enjoy">
      <h2 className="auth-hero-heading">
        <span className="auth-hero-word auth-hero-word--solid">Book</span>
        <span className="auth-hero-word auth-hero-word--accent">
          Dine
          <svg
            className="auth-hero-swoosh"
            viewBox="0 0 170 34"
            fill="none"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M7 27 C 52 7, 112 4, 158 17"
              stroke="#ef1b23"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d="M15 31 C 60 14, 106 11, 151 21"
              stroke="#ef1b23"
              strokeWidth="2.2"
              strokeLinecap="round"
              opacity="0.35"
            />
          </svg>
        </span>
        <span className="auth-hero-word auth-hero-word--solid">Enjoy</span>
      </h2>

      <p className="auth-hero-subtitle">
        Discover great places. Reserve your table.
        <svg
          className="auth-hero-subline"
          viewBox="0 0 170 16"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M5 9 C 52 3, 116 4, 164 7"
            stroke="#ef1b23"
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity="0.6"
          />
        </svg>
      </p>
    </section>
  );
}

export default AuthHero;
