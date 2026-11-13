export type Papel = "membro" | "lider" | "tesoureiro" | "admin";

export interface Perfil {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  nascimento: string | null;
  bairro: string | null;
  papel: Papel;
  celula_id: string | null;
  membro_desde: string | null;
  pix_presente?: string | null;
  avatar_url: string | null;
  criado_em: string;
}

export interface Config {
  id: 1;
  nome_igreja: string;
  slogan: string | null;
  endereco: string | null;
  horarios_culto: string | null;
  instagram: string | null;
  youtube: string | null;
  whatsapp: string | null;
  pix_chave: string | null;
  pix_recebedor: string | null;
  pix_cidade: string | null;
  bio: string | null;
  ao_vivo: boolean;
  ao_vivo_url: string | null;
  maps_url: string | null;
  capas: Partial<Record<"igreja" | "celulas" | "agenda" | "oracao" | "ofertas", string>> | null;
}

export interface Aviso {
  id: string;
  titulo: string;
  corpo: string;
  link: string | null;
  fixado: boolean;
  publicado_em: string;
  expira_em: string | null;
}

export interface Evento {
  id: string;
  titulo: string;
  descricao: string | null;
  local: string | null;
  inicio: string;
  fim: string | null;
  vagas: number | null;
  inscricao_aberta: boolean;
  criado_em: string;
  banner_url?: string | null;
  rede?: string | null;
  valor_centavos?: number;
}

export interface Celula {
  id: string;
  nome: string;
  descricao: string | null;
  lider_id: string | null;
  dia_semana: string | null;
  horario: string | null;
  endereco: string | null;
  bairro: string | null;
  ativa: boolean;
  afinidade?: "todos" | "homens" | "mulheres" | "criancas" | "casais" | "estudantes";
}

export interface Devocional {
  id: string;
  data: string;
  titulo: string;
  referencia: string;
  texto_biblico: string;
  reflexao: string;
  oracao: string | null;
}

export interface Pedido {
  id: string;
  user_id: string;
  autor_nome: string | null;
  pedido: string;
  publico: boolean;
  anonimo: boolean;
  respondido: boolean;
  testemunho: string | null;
  criado_em: string;
}

export interface Midia { url: string; tipo: "imagem" | "video"; w?: number; h?: number }

export interface Post {
  id: string;
  autor_id: string;
  como_igreja: boolean;
  legenda: string;
  midias: Midia[];
  criado_em: string;
}

export interface PerfilPublico { id: string; nome: string; avatar_url: string | null; papel: Papel }

export interface Contagem { post_id: string; amens: number; comentarios: number; meu_amem: boolean }

export interface Story {
  id: string;
  autor_id: string;
  celula_id: string | null;
  tipo: "imagem" | "video" | "texto";
  midia_url: string | null;
  texto: string | null;
  cor: string | null;
  criado_em: string;
  expira_em: string | null;
}

export interface Comentario { id: string; post_id: string; user_id: string; texto: string; criado_em: string }
