// Relatório de recebimentos: monta o Excel (.xlsx) e o PDF no navegador a partir do JSON
// de /api/admin/relatorio. As bibliotecas só carregam quando alguém clica para baixar.

export interface Relatorio {
  igreja: string;
  periodo: { inicio: string; fim: string };
  geradoEm: string;
  geradoPor: string;
  resumo: {
    entradas: number; bruto: number; taxas: number; liquido: number;
    porForma: { forma: string; valor: number }[];
    splitMissoes: number; splitPrimicias: number; splitOutros: number;
    repasseTransferido: number; repasseAguardando: number; repasseSimulado: number; repasseErro: number;
    ficaNaIgreja: number;
  };
  entradas: {
    id: string; data: string; pagador: string; descricao: string; forma: string; situacao: string;
    bruto: number; taxa: number; liquido: number; split: number; destinoSplit: string;
  }[];
  splits: { id: string; cobranca: string; data: string; destino: string; valor: number; status: string; creditado: string }[];
  repasses: { cobranca: string; data: string; bruto: number; valor: number; percentual: number; status: string; erro: string }[];
}

const STATUS_SPLIT: Record<string, string> = {
  PENDING: "Pendente", PROCESSING: "Processando", AWAITING_CREDIT: "Aguardando crédito", DONE: "Creditado",
  CANCELLED: "Cancelado", REFUNDED: "Estornado", PROCESSING_REFUND: "Estornando", BLOCKED_BY_VALUE_DIVERGENCE: "Bloqueado",
};
const STATUS_REPASSE: Record<string, string> = {
  simulado: "Simulado", pendente: "Transferindo", aguardando: "Aguardando aprovação", transferido: "Transferido", no_pagamento: "Separado no pagamento", erro: "Recusado / erro",
};
export const statusSplit = (s: string) => STATUS_SPLIT[s] || s;
export const statusRepasse = (s: string) => STATUS_REPASSE[s] || s;

