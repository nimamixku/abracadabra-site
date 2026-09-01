import TryItDemo from "./TryItDemo";
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
              A free look at your own work in the real feed — before you build
              anything.
            </p>
            <p className="tryit-copy-hint tryit-hint-drag">drag &amp; drop / tap &amp; upload any image to preview</p>
            <p className="tryit-copy-hint tryit-hint-tap">tap &amp; upload any image to preview</p>
            <p className="tryit-copy-hint tryit-copy-hint-tight tryit-clear-hint-desktop">tap clear to reset and see again</p>
            <p className="tryit-copy-hint tryit-copy-hint-tight tryit-clear-hint-mobile">
              tap <span className="tryit-clear-chip">clear</span> to reset
            </p>
          </div>
          <TryItDemo />
        </div>
        <div className="marketing-hero-copy">
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
          <p className="marketing-sub">
            Just easier — no cart, no checkout, and your entire catalog
            stays on display, not just what's newest. No forced cropping, no
            quality loss, ever. Drag and drop, or bulk upload up to 90
            files. Pick your own background and text color, and get paid
            straight to your account on every sale.
          </p>
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
              <h3>No manual merchandising, ever.</h3>
              <p>
                The feed shuffles on its own — no homepage to arrange, no
                decision about what goes first.
              </p>
            </div>
            <div className="marketing-card marketing-card-compact">
              <h3>No cart, ever.</h3>
              <p>
                Apple Pay or Google Pay, right from the feed — no cart, no
                account required to buy.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-grid">
          <div className="marketing-card">
            <h3>No forced cropping, ever.</h3>
            <p>
              Every photo shows at its own real shape — no square grid
              squeezing it to fit. A piece with more than one photo keeps
              each one's own shape too, never locked to match the others.
            </p>
          </div>
          <div className="marketing-card">
            <h3>No platform-driven quality loss, ever.</h3>
            <p>
              No compression, no forced re-encoding. What people see — and
              what they download after buying — is always your real,
              original file.
            </p>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-section-alt">
        <div className="marketing-grid">
          <div className="marketing-card">
            <h3>Feels like posting, not paperwork.</h3>
            <p>
              Drop in a file, add a caption and a price, publish — the same
              motion as posting anywhere else, just with a price attached.
            </p>
          </div>
          <div className="marketing-card">
            <h3>Color palette is customizable — nothing else is.</h3>
            <p>
              Pick your shop's background and text color and make it feel
              like yours. Everything else — the feed, the checkout, every
              gesture — stays the same as every other shop on the platform,
              so buyers already know how it works the moment they land.
            </p>
          </div>
          <div className="marketing-card">
            <h3>You get paid directly.</h3>
            <p>
              Every sale is charged straight to your own connected account.
              We take a small platform fee — the rest lands with you, same
              purchase, no waiting on us to forward it.
            </p>
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
