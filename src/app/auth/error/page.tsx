export default async function AuthError({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const msg =
    reason === "domain"
      ? "Your account isn't on the brodierec.com domain. Sign in with your Brodie email."
      : "Something went wrong signing you in.";
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        background: "#000",
        color: "#f5f5f7",
      }}
    >
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 12, letterSpacing: "-0.02em" }}>
          No dice.
        </h1>
        <p style={{ color: "#a1a1a6", marginBottom: 24, lineHeight: 1.5 }}>{msg}</p>
        <a
          href="/login"
          style={{
            display: "inline-block",
            padding: "10px 18px",
            borderRadius: 12,
            background: "#FFB800",
            color: "#000",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Try again
        </a>
      </div>
    </main>
  );
}
