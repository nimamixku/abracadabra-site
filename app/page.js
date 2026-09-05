import TryItDemo from "./TryItDemo";
import TryItClearHint from "./TryItClearHint";
import MarketingMarquee from "./MarketingMarquee";
import AmbientLoop from "./AmbientLoop";

export const metadata = {
  title: "ABRACADABRA — a shop that never buries your work",
  description:
    "Drop in a few of your own images and try the real shop, no account needed. An endless shuffling feed and a one-tap checkout, so people find everything you've made.",
};

export default function MarketingHome() {
  return (
    <main className="marketing">
      <div className="masthead-group">
        <div className="masthead">
          <span className="brand">
            ABRACADABRA <span className="brand-sub">shop</span>
          </span>
        </div>

        <MarketingMarquee />
      </div>

      <section className="marketing-hero marketing-hero-split">
        <div className="marketing-hero-demo">
          <div className="tryit-copy-col">
            <h2 className="tryit-section-heading">Try it before you buy it</h2>
            <p className="tryit-tagline">
              A free look at your own work in the real feed — this is what
              building your shop actually feels like.
            </p>
            <TryItClearHint />
          </div>
          <TryItDemo />
        </div>
        <div className="marketing-hero-copy">
          {/* Mobile only: this inner box (kicker + h1 + ambient phone) is
              the boxed/card treatment -- sized to just this content, not
              stretched down to the paragraph below. The paragraph itself
              sits outside the box, directly on the page background (see
              .marketing-hero-topbox in the mobile media query). */}
          <div className="marketing-hero-topbox">
            <p className="marketing-kicker">for artists</p>
            <h1>
              <span className="hero-line">feels like posting.</span>
              <span className="hero-line">instant pay &amp; download.</span>
              <span className="hero-line">infinite scroll and shuffle.</span>
            </h1>
            {/* Mobile only (see .hero-mobile-ambient, hidden everywhere else) --
                the small passive/ambient phone, same component already used
                below in .ambient-section, just a second instance here at a
                smaller size so it can sit next to the headline on mobile.
                Never the interactive try-it phone -- that one stays full size,
                in its own full section below (see .marketing-hero-demo). */}
            <div className="hero-mobile-ambient" aria-hidden="true">
              <AmbientLoop />
            </div>
          </div>
          <p className="marketing-sub">
            Just easier — no cart, no checkout, and your entire catalog
            stays on display, not just what's newest. No forced cropping, no
            quality loss, ever. Drag and drop, or bulk upload up to 90
            files. Pick your own background and text color, and get paid
            straight to your account on every sale.
          </p>
        </div>
        {/* Mobile only -- a thin, quiet divider between the copy above and
            the interactive try-it phone below: several close, hairline-thin
            colored lines that gently pulse, echoing the founder's own rough
            sketch of it. Placed in the grid via its own explicit `order` so
            it lands between the two, not tied to either one's own layout. */}
        <div className="hero-mobile-divider" aria-hidden="true">
          <span className="hero-divider-line" style={{ background: "#a878ff" }} />
          <span className="hero-divider-line" style={{ background: "#e05a3c" }} />
          <span className="hero-divider-line" style={{ background: "#e0c83c" }} />
          <span className="hero-divider-line" style={{ background: "#7ac97a" }} />
          <span className="hero-divider-line" style={{ background: "#3bb8c9" }} />
          <span className="hero-divider-line" style={{ background: "#e0508a" }} />
        </div>
      </section>

      <section className="marketing-section marketing-cta-section marketing-cta-section-tight">
        <p className="marketing-sub">
          You just tried it. Creating the real thing takes about as long —
          drop in your actual catalog and it's live in minutes.
        </p>
        <a className="marketing-cta-primary" href="/login">
          Create your shop
        </a>
      </section>

      <section className="ambient-section">
        <div className="ambient-left">
          <p className="ambient-tagline">A feed that never buries your work</p>
        </div>
        <div className="ambient-right">
          <AmbientLoop />
          <div className="ambient-cards">
            <div className="marketing-card marketing-card-compact">
              <div className="marketing-card-text">
                <h3>No manual merchandising, ever.</h3>
                <p>
                  The feed shuffles on its own — no homepage to arrange, no
                  decision about what goes first.
                </p>
              </div>
            </div>
            <div className="marketing-card marketing-card-compact">
              <div className="marketing-icon marketing-icon-cart" aria-hidden="true">
                <svg viewBox="0 0 40 40" width="22" height="22" fill="none">
                  <path
                    d="M10 14 H30 L27 26 H13 Z"
                    stroke="var(--accent)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 14 L7 8 H4"
                    stroke="var(--accent)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="15.5" cy="30.5" r="1.8" fill="var(--accent)" />
                  <circle cx="24.5" cy="30.5" r="1.8" fill="var(--accent)" />
                  <line
                    x1="6"
                    y1="6"
                    x2="34"
                    y2="34"
                    stroke="var(--accent)"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="marketing-card-text">
                <h3>No cart, ever.</h3>
                <p>
                  Apple Pay or Google Pay, right from the feed — no cart, no
                  account required to buy.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-grid">
          <div className="marketing-card">
            <div className="marketing-card-text">
              <h3>No forced cropping, ever.</h3>
              <p>
                Every photo shows at its own real shape — no square grid
                squeezing it to fit. A piece with more than one photo keeps
                each one's own shape too, never locked to match the others.
              </p>
            </div>
          </div>
          <div className="marketing-card">
            <div className="marketing-card-text">
              <h3>No platform-driven quality loss, ever.</h3>
              <p>
                No compression, no forced re-encoding. What people see — and
                what they download after buying — is always your real,
                original file.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-section-alt">
        <div className="marketing-grid">
          <div className="marketing-card">
            <div className="marketing-icon marketing-icon-phone" aria-hidden="true">
              <svg viewBox="0 0 40 40" width="22" height="22" fill="none">
                <rect x="12" y="4" width="16" height="32" rx="4" stroke="var(--accent)" strokeWidth="2" />
                <line x1="16" y1="12" x2="24" y2="12" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
                <line x1="16" y1="18" x2="24" y2="18" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
                <line x1="16" y1="24" x2="21" y2="24" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="marketing-card-text">
              <h3>Feels like posting, not work.</h3>
              <p>
                Choose your photo, audio, or video, add a caption and a price.
                Publish — the same motion as posting anywhere else.
              </p>
            </div>
          </div>
          <div className="marketing-card">
            <div className="marketing-icon marketing-icon-palette" aria-hidden="true">
              <span className="marketing-icon-palette-grid">
                <span style={{ background: "#a878ff" }} />
                <span style={{ background: "#e0607a" }} />
                <span style={{ background: "#e0a83c" }} />
                <span style={{ background: "#3ba8c9" }} />
              </span>
            </div>
            <div className="marketing-card-text">
              <h3>Choose your palette.</h3>
              <p>
                Pick your shop's background and text color and it instantly
                feels like you.
              </p>
            </div>
          </div>
          <div className="marketing-card">
            <div className="marketing-icon marketing-icon-money" aria-hidden="true">$</div>
            <div className="marketing-card-text">
              <h3>You get paid directly.</h3>
              <p>
                Every sale lands straight in your own connected account,
                instantly — a small platform fee, and the rest is already
                yours.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-cta-section">
        <p className="marketing-sub">
          You just tried it. Creating the real thing takes about as long —
          drop in your actual catalog and it's live in minutes.
        </p>
        <a className="marketing-cta-primary" href="/login">
          Create your shop
        </a>
      </section>

      <footer className="marketing-footer">
        <p>ABRACADABRA</p>
      </footer>
    </main>
  );
}
