"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Compass, SquarePlus, BookOpen, Image as ImageIcon, CircleDashed, MessageCircleHeart } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Folha, Toaster } from "./ui";
import Avatar from "./Avatar";
import { configurado } from "@/lib/supabase";

const PUBLICAS = ["/entrar", "/privacidade", "/termos"];
const GRUPOS: Record<string, string[]> = {
  "/inicio": ["/inicio", "/post"],
  "/explorar": ["/explorar", "/celulas", "/agenda", "/ofertas", "/igreja", "/oracao"],
  "/biblia": ["/biblia"],
  "/perfil": ["/perfil", "/admin"],
};

export default function AppShell({ children }: { children: ReactNode }) {
  const { carregando, session, perfil, isLider } = useAuth();
  const path = usePathname() || "/";
  const router = useRouter();
  const publica = PUBLICAS.includes(path);
  const [criar, setCriar] = useState(false);

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
      <nav className="nav" aria-label="Navegação principal">
        <div className="nav-in">
          <Link href="/inicio" aria-label="Início" className={ativo("/inicio") ? "ativo" : ""}>
            <Home size={26} strokeWidth={ativo("/inicio") ? 2.6 : 1.8} fill={ativo("/inicio") ? "currentColor" : "none"} />
          </Link>
          <Link href="/explorar" aria-label="Explorar" className={ativo("/explorar") ? "ativo" : ""}>
            <Compass size={26} strokeWidth={ativo("/explorar") ? 2.6 : 1.8} />
          </Link>
          <button aria-label="Criar" onClick={() => setCriar(true)}><SquarePlus size={26} strokeWidth={1.8} /></button>
          <Link href="/biblia" aria-label="Bíblia" className={ativo("/biblia") ? "ativo" : ""}>
            <BookOpen size={26} strokeWidth={ativo("/biblia") ? 2.6 : 1.8} />
          </Link>
          <Link href="/perfil" aria-label="Meu perfil" className={ativo("/perfil") ? "ativo" : ""}>
            <span className="av-nav"><Avatar src={perfil?.avatar_url} nome={perfil?.nome} tam={26} /></span>
          </Link>
        </div>
      </nav>

      <Folha aberta={criar} fechar={() => setCriar(false)} titulo="Criar">
        <div className="menu-acoes">
          {isLider && (
            <>
              <button onClick={() => ir("/criar?tipo=post")}><ImageIcon size={22} />Post no feed</button>
              <button onClick={() => ir("/criar?tipo=story")}><CircleDashed size={22} />Story (some em 24h)</button>
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
