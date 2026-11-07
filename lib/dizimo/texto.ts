// Utilitários de texto do módulo de dízimo: dinheiro, CPF, datas e telefone.
// Sem dependências — roda no servidor, no navegador e nos testes.

/** 5000 → "R$ 50,00" */
export function reais(centavos: number): string {
  const v = (centavos / 100).toFixed(2);
  const [int, dec] = v.split(".");
  return `R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
}

/**
 * Lê um valor digitado ("50", "R$ 50,00", "1.234,56", "50.5", "cem" não) → centavos.
 * Devolve null se não der pra entender.
 */
export function lerValor(txt: string): number | null {
  let s = txt.replace(/r\$|reais|real/gi, "").replace(/\s/g, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const virgula = s.lastIndexOf(",");
  const ponto = s.lastIndexOf(".");
  if (virgula > ponto) {
    // formato brasileiro: 1.234,56
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (ponto > -1 && s.length - ponto - 1 === 3 && virgula === -1) {
    // "1.000" = mil, não um real
    s = s.replace(/\./g, "");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/** Só os dígitos. */
export const digitos = (t: string) => t.replace(/\D/g, "");

/** Valida CPF pelos dígitos verificadores. Devolve os 11 dígitos ou null. */
export function lerCpf(txt: string): string | null {
  const c = digitos(txt);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return null;
  for (const n of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(c[i]) * (n + 1 - i);
    const dv = ((soma * 10) % 11) % 10;
    if (dv !== Number(c[n])) return null;
  }
  return c;
}

/** "012.345.678-90" a partir de 11 dígitos, escondendo o meio: "012.***.***-90". */
export function cpfMascarado(cpf: string): string {
  return `${cpf.slice(0, 3)}.***.***-${cpf.slice(9)}`;
}

/** "05/03/1990" ou "5/3/90" → "1990-03-05". Null se inválida, futura ou antes de 1900. */
export function lerData(txt: string, hoje = new Date()): string | null {
  const m = txt.trim().match(/^(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{2}|\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mes = Number(m[2]);
  let a = Number(m[3]);
  if (m[3].length === 2) a += a > hoje.getFullYear() % 100 ? 1900 : 2000;
  const dt = new Date(Date.UTC(a, mes - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== mes - 1 || dt.getUTCDate() !== d) return null;
  if (a < 1900 || dt.getTime() > hoje.getTime()) return null;
  return `${a}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Texto em minúsculas, sem acento e sem pontuação nas pontas — para comparar respostas. */
export function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}#\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** wa_id do WhatsApp ("5585999990001") → E.164 ("+5585999990001"). */
export function e164(waId: string): string {
  return `+${digitos(waId)}`;
}

/** Primeiro nome, com a primeira letra maiúscula. */
export function primeiroNome(nome: string | null | undefined): string {
  const p = (nome || "").trim().split(/\s+/)[0] || "";
  return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : "";
}
