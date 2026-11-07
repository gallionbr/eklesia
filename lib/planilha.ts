/** Baixa uma planilha CSV que o Excel abre direto (separador ";" e UTF-8 com BOM). */
export function baixarCSV(nome: string, linhas: string[][]) {
  const csv = "﻿" + linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = nome.replace(/[^\w.\-]+/g, "-");
  a.click();
  URL.revokeObjectURL(a.href);
}
