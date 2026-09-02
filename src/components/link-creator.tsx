// src/components/link-creator.tsx
"use client";

import { useState } from "react";

type LinkType = "whatsapp" | "paste" | "linktree" | "shorturl";

const API_TYPE_MAP: Record<LinkType, string> = {
  shorturl: "url",
  whatsapp: "wa",
  linktree: "bio",
  paste: "paste",
};

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  return trimmed && !/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? `https://${trimmed}` : trimmed;
}

export default function LinkCreator() {
  const [activeType, setActiveType] = useState<LinkType>("shorturl");
  const [slug, setSlug] = useState("");
  const [url, setUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [pastePassword, setPastePassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [links, setLinks] = useState([{ label: "", url: "" }]);
  const [result, setResult] = useState<{ slug: string; type: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!slug.trim()) return;
    setLoading(true);
    setError("");

    try {
      let data: any = {};

      if (activeType === "shorturl") {
        data = { url: normalizeUrl(url) };
      } else if (activeType === "whatsapp") {
        const normalizedPhone = phone.trim().replace(/^https?:\/\/(?:www\.)?(?:wa\.me|api\.whatsapp\.com)\//i, "").replace(/^\+/, "");
        data = { phone: normalizedPhone, message };
      } else if (activeType === "paste") {
        data = { content: pasteContent };
      } else if (activeType === "linktree") {
        data = { displayName, links: links.filter(l => l.label && l.url) };
      }

      const res = await fetch("/api/slugs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slug.trim(),
          type: API_TYPE_MAP[activeType],
          data,
          pastePassword: pastePassword || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setResult({ slug: slug.trim(), type: activeType });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (result) {
      navigator.clipboard.writeText(`${window.location.origin}/${result.slug}`);
      alert("Link copied!");
    }
  };

  const types = [
    { key: "shorturl" as LinkType, label: "Short URL" },
    { key: "whatsapp" as LinkType, label: "WhatsApp" },
    { key: "paste" as LinkType, label: "Paste" },
    { key: "linktree" as LinkType, label: "Link-in-Bio" },
  ];

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg border shadow">
      <input type="text" tabIndex={-1} aria-hidden="true" style={{ display: "none" }} autoComplete="username" />
      <input type="password" tabIndex={-1} aria-hidden="true" style={{ display: "none" }} autoComplete="current-password" />
      <h2 className="text-2xl font-bold mb-6">Create Link</h2>

      <div className="flex gap-2 mb-6">
        {types.map((t) => (
          <button
            key={t.key}
            onClick={() => { setActiveType(t.key); setResult(null); }}
            className={`px-4 py-2 rounded font-medium ${activeType === t.key ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Slug</label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">{window?.location?.host || "door.id"}/</span>
            <input autoComplete="new-password"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="flex-1 border rounded px-3 py-2"
              placeholder="my-link"
            />
          </div>
        </div>

        {activeType === "shorturl" && (
          <div>
            <label className="block text-sm font-medium mb-1">Target URL</label>
            <input autoComplete="new-password"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="https://example.com"
            />
          </div>
        )}

        {activeType === "whatsapp" && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Phone Number</label>
              <input autoComplete="new-password"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="6281234567890"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Message (optional)</label>
              <textarea autoComplete="new-password"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full border rounded px-3 py-2"
                rows={2}
              />
            </div>
          </>
        )}

        {activeType === "paste" && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Content</label>
              <textarea autoComplete="new-password"
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                className="w-full border rounded px-3 py-2"
                rows={6}
                placeholder="Paste your content here..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password (optional)</label>
              <input autoComplete="new-password"
                type="password"
                value={pastePassword}
                onChange={(e) => setPastePassword(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="Optional password protection"
              />
            </div>
          </>
        )}

        {activeType === "linktree" && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Display Name</label>
              <input autoComplete="new-password"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="Your Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Links</label>
              {links.map((link, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input autoComplete="new-password"
                    value={link.label}
                    onChange={(e) => {
                      const newLinks = [...links];
                      newLinks[i].label = e.target.value;
                      setLinks(newLinks);
                    }}
                    className="flex-1 border rounded px-3 py-2"
                    placeholder="Label"
                  />
                  <input autoComplete="new-password"
                    value={link.url}
                    onChange={(e) => {
                      const newLinks = [...links];
                      newLinks[i].url = e.target.value;
                      setLinks(newLinks);
                    }}
                    className="flex-1 border rounded px-3 py-2"
                    placeholder="URL"
                  />
                </div>
              ))}
              <button
                onClick={() => setLinks([...links, { label: "", url: "" }])}
                className="text-sm text-violet-600 hover:underline"
              >
                + Add link
              </button>
            </div>
          </>
        )}
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {result ? (
        <div className="bg-green-50 border border-green-200 rounded p-4 mb-4">
          <p className="font-medium text-green-800">Link created!</p>
          <p className="text-green-700 mt-1">
            {window.location.origin}/{result.slug}
          </p>
          <button
            onClick={copyLink}
            className="mt-2 text-sm text-violet-600 hover:underline"
          >
            Copy link
          </button>
        </div>
      ) : (
        <button
          onClick={handleCreate}
          disabled={loading || !slug.trim()}
          className="w-full bg-violet-600 text-white py-2 rounded font-medium hover:bg-violet-700 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Link"}
        </button>
      )}
    </div>
  );
}