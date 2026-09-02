import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <div className="w-8 h-8 bg-violet-600 rounded flex items-center justify-center text-white font-bold">
            D
          </div>
          <span className="text-xl font-bold">Techy.id</span>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-4">Build your link ecosystem</h1>
        <p className="text-gray-600 mb-6">Create WhatsApp links, short URLs, and link-in-bio pages.</p>
        
        <div className="border rounded-lg p-6 bg-white">
          <h2 className="font-semibold mb-3">Your Links</h2>
          <Link href="/dashboard" className="text-blue-600 hover:underline">
            Go to Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}