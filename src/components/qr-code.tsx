"use client";

import { useState } from "react";

export default function QRCodeGenerator({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const fullUrl = `${baseUrl}/${slug}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fullUrl)}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="inline-flex flex-col items-center gap-2 p-4 border rounded bg-white">
      <img src={qrUrl} alt={`QR Code for ${slug}`} className="w-48 h-48" />
      <p className="text-sm text-gray-600 break-all max-w-xs text-center">{fullUrl}</p>
      <button
        onClick={handleCopy}
        className="text-sm text-violet-600 hover:underline"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}