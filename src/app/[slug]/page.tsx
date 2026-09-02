import { redirect, notFound } from "next/navigation";
import { getDB } from "@/lib/db";
import { headers } from "next/headers";
import PasteViewer from "@/components/PasteViewer";

export default async function SlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDB();
  if (!db) return notFound();

  const headersList = await headers();
  const hostname = headersList.get("host") || "";
  const isCustomDomain =
    hostname &&
    !hostname.endsWith("door.id") &&
    !hostname.endsWith("workers.dev") &&
    !hostname.includes("vercel.app");

  let result: any;

  if (isCustomDomain) {
    const domainRecord: any = await db.prepare(
      "SELECT user_id FROM custom_domains WHERE domain = ? AND zone_status = 'active' LIMIT 1"
    ).bind(hostname).first();
    if (!domainRecord) return notFound();

    result = await db.prepare(
      "SELECT id, slug, type, data, user_id, paste_password FROM slugs WHERE slug = ? LIMIT 1"
    ).bind(slug).first();
    if (!result || result.user_id !== domainRecord.user_id) return notFound();
  } else {
    result = await db.prepare(
      "SELECT id, slug, type, data, user_id, paste_password FROM slugs WHERE slug = ? LIMIT 1"
    ).bind(slug).first();
  }

  if (!result) return notFound();

  // Increment click_count for tracking (non-paste; paste counts on view)
  if (result.type !== "paste") {
    try {
      await db.prepare("UPDATE slugs SET click_count = click_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(result.id).run();
    } catch (e) {
      console.error("click increment failed", e);
    }
  }

  const data = typeof result.data === "string" ? JSON.parse(result.data) : result.data;

  if (result.type === "url") {
    redirect(data.url);
  }

  if (result.type === "wa") {
    const phone = String(data.phone || "").replace(/^\+/, "");
    if (!phone) return notFound();
    const message = data.message ? `?text=${encodeURIComponent(data.message)}` : "";
    redirect(`https://wa.me/${phone}${message}`);
  }

  if (result.type === "paste") {
    const protectedPaste = Boolean(result.paste_password);
    return (
      <PasteViewer
        slug={slug}
        content={protectedPaste ? "" : (data.content || "")}
        hasPassword={protectedPaste}
      />
    );
  }

  if (result.type === "bio") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-blue-50 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{data.title || "Link"}</h1>
            {data.links && Array.isArray(data.links) && (
              <div className="mt-6 space-y-3">
                {data.links.map((link: any, idx: number) => (
                  <a
                    key={idx}
                    href={link.url}
                    className="block p-4 bg-violet-50 hover:bg-violet-100 rounded-lg text-violet-700 font-medium transition"
                  >
                    {link.title || link.label || link.url}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return notFound();
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDB();
  if (!db) return { title: "Not Found" };

  const result: any = await db.prepare(
    "SELECT slug, type, data FROM slugs WHERE slug = ? LIMIT 1"
  ).bind(slug).first();
  if (!result) return { title: "Not Found" };

  const data = typeof result.data === "string" ? JSON.parse(result.data) : result.data;
  return {
    title: data.title || `Link: ${slug}`,
    description: data.description || "Link",
  };
}
