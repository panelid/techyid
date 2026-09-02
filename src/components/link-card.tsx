"use client";

import { useState } from "react";
import QRCodeGenerator from "@/components/qr-code";

export default function LinkCard({ slug, type, data }: { slug: string; type: string; data: any }) {
  const [showQR, setShowQR] = useState(false);

  return (
    <div className="border rounded p-4 bg-white">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{type}</span>
            <a
              href={`/${slug}`}
              target="_blank"
              className="font-medium text-violet-600 hover:underline"
            >
              /{slug}
            </a>
          </div>
          {type === "shorturl" && data.url && (
            <p className="text-sm text-gray-500 truncate max-w-md">{data.url}</p>
          )}
          {type === "whatsapp" && data.phone && (
            <p className="text-sm text-gray-500">WhatsApp to {data.phone}</p>
          )}
          {type === "paste" && (
            <p className="text-sm text-gray-500">Paste content {data.paste_password ? "(protected)" : ""}</p>
          )}
        </div>
        <button
          onClick={() => setShowQR(!showQR)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          QR
        </button>
      </div>

      {showQR && (
        <div className="mt-4 flex justify-center">
          <QRCodeGenerator slug={slug} />
        </div>
      )}
    </div>
  );
}