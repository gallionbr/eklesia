// "Seu próximo passo" e os projetos da Eklésia, usados na Início e em Participe.
// Textos provisórios: a liderança ajusta depois (e as fotos entram no lugar dos degradês).
import { Droplets, Users, HandHelping, MessageCircleHeart, CalendarDays, BookOpen, GraduationCap, HeartPulse, Globe2, type LucideIcon } from "lucide-react";

export interface Passo {
  id: string; titulo: string; sub: string; Icone: LucideIcon; fundo: string;
  href?: string;          // tela do app
  zap?: string;           // ou mensagem pronta para o WhatsApp da igreja
}

export const PASSOS: Passo[] = [
  { id: "celula", titulo: "Encontre um PG", sub: "Pequenos Grupos, comunhão perto de você durante a semana.", Icone: Users, href: "/celulas", fundo: "radial-gradient(120% 70% at 20% 0%, #ffe0b8 0%, transparent 55%), linear-gradient(180deg, #f39a52 0%, #cf5419 55%, #3d1504 100%)" },
  { id: "batismo", titulo: "Seja batizado", sub: "Dê o próximo passo na sua fé", Icone: Droplets, zap: "Olá! Quero me batizar na Eklésia. Como faço?", fundo: "radial-gradient(120% 70% at 75% 0%, #d7ecff 0%, transparent 55%), linear-gradient(180deg, #6c9cc8 0%, #2a527c 55%, #0a1422 100%)" },
  { id: "servir", titulo: "Sirva num ministério", sub: "Use seus dons para abençoar pessoas", Icone: HandHelping, zap: "Olá! Quero servir em um ministério da Eklésia.", fundo: "radial-gradient(120% 70% at 20% 0%, #fff1c9 0%, transparent 55%), linear-gradient(180deg, #f2c25e 0%, #c8781b 55%, #3e2105 100%)" },
  { id: "oracao", titulo: "Peça oração", sub: "A igreja ora com você", Icone: MessageCircleHeart, href: "/oracao", fundo: "radial-gradient(120% 70% at 70% 0%, #ffe3ea 0%, transparent 55%), linear-gradient(180deg, #e99aae 0%, #b04867 55%, #3a0e1c 100%)" },
  { id: "agenda", titulo: "Agenda", sub: "Cultos, encontros e eventos", Icone: CalendarDays, href: "/agenda", fundo: "radial-gradient(120% 70% at 20% 0%, #e6f5ec 0%, transparent 55%), linear-gradient(180deg, #7fbf9a 0%, #2f7350 55%, #0b2617 100%)" },
  { id: "biblia", titulo: "Bíblia e devocional", sub: "Uma palavra para cada dia", Icone: BookOpen, href: "/biblia", fundo: "radial-gradient(120% 70% at 75% 0%, #efe2ff 0%, transparent 55%), linear-gradient(180deg, #a98bd6 0%, #5e3f93 55%, #1b0f2e 100%)" },
];

export interface Projeto {
  id: "escolinha" | "casm" | "missoes";
  titulo: string; curto: string; texto: string; Icone: LucideIcon; fundo: string;
  doar?: "missoes";       // propósito na tela de Doações
  zap: string;
}

export const PROJETOS: Projeto[] = [
  {
    id: "escolinha", titulo: "Escolinha comunitária", curto: "Educação e cuidado para as crianças da comunidade",
    texto: "A Escolinha comunitária da Eklésia acolhe crianças da comunidade com reforço escolar, valores cristãos e cuidado. Você pode ajudar como voluntário, doando material escolar ou contribuindo com o projeto.",
    Icone: GraduationCap, fundo: "radial-gradient(120% 70% at 20% 0%, #fff3c4 0%, transparent 55%), linear-gradient(180deg, #f5c85a 0%, #c47f14 55%, #3b2603 100%)", zap: "Olá! Quero ajudar a Escolinha comunitária da Eklésia.",
  },
  {
    id: "casm", titulo: "CASM", curto: "Centro de Apoio à Saúde da Mulher",
    texto: "O CASM – Centro de Apoio à Saúde da Mulher oferece acolhimento, orientação e cuidado para mulheres da comunidade. Profissionais de saúde e voluntárias são muito bem-vindos.",
    Icone: HeartPulse, fundo: "radial-gradient(120% 70% at 75% 0%, #ffe0e8 0%, transparent 55%), linear-gradient(180deg, #f08aa6 0%, #c0335e 55%, #3d0a1a 100%)", zap: "Olá! Quero ajudar o CASM – Centro de Apoio à Saúde da Mulher.",
  },
  {
    id: "missoes", titulo: "Missões", curto: "Vila Apaco e interior do Maranhão",
    texto: "Missões de evangelismo e ajuda social na comunidade da Vila Apaco e no interior do Maranhão: cultos, distribuição de alimentos, atendimento e discipulado. Vá conosco, ore e contribua.",
    Icone: Globe2, fundo: "radial-gradient(120% 70% at 20% 0%, #dcffef 0%, transparent 55%), linear-gradient(180deg, #5fcf9e 0%, #1f7d55 55%, #05261a 100%)", doar: "missoes", zap: "Olá! Quero participar das missões da Eklésia.",
  },
];

export const linkZap = (numero: string | null | undefined, msg: string) =>
  numero ? `https://wa.me/${numero.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}` : null;
