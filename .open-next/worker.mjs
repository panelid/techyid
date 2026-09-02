// .open-next/worker.mjs
// Cloudflare Worker entry point with email routing

// Import email handler (will be bundled by OpenNext or wrangler)
// For now, define inline to avoid import issues

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      
      // Placeholder for HTTP routes
      if (request.method === "GET" || request.method === "POST") {
        return new Response("Email infrastructure ready. Deploy to activate HTTP routes.", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      console.error("[WORKER]", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  async email(message, env, ctx) {
    // Handle Cloudflare Email Routing events
    try {
      const db = env.DB;
      const r2 = env.R2;
      
      if (!db || !r2) {
        console.error("[EMAIL] DB or R2 unavailable");
        return;
      }

      const from = message.from;
      const to = message.to;
      const subject = message.headers.get("subject") || "";
      const raw = await message.text();
      
      const toDomain = to.split("@")[1];
      if (!toDomain) {
        console.error("[EMAIL] Invalid to address:", to);
        return;
      }

      // Find custom domain
      const domainRecord = await db
        .prepare("SELECT user_id, id FROM custom_domains WHERE domain = ? LIMIT 1")
        .bind(toDomain)
        .first();

      if (!domainRecord) {
        console.warn("[EMAIL] Domain not configured:", toDomain);
        return;
      }

      const userId = domainRecord.user_id;
      const domainId = domainRecord.id;
      const emailId = crypto.randomUUID();
      const receivedAt = Math.floor(Date.now() / 1000);

      // Store in R2
      const r2Key = `emails/${userId}/${emailId}`;
      await r2.put(r2Key, raw, {
        httpMetadata: { contentType: "message/rfc822" },
      });

      // Store metadata in D1
      await db
        .prepare(
          "INSERT INTO emails (id, user_id, domain_id, from_addr, to_addr, subject, body_r2_key, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(emailId, userId, domainId, from, to, subject, r2Key, receivedAt)
        .run();

      // Get user email for forwarding
      const userRecord = await db
        .prepare("SELECT email FROM users WHERE id = ? LIMIT 1")
        .bind(userId)
        .first();

      if (userRecord && userRecord.email) {
        await message.forward(userRecord.email);
        console.log("[EMAIL] Forwarded to", userRecord.email, "ID:", emailId);
      }
    } catch (error) {
      console.error("[EMAIL] Handler error:", error?.message);
    }
  },
};
