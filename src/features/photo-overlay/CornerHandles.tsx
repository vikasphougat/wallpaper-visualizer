import { useRef } from "react";

interface Props {
  quad: [number, number][];
  onChange: (quad: [number, number][]) => void;
}

const LABELS = ["Top-left", "Top-right", "Bottom-right", "Bottom-left"];

/** Four draggable handles, positioned in normalised space over the canvas. */
export function CornerHandles({ quad, onChange }: Props) {
  const layerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);

  function clientToNorm(clientX: number, clientY: number): [number, number] {
    const rect = layerRef.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    return [x, y];
  }

  function onPointerMove(e: PointerEvent) {
    if (dragging.current === null) return;
    const next = quad.slice() as [number, number][];
    next[dragging.current] = clientToNorm(e.clientX, e.clientY);
    onChange(next);
  }

  function endDrag() {
    dragging.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
  }

  function startDrag(i: number) {
    dragging.current = i;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
  }

  return (
    <div ref={layerRef} className="handles">
      <svg
        className="handles__edges"
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        aria-hidden
      >
        <polygon points={quad.map(([x, y]) => `${x},${y}`).join(" ")} />
      </svg>
      {quad.map(([x, y], i) => (
        <button
          key={i}
          className="handles__dot"
          style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
          onPointerDown={(e) => {
            e.preventDefault();
            startDrag(i);
          }}
          aria-label={`${LABELS[i]} wall corner`}
        />
      ))}
    </div>
  );
}
