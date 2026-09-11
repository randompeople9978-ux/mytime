import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Plus, MessageCircle, User, Newspaper } from "lucide-react";
import logoAsset from "@/assets/maujajan-logo.png.asset.json";
import { useEffect, useState, type ReactNode } from "react";
import { IncomingCallListener } from "@/components/IncomingCallListener";
import { NotificationsBell } from "@/components/NotificationsBell";

export function Shell({ children, hideNav = false }: { children: ReactNode; hideNav?: boolean }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const is = (p: string) => path === p;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="shell">
      <div className={`topbar ${scrolled ? "scrolled" : ""}`}>
        <Link to="/" className="brand">
          <img src={logoAsset.url} alt="Maujajan Indonesia" className="brand-mark" width={36} height={36} />
          <div className="brand-word">
            MAUJAJAN
            <small>INDONESIA</small>
          </div>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <NotificationsBell />
          <Clock />
        </div>
      </div>

      <div className="content">{children}</div>
      <footer className="site-footer">
        <div className="footer-links">
          <Link to="/privacy">Kebijakan Privasi</Link>
          <span>·</span>
          <Link to="/terms">Syarat Layanan</Link>
        </div>
        <p>© {new Date().getFullYear()} MAUJAJAN INDONESIA</p>
      </footer>
      {!hideNav && (
        <nav className="navbar">
          <Link to="/" className={`navbtn ${is("/") ? "active" : ""}`}>
            <Home /><span>Beranda</span>
          </Link>
          <Link to="/search" className={`navbtn ${is("/search") ? "active" : ""}`}>
            <Search /><span>Cari</span>
          </Link>
          <Link to="/newsjajan" className={`navbtn ${is("/newsjajan") ? "active" : ""}`}>
            <Newspaper /><span>News</span>
          </Link>
          <Link to="/new" className="navbtn center">
            <div className="plus-wrap"><Plus /></div>
          </Link>
          <Link to="/messages" className={`navbtn ${path.startsWith("/messages") || path.startsWith("/chat") ? "active" : ""}`}>
            <MessageCircle /><span>Pesan</span>
          </Link>
          <Link to="/profile" className={`navbtn ${is("/profile") ? "active" : ""}`}>
            <User /><span>Profil</span>
          </Link>
        </nav>
      )}
      <IncomingCallListener />
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const i = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(i);
  }, []);
  if (!now) return <div style={{ minWidth: 42 }} />;
  const t = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const day = now.toLocaleDateString("id-ID", { weekday: "short" });
  return (
    <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 12.5, color: "#FFF8EE", lineHeight: 1.25 }}>
      {t}
      <span style={{ display: "block", fontSize: 9.5, color: "rgba(255,248,238,.75)", textTransform: "uppercase", letterSpacing: 1 }}>{day}</span>
    </div>
  );
}
