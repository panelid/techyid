export default function BioPage({ slug, links }: {
  slug: string;
  links: Array<{ label: string; url: string }>;
}) {
  // [S-2] Filter out links with unsafe URLs (block javascript:, data:, ftp:, file:)
  const safeLinks = (links || []).filter(link => {
    if (!link.url || !link.label) return false;
    try {
      const parsed = new URL(link.url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false; // Invalid URL — skip
    }
  });
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.avatar}>🌐</div>
        <h1 style={styles.title}>door.id/{slug}</h1>
        <p style={styles.subtitle}>Tautan pilihan oleh kreator</p>
        
        <div style={styles.linksContainer}>
          {safeLinks.length > 0 ? (
            safeLinks.map((link, idx) => (
              <a
                key={idx}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.linkButton}
                data-testid={`bio-link-${idx}`}
              >
                <span>{link.label || link.url}</span>
                <span>→</span>
              </a>
            ))
          ) : (
            <p style={styles.empty}>Belum ada tautan.</p>
          )}
        </div>

        <div style={styles.footer}>
          <a href="https://door.id" style={styles.brand}>⚡ Powered by door.id</a>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    background: "#f5f0e8",
    backgroundImage: "radial-gradient(#00000012 1px, transparent 1px)",
    backgroundSize: "16px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    fontFamily: "'Space Grotesk', sans-serif",
  },
  card: {
    background: "#fff",
    border: "3px solid #000",
    borderRadius: "12px",
    boxShadow: "6px 6px 0 #000",
    padding: "36px 24px",
    maxWidth: "480px",
    width: "100%",
    textAlign: "center" as const,
  },
  avatar: {
    width: "64px",
    height: "64px",
    background: "#d4ff00",
    border: "3px solid #000",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "28px",
    margin: "0 auto 16px",
    boxShadow: "3px 3px 0 #000",
  },
  title: {
    fontSize: "22px",
    fontWeight: 800,
    margin: "0 0 4px",
    fontFamily: "'DM Mono', monospace",
  },
  subtitle: {
    fontSize: "13px",
    color: "#666",
    margin: "0 0 28px",
  },
  linksContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "14px",
    marginBottom: "28px",
  },
  linkButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    background: "#fff",
    border: "2.5px solid #000",
    borderRadius: "8px",
    boxShadow: "4px 4px 0 #000",
    fontWeight: 700,
    fontSize: "14px",
    color: "#0a0a0a",
    transition: "transform .08s, box-shadow .08s",
    textDecoration: "none",
  },
  empty: {
    fontSize: "13px",
    color: "#888",
    fontStyle: "italic",
  },
  footer: {
    borderTop: "2px dashed #e5e5e5",
    paddingTop: "16px",
  },
  brand: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#888",
    fontFamily: "'DM Mono', monospace",
    textDecoration: "none",
  },
};
