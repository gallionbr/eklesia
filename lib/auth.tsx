"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { configurado, sb } from "./supabase";
import type { Config, Perfil } from "./types";

interface Ctx {
  carregando: boolean;
  session: Session | null;
  perfil: Perfil | null;
  config: Config | null;
  recarregar: () => Promise<void>;
  sair: () => Promise<void>;
  isAdmin: boolean;
  isLider: boolean;
  isTesoureiro: boolean;
  /** Admin ou tesoureiro: vê as contribuições no painel. */
  veFinanceiro: boolean;
}

const AuthCtx = createContext<Ctx>({
  carregando: true, session: null, perfil: null, config: null,
  recarregar: async () => {}, sair: async () => {}, isAdmin: false, isLider: false, isTesoureiro: false, veFinanceiro: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [config, setConfig] = useState<Config | null>(null);

  const carregarDados = useCallback(async (s: Session | null) => {
    if (!s) { setPerfil(null); return; }
    const [p, c] = await Promise.all([
      sb().from("profiles").select("*").eq("id", s.user.id).maybeSingle(),
      sb().from("config").select("*").eq("id", 1).maybeSingle(),
    ]);
    setPerfil((p.data as Perfil) ?? null);
    setConfig((c.data as Config) ?? null);
  }, []);

  useEffect(() => {
    if (!configurado) { setCarregando(false); return; }
    let ativo = true;
    sb().auth.getSession().then(async ({ data }) => {
      if (!ativo) return;
      setSession(data.session);
      await carregarDados(data.session);
      setCarregando(false);
    });
    const { data: sub } = sb().auth.onAuthStateChange((_e, s) => {
      setSession(s);
      carregarDados(s);
    });
    return () => { ativo = false; sub.subscription.unsubscribe(); };
  }, [carregarDados]);

  const recarregar = useCallback(async () => { await carregarDados(session); }, [carregarDados, session]);
  const sair = useCallback(async () => { await sb().auth.signOut(); }, []);

  const isAdmin = perfil?.papel === "admin";
  const isLider = isAdmin || perfil?.papel === "lider";
  const isTesoureiro = perfil?.papel === "tesoureiro";
  const veFinanceiro = isAdmin || isTesoureiro;

  return (
    <AuthCtx.Provider value={{ carregando, session, perfil, config, recarregar, sair, isAdmin, isLider, isTesoureiro, veFinanceiro }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
