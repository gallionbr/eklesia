"use client";
import { useEffect, useState } from "react";
import { sb, msgErro } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Campo, Topo, toast } from "@/components/ui";

const PAPEL = { membro: "Membro", lider: "Líder", admin: "Administrador" } as const;

export default function EditarPerfil() {
  const { perfil, recarregar, session } = useAuth();
  const [f, setF] = useState({ nome: "", telefone: "", nascimento: "", bairro: "", membro_desde: "" });
  const [salvando, setSalvando] = useState(false);
  const [senha, setSenha] = useState("");
  const [trocarSenha, setTrocarSenha] = useState(false);

  useEffect(() => {
    if (!perfil) return;
    setF({ nome: perfil.nome || "", telefone: perfil.telefone || "", nascimento: perfil.nascimento || "", bairro: perfil.bairro || "", membro_desde: perfil.membro_desde || "" });
  }, [perfil]);

  useEffect(() => { if (location.search.includes("senha=1")) setTrocarSenha(true); }, []);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const dados = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null]));
    const { error } = await sb().from("profiles").update({ ...dados, nome: f.nome.trim() }).eq("id", perfil!.id);
    setSalvando(false);
    if (error) return toast(msgErro(error));
    await recarregar();
    toast("Dados salvos");
  }

  async function novaSenha(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await sb().auth.updateUser({ password: senha });
    if (error) return toast(msgErro(error));
    setSenha(""); setTrocarSenha(false); toast("Senha alterada");
  }

  if (!perfil) return null;

  return (
    <main className="pagina">
      <Topo titulo="Editar perfil" sub={`${PAPEL[perfil.papel]} · ${session?.user.email}`} voltar />

      <form className="card form" onSubmit={salvar}>
        <Campo rotulo="Nome completo"><input value={f.nome} onChange={set("nome")} required autoComplete="name" /></Campo>
        <Campo rotulo="Celular / WhatsApp"><input value={f.telefone} onChange={set("telefone")} inputMode="tel" autoComplete="tel" placeholder="(85) 99999-9999" /></Campo>
        <Campo rotulo="Data de nascimento"><input type="date" value={f.nascimento} onChange={set("nascimento")} /></Campo>
        <Campo rotulo="Bairro"><input value={f.bairro} onChange={set("bairro")} /></Campo>
        <Campo rotulo="Membro desde"><input type="date" value={f.membro_desde} onChange={set("membro_desde")} /></Campo>
        <p className="muted peq">Seus dados são usados só pela liderança da igreja para cuidado e comunicação.</p>
        <button className="btn bloco" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
      </form>

      {trocarSenha ? (
        <form className="card form" onSubmit={novaSenha}>
          <Campo rotulo="Nova senha"><input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} minLength={6} required autoComplete="new-password" /></Campo>
          <button className="btn bloco">Salvar nova senha</button>
        </form>
      ) : (
        <button className="btn sec" onClick={() => setTrocarSenha(true)}>Alterar senha</button>
      )}
    </main>
  );
}