const brl = (centavos: number) => ((centavos || 0) / 100 + 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const nomeArquivo = (r: Relatorio, ext: string) => `recebimentos-eklesia-${r.periodo.inicio}-a-${r.periodo.fim}.${ext}`;

function linhasResumo(r: Relatorio): [string, number | null][] {
  const s = r.resumo;
  const linhas: [string, number | null][] = [
    ["Entrada geral (bruto)", s.bruto],
    ["Taxas do Asaas", -s.taxas],
    ["Entrada líquida", s.liquido],
    ...s.porForma.map((f) => [`   ${f.forma} (bruto)`, f.valor] as [string, number]),
    ["Split — Missões", -s.splitMissoes],
    ["Split — Primícias (ofertas pelo app)", -s.splitPrimicias],
    ...(s.splitOutros ? [["Split — outras contas", -s.splitOutros] as [string, number]] : []),
    ["Repasse 45% para Primícias (transferido)", -s.repasseTransferido],
    ["Repasse 45% para Primícias (aguardando aprovação)", -s.repasseAguardando],
    ["Fica na conta da Eklésia", s.ficaNaIgreja],
    ["", null],
    ["Repasse 45% simulado (não transferido)", s.repasseSimulado],
    ["Repasse 45% recusado / com erro", s.repasseErro],
  ];
  return linhas.map(([rot, v]) => [rot, v === null ? null : v || 0]);  // sem "-R$ 0,00"
}

function baixar(blob: Blob, nome: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function baixarExcel(r: Relatorio) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "App Eklésia";
  wb.created = new Date(r.geradoEm);
  const MOEDA = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
  const cab = (ws: import("exceljs").Worksheet) => {
    const l = ws.getRow(1);
    l.font = { bold: true, color: { argb: "FFFFFFFF" } };
    l.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC94A14" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  };
  const reais = (v: number) => v / 100;

  // Resumo
  const res = wb.addWorksheet("Resumo");
  res.columns = [{ width: 48 }, { width: 18 }];
  res.addRow([`Relatório de recebimentos — ${r.igreja}`]).font = { bold: true, size: 14 };
  res.addRow([`Período: ${dataBR(r.periodo.inicio)} a ${dataBR(r.periodo.fim)}`]);
  res.addRow([`Gerado em ${new Date(r.geradoEm).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })} por ${r.geradoPor}`]);
  res.addRow([`${r.resumo.entradas} recebimentos no período`]);
  res.addRow([]);
  for (const [rot, v] of linhasResumo(r)) {
    const row = res.addRow([rot, v === null ? null : reais(v)]);
    row.getCell(2).numFmt = MOEDA;
    if (rot.startsWith("Entrada geral") || rot.startsWith("Fica na conta")) row.font = { bold: true };
  }

  // Entradas
  const ent = wb.addWorksheet("Entradas");
  ent.columns = [
    { header: "Data", key: "data", width: 12 }, { header: "Pagador", key: "pagador", width: 30 },
    { header: "Descrição", key: "descricao", width: 36 }, { header: "Forma", key: "forma", width: 16 },
    { header: "Situação", key: "situacao", width: 20 }, { header: "Bruto", key: "bruto", width: 14 },
    { header: "Taxa", key: "taxa", width: 12 }, { header: "Líquido", key: "liquido", width: 14 },
    { header: "Split", key: "split", width: 14 }, { header: "Destino do split", key: "destinoSplit", width: 18 },
    { header: "Cobrança (Asaas)", key: "id", width: 24 },
  ];
  for (const e of r.entradas) {
    ent.addRow({ ...e, data: dataBR(e.data), bruto: reais(e.bruto), taxa: reais(e.taxa), liquido: reais(e.liquido), split: reais(e.split) });
  }
  ["bruto", "taxa", "liquido", "split"].forEach((k) => (ent.getColumn(k).numFmt = MOEDA));
  cab(ent);
  const totEnt = ent.addRow({ data: "TOTAL", bruto: reais(r.resumo.bruto), taxa: reais(r.resumo.taxas), liquido: reais(r.resumo.liquido),
    split: reais(r.entradas.reduce((t, e) => t + e.split, 0)) });
  totEnt.font = { bold: true };

  // Splits
  const spl = wb.addWorksheet("Splits Missões e Primícias");
  spl.columns = [
    { header: "Data", key: "data", width: 12 }, { header: "Destino", key: "destino", width: 16 },
    { header: "Valor", key: "valor", width: 14 }, { header: "Situação", key: "status", width: 20 },
    { header: "Creditado em", key: "creditado", width: 14 }, { header: "Cobrança (Asaas)", key: "cobranca", width: 24 },
  ];
  for (const s of r.splits) spl.addRow({ ...s, data: dataBR(s.data), creditado: dataBR(s.creditado), valor: reais(s.valor), status: statusSplit(s.status) });
  spl.getColumn("valor").numFmt = MOEDA;
  cab(spl);
  spl.addRow({ data: "Missões", valor: reais(r.resumo.splitMissoes) }).font = { bold: true };
  spl.addRow({ data: "Primícias", valor: reais(r.resumo.splitPrimicias) }).font = { bold: true };

  // Repasse 45%
  const rep = wb.addWorksheet("Repasse 45% Primícias");
  rep.columns = [
    { header: "Data", key: "data", width: 12 }, { header: "Pix recebido (bruto)", key: "bruto", width: 20 },
    { header: "%", key: "percentual", width: 8 }, { header: "Repasse", key: "valor", width: 14 },
    { header: "Situação", key: "status", width: 22 }, { header: "Observação", key: "erro", width: 36 },
    { header: "Cobrança (Asaas)", key: "cobranca", width: 24 },
  ];
  for (const x of r.repasses) rep.addRow({ ...x, data: dataBR(x.data), bruto: reais(x.bruto), valor: reais(x.valor), status: statusRepasse(x.status) });
  ["bruto", "valor"].forEach((k) => (rep.getColumn(k).numFmt = MOEDA));
  cab(rep);
  rep.addRow({ data: "Transferido", valor: reais(r.resumo.repasseTransferido) }).font = { bold: true };
  rep.addRow({ data: "Aguardando", valor: reais(r.resumo.repasseAguardando) }).font = { bold: true };

  const buf = await wb.xlsx.writeBuffer();
  baixar(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), nomeArquivo(r, "xlsx"));
}

export async function baixarPDF(r: Relatorio) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const AZUL: [number, number, number] = [201, 74, 20];  // laranja do tema
  const larg = doc.internal.pageSize.getWidth();
  const fimY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...AZUL);
  doc.text(`Relatório de recebimentos — ${r.igreja}`, 40, 46);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(80);
  doc.text(`Período: ${dataBR(r.periodo.inicio)} a ${dataBR(r.periodo.fim)}  ·  ${r.resumo.entradas} recebimentos`, 40, 64);
  doc.text(`Gerado em ${new Date(r.geradoEm).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })} por ${r.geradoPor}`, 40, 78);

  const negrito = new Set(["Entrada geral (bruto)", "Entrada líquida", "Fica na conta da Eklésia"]);
  autoTable(doc, {
    startY: 92, margin: { left: 40, right: larg / 2 },
    head: [["Resumo", "Valor"]],
    body: linhasResumo(r).filter(([rot]) => rot).map(([rot, v]) => [rot, v === null ? "" : brl(v)]),
    headStyles: { fillColor: AZUL }, styles: { fontSize: 9 },
    columnStyles: { 1: { halign: "right" } },
    didParseCell: (d) => { if (d.section === "body" && negrito.has(String(d.row.raw && (d.row.raw as string[])[0]))) d.cell.styles.fontStyle = "bold"; },
  });

  const secao = (titulo: string, y: number) => {
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...AZUL);
    doc.text(titulo, 40, y);
    return y + 8;
  };

  doc.addPage();
  autoTable(doc, {
    startY: secao("Entradas", 40),
    head: [["Data", "Pagador", "Descrição", "Forma", "Situação", "Bruto", "Taxa", "Líquido", "Split", "Destino"]],
    body: r.entradas.map((e) => [dataBR(e.data), e.pagador, e.descricao, e.forma, e.situacao, brl(e.bruto), brl(e.taxa), brl(e.liquido), e.split ? brl(e.split) : "", e.destinoSplit]),
    foot: [["Total", "", "", "", "", brl(r.resumo.bruto), brl(r.resumo.taxas), brl(r.resumo.liquido), brl(r.entradas.reduce((t, e) => t + e.split, 0)), ""]],
    headStyles: { fillColor: AZUL }, footStyles: { fillColor: [253, 234, 219], textColor: 20, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 3 }, columnStyles: { 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" } },
  });

  let y = fimY() + 30;
  if (y > doc.internal.pageSize.getHeight() - 100) { doc.addPage(); y = 40; }
  autoTable(doc, {
    startY: secao("Splits — Missões e Primícias", y),
    head: [["Data", "Destino", "Valor", "Situação", "Creditado em", "Cobrança"]],
    body: r.splits.length ? r.splits.map((s) => [dataBR(s.data), s.destino, brl(s.valor), statusSplit(s.status), dataBR(s.creditado), s.cobranca]) : [["Nenhum split no período", "", "", "", "", ""]],
    foot: [["Total", `Missões ${brl(r.resumo.splitMissoes)} · Primícias ${brl(r.resumo.splitPrimicias)}`, "", "", "", ""]],
    headStyles: { fillColor: AZUL }, footStyles: { fillColor: [253, 234, 219], textColor: 20, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 3 }, columnStyles: { 2: { halign: "right" } },
  });

  y = fimY() + 30;
  if (y > doc.internal.pageSize.getHeight() - 100) { doc.addPage(); y = 40; }
  autoTable(doc, {
    startY: secao("Repasse automático de 45% para Primícias", y),
    head: [["Data", "Pix recebido (bruto)", "%", "Repasse", "Situação", "Observação"]],
    body: r.repasses.length ? r.repasses.map((x) => [dataBR(x.data), brl(x.bruto), `${x.percentual}%`, brl(x.valor), statusRepasse(x.status), x.erro]) : [["Nenhum repasse no período", "", "", "", "", ""]],
    foot: [["Total", "", "", `Transferido ${brl(r.resumo.repasseTransferido)} · Aguardando ${brl(r.resumo.repasseAguardando)}`, "", ""]],
    headStyles: { fillColor: AZUL }, footStyles: { fillColor: [253, 234, 219], textColor: 20, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 3 }, columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
  });

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(130);
    doc.text(`Eklésia · Relatório de recebimentos · página ${i} de ${n}`, 40, doc.internal.pageSize.getHeight() - 20);
  }
  doc.save(nomeArquivo(r, "pdf"));
}
