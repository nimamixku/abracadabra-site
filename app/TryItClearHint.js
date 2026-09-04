"use client";

// The instructional caption above the interactive demo (app/page.js) --
// server-rendered marketing copy, so its "clear" mention couldn't
// actually DO anything on its own. This one small client component owns
// just that caption, and makes the "clear" chip a real button: it fires
// a plain custom event that TryItDemo.js (already a client component,
// mounted right below this) listens for and answers with its own real
// handleClear -- no need to turn the whole marketing page into a client
// component just for one clickable word.
export default function TryItClearHint() {
  function requestClear() {
    window.dispatchEvent(new CustomEvent("tryit:clear-request"));
  }

  return (
    <>
      <p className="tryit-copy-hint tryit-hint-drag">
        drag &amp; drop / tap &amp; upload any image to preview. tap{" "}
        <button type="button" className="tryit-clear-chip" onClick={requestClear}>
          clear
        </button>{" "}
        to reset
      </p>
      <p className="tryit-copy-hint tryit-hint-tap">
        tap &amp; upload any image to preview. tap{" "}
        <button type="button" className="tryit-clear-chip" onClick={requestClear}>
          clear
        </button>{" "}
        to reset
      </p>
    </>
  );
}
