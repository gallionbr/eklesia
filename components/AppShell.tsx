"use client";
import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, CalendarDays, BookOpen, HandHeart, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Toaster } from "./ui";
import { configurado } from "@/lib/supabase";

const ABAS = [
  { href: "/inicio", rotulo: "Início", Icone: Home },
  { href: "/agenda", rotulo: "Agenda", Icone: CalendarDays },
  { href: "/biblia", rotulo: "Bíblia", Icone: BookOpen },
  { href: "/ofertas", rotulo: "Ofertas", Icone: HandHeart },
  { href: "/mais", rotulo: "Mais", Icone: Menu },
];

const PUBLICAS = ["/entrar", "/privacidade", "/termos"];

export default function AppShell({ children }: { children: ReactNode }) {
  const { carregando, session } = useAuth();
  const path = usePathname() || "/";
  const router = useRouter();
  const publica = PUBLICAS.includes(path);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (carregando || !configurado) return;
    if (!session && !publica) router.replace("/entrar");
    if (session && (path === "/entrar" || path === "/")) router.replace("/inicio");
  }, [carregando, session, publica, path, router]);

  if (!configurado) return <SemConfig />;
  if (carregando || (!session && !publica) || (session && (path === "/" || path === "/entrar"))) {
    return <div className="centro"><div className="girando" aria-label="Carregando" /></div>;
  }
  if (publica) return <>{children}<Toaster /></>;

  return (
    <div className="app">
      {children}
      <Toaster />
      <nav className="nav" aria-label="Navegação principal">
        <div className="nav-in">
          {ABAS.map(({ href, rotulo, Icone }) => {
            const ativo = path === href || path.startsWith(href + "/") ||
              (href === "/mais" && ["/celulas", "/oracao", "/perfil", "/admin"].some((p) => path.startsWith(p)));
            return (
              <Link key={href} href={href} className={ativo ? "ativo" : ""} aria-current={ativo ? "page" : undefined}>
                <Icone size={22} strokeWidth={ativo ? 2.4 : 1.8} />
                {rotulo}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function SemConfig() {
  return (
    <div className="centro">
      <div className="card" style={{ maxWidth: 420 }}>
        <img src="/logo.svg" alt="Eklésia" width={72} height={116} style={{ display: "block", margin: "0 auto 12px" }} />
        <h2 style={{ textAlign: "center" }}>Quase lá</h2>
        <p className="muted" style={{ marginTop: 8 }}>
          Defina <b>NEXT_PUBLIC_SUPABASE_URL</b> e <b>NEXT_PUBLIC_SUPABASE_ANON_KEY</b> nas variáveis de ambiente
          (arquivo <code>.env.local</code> ou na Vercel) e rode a migração <code>supabase/migrations/0001_eklesia.sql</code>.
        </p>
      </div>
    </div>
  );
}
