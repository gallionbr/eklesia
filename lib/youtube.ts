"use client";
import { useEffect, useState } from "react";

export interface Video { id: string; titulo: string; publicado: string; capa: string; descricao: string; views: number; tipo: "culto" | "mensagem" | "missoes" | "louvor" | "outro" }
export interface DadosYoutube { url?: string; aoVivo?: string | null; videos: Video[]; erro?: string }

let cache: Promise<DadosYoutube> | null = null;

/** Vídeos do canal (uma busca por sessão do app). */
export function useYoutube(): DadosYoutube | null {
  const [d, setD] = useState<DadosYoutube | null>(null);
  useEffect(() => {
    cache ??= fetch("/api/youtube").then((r) => r.json()).catch(() => ({ videos: [], erro: "Sem conexão." }));
    cache.then(setD);
  }, []);
  return d;
}

export const capaGrande = (id: string) => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
export const capaMedia = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
