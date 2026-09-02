import LandingClient from '@/components/LandingClient';

export const metadata = {
  title: 'door.id — Open the door to your digital identity',
  description: 'door.id is digital identity infrastructure: short links, bio pages, WhatsApp links, encrypted pastes, email aliases, and API access for AI agents — all in one place.',
  keywords: 'short link, url shortener, bio link, digital identity, email alias, link management, ai agent identity, custom domain',
  openGraph: {
    title: 'door.id — Open the door to your digital identity',
    description: 'Digital identity infrastructure for humans and AI agents. Short links, custom domains, email aliases, and a REST API — one door for everything.',
    url: 'https://door.id/',
    siteName: 'door.id',
    locale: 'id_ID',
    type: 'website',
  },
  twitter: {
    title: 'door.id — Open the door to your digital identity',
    description: 'Short links, bio pages, email aliases, and API access for AI agents — one dashboard, one domain.',
    card: 'summary_large_image',
  },
  alternates: {
    canonical: 'https://door.id/',
  },
  robots: {
    index: true,
    follow: true,
  },
  other: {
    'og:locale': 'id_ID',
    'og:locale:alternate': 'en_US',
  },
};

const jsonLdSoftwareApp = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "door.id",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "description": "Digital identity infrastructure for humans and AI agents. Combines short links, bio pages, WhatsApp link generator, encrypted pastes, email aliases, and a REST API in one dashboard.",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "url": "https://door.id/"
};

const jsonLdFAQPage = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "What is door.id?", "acceptedAnswer": { "@type": "Answer", "text": "door.id is digital identity infrastructure that combines short links, bio pages, WhatsApp links, encrypted pastes, email aliases, and a REST API for AI agents — all in one dashboard." } },
    { "@type": "Question", "name": "Is door.id free?", "acceptedAnswer": { "@type": "Answer", "text": "Yes, door.id has a free plan with core features. Paid plans unlock custom domains, higher limits, and full API access." } },
    { "@type": "Question", "name": "Can I use my own domain with door.id?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Connect your own domain for short links, bio pages, and email aliases so everything stays on your brand." } },
    { "@type": "Question", "name": "Can AI agents use door.id?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. door.id provides a REST API that lets AI agents have a real digital identity — links, email inboxes, and profile pages that can be provisioned programmatically in milliseconds." } },
    { "@type": "Question", "name": "Does door.id track clicks?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Every link comes with real-time click analytics viewable directly from the dashboard." } }
  ]
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json">{JSON.stringify(jsonLdSoftwareApp)}</script>
      <script type="application/ld+json">{JSON.stringify(jsonLdFAQPage)}</script>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700;800&display=swap" rel="stylesheet" />
      <LandingClient />
    </>
  );
}