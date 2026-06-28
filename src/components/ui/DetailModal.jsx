/**
 * DetailModal — generic drill-down table modal.
 * Renders a title, an optional filter/action slot (e.g. period
 * buttons, "+ Add Insertion Order"), and a scrollable table built
 * from `columns` (headers) and `rows` (array of cell arrays).
 * Used for every "click a card → see the underlying records" view.
 */
export default function DetailModal({ title, columns, rows, onClose, filterSlot, emptyMsg, actionSlot }) {
  return (
    <div className="sv-modal-overlay" onClick={onClose}>
      <div
        className="sv-modal"
        style={{ maxWidth: 740, maxHeight: "85vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sv-modal-header" style={{ flexShrink: 0 }}>
          <span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>{title}</span>
          <div className="sv-flex sv-items-center sv-gap-3">
            {actionSlot}
            <button onClick={onClose} className="sv-modal-close">×</button>
          </div>
        </div>
        {filterSlot && (
          <div style={{ padding: "10px 20px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>{filterSlot}</div>
        )}
        <div style={{ overflowY: "auto", flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "var(--font)" }}>
            <thead style={{ position: "sticky", top: 0, background: "#F8FAFC", zIndex: 1 }}>
              <tr>
                {columns.map((c, i) => (
                  <th key={i} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#475569", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap", fontSize: 12 }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} style={{ padding: 32, textAlign: "center", color: "#94A3B8" }}>
                    {emptyMsg || "No data for this period."}
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
                    {row.map((cell, j) => (
                      <td key={j} style={{ padding: "9px 14px", color: "#374151", borderBottom: "1px solid #F1F5F9" }}>{cell}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
