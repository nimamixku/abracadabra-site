export const metadata = {
  title: "ABRACADABRA — a shop that never buries your work",
  description:
    "An endless shuffling feed and a one-tap checkout, so people find everything you've made and buy without a cart getting in the way. Free to start.",
};

export default function MarketingHome() {
  return (
    <main className="marketing">
      <section className="marketing-hero">
        <p className="marketing-kicker">for artists</p>
        <h1>Your work deserves a feed that never buries it.</h1>
        <p className="marketing-sub">
          Every social platform hides your back catalog the moment it scrolls
          away. Every shop builder makes you decide what goes first, then
          drops a cart between someone loving your work and actually owning
          it. ABRACADABRA does none of that — an endless shuffling feed and a
          one-tap checkout, so every piece keeps surfacing and buying never
          takes more than a tap.
        </p>
        <div className="marketing-cta-row">
          <a className="marketing-cta-primary" href="/login">
            Create your shop
          </a>
        </div>
      </section>

      <section className="marketing-section">
        <h2>The problem with everywhere else</h2>
        <div className="marketing-grid">
          <div className="marketing-card">
            <h3>Instagram buries your catalog</h3>
            <p>
              The moment a piece scrolls off the feed, it's effectively gone —
              there's no way for someone who loves your work to easily find
              and revisit it.
            </p>
          </div>
          <div className="marketing-card">
            <h3>Shop builders force a decision</h3>
            <p>
              A curated homepage means picking what goes first, every time you
              add something new. A cart adds friction right between "I love
              this" and "I own this."
            </p>
          </div>
          <div className="marketing-card">
            <h3>This does neither</h3>
            <p>
              Shuffle means every piece surfaces on its own — no manual
              merchandising decision to make. One tap with Apple Pay or Google
              Pay means people buy and keep scrolling.
            </p>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-section-alt">
        <h2>Built for artists, not admins</h2>
        <div className="marketing-grid">
          <div className="marketing-card">
            <h3>Post like you already do</h3>
            <p>
              Drop in a file, add a caption and a price, publish. No forced
              cropping and no quality loss, ever — your photo shows at its own
              shape, and what a buyer downloads is always your original file.
            </p>
          </div>
          <div className="marketing-card">
            <h3>Make it feel like yours</h3>
            <p>
              Pick your shop's background and text color. Everything else —
              the feed, the checkout, every gesture — stays the same as every
              other shop on the platform, so buyers already know how it
              works the moment they land.
            </p>
          </div>
          <div className="marketing-card">
            <h3>You get paid directly</h3>
            <p>
              Every sale is charged straight to your own connected account.
              We take a small platform fee — the rest lands with you, same
              purchase, no waiting on us to forward it.
            </p>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-cta-section">
        <h2>See your own work in it, before anything else</h2>
        <p className="marketing-sub">
          A full try-it-yourself demo — drag in a few of your own images and
          feel the real feed, no account needed — is coming soon. For now,
          create your shop and see your real catalog live in minutes.
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
