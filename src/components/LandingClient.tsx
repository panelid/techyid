"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LandingClient() {
  const router = useRouter();
  const [activeTool, setActiveTool] = useState('url');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    fetch('/api/auth/session').then(r => {
      if (r.ok) setIsAuthenticated(true);
    }).catch(() => {});
  }, []);

  // Short URL state
  const [urlSlug, setUrlSlug] = useState('');
  const [urlDest, setUrlDest] = useState('');

  // WhatsApp state
  const [waSlug, setWaSlug] = useState('');
  const [waNumber, setWaNumber] = useState('');
  const [waMsg, setWaMsg] = useState('');

  // Paste state
  const [pasteSlug, setPasteSlug] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const [pastePwd, setPastePwd] = useState('');

  // Bio state
  const [bioSlug, setBioSlug] = useState('');
  const [bioLinks, setBioLinks] = useState<Array<{label:string; url:string}>>([{label:'', url:''}]);
  const [lang, setLangState] = useState('id');

  // [U-1] & [U-2] Modal & Error state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdSlug, setCreatedSlug] = useState('');
  const [copied, setCopied] = useState(false);
  const [formError, setFormError] = useState('');
  const [slugStatus, setSlugStatus] = useState<Record<string, { state: 'idle'|'checking'|'available'|'taken'|'invalid'; message?: string }>>({});

  const checkSlug = async (key: string, value: string) => {
    const slug = value.trim().toLowerCase();
    if (!slug) {
      setSlugStatus(s => ({ ...s, [key]: { state: 'idle' } }));
      return;
    }
    setSlugStatus(s => ({ ...s, [key]: { state: 'checking' } }));
    try {
      const res = await fetch(`/api/slugs/check?slug=${encodeURIComponent(slug)}`);
      const d = await res.json();
      if (d.available) {
        setSlugStatus(s => ({ ...s, [key]: { state: 'available' } }));
      } else {
        setSlugStatus(s => ({ ...s, [key]: { state: d.reason === 'format' || d.reason === 'reserved' ? 'invalid' : 'taken', message: d.message } }));
      }
    } catch {
      setSlugStatus(s => ({ ...s, [key]: { state: 'idle' } }));
    }
  };

  // Language
  useEffect(() => {
    const saved = sessionStorage.getItem('techy_lang') || 'id';
    setLangState(saved);
    document.documentElement.lang = saved;
    if (saved === 'en') document.documentElement.classList.add('lang-en');
  }, []);

  const setLang = (l: string) => {
    setLangState(l);
    document.documentElement.lang = l;
    if (l === 'en') {
      document.documentElement.classList.add('lang-en');
    } else {
      document.documentElement.classList.remove('lang-en');
    }
    sessionStorage.setItem('techy_lang', l);
  };

  const handleSubmit = async (type: string) => {
    setFormError('');
    let slug = '', data: any = {};
    if (type === 'url') { slug = urlSlug; data = { url: urlDest }; }
    else if (type === 'wa') { slug = waSlug; data = { phone: waNumber, message: waMsg }; }
    else if (type === 'paste') { slug = pasteSlug; data = { content: pasteContent, password: pastePwd }; }
    else if (type === 'bio') { slug = bioSlug; data = { links: bioLinks.filter(l => l.label && l.url) }; }

    if (!slug) { setFormError('Slug tidak boleh kosong'); return; }

    const apiUrl = type === 'paste' ? '/api/paste' : '/api/slugs/create';
    const body = type === 'paste' ? { slug, content: pasteContent, password: pastePwd } : { slug, type, data };

    const r = await fetch(apiUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), credentials: 'include'
    });
    if (r.status === 401) { router.push('/register'); return; }
    const d = await r.json();
    if (d.success || r.status === 201) {
      setCreatedSlug(slug.toLowerCase());
      setShowSuccessModal(true);
    } else {
      setFormError(d.error || 'Terjadi kesalahan');
    }
  };

  const SlugStatus = ({ status }: { status?: { state: string; message?: string } }) => {
    if (!status || status.state === 'idle') return null;
    if (status.state === 'checking') {
      return <div className="slug-status checking"><span className="ss-dot"></span> Mengecek ketersediaan...</div>;
    }
    if (status.state === 'available') {
      return <div className="slug-status ok">✓ Tersedia</div>;
    }
    if (status.state === 'taken') {
      return <div className="slug-status no">✕ Sudah dipakai — pilih yang lain</div>;
    }
    if (status.state === 'invalid') {
      return <div className="slug-status no">✕ {status.message || 'Format tidak valid'}</div>;
    }
    return null;
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html{scroll-behavior:smooth;overflow-x:hidden;max-width:100vw;}
        body{background:#f5f0e8;background-image:radial-gradient(#00000012 1px,transparent 1px);background-size:16px 16px;font-family:'Space Grotesk',sans-serif;color:#0a0a0a;line-height:1.5;overflow-x:hidden;max-width:100vw;margin:0;}
        a{color:inherit;text-decoration:none;}
        nav{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:#fff;border-bottom:4px solid #000;position:sticky;top:0;z-index:220;}
        .logo{display:flex;align-items:center;gap:10px;font-size:20px;font-weight:800;letter-spacing:-.03em;}
        .logo-mark{width:32px;height:32px;background:#000;border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .logo-mark-d{width:14px;height:14px;border:3px solid #d4ff00;border-radius:2px;}
        .logo span{color:#FF6B35;}
        .nav-right{display:flex;align-items:center;gap:10px;}
        .lang-switch{display:flex;border:2.5px solid #000;border-radius:5px;overflow:hidden;box-shadow:2.5px 2.5px 0 #000;}
        .lang-btn{padding:7px 12px;font-size:11.5px;font-weight:800;font-family:'DM Mono',monospace;cursor:pointer;background:#fff;border:none;color:#888;letter-spacing:.03em;}
        .lang-btn.on{background:#000;color:#d4ff00;}
        /* Single toggle switch for ID/EN */
        .lang-toggle{display:inline-flex;align-items:center;gap:6px;border:2.5px solid #000;border-radius:20px;padding:4px 10px;cursor:pointer;box-shadow:2px 2px 0 #000;background:#fff;user-select:none;transition:background .12s,color .12s;}
        .lang-toggle .lang-label{font-family:'DM Mono',monospace;font-size:11px;font-weight:800;letter-spacing:.04em;}
        .lang-toggle .lang-pill{width:34px;height:18px;border-radius:10px;background:#ddd;border:2px solid #000;position:relative;transition:background .12s;}
        .lang-toggle .lang-pill::after{content:'';position:absolute;top:1px;left:1px;width:12px;height:12px;border-radius:50%;background:#000;transition:transform .12s;}
        .lang-toggle[data-lang="en"] .lang-pill{background:#d4ff00;}
        .lang-toggle[data-lang="en"] .lang-pill::after{transform:translateX(16px);}
        .lang-toggle[data-lang="en"] .lang-label{color:#000;}
        /* Hamburger button (mobile only) */
        .hamburger{display:none;flex-direction:column;justify-content:center;align-items:center;gap:4px;width:40px;height:40px;border:2.5px solid #000;border-radius:6px;background:#fff;cursor:pointer;box-shadow:2.5px 2.5px 0 #000;z-index:230;}
        .hamburger span{display:block;width:18px;height:2.5px;background:#000;border-radius:2px;transition:transform .18s,opacity .18s;}
        .hamburger.open span:nth-child(1){transform:translateY(6.5px) rotate(45deg);}
        .hamburger.open span:nth-child(2){opacity:0;}
        .hamburger.open span:nth-child(3){transform:translateY(-6.5px) rotate(-45deg);}
        /* Mobile dropdown menu */
        .mobile-menu{position:fixed;top:64px;left:0;right:0;background:#fff;border-bottom:4px solid #000;box-shadow:0 8px 0 rgba(0,0,0,.12);display:none;flex-direction:column;padding:14px 20px;gap:10px;z-index:225;}
        .mobile-menu.open{display:flex;}
        .mobile-menu .mm-item{padding:13px 14px;font-size:14px;font-weight:800;border:2.5px solid #000;border-radius:6px;background:#fff;cursor:pointer;text-align:left;box-shadow:2.5px 2.5px 0 #000;color:#000;font-family:'Space Grotesk',sans-serif;letter-spacing:-.01em;}
        .mobile-menu .mm-item.primary{background:#d4ff00;}
        .mobile-menu .mm-item.accent{background:#FF6B35;color:#fff;}
        /* Desktop auth buttons */
        .nav-auth{display:flex;align-items:center;gap:8px;}
        .nav-auth .nav-cta{margin-left:0;}
        @media(max-width:600px){
          .nav-auth{display:none;}
          .hamburger{display:flex;}
          nav{padding:12px 14px;}
        }
        .nav-cta{padding:9px 16px;font-size:12.5px;font-weight:700;cursor:pointer;border:2.5px solid #000;border-radius:5px;background:#d4ff00;box-shadow:3px 3px 0 #000;transition:transform .08s,box-shadow .08s;white-space:nowrap;}
        .nav-cta:active{transform:translate(3px,3px);box-shadow:0 0 0 #000;}
        header{padding:56px 20px 44px;text-align:center;border-bottom:4px solid #000;background:#fff;}
        .eyebrow{display:inline-block;font-family:'DM Mono',monospace;font-size:11.5px;font-weight:700;background:#000;color:#d4ff00;padding:5px 12px;border-radius:20px;letter-spacing:.06em;margin-bottom:20px;}
        h1{font-size:clamp(30px,7vw,54px);font-weight:800;letter-spacing:-0.035em;line-height:1.06;max-width:820px;margin:0 auto 18px;}
        .hl{background:#d4ff00;padding:0 8px;box-shadow:3px 3px 0 #000;display:inline-block;transform:rotate(-1deg);}
        .hero p{font-size:16px;color:#555;max-width:520px;margin:0 auto 28px;font-weight:500;}
        .hero-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:36px;}
        .btn-primary,.btn-secondary{padding:14px 26px;font-size:14.5px;font-weight:700;cursor:pointer;border:2.5px solid #000;border-radius:6px;box-shadow:4px 4px 0 #000;transition:transform .08s,box-shadow .08s;}
        .btn-primary{background:#d4ff00;}
        .btn-primary:active,.btn-secondary:active{transform:translate(4px,4px);box-shadow:0 0 0 #000;}
        .btn-secondary{background:#fff;}
        .demo{max-width:480px;margin:0 auto;background:#fff;border:2.5px solid #000;border-radius:8px;box-shadow:6px 6px 0 #000;padding:18px;text-align:left;}
        .tool-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:18px;}
        .tool-tab{display:flex;flex-direction:column;align-items:center;gap:5px;padding:10px 4px;border:2.5px solid #000;border-radius:6px;background:#f5f0e8;cursor:pointer;font-size:10.5px;font-weight:700;color:#555;}
        .tool-tab svg{width:18px;height:18px;stroke:#555;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
        .tool-tab.on{background:#000;color:#d4ff00;box-shadow:2.5px 2.5px 0 #FF6B35;}
        .tool-tab.on svg{stroke:#d4ff00;}
        .tool-pane{display:none;}
        .tool-pane.on{display:block;}
        .tool-label{display:block;font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin:0 0 7px;color:#333;}
        .tool-label:not(:first-child){margin-top:16px;}
        .tool-slugrow{display:flex;align-items:stretch;border:2.5px solid #000;border-radius:6px;overflow:hidden;}
        .tool-prefix{background:#e8e2d6;color:#666;font-family:'DM Mono',monospace;font-weight:700;font-size:13px;padding:11px 10px;display:flex;align-items:center;border-right:2.5px solid #000;white-space:nowrap;}
        .tool-field{border:none;outline:none;padding:11px 12px;font-size:13px;font-family:'Space Grotesk',sans-serif;flex:1;min-width:0;background:#fff;color:#111;}
        .tool-field.full{width:100%;border:2.5px solid #000;border-radius:6px;padding:11px 12px;}
        .tool-textarea{min-height:76px;resize:vertical;font-family:'DM Mono',monospace;font-size:12px;}
        .tool-field::placeholder{color:#aaa;}
        .tool-slugrow.ok{border-color:#16a34a;box-shadow:3px 3px 0 #16a34a;}
        .tool-slugrow.no{border-color:#dc2626;box-shadow:3px 3px 0 #dc2626;}
        .slug-status{font-size:11.5px;font-weight:800;margin-top:7px;display:flex;align-items:center;gap:6px;}
        .slug-status.ok{color:#16a34a;}
        .slug-status.no{color:#dc2626;}
        .slug-status.checking{color:#888;}
        .ss-dot{width:8px;height:8px;border-radius:50%;background:#888;border:1.5px solid #000;animation:pulse 1s infinite;}
        @keyframes pulse{0%,100%{opacity:.4;}50%{opacity:1;}}
        .tool-preview{margin-top:16px;border:2.5px dashed #7c6fd6;border-radius:6px;padding:12px 14px;background:#f6f4ff;}
        .tp-label{font-size:10px;font-weight:800;letter-spacing:.06em;color:#888;margin-bottom:6px;}
        .tp-row{display:flex;align-items:center;gap:8px;}
        .tp-slug{font-family:'DM Mono',monospace;font-weight:700;font-size:14px;color:#4F46E5;}
        .tp-arrow{color:#999;}
        .tp-dest{font-family:'DM Mono',monospace;font-size:12px;color:#0a8f3c;font-weight:600;margin-top:4px;word-break:break-all;}
        .tool-submit{width:100%;margin-top:18px;padding:14px;font-size:14px;font-weight:700;cursor:pointer;border:2.5px solid #000;border-radius:6px;background:#d4ff00;box-shadow:4px 4px 0 #000;transition:transform .08s,box-shadow .08s;}
        .tool-submit:active{transform:translate(4px,4px);box-shadow:0 0 0 #000;}
        .value-bar{display:flex;justify-content:center;flex-wrap:wrap;border-bottom:4px solid #000;background:#fff;}
        .value-cell{flex:1;min-width:140px;text-align:center;padding:20px 12px;border-right:2.5px solid #000;}
        .value-cell:last-child{border-right:none;}
        .value-cell .n{font-size:22px;font-weight:800;}
        .value-cell .l{font-size:10.5px;color:#888;text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-top:3px;}
        .section{padding:52px 20px;}
        .section-head{text-align:center;margin-bottom:36px;}
        .section-tag{display:inline-block;font-family:'DM Mono',monospace;font-size:11px;font-weight:700;background:#fff;border:2.5px solid #000;padding:4px 11px;border-radius:4px;box-shadow:2.5px 2.5px 0 #000;margin-bottom:14px;}
        .section-head h2{font-size:clamp(22px,4.5vw,36px);font-weight:800;letter-spacing:-.03em;}
        .section-head p{color:#666;font-size:14.5px;margin-top:10px;max-width:480px;margin-left:auto;margin-right:auto;font-weight:500;}
        .features{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;max-width:1000px;margin:0 auto;}
        .feature{background:#fff;border:2.5px solid #000;border-radius:7px;padding:22px;box-shadow:5px 5px 0 #000;}
        .f-icon{width:42px;height:42px;border:2.5px solid #000;border-radius:6px;display:flex;align-items:center;justify-content:center;margin-bottom:14px;}
        .f-icon svg{width:20px;height:20px;stroke:#000;fill:none;stroke-width:2.1;stroke-linecap:round;stroke-linejoin:round;}
        .f-url .f-icon{background:#4F46E5;}.f-url .f-icon svg{stroke:#fff;}
        .f-wa .f-icon{background:#25D366;}.f-wa .f-icon svg{stroke:#fff;}
        .f-bio .f-icon{background:#EC4899;}.f-bio .f-icon svg{stroke:#fff;}
        .f-paste .f-icon{background:#FF6B35;}.f-paste .f-icon svg{stroke:#fff;}
        .f-mail .f-icon{background:#d4ff00;}
        .f-stat .f-icon{background:#000;}.f-stat .f-icon svg{stroke:#d4ff00;}
        .feature h3{font-size:15px;font-weight:700;margin-bottom:6px;}
        .feature p{font-size:13px;color:#666;font-weight:500;}
        .api-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center;max-width:960px;margin:0 auto;}
        @media(max-width:680px){.api-grid{grid-template-columns:1fr;}}
        .api-text h2{font-size:clamp(22px,4vw,32px);font-weight:800;letter-spacing:-.03em;margin-bottom:14px;}
        .api-text p{font-size:14px;color:#555;font-weight:500;line-height:1.7;margin-bottom:20px;}
        .code-block{background:#0a0a0a;color:#e8e8e8;border:2.5px solid #000;border-radius:8px;padding:20px;font-family:'DM Mono',monospace;font-size:12px;line-height:1.8;box-shadow:5px 5px 0 #000;overflow-x:auto;white-space:pre;}
        .steps{max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:0;}
        .step{display:flex;gap:16px;padding:18px 0;border-bottom:2px dashed #ccc;align-items:flex-start;}
        .step:last-child{border-bottom:none;}
        .step-num{flex-shrink:0;width:38px;height:38px;border:2.5px solid #000;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-family:'DM Mono',monospace;font-size:14px;background:#d4ff00;}
        .step-body h4{font-size:15px;font-weight:700;margin-bottom:4px;}
        .step-body p{font-size:13px;color:#666;font-weight:500;}
        .faq{max-width:680px;margin:0 auto;display:flex;flex-direction:column;gap:10px;}
        .faq-item{background:#fff;border:2.5px solid #000;border-radius:6px;box-shadow:3px 3px 0 #000;overflow:hidden;}
        .faq-q{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 18px;cursor:pointer;font-weight:700;font-size:14px;}
        .faq-q .plus{font-family:'DM Mono',monospace;font-size:18px;flex-shrink:0;transition:transform .15s;}
        .faq-item.open .plus{transform:rotate(45deg);}
        .faq-a{max-height:0;overflow:hidden;transition:max-height .2s ease;}
        .faq-a p{padding:0 18px 16px;font-size:13.5px;color:#555;font-weight:500;}
        .faq-item.open .faq-a{max-height:240px;}
        .cta-band{background:#000;color:#fff;text-align:center;padding:56px 20px;border-top:4px solid #000;border-bottom:4px solid #000;}
        .cta-band h2{font-size:clamp(22px,5vw,38px);font-weight:800;letter-spacing:-.03em;margin-bottom:14px;}
        .cta-band .hl{color:#d4ff00;}
        .cta-band p{color:#aaa;font-size:14.5px;margin-bottom:26px;font-weight:500;}
        footer.footer{padding:24px 20px;text-align:center;background:#fff;border-top:2px solid #eee;}
        footer.footer p{font-size:12px;color:#888;font-weight:600;}
        footer.footer a{color:#555;text-decoration:underline;font-weight:700;}
        [data-en]{display:none;}
        html.lang-en [data-en]{display:initial;}
        html.lang-en [data-id]{display:none;}
        @media(max-width:600px){.tool-tabs{grid-template-columns:repeat(2,1fr);}.value-bar{flex-direction:column;}.value-cell{border-right:none;border-bottom:2px solid #000;}.value-cell:last-child{border-bottom:none;}}
      `}</style>

      <nav>
        <div className="logo-mark"><div className="logo-mark-d" /></div>
        <div className="logo"><a href="/">⚡ techy<span>.id</span></a></div>
        <div className="nav-right">
          {/* Desktop auth buttons (>600px) */}
          <div className="nav-auth">
            {isAuthenticated ? (
              <button className="nav-cta" style={{ background: '#FF6B35', color: '#fff' }} onClick={() => router.push('/dashboard')}>
                <span data-id>Dashboard</span><span data-en>Dashboard</span>
              </button>
            ) : (
              <>
                <button className="nav-cta" style={{ background: '#fff' }} onClick={() => router.push('/login')}>
                  <span data-id>Masuk</span><span data-en>Log in</span>
                </button>
                <button className="nav-cta" onClick={() => router.push('/register')}>
                  <span data-id>Daftar</span><span data-en>Sign up</span>
                </button>
              </>
            )}
          </div>
          {/* Single language toggle switch */}
          <div
            className="lang-toggle"
            data-lang={lang}
            role="button"
            aria-label="Ganti bahasa / Switch language"
            onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
          >
            <span className="lang-label">ID</span>
            <span className="lang-pill" />
            <span className="lang-label">EN</span>
          </div>
          {/* Hamburger (mobile only) */}
          <button
            className={`hamburger${menuOpen ? ' open' : ''}`}
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
        {isAuthenticated ? (
          <>
            <button className="mm-item accent" onClick={() => { setMenuOpen(false); router.push('/dashboard'); }}>
              <span data-id>📊 Dashboard</span><span data-en>📊 Dashboard</span>
            </button>
            <button className="mm-item" onClick={() => { setMenuOpen(false); router.push('/settings'); }}>
              <span data-id>👤 Profil</span><span data-en>👤 Profile</span>
            </button>
          </>
        ) : (
          <>
            <button className="mm-item" onClick={() => { setMenuOpen(false); router.push('/login'); }}>
              <span data-id>🔑 Masuk</span><span data-en>🔑 Log in</span>
            </button>
            <button className="mm-item primary" onClick={() => { setMenuOpen(false); router.push('/register'); }}>
              <span data-id>✨ Daftar</span><span data-en>✨ Sign up</span>
            </button>
          </>
        )}
      </div>

      <header className="hero">
        <div className="eyebrow"><span data-id>INFRASTRUKTUR IDENTITAS DIGITAL</span><span data-en>DIGITAL IDENTITY INFRASTRUCTURE</span></div>
        <h1><span data-id>Open the door to your </span><span data-en>Open the door to your </span><span className="hl"><span data-id>digital identity</span><span data-en>digital identity</span></span></h1>
        <p><span data-id>Satu platform untuk link, domain, email, dan identitas AI agent kamu — semua terpusat, semua terpantau.</span><span data-en>One platform for your links, domains, email, and AI agent identity — all in one place, all in one dashboard.</span></p>
        <div className="hero-actions">
          <button className="btn-primary" onClick={() => router.push('/register')}><span data-id>Mulai Gratis</span><span data-en>Start Free</span></button>
          <button className="btn-secondary" onClick={() => document.getElementById('tool')?.scrollIntoView({ behavior: 'smooth' })}><span data-id>Lihat Demo</span><span data-en>See Demo</span></button>
        </div>

        <div className="demo" id="tool">
          <div className="tool-tabs">
            <button id="tab-url" className={`tool-tab${activeTool==='url'?' on':''}`} onClick={() => setActiveTool('url')}>
              <svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              <span>Short URL</span>
            </button>
            <button id="tab-wa" className={`tool-tab${activeTool==='wa'?' on':''}`} onClick={() => setActiveTool('wa')}>
              <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              <span>WhatsApp</span>
            </button>
            <button id="tab-paste" className={`tool-tab${activeTool==='paste'?' on':''}`} onClick={() => setActiveTool('paste')}>
              <svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
              <span>Paste</span>
            </button>
            <button id="tab-bio" className={`tool-tab${activeTool==='bio'?' on':''}`} onClick={() => setActiveTool('bio')}>
              <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></svg>
              <span>Bio Page</span>
            </button>
          </div>
          
          {/* [U-2] Inline Error Display */}
          {formError && (
            <div style={{ background: '#ffe0dc', border: '2.5px solid #000', borderRadius: '5px', padding: '12px', marginTop: '12px', fontWeight: 700, fontSize: '13px', color: '#c0392b', boxShadow: '3px 3px 0 #c0392b' }}>
              ⚠️ {formError}
            </div>
          )}

          <input type="text" tabIndex={-1} aria-hidden="true" style={{ display: "none" }} autoComplete="username" />
          <input type="password" tabIndex={-1} aria-hidden="true" style={{ display: "none" }} autoComplete="current-password" />
          {/* Short URL */}
          <div id="pane-url" className={`tool-pane${activeTool==='url'?' on':''}`}>
            <label className="tool-label"><span data-id>Nama Link Kamu</span><span data-en>Your Link Slug</span></label>
            <div className={`tool-slugrow${slugStatus['url']?.state === 'available' ? ' ok' : slugStatus['url']?.state === 'taken' || slugStatus['url']?.state === 'invalid' ? ' no' : ''}`}><span className="tool-prefix">techy.id/</span><input autoComplete="new-password" id="url-slug" className="tool-field" value={urlSlug} onChange={e => { setUrlSlug(e.target.value); checkSlug('url', e.target.value); }} placeholder="my-link" /></div>
            <SlugStatus status={slugStatus['url']} />
            <label className="tool-label"><span data-id>URL Tujuan</span><span data-en>Destination URL</span></label>
            <input autoComplete="new-password" id="url-dest" className="tool-field full" value={urlDest} onChange={e => setUrlDest(e.target.value)} placeholder="https://..." />
            <div className="tool-preview">
              <div className="tp-label"><span data-id>PREVIEW LINK</span><span data-en>LINK PREVIEW</span></div>
              <div className="tp-row"><span id="url-preview-slug" className="tp-slug">techy.id/{urlSlug || 'my-link'}</span><span className="tp-arrow">→</span></div>
              <div id="url-preview-dest" className="tp-dest">{urlDest || 'https://tujuan-panjang.kamu'}</div>
            </div>
            <button className="tool-submit" onClick={() => handleSubmit('url')}><span data-id>Perpendek URL</span><span data-en>Shorten URL</span></button>
          </div>

          {/* WhatsApp */}
          <div id="pane-wa" className={`tool-pane${activeTool==='wa'?' on':''}`}>
            <label className="tool-label"><span data-id>Nama Link Kamu</span><span data-en>Your Link Slug</span></label>
            <div className={`tool-slugrow${slugStatus['wa']?.state === 'available' ? ' ok' : slugStatus['wa']?.state === 'taken' || slugStatus['wa']?.state === 'invalid' ? ' no' : ''}`}><span className="tool-prefix">techy.id/</span><input autoComplete="new-password" className="tool-field" value={waSlug} onChange={e => { setWaSlug(e.target.value); checkSlug('wa', e.target.value); }} placeholder="wa-toko" /></div>
            <SlugStatus status={slugStatus['wa']} />
            <label className="tool-label"><span data-id>Nomor WhatsApp</span><span data-en>WhatsApp Number</span></label>
            <input autoComplete="new-password" className="tool-field full" value={waNumber} onChange={e => setWaNumber(e.target.value)} placeholder="62812xxxxxxx" />
            <label className="tool-label"><span data-id>Pesan Otomatis (opsional)</span><span data-en>Pre-filled Message (optional)</span></label>
            <input autoComplete="new-password" className="tool-field full" value={waMsg} onChange={e => setWaMsg(e.target.value)} placeholder="Halo kak..." />
            <div className="tool-preview">
              <div className="tp-label"><span data-id>PREVIEW LINK</span><span data-en>LINK PREVIEW</span></div>
              <div className="tp-row"><span className="tp-slug">techy.id/{waSlug || 'wa-toko'}</span><span className="tp-arrow">→</span></div>
              <div className="tp-dest">{waNumber ? (waMsg ? `wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}` : `wa.me/${waNumber}`) : 'wa.me/62812xxxxxxx'}</div>
            </div>
            <button className="tool-submit" onClick={() => handleSubmit('wa')}><span data-id>Buat Link WhatsApp</span><span data-en>Create WhatsApp Link</span></button>
          </div>

          {/* Paste */}
          <div id="pane-paste" className={`tool-pane${activeTool==='paste'?' on':''}`}>
            <label className="tool-label"><span data-id>Nama Link Kamu</span><span data-en>Your Link Slug</span></label>
            <div className={`tool-slugrow${slugStatus['paste']?.state === 'available' ? ' ok' : slugStatus['paste']?.state === 'taken' || slugStatus['paste']?.state === 'invalid' ? ' no' : ''}`}><span className="tool-prefix">techy.id/</span><input autoComplete="new-password" className="tool-field" value={pasteSlug} onChange={e => { setPasteSlug(e.target.value); checkSlug('paste', e.target.value); }} placeholder="catatan-rahasia" /></div>
            <SlugStatus status={slugStatus['paste']} />
            <label className="tool-label"><span data-id>Teks / Kode yang Dibagikan</span><span data-en>Text / Code to Share</span></label>
            <textarea autoComplete="new-password" className="tool-field full tool-textarea" value={pasteContent} onChange={e => setPasteContent(e.target.value)} />
            <label className="tool-label"><span data-id>Kata Sandi (opsional)</span><span data-en>Password (optional)</span></label>
            <input autoComplete="new-password" className="tool-field full" type="password" value={pastePwd} onChange={e => setPastePwd(e.target.value)} placeholder="••••••" />
            <div className="tool-preview">
              <div className="tp-label"><span data-id>PREVIEW LINK</span><span data-en>LINK PREVIEW</span></div>
              <div className="tp-row"><span className="tp-slug">techy.id/{pasteSlug || 'catatan-rahasia'}</span><span className="tp-arrow">→</span></div>
              <div className="tp-dest">🔒 <span data-id>Paste terenkripsi dengan proteksi kata sandi</span><span data-en>Password-protected encrypted paste</span></div>
            </div>
            <button className="tool-submit" onClick={() => handleSubmit('paste')}><span data-id>Buat Paste Terenkripsi</span><span data-en>Create Encrypted Paste</span></button>
          </div>

          {/* Bio Page */}
          <div id="pane-bio" className={`tool-pane${activeTool==='bio'?' on':''}`}>
            <label className="tool-label"><span data-id>Nama Halaman Bio</span><span data-en>Bio Page Slug</span></label>
            <div className={`tool-slugrow${slugStatus['bio']?.state === 'available' ? ' ok' : slugStatus['bio']?.state === 'taken' || slugStatus['bio']?.state === 'invalid' ? ' no' : ''}`}><span className="tool-prefix">techy.id/</span><input autoComplete="new-password" className="tool-field" value={bioSlug} onChange={e => { setBioSlug(e.target.value); checkSlug('bio', e.target.value); }} placeholder="namakamu" /></div>
            <SlugStatus status={slugStatus['bio']} />
            <label className="tool-label"><span data-id>Tautan Kamu</span><span data-en>Your Links</span></label>
            {bioLinks.map((link, idx) => (
              <div key={idx} style={{display:'flex',gap:6,marginBottom:8}}>
                <input autoComplete="new-password" className="tool-field" style={{flex:1}} value={link.label} placeholder="Label (Instagram)" onChange={e => {const n=[...bioLinks];n[idx].label=e.target.value;setBioLinks(n);}} />
                <input autoComplete="new-password" className="tool-field" style={{flex:2}} value={link.url} placeholder="https://..." onChange={e => {const n=[...bioLinks];n[idx].url=e.target.value;setBioLinks(n);}} />
                {bioLinks.length > 1 && <button onClick={() => setBioLinks(bioLinks.filter((_,i)=>i!==idx))} style={{border:'2px solid #000',background:'#fff',borderRadius:4,padding:'0 10px',fontWeight:800,cursor:'pointer'}}>✕</button>}
              </div>
            ))}
            <button onClick={() => setBioLinks([...bioLinks, {label:'',url:''}])} style={{width:'100%',padding:8,border:'2px dashed #000',borderRadius:6,background:'#f5f0e8',cursor:'pointer',fontWeight:700,fontSize:12,marginBottom:16}}>+ Tambah Link</button>
            <div className="tool-preview">
              <div className="tp-label"><span data-id>PREVIEW LINK</span><span data-en>LINK PREVIEW</span></div>
              <div className="tp-row"><span className="tp-slug">techy.id/{bioSlug || 'namakamu'}</span><span className="tp-arrow">→</span></div>
              <div className="tp-dest"><span data-id>Halaman bio kamu dengan semua link</span><span data-en>Your bio page with all links</span></div>
            </div>
            <button className="tool-submit" onClick={() => handleSubmit('bio')}><span data-id>Buat Halaman Bio</span><span data-en>Create Bio Page</span></button>
          </div>
        </div>
      </header>

      {/* VALUE BAR */}
      <div className="value-bar">
        <div className="value-cell"><div className="n">⚡</div><div className="l"><span data-id>Redirect &lt;100ms</span><span data-en>Redirect &lt;100ms</span></div></div>
        <div className="value-cell"><div className="n">🆓</div><div className="l"><span data-id>Gratis untuk mulai</span><span data-en>Free to start</span></div></div>
        <div className="value-cell"><div className="n">🌐</div><div className="l"><span data-id>Custom domain</span><span data-en>Custom domains</span></div></div>
        <div className="value-cell"><div className="n">🤖</div><div className="l"><span data-id>API untuk AI Agent</span><span data-en>API for AI Agents</span></div></div>
      </div>

      {/* FEATURES */}
      <section className="section" id="fitur">
        <div className="section-head">
          <div className="section-tag">// <span data-id>FITUR</span><span data-en>FEATURES</span></div>
          <h2><span data-id>Semua yang kamu butuh, satu pintu</span><span data-en>Everything you need, one door</span></h2>
          <p><span data-id>Bukan sekadar pemendek link — techy.id adalah infrastruktur identitas digital kamu.</span><span data-en>Not just a link shortener — techy.id is your digital identity infrastructure.</span></p>
        </div>
        <div className="features">
          <div className="feature f-url"><div className="f-icon"><svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div><h3>Short URL</h3><p><span data-id>Pendekin link panjang jadi slug yang gampang diingat dan dipantau klik-nya real-time.</span><span data-en>Turn long links into memorable slugs with real-time click tracking.</span></p></div>
          <div className="feature f-wa"><div className="f-icon"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></div><h3><span data-id>Link WhatsApp</span><span data-en>WhatsApp Link</span></h3><p><span data-id>Bikin link wa.me lengkap dengan pesan otomatis, tinggal klik langsung chat.</span><span data-en>Generate wa.me links with a pre-filled message — one tap to chat.</span></p></div>
          <div className="feature f-bio"><div className="f-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></svg></div><h3>Bio Page</h3><p><span data-id>Satu halaman buat semua tautan sosial dan produk kamu — cocok buat TikTok &amp; Instagram.</span><span data-en>One page for all your social and product links — built for TikTok &amp; Instagram bios.</span></p></div>
          <div className="feature f-paste"><div className="f-icon"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div><h3><span data-id>Paste Terenkripsi</span><span data-en>Encrypted Paste</span></h3><p><span data-id>Bagikan teks atau kode sensitif dengan proteksi kata sandi dan masa berlaku otomatis.</span><span data-en>Share sensitive text or code with password protection and auto-expiry.</span></p></div>
          <div className="feature f-mail"><div className="f-icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg></div><h3>Email Alias</h3><p><span data-id>Punya alamat email dengan domain sendiri yang diteruskan ke inbox utama kamu.</span><span data-en>Get an email address on your own domain, forwarded straight to your main inbox.</span></p></div>
          <div className="feature f-stat"><div className="f-icon"><svg viewBox="0 0 24 24"><line x1="4" y1="20" x2="4" y2="12"/><line x1="10" y1="20" x2="10" y2="4"/><line x1="16" y1="20" x2="16" y2="9"/><line x1="21" y1="20" x2="21" y2="14"/></svg></div><h3><span data-id>Statistik Real-Time</span><span data-en>Real-Time Analytics</span></h3><p><span data-id>Pantau klik, sumber trafik, dan performa tiap link dari satu dashboard.</span><span data-en>Track clicks, traffic sources, and link performance from one dashboard.</span></p></div>
        </div>
      </section>

      {/* API */}
      <section className="section" style={{background:'#fff',borderTop:'4px solid #000',borderBottom:'4px solid #000'}}>
        <div className="api-grid">
          <div className="api-text">
            <div className="section-tag">// API</div>
            <h2><span data-id>Identitas untuk AI Agent kamu</span><span data-en>Identity for your AI agents</span></h2>
            <p><span data-id>techy.id menyediakan REST API yang memungkinkan AI agent punya identitas digital sendiri — link, inbox email, dan halaman profil yang bisa di-provision secara programmatic dalam hitungan milidetik.</span><span data-en>techy.id provides a REST API that lets AI agents have a real digital identity — links, email inboxes, and profile pages that can be provisioned programmatically in milliseconds.</span></p>
            <button className="btn-secondary" style={{width:'fit-content',padding:'10px 20px',fontSize:'13px'}} onClick={() => router.push('/docs')}><span data-id>Lihat Dokumentasi API →</span><span data-en>View API Docs →</span></button>
          </div>
          <div className="code-block">
{`// Give your agent an identity
POST /v1/identities

{
  "name": "sales-agent-01",
  "domain": "yourdomain.com",
  "email": true,
  "links": true
}

// Response
{
  "email": "agent@yourdomain.com",
  "short_base": "yourdomain.com",
  "status": "active"
}`}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section" id="cara-pakai">
        <div className="section-head">
          <div className="section-tag">// <span data-id>CARA PAKAI</span><span data-en>HOW IT WORKS</span></div>
          <h2><span data-id>Tiga langkah, langsung jalan</span><span data-en>Three steps, live in minutes</span></h2>
        </div>
        <div className="steps">
          <div className="step"><div className="step-num">1</div><div className="step-body"><h4><span data-id>Tempel link atau nomor WA</span><span data-en>Paste your link or WhatsApp number</span></h4><p><span data-id>Masukkan URL panjang, nomor WhatsApp, atau teks yang mau dibagikan.</span><span data-en>Enter a long URL, a WhatsApp number, or the text you want to share.</span></p></div></div>
          <div className="step"><div className="step-num">2</div><div className="step-body"><h4><span data-id>Pilih slug &amp; domain</span><span data-en>Pick a slug &amp; domain</span></h4><p><span data-id>Custom-in slug-nya, atau pakai domain kamu sendiri biar tetap branded.</span><span data-en>Customize the slug, or connect your own domain to keep it on-brand.</span></p></div></div>
          <div className="step"><div className="step-num">3</div><div className="step-body"><h4><span data-id>Pantau dari dashboard</span><span data-en>Track it from the dashboard</span></h4><p><span data-id>Semua link, klik, dan alias email keliatan di satu tempat — real-time.</span><span data-en>All your links, clicks, and email aliases in one place — live.</span></p></div></div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section" id="faq" style={{background:'#fff',borderTop:'4px solid #000',borderBottom:'4px solid #000'}}>
        <div className="section-head">
          <div className="section-tag">// FAQ</div>
          <h2><span data-id>Pertanyaan yang sering ditanyain</span><span data-en>Frequently asked questions</span></h2>
        </div>
        <div className="faq">
          {[
            { qId: 'Apa itu techy.id?', qEn: 'What is techy.id?', aId: 'techy.id adalah infrastruktur identitas digital yang menggabungkan short link, bio page, link WhatsApp, paste terenkripsi, email alias, dan API untuk AI agent — dalam satu dashboard.', aEn: 'techy.id is digital identity infrastructure combining short links, bio pages, WhatsApp links, encrypted pastes, email aliases, and an API for AI agents — in one dashboard.' },
            { qId: 'Apakah techy.id gratis?', qEn: 'Is techy.id free?', aId: 'Ya, ada paket gratis dengan fitur inti. Paket berbayar tersedia untuk custom domain, limit lebih besar, dan akses API penuh.', aEn: "Yes, there's a free plan with core features. Paid plans unlock custom domains, higher limits, and full API access." },
            { qId: 'Bisa pakai domain sendiri?', qEn: 'Can I use my own domain?', aId: 'Bisa. Hubungkan domain kamu sendiri untuk short link, bio page, dan email alias biar semuanya tampil sesuai brand kamu.', aEn: 'Yes. Connect your own domain for short links, bio pages, and email aliases so everything matches your brand.' },
            { qId: 'AI agent bisa pakai techy.id?', qEn: 'Can AI agents use techy.id?', aId: 'Ya. techy.id menyediakan REST API yang memungkinkan AI agent punya identitas digital sendiri — link, inbox email, dan profil.', aEn: 'Yes. techy.id provides a REST API that lets AI agents have a real digital identity — links, email inboxes, and profiles.' },
            { qId: 'Ada statistik klik-nya?', qEn: 'Does it track clicks?', aId: 'Ada. Setiap link dilengkapi statistik klik real-time yang bisa dipantau langsung dari dashboard.', aEn: 'Yes. Every link comes with real-time click stats viewable directly from the dashboard.' },
          ].map((faq, i) => (
            <div key={i} className={`faq-item${openFaq===i?' open':''}`}>
              <div className="faq-q" onClick={() => setOpenFaq(openFaq===i ? null : i)}>
                <span><span data-id>{faq.qId}</span><span data-en>{faq.qEn}</span></span>
                <span className="plus">+</span>
              </div>
              <div className="faq-a"><p><span data-id>{faq.aId}</span><span data-en>{faq.aEn}</span></p></div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="cta-band">
        <h2><span data-id>Satu pintu, </span><span data-en>One door, </span><span className="hl"><span data-id>semua kendali</span><span data-en>full control</span></span></h2>
        <p><span data-id>Gratis buat mulai. Nggak perlu kartu kredit.</span><span data-en>Free to start. No credit card required.</span></p>
        <button className="btn-primary" onClick={() => router.push('/register')}><span data-id>Buat Link Pertama Kamu</span><span data-en>Create Your First Link</span></button>
      </div>

      {/* FOOTER */}
      <footer className="footer">
        <p>© 2026 techy.id · <span data-id>Dibuat oleh</span><span data-en>Built by</span> <a href="https://linkedin.com/in/sobr" target="_blank" rel="noopener noreferrer">Sobur</a> · <span data-id>Dibangun dengan</span><span data-en>Built with</span> ☁️ Cloudflare</p>
      </footer>

      {/* [U-1] Success Modal with Copy-to-Clipboard */}
      {showSuccessModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
          <div style={{ background: '#fff', border: '3px solid #000', borderRadius: '8px', padding: 32, maxWidth: 400, width: '100%', boxShadow: '8px 8px 0 #000', textAlign: 'center' }}>
            <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>✅ Link Berhasil Dibuat!</h3>
            <div style={{ background: '#f5f0e8', border: '2.5px solid #000', borderRadius: '5px', padding: 14, marginBottom: 20, fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 700, color: '#4F46E5', wordBreak: 'break-all' }}>
              techy.id/{createdSlug}
            </div>
            <button
              style={{ width: '100%', padding: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', border: '2.5px solid #000', borderRadius: '5px', background: copied ? '#10b981' : '#d4ff00', color: copied ? '#fff' : '#000', boxShadow: '4px 4px 0 #000', transition: 'all 0.2s', marginBottom: 10 }}
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/${createdSlug}`).then(() => {
                  setCopied(true);
                  setTimeout(() => {
                    setCopied(false);
                    setShowSuccessModal(false);
                  }, 1500);
                });
              }}
            >
              {copied ? '✅ Tersalin!' : '📋 Copy Link'}
            </button>
            <button
              style={{ width: '100%', padding: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '2.5px solid #000', borderRadius: '5px', background: '#fff', boxShadow: '3px 3px 0 #000' }}
              onClick={() => setShowSuccessModal(false)}
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
}
