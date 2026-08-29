"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "Arial, sans-serif" }}>
          <div style={{ maxWidth: 520, textAlign: "center" }}>
            <h1>LifeTracker needs a fresh start</h1>
            <p>The application could not load. Your saved account data has not been changed.</p>
            <button type="button" onClick={reset} style={{ marginTop: 16, padding: "12px 18px", border: 0, borderRadius: 12, background: "#176b5b", color: "white", fontWeight: 700 }}>Reload application</button>
          </div>
        </main>
      </body>
    </html>
  );
}
