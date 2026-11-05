// Gera o "Pix Copia e Cola" (BR Code estático, padrão EMV do Banco Central).

function campo(id: string, valor: string): string {
  const tam = String(valor.length).padStart(2, "0");
  return `${id}${tam}${valor}`;
}

export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Remove acentos e caracteres fora do conjunto aceito pelos bancos. */
export function limpar(txt: string, max: number): string {
  return txt
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .,\-\/]/g, "")
    .trim()
    .slice(0, max);
}

export interface PixParams {
  chave: string;
  recebedor: string;
  cidade: string;
  valor?: number;        // em reais; omitido = pagador digita o valor
  txid?: string;         // até 25 caracteres alfanuméricos; padrão "***"
  descricao?: string;
}

export function gerarPix(p: PixParams): string {
  const chave = p.chave.trim();
  let conta = campo("00", "br.gov.bcb.pix") + campo("01", chave);
  if (p.descricao) conta += campo("02", limpar(p.descricao, 40));

  const txid = (p.txid || "***").replace(/[^A-Za-z0-9*]/g, "").slice(0, 25) || "***";

  let payload =
    campo("00", "01") +
    campo("26", conta) +
    campo("52", "0000") +
    campo("53", "986") +
    (p.valor && p.valor > 0 ? campo("54", p.valor.toFixed(2)) : "") +
    campo("58", "BR") +
    campo("59", limpar(p.recebedor, 25) || "IGREJA") +
    campo("60", limpar(p.cidade, 15) || "BRASIL") +
    campo("62", campo("05", txid)) +
    "6304";

  return payload + crc16(payload);
}
