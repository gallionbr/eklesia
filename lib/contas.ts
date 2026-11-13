// Subcontas do Asaas: Missões, Primícias e as Redes (cada uma recebe direto na própria conta).
export const CONTAS = {
  missoes: { nome: "Missões", grupo: "ofertas" },
  primicias: { nome: "Primícias", grupo: "ofertas" },
  rede_rosa: { nome: "Rede Rosa", grupo: "redes" },
  rede_azul: { nome: "Rede Azul", grupo: "redes" },
  rede_santa: { nome: "Rede Santa", grupo: "redes" },
  rede_familia: { nome: "Rede da Família", grupo: "redes" },
} as const;
export type TipoConta = keyof typeof CONTAS;
export const TIPOS_CONTA = Object.keys(CONTAS) as TipoConta[];
export const REDES = TIPOS_CONTA.filter((t) => CONTAS[t].grupo === "redes");
export const nomeConta = (t?: string | null) => (t && t in CONTAS ? CONTAS[t as TipoConta].nome : "Conta da Eklésia");

// Cores das redes (degradê de luz, como os cartões da Início)
export const COR_REDE: Record<string, string> = {
  rede_rosa: "radial-gradient(120% 70% at 30% 0%, #ffe1e6 0%, transparent 55%), linear-gradient(180deg, #f2a0b0 0%, #c4506d 55%, #3d0f1c 100%)",
  rede_azul: "radial-gradient(120% 70% at 80% 0%, #cfe7ff 0%, transparent 55%), linear-gradient(180deg, #5f8fc0 0%, #23466e 55%, #0b1626 100%)",
  rede_santa: "radial-gradient(120% 70% at 25% 0%, #f3e0ff 0%, transparent 55%), linear-gradient(180deg, #b48ad6 0%, #6a3d96 55%, #1e0f2e 100%)",
  rede_familia: "radial-gradient(120% 70% at 75% 0%, #fff1c9 0%, transparent 55%), linear-gradient(180deg, #f2c25e 0%, #c8781b 55%, #3e2105 100%)",
};
