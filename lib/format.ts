const TZ = "America/Fortaleza";

export function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: TZ }).replace(".", "");
}
export function diaSemana(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { weekday: "long", timeZone: TZ });
}
export function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}
export function dataHora(iso: string) {
  return `${diaSemana(iso)}, ${dataCurta(iso)} · ${hora(iso)}`;
}
export function diaMes(iso: string) {
  const d = new Date(iso);
  return {
    dia: d.toLocaleDateString("pt-BR", { day: "2-digit", timeZone: TZ }),
    mes: d.toLocaleDateString("pt-BR", { month: "short", timeZone: TZ }).replace(".", ""),
  };
}
/** Data de hoje (AAAA-MM-DD) no fuso da igreja. */
export function hojeISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}
export function relativo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) return `há ${Math.floor(s / 86400)} d`;
  return dataCurta(iso);
}
export function saudacao() {
  const h = Number(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", timeZone: TZ }));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}
export function primeiroNome(nome?: string | null) {
  return (nome || "").trim().split(/\s+/)[0] || "";
}
/** Converte "2026-11-05T19:30" (input datetime-local, horário de Fortaleza) em ISO UTC. */
export function localParaISO(v: string) {
  return v ? new Date(`${v}:00-03:00`).toISOString() : null;
}
export function isoParaLocal(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}
