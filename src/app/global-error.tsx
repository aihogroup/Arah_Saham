"use client";

// Keadaan crash: galat di layout akar sehingga seluruh aplikasi tidak bisa dirender.
// Berdiri sendiri (tanpa CSS aplikasi yang mungkin gagal dimuat), jadi gaya ditulis sebaris dan sederhana.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", background: "#fff", color: "#0f172a", padding: 24 }}>
        <main role="alert" style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Aplikasi mengalami kendala</h1>
          <p style={{ color: "#5b6b82", lineHeight: 1.5, margin: "0 0 20px" }}>Maaf, halaman tidak bisa ditampilkan. Coba muat ulang. Bila masih terjadi, kembali lagi beberapa saat lagi.</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={reset} style={{ minHeight: 44, padding: "0 20px", borderRadius: 12, border: 0, background: "#2554d6", color: "#fff", fontWeight: 600, fontSize: 15, cursor: "pointer" }}>Muat ulang</button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- router mungkin ikut rusak; pakai navigasi penuh */}
            <a href="/" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", padding: "0 20px", borderRadius: 12, border: "1px solid #e5e7eb", color: "#0f172a", textDecoration: "none", fontSize: 15 }}>Ke beranda</a>
          </div>
          {error.digest && <p style={{ marginTop: 16, fontSize: 12, color: "#5b6b82" }}>Kode: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
