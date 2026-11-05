"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";

export function Topo({ titulo, sub, voltar, acao }: { titulo: string; sub?: string; voltar?: boolean; acao?: ReactNode }) {
  const router = useRouter();
  return (
    <header className="topo">
      <div className="linha cresce">
        {voltar && (
          <button className="icone-btn" onClick={() => router.back()} aria-label="Voltar"><ChevronLeft size={20} /></button>
        )}
        <div className="cresce">
          <h1>{titulo}</h1>
          {sub && <p className="sub">{sub}</p>}
        </div>
      </div>
      {acao}
    </header>
  );
}

export function Carregando() {
  return <div style={{ display: "grid", placeItems: "center", padding: 32 }}><div className="girando" /></div>;
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="vazio">{children}</div>;
}

export function Folha({ aberta, fechar, titulo, children }: { aberta: boolean; fechar: () => void; titulo: string; children: ReactNode }) {
  useEffect(() => {
    if (!aberta) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [aberta, fechar]);
  if (!aberta) return null;
  return (
    <div className="veu" onClick={fechar}>
      <div className="folha" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="alca" />
        <div className="linha entre" style={{ marginBottom: 16 }}>
          <h2>{titulo}</h2>
          <button className="icone-btn" onClick={fechar} aria-label="Fechar"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

let avisar: (m: string) => void = () => {};
export const toast = (m: string) => avisar(m);

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    avisar = (m) => { setMsg(m); clearTimeout(t); t = setTimeout(() => setMsg(null), 2600); };
    return () => clearTimeout(t);
  }, []);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <label className="campo"><span>{rotulo}</span>{children}</label>;
}
