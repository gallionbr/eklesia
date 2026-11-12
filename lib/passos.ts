// "Seu próximo passo" e os projetos da Eklésia, usados na Início e em Participe.
// Textos provisórios: a liderança ajusta depois (e as fotos entram no lugar dos degradês).
import { Droplets, Users, HandHelping, MessageCircleHeart, CalendarDays, BookOpen, GraduationCap, HeartPulse, Globe2, type LucideIcon } from "lucide-react";

export interface Passo {
  id: string; titulo: string; sub: string; Icone: LucideIcon; fundo: string;
  href?: string;          // tela do app
  zap?: string;           // ou mensagem pronta para o WhatsApp da igreja
}

export const PASSOS: Passo[] = [
  { id: "celula", titulo: "Encontre uma célula", sub: "Comunhão perto de você, durante a semana", Icone: Users, href: "/celulas", fundo: "linear-gradient(160deg,#f07a3a,#b8410f)" },
  { id: "batismo", titulo: "Seja batizado", sub: "Dê o próximo passo na sua fé", Icone: Droplets, zap: "Olá! Quero me batizar na Eklésia. Como faço?", fundo: "linear-gradient(160deg,#2b2b2b,#000)" },
  { id: "servir", titulo: "Sirva num ministério", sub: "Use seus dons para abençoar pessoas", Icone: HandHelping, zap: "Olá! Quero servir em um ministério da Eklésia.", fundo: "linear-gradient(160deg,#f7a24a,#d9541c)" },
  { id: "oracao", titulo: "Peça oração", sub: "A igreja ora com você", Icone: MessageCircleHeart, href: "/oracao", fundo: "linear-gradient(160deg,#b48f4b,#6b4f1f)" },
  { id: "agenda", titulo: "Agenda", sub: "Cultos, encontros e eventos", Icone: CalendarDays, href: "/agenda", fundo: "linear-gradient(160deg,#3a3a3a,#111)" },
  { id: "biblia", titulo: "Bíblia e devocional", sub: "Uma palavra para cada dia", Icone: BookOpen, href: "/biblia", fundo: "linear-gradient(160deg,#c94a14,#5a1f06)" },
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
    Icone: GraduationCap, fundo: "linear-gradient(160deg,#f7a24a,#c94a14)", zap: "Olá! Quero ajudar a Escolinha comunitária da Eklésia.",
  },
  {
    id: "casm", titulo: "CASM", curto: "Centro de Apoio à Saúde da Mulher",
    texto: "O CASM – Centro de Apoio à Saúde da Mulher oferece acolhimento, orientação e cuidado para mulheres da comunidade. Profissionais de saúde e voluntárias são muito bem-vindos.",
    Icone: HeartPulse, fundo: "linear-gradient(160deg,#e0245e,#7a0f30)", zap: "Olá! Quero ajudar o CASM – Centro de Apoio à Saúde da Mulher.",
  },
  {
    id: "missoes", titulo: "Missões", curto: "Vila Apaco e interior do Maranhão",
    texto: "Missões de evangelismo e ajuda social na comunidade da Vila Apaco e no interior do Maranhão: cultos, distribuição de alimentos, atendimento e discipulado. Vá conosco, ore e contribua.",
    Icone: Globe2, fundo: "linear-gradient(160deg,#0e9f47,#0b5e33)", doar: "missoes", zap: "Olá! Quero participar das missões da Eklésia.",
  },
];

export const linkZap = (numero: string | null | undefined, msg: string) =>
  numero ? `https://wa.me/${numero.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}` : null;
