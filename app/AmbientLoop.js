import TryItDemo from "./TryItDemo";

// The small, passive companion below the interactive demo (see the
// plan's design ethos section) -- literally the same component as the
// interactive one, driving itself on a timer instead of taking input,
// so it can never visually drift out of sync with the real thing.
export default function AmbientLoop() {
  return <TryItDemo variant="ambient" />;
}
