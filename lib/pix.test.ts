import { test } from "node:test";
import assert from "node:assert/strict";
import { gerarPix, crc16 } from "./pix.ts";

test("exemplo do manual do BR Code (Banco Central)", () => {
  const esperado =
    "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D";
  const gerado = gerarPix({
    chave: "123e4567-e12b-12d1-a456-426655440000",
    recebedor: "Fulano de Tal",
    cidade: "BRASILIA",
  });
  assert.equal(gerado, esperado);
});

test("valor e acentos", () => {
  const p = gerarPix({ chave: "igreja@exemplo.com", recebedor: "Igreja Eklésia", cidade: "Fortaleza", valor: 50, txid: "OFERTA" });
  assert.match(p, /540550\.00/);
  assert.match(p, /5914Igreja Eklesia/);
  assert.equal(crc16(p.slice(0, -4)), p.slice(-4));
});
