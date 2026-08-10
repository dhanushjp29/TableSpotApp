// Reusable light-mode PDF building blocks. Every style is inlined so the
// generated document is always white/dark text regardless of the app theme.

import { PDF_COLORS } from "../../utils/pdf/pdfTheme.js";

export const PDF_FONT =
  "'Segoe UI', Arial, Helvetica, sans-serif";

export function PdfRoot({ children, style = {} }) {
  return (
    <div
      className="tablespot-pdf-root"
      style={{
        width: "100%",
        background: PDF_COLORS.bg,
        color: PDF_COLORS.text,
        fontFamily: PDF_FONT,
        fontSize: 13,
        lineHeight: 1.5,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function PdfHeader({ brand = "TableSpot", eyebrow, title, subtitle, codeLabel, codeValue }) {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${PDF_COLORS.red} 0%, #dc2626 60%, #ea580c 100%)`,
        color: "#ffffff",
        padding: "28px 32px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#fee2e2",
            }}
          >
            {brand}
          </p>
          {eyebrow && (
            <p style={{ margin: "4px 0 0", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fee2e2" }}>
              {eyebrow}
            </p>
          )}
          <h1 style={{ margin: "10px 0 0", fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#fee2e2" }}>
              {subtitle}
            </p>
          )}
        </div>
        {codeLabel && (
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.35)",
              borderRadius: 12,
              padding: "10px 16px",
              textAlign: "right",
              background: "rgba(255,255,255,0.12)",
            }}
          >
            <p style={{ margin: 0, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "#fee2e2" }}>
              {codeLabel}
            </p>
            <p style={{ margin: "4px 0 0", fontFamily: "'Consolas', monospace", fontSize: 14, fontWeight: 700 }}>
              {codeValue || "—"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function PdfInfoCell({ label, value, tone = "neutral" }) {
  const toneStyles = {
    neutral: { border: `1px solid ${PDF_COLORS.border}`, background: "#f9fafb", label: PDF_COLORS.muted },
    red: { border: "1px solid #fee2e2", background: PDF_COLORS.redSoft, label: PDF_COLORS.red },
    emerald: { border: "1px solid #d1fae5", background: "#ecfdf5", label: PDF_COLORS.emerald },
    amber: { border: "1px solid #fde68a", background: PDF_COLORS.amberSoft, label: PDF_COLORS.amber },
    blue: { border: "1px solid #dbeafe", background: PDF_COLORS.blueSoft, label: PDF_COLORS.blue },
  }[tone] || {};

  return (
    <div style={{ border: toneStyles.border, background: toneStyles.background, borderRadius: 12, padding: "10px 12px" }}>
      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: toneStyles.label }}>
        {label}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: PDF_COLORS.text }}>{value}</p>
    </div>
  );
}

export function PdfInfoGrid({ items, columns = 3 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 10 }}>
      {items.map((item, index) => (
        <PdfInfoCell key={index} {...item} />
      ))}
    </div>
  );
}

export function PdfKeyValueRow({ label, value, valueColor = PDF_COLORS.text }) {
  return (
    <p style={{ margin: 0, fontSize: 13, display: "flex", justifyContent: "space-between", gap: 16 }}>
      <span style={{ color: PDF_COLORS.muted }}>{label}</span>
      <span style={{ fontWeight: 600, color: valueColor }}>{value}</span>
    </p>
  );
}

export function PdfSection({ title, children, right = null }) {
  return (
    <div
      style={{
        marginTop: 24,
        border: `1px solid ${PDF_COLORS.border}`,
        borderRadius: 12,
        padding: "16px 18px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: PDF_COLORS.muted }}>
          {title}
        </p>
        {right}
      </div>
      {children}
    </div>
  );
}

export function PdfTable({ columns, rows, emptyText = "No records" }) {
  if (!rows.length) {
    return <p style={{ margin: 0, fontSize: 12, color: PDF_COLORS.muted }}>{emptyText}</p>;
  }

  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 12,
        color: PDF_COLORS.text,
      }}
    >
      <thead>
        <tr style={{ borderBottom: `2px solid ${PDF_COLORS.redBorder}` }}>
          {columns.map((column) => (
            <th
              key={column.key}
              style={{
                padding: "0 8px 8px 0",
                textAlign: column.align || "left",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: PDF_COLORS.redDark,
                fontWeight: 700,
              }}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex} style={{ borderBottom: `1px solid ${PDF_COLORS.border}` }}>
            {columns.map((column) => (
              <td
                key={column.key}
                style={{
                  padding: "10px 8px 10px 0",
                  textAlign: column.align || "left",
                  fontWeight: column.bold ? 700 : 500,
                  color: column.bold ? PDF_COLORS.text : PDF_COLORS.text,
                }}
              >
                {column.render ? column.render(row) : row[column.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PdfSummaryRow({ label, value, bold = false, color = PDF_COLORS.text, divider = false }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        padding: "4px 0",
        borderTop: divider ? `1px dashed ${PDF_COLORS.border}` : "none",
        marginTop: divider ? 6 : 0,
        paddingTop: divider ? 8 : 4,
        fontWeight: bold ? 800 : 600,
        color,
        fontSize: bold ? 15 : 13,
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function PdfSummaryBox({ children }) {
  return (
    <div
      style={{
        marginLeft: "auto",
        width: 320,
        borderRadius: 12,
        background: "#f9fafb",
        padding: "14px 16px",
      }}
    >
      {children}
    </div>
  );
}

export function PdfFooter({ generatedAt, note = "This is a computer-generated document from TableSpot." }) {
  return (
    <div style={{ marginTop: 28, borderTop: `1px solid ${PDF_COLORS.border}`, paddingTop: 12 }}>
      <p style={{ margin: 0, fontSize: 10.5, color: PDF_COLORS.muted, textAlign: "center" }}>
        {note}
      </p>
      {generatedAt && (
        <p style={{ margin: "4px 0 0", fontSize: 10.5, color: PDF_COLORS.muted, textAlign: "center" }}>
          Generated on {generatedAt}
        </p>
      )}
    </div>
  );
}
