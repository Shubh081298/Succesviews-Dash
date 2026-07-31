import { useState, useRef, useEffect, useCallback } from "react";

/**
 * PhotoCropper — WhatsApp-style square crop + zoom before saving a profile photo.
 * Drag to reposition, slider or wheel to zoom, then exports a crisp 512×512 JPEG.
 * No external libraries. Props: { src, onCancel, onSave(dataUrl) }.
 */
const VIEW = 280;   // on-screen crop viewport (px)
const OUT = 512;    // exported image size (px) — crisp, not blurry

export default function PhotoCropper({ src, onCancel, onSave }) {
  const [img, setImg] = useState(null);           // { el, w, h }
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const drag = useRef(null);

  // base = zoom 1 shows the WHOLE image (minimise). coverZoom fills the frame.
  const maxZoom = img ? Math.max(4, img.coverZoom * 4) : 4;

  useEffect(() => {
    const el = new Image();
    el.onload = () => {
      const w = el.naturalWidth, h = el.naturalHeight;
      const base = VIEW / Math.max(w, h);          // fit whole image at zoom 1
      const coverZoom = Math.max(w, h) / Math.min(w, h); // zoom needed to fill the frame
      setImg({ el, w, h, base, coverZoom });
      setZoom(coverZoom);                          // default: nicely filled
      const dw = w * base * coverZoom, dh = h * base * coverZoom;
      setOffset({ x: (VIEW - dw) / 2, y: (VIEW - dh) / 2 });
    };
    el.src = src;
  }, [src]);

  const clamp = useCallback((off, z) => {
    if (!img) return off;
    const dw = img.w * img.base * z, dh = img.h * img.base * z;
    // if the image is smaller than the frame on an axis, keep it centred; else pan-clamp
    const ax = (val, d) => (d <= VIEW ? (VIEW - d) / 2 : Math.min(0, Math.max(VIEW - d, val)));
    return { x: ax(off.x, dw), y: ax(off.y, dh) };
  }, [img]);

  const applyZoom = (z) => {
    const nz = Math.max(1, Math.min(maxZoom, z));
    // zoom around the viewport centre so it feels natural
    const cx = VIEW / 2, cy = VIEW / 2;
    setOffset((o) => {
      const ratio = nz / zoom;
      return clamp({ x: cx - (cx - o.x) * ratio, y: cy - (cy - o.y) * ratio }, nz);
    });
    setZoom(nz);
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    const p = e.touches ? e.touches[0] : e;
    drag.current = { px: p.clientX, py: p.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const p = e.touches ? e.touches[0] : e;
    const dx = p.clientX - drag.current.px, dy = p.clientY - drag.current.py;
    setOffset(clamp({ x: drag.current.ox + dx, y: drag.current.oy + dy }, zoom));
  };
  const onPointerUp = () => { drag.current = null; };

  useEffect(() => {
    const up = () => (drag.current = null);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => { window.removeEventListener("mouseup", up); window.removeEventListener("touchend", up); };
  }, []);

  const save = () => {
    if (!img) return;
    setSaving(true);
    const scale = img.base * zoom;             // displayed px per source px
    const sSize = VIEW / scale;                // source px covered by the viewport
    const sx = -offset.x / scale, sy = -offset.y / scale;
    const c = document.createElement("canvas");
    c.width = OUT; c.height = OUT;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, OUT, OUT);
    ctx.drawImage(img.el, sx, sy, sSize, sSize, 0, 0, OUT, OUT);
    const out = c.toDataURL("image/jpeg", 0.92);
    onSave(out);
  };

  const dw = img ? img.w * img.base * zoom : 0;
  const dh = img ? img.h * img.base * zoom : 0;

  return (
    <div className="sv-modal-overlay" style={{ zIndex: 400 }} onClick={onCancel}>
      <div className="sv-modal" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
        <div className="sv-modal-header"><span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>Adjust photo</span><button className="sv-modal-close" onClick={onCancel}>×</button></div>
        <div style={{ padding: "16px 20px" }}>
          <p className="sv-text-muted" style={{ fontSize: 12.5, margin: "0 0 12px" }}>Drag to reposition and zoom to frame your photo.</p>
          <div
            className="sv-crop-view"
            style={{ width: VIEW, height: VIEW }}
            onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp}
            onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}
            onWheel={(e) => applyZoom(zoom + (e.deltaY < 0 ? 0.12 : -0.12))}
          >
            {img && <img src={src} alt="" draggable={false} style={{ position: "absolute", left: offset.x, top: offset.y, width: dw, height: dh, maxWidth: "none", userSelect: "none", pointerEvents: "none" }} />}
            <div className="sv-crop-ring" />
          </div>
          <div className="sv-flex sv-items-center sv-gap-2" style={{ marginTop: 14 }}>
            <span style={{ fontSize: 15 }}>🔍</span>
            <input type="range" min="1" max={maxZoom} step="0.01" value={zoom} onChange={(e) => applyZoom(parseFloat(e.target.value))} style={{ flex: 1 }} />
          </div>
          <div className="sv-flex sv-gap-2" style={{ marginTop: 16 }}>
            <button className="sv-btn sv-btn--outline" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
            <button className="sv-btn sv-btn--primary" style={{ flex: 1 }} disabled={!img || saving} onClick={save}>{saving ? "Saving…" : "Save Photo"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
