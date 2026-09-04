// door-email-inbox — Cloudflare Email Worker
// Terima email masuk ke custom domain user: simpan ke D1 (inbox dashboard) + forward ke Gmail pemilik.
export default {
  async email(message, env) {
    try {
      const to = message.to || "";
      const from = message.from || "";
      const subject = message.headers.get("subject") || "(no subject)";
      const toDomain = (to.split("@")[1] || "").toLowerCase();

      // Main domain (techy.id) atau custom domain: cari user by email tujuan dulu,
      // fallback ke custom_domains mapping.
      let user = await env.DB.prepare(
        "SELECT id AS user_id, id AS domain_id FROM users WHERE email = ? LIMIT 1"
      )
        .bind(to)
        .first();
      if (!user && toDomain === "techy.id") {
        // fallback: admin user pertama di domain utama
        user = await env.DB.prepare(
          "SELECT id AS user_id, '' AS domain_id FROM users WHERE is_admin = 1 LIMIT 1"
        ).first();
      }
      if (!user) {
        const d = await env.DB.prepare(
          "SELECT user_id, id FROM custom_domains WHERE domain = ? LIMIT 1"
        )
          .bind(toDomain)
          .first();
        if (!d) return; // domain tidak terdaftar — buang
        user = d;
      }

      let raw = "";
      try {
        raw = await new Response(message.raw).text();
      } catch {}

      const emailId = crypto.randomUUID();
      const receivedAt = Math.floor(Date.now() / 1000);
      await env.DB.prepare(
        "INSERT INTO emails (id, user_id, domain_id, from_addr, to_addr, subject, body_text, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(emailId, user.user_id || user.id, user.domain_id || user.id, from, to, subject, raw.slice(0, 900000), receivedAt)
        .run();

      const u = await env.DB.prepare("SELECT email, forward_to FROM users WHERE id = ? LIMIT 1")
        .bind(user.user_id || user.id)
        .first();
      const dest = (u && u.forward_to) || (u && u.email);
      if (dest) await message.forward(dest); // salinan ke email pribadi
    } catch (e) {
      console.error("[door-email-inbox]", e && e.message);
    }
  },
};

// deployed 1788424537
// 1788515597
