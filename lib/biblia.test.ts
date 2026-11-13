import { test } from "node:test";
import assert from "node:assert/strict";
import { lerReferencia, LIVROS } from "./biblia.ts";

const nome = (t: string) => { const r = lerReferencia(t); return r ? `${LIVROS[r.livro].nome} ${r.cap}${r.vers ? ":" + r.vers : ""}` : null; };

test("referências comuns", () => {
  assert.equal(nome("João 3:16"), "João 3:16");
  assert.equal(nome("joao 3 16"), "João 3:16");
  assert.equal(nome("jo 3.16"), "João 3:16");
  assert.equal(nome("1co 13"), "1 Coríntios 13");
  assert.equal(nome("1 Coríntios 13:4"), "1 Coríntios 13:4");
  assert.equal(nome("Sl 23"), "Salmos 23");
  assert.equal(nome("salmo 91:1"), "Salmos 91:1");
  assert.equal(nome("gn"), "Gênesis 1");
  assert.equal(nome("apocalipse 22"), "Apocalipse 22");
  assert.equal(nome("1 jo 4:8"), "1 João 4:8");
  assert.equal(nome("rm 999"), "Romanos 16");
  assert.equal(nome("Jó 1"), "Jó 1");
  assert.equal(nome("xyz 1"), null);
});
