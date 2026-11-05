export type Papel = "membro" | "lider" | "admin";

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
