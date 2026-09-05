"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Smallest crop dimension allowed, as a fraction of the photo's own size --
// purely to stop a corner drag from collapsing the box to nothing.
const MIN_SIZE = 0.08;

function clampRect({ x, y, w, h }) {
  const cw = Math.min(1, Math.max(MIN_SIZE, w));
  const ch = Math.min(1, Math.max(MIN_SIZE, h));
  const cx = Math.min(Math.max(0, x), 1 - cw);
  const cy = Math.min(Math.max(0, y), 1 - ch);
  return { x: cx, y: cy, w: cw, h: ch };
}

// A simple, exact-size crop tool: the artist drags a box over their own
// photo to choose precisely what shows in the feed -- not a menu of
// preset shapes (square/portrait), an actual adjustable rectangle. Never
// touches the real file a buyer downloads, or the lightbox/expanded view,
// which always shows the whole original -- this only changes the feed
// card's own preview. Shared as one component so the try-it demo and the
// real dashboard use the identical tool, not two hand-built copies of it.
export default function CropEditor({ imageUrl, initialCrop, onSave, onCancel }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [naturalSize, setNaturalSize] = useState(null); // { w, h } in real pixels
  // Always fractions (0-1) of the photo's own box -- independent of
  // whatever size the editor happens to render it at on screen.
  const [rect, setRect] = useState(() =>
    initialCrop
      ? { x: initialCrop.x, y: initialCrop.y, w: initialCrop.w, h: initialCrop.h }
      : { x: 0, y: 0, w: 1, h: 1 }
  );
  const frameRef = useRef(null);
  const dragRef = useRef(null); // { mode: "move" | "nw" | "ne" | "sw" | "se", startX, startY, startRect }

  function handleImgLoad(e) {
    setNaturalSize({ w: e.target.naturalWidth, h: e.target.naturalHeight });
    setImgLoaded(true);
  }

  const handlePointerMove = useCallback((e) => {
    const drag = dragRef.current;
    const frame = frameRef.current;
    if (!drag || !frame) return;
    const box = frame.getBoundingClientRect();
    const dx = (e.clientX - drag.startX) / box.width;
    const dy = (e.clientY - drag.startY) / box.height;
    const next = { ...drag.startRect };
    if (drag.mode === "move") {
      next.x = drag.startRect.x + dx;
      next.y = drag.startRect.y + dy;
    } else {
      if (drag.mode.includes("w")) {
        next.x = drag.startRect.x + dx;
        next.w = drag.startRect.w - dx;
      }
      if (drag.mode.includes("e")) {
        next.w = drag.startRect.w + dx;
      }
      if (drag.mode.includes("n")) {
        next.y = drag.startRect.y + dy;
        next.h = drag.startRect.h - dy;
      }
      if (drag.mode.includes("s")) {
        next.h = drag.startRect.h + dy;
      }
    }
    setRect(clampRect(next));
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }, [handlePointerMove]);

  useEffect(
    () => () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    },
    [handlePointerMove, handlePointerUp]
  );

  function startDrag(mode, e) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, startRect: rect };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function handleUse() {
    if (!naturalSize) return;
    const isFullPhoto = rect.x === 0 && rect.y === 0 && rect.w >= 0.995 && rect.h >= 0.995;
    onSave(isFullPhoto ? null : { ...rect, srcW: naturalSize.w, srcH: naturalSize.h });
  }

  const pxLabel = naturalSize
    ? `${Math.round(rect.w * naturalSize.w)} × ${Math.round(rect.h * naturalSize.h)} px`
    : "";

  return (
    <div className="crop-editor-overlay" onClick={onCancel}>
      <div className="crop-editor-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="crop-editor-close" onClick={onCancel} aria-label="Cancel">
          ✕
        </button>
        <div className="crop-editor-frame" ref={frameRef}>
          <img src={imageUrl} alt="" className="crop-editor-img" draggable={false} onLoad={handleImgLoad} />
          {imgLoaded && (
            <div
              className="crop-editor-box"
              style={{
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.w * 100}%`,
                height: `${rect.h * 100}%`,
              }}
              onPointerDown={(e) => startDrag("move", e)}
            >
              <span className="crop-editor-size">{pxLabel}</span>
              {["nw", "ne", "sw", "se"].map((corner) => (
                <span
                  key={corner}
                  className={`crop-editor-handle crop-editor-handle-${corner}`}
                  onPointerDown={(e) => startDrag(corner, e)}
                />
              ))}
            </div>
          )}
        </div>
        <p className="crop-editor-hint">
          Drag the corners or the box to choose exactly what shows in the feed — your original
          file never changes.
        </p>
        <div className="crop-editor-actions">
          <button
            type="button"
            className="crop-editor-reset"
            onClick={() => setRect({ x: 0, y: 0, w: 1, h: 1 })}
          >
            Reset to full photo
          </button>
          <button type="button" className="crop-editor-use" onClick={handleUse}>
            Use this crop
          </button>
        </div>
      </div>
    </div>
  );
}
