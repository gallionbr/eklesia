"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Hand, MonitorPlay, Heart, Users, Image as ImageIcon, CircleDashed, MessageCircleHeart } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Folha, Toaster } from "./ui";
import { configurado } from "@/lib/supabase";

const PUBLICAS = ["/entrar", "/privacidade", "/termos"];
const GRUPOS: Record<string, string[]> = {
  "/inicio": ["/inicio", "/post", "/igreja", "/explorar"],
  "/participe": ["/participe", "/agenda", "/oracao", "/biblia"],
  "/assistir": ["/assistir"],
  "/ofertas": ["/ofertas", "/doacoes"],
  "/celulas": ["/celulas"],
};
const ABAS = [
  { href: "/inicio", rotulo: "Início", Icone: Home },
  { href: "/participe", rotulo: "Participe", Icone: Hand },
  { href: "/assistir", rotulo: "Assistir", Icone: MonitorPlay },
  { href: "/ofertas", rotulo: "Doar", Icone: Heart },
  { href: "/celulas", rotulo: "Grupos", Icone: Users },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const { carregando, session, perfil, isLider } = useAuth();
  const path = usePathname() || "/";
  const router = useRouter();
  const publica = PUBLICAS.includes(path);
  const [criar, setCriar] = useState(false);

  // O botão "+" da tela inicial abre o menu Criar.
  useEffect(() => {
    const abrir = () => setCriar(true);
    window.addEventListener("eklesia:criar", abrir);
    return () => window.removeEventListener("eklesia:criar", abrir);
  }, []);

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

  const ativo = (href: string) => GRUPOS[href]?.some((p) => path === p || path.startsWith(p + "/"));
  const ir = (href: string) => { setCriar(false); router.push(href); };

  return (
    <div className="app">
      {children}
      <Toaster />
      <nav className="nav-el" aria-label="Navegação principal">
        <div className="nav-el-in">
          {ABAS.map(({ href, rotulo, Icone }) => {
            const on = ativo(href);
            return (
              <Link key={href} href={href} className={on ? "ativo" : ""} aria-current={on ? "page" : undefined}>
                <Icone size={24} strokeWidth={on ? 2.4 : 1.9} fill={on && (href === "/ofertas" || href === "/inicio") ? "currentColor" : "none"} />
                <span>{rotulo}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <Folha aberta={criar} fechar={() => setCriar(false)} titulo="Criar">
        <div className="menu-acoes">
          {isLider && (
            <>
              <button onClick={() => ir("/criar?tipo=post")}><ImageIcon size={22} />Post no feed</button>
              <button onClick={() => ir("/criar?tipo=story")}><CircleDashed size={22} />Story</button>
            </>
          )}
          <button onClick={() => ir("/oracao?novo=1")}><MessageCircleHeart size={22} />Pedido de oração</button>
        </div>
        {!isLider && <p className="muted peq" style={{ marginTop: 12 }}>Posts e stories são publicados pela liderança da igreja.</p>}
      </Folha>
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
          (arquivo <code>.env.local</code> ou na Vercel) e rode as migrações em <code>supabase/migrations</code>.
        </p>
      </div>
    </div>
  );
}
