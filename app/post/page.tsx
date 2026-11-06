"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sb } from "@/lib/supabase";
import { contagensPosts, perfisPublicos } from "@/lib/midia";
import type { Contagem, PerfilPublico, Post } from "@/lib/types";
import PostCard from "@/components/PostCard";
import { Carregando, Topo, Vazio } from "@/components/ui";

export default function VerPost() {
  const router = useRouter();
  const [post, setPost] = useState<Post | null | undefined>(undefined);
  const [autor, setAutor] = useState<PerfilPublico>();
  const [contagem, setContagem] = useState<Contagem>();
  const [abrirComent, setAbrirComent] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const id = q.get("id");
    setAbrirComent(q.get("comentarios") === "1");
    if (!id) return setPost(null);
    sb().from("posts").select("*").eq("id", id).maybeSingle().then(async ({ data }) => {
      const p = data as Post | null;
      if (p) {
        const [pf, ct] = await Promise.all([perfisPublicos([p.autor_id]), contagensPosts([p.id])]);
        setAutor(pf[p.autor_id]); setContagem(ct[p.id]);
      }
      setPost(p);
    });
  }, []);

  return (
    <main>
      <div className="pagina" style={{ paddingBottom: 8 }}><Topo titulo="Post" voltar /></div>
      {post === undefined ? <Carregando /> : post === null ? (
        <div style={{ padding: 16 }}><Vazio>Este post não existe mais.</Vazio></div>
      ) : (
        <PostCard post={post} autor={autor} contagem={contagem} comentariosAbertos={abrirComent} aoApagar={() => router.replace("/inicio")} />
      )}
    </main>
  );
}
