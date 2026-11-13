// Para quem é cada Pequeno Grupo (PG). Degradês no estilo "luz suave no topo, escuro embaixo".
export const AFINIDADES = [
  { id: "todos", nome: "Para todos", fundo: "radial-gradient(120% 70% at 20% 0%, #ffe3b8 0%, transparent 55%), linear-gradient(180deg, #f6a75c 0%, #d9601f 55%, #4a1a06 100%)" },
  { id: "homens", nome: "Homens", fundo: "radial-gradient(120% 70% at 80% 0%, #cfe7ff 0%, transparent 55%), linear-gradient(180deg, #5f8fc0 0%, #23466e 55%, #0b1626 100%)" },
  { id: "mulheres", nome: "Mulheres", fundo: "radial-gradient(120% 70% at 30% 0%, #ffe1e6 0%, transparent 55%), linear-gradient(180deg, #f2a0b0 0%, #c4506d 55%, #3d0f1c 100%)" },
  { id: "criancas", nome: "Crianças", fundo: "radial-gradient(120% 70% at 70% 0%, #fff7c2 0%, transparent 55%), linear-gradient(180deg, #f5d65a 0%, #b58b12 55%, #3b2c03 100%)" },
  { id: "casais", nome: "Casais", fundo: "radial-gradient(120% 70% at 25% 0%, #f3e0ff 0%, transparent 55%), linear-gradient(180deg, #b48ad6 0%, #6a3d96 55%, #1e0f2e 100%)" },
  { id: "estudantes", nome: "Estudantes", fundo: "radial-gradient(120% 70% at 75% 0%, #d6fff0 0%, transparent 55%), linear-gradient(180deg, #5cc9a3 0%, #1f7a5c 55%, #06261c 100%)" },
] as const;
export type Afinidade = (typeof AFINIDADES)[number]["id"];
export const nomeAfinidade = (id?: string | null) => AFINIDADES.find((a) => a.id === id)?.nome || "Para todos";
