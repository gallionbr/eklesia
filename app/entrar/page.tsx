"use client";
import { useState } from "react";
import { sb, msgErro } from "@/lib/supabase";
import { Campo } from "@/components/ui";

type Modo = "entrar" | "cadastrar" | "esqueci";

export default function Entrar() {
  const [modo, setModo] = useState<Modo>("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setOk(""); setEnviando(true);
    try {
      if (modo === "entrar") {
        const { error } = await sb().auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      } else if (modo === "cadastrar") {
        if (!aceite) throw new Error("Para continuar, aceite o uso dos seus dados pela igreja.");
        const { data, error } = await sb().auth.signUp({
          email, password: senha,
          options: { data: { nome: nome.trim() }, emailRedirectTo: `${location.origin}/inicio` },
        });
        if (error) throw error;
        if (!data.session) setOk("Cadastro feito! Enviamos um link de confirmação para o seu e-mail.");
      } else {
        const { error } = await sb().auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/perfil?senha=1` });
        if (error) throw error;
        setOk("Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.");
      }
    } catch (e) {
      setErro(msgErro(e));
    } finally {
      setEnviando(false);
    }
  }

  async function google() {
    setErro("");
    const { error } = await sb().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/inicio` } });
    if (error) setErro(msgErro(error));
  }

  return (
    <main className="centro" style={{ alignItems: "start", paddingTop: "max(48px, 8dvh)" }}>
      <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ textAlign: "center" }}>
          <img src="/logo.svg" alt="" width={96} height={155} style={{ height: "auto", margin: "0 auto 12px", display: "block" }} />
          <h1>Eklésia</h1>
          <p className="muted" style={{ marginTop: 6 }}>Chamados para fora, reunidos em Cristo.</p>
        </div>

        <div className="card form">
          {modo !== "esqueci" && (
            <>
              <button type="button" className="btn sec bloco" onClick={google}>
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
                Continuar com Google
              </button>
              <div className="linha muted peq" style={{ justifyContent: "center" }}>ou com e-mail</div>
            </>
          )}

          <form className="form" onSubmit={enviar}>
            {modo === "cadastrar" && (
              <Campo rotulo="Nome completo">
                <input value={nome} onChange={(e) => setNome(e.target.value)} required autoComplete="name" />
              </Campo>
            )}
            <Campo rotulo="E-mail">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" />
            </Campo>
            {modo !== "esqueci" && (
              <Campo rotulo="Senha">
                <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6}
                  autoComplete={modo === "entrar" ? "current-password" : "new-password"} />
              </Campo>
            )}
            {modo === "cadastrar" && (
              <label className="check peq">
                <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
                <span>Autorizo a igreja a guardar meus dados para cuidado pastoral e comunicação (LGPD).</span>
              </label>
            )}
            {erro && <p className="erro">{erro}</p>}
            {ok && <p className="ok">{ok}</p>}
            <button className="btn bloco" disabled={enviando}>
              {enviando ? "Aguarde…" : modo === "entrar" ? "Entrar" : modo === "cadastrar" ? "Criar conta" : "Enviar link"}
            </button>
          </form>
        </div>

        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }} className="peq">
          {modo === "entrar" ? (
            <>
              <button className="btn sec" onClick={() => setModo("cadastrar")}>Ainda não tenho conta</button>
              <button className="muted" style={{ background: "none", border: 0 }} onClick={() => setModo("esqueci")}>Esqueci minha senha</button>
            </>
          ) : (
            <button className="btn sec" onClick={() => { setModo("entrar"); setErro(""); setOk(""); }}>Já tenho conta</button>
          )}
        </div>
      </div>
    </main>
  );
}
