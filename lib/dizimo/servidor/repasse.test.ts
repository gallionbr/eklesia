import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularRepasse, elegivel } from "./repasse-regra.ts";

test("45% do bruto, arredondado para baixo", () => {
  assert.equal(calcularRepasse(10000, 45), 4500);
  assert.equal(calcularRepasse(2001, 45), 900);   // 900,45 → 900
  assert.equal(calcularRepasse(1, 45), 0);
});

test("só Pix recebido sem split entra", () => {
  const pix = { id: "pay_1", value: 50, billingType: "PIX" };
  assert.equal(elegivel("PAYMENT_RECEIVED", pix), null);
  assert.ok(elegivel("PAYMENT_CONFIRMED", pix));
  assert.ok(elegivel("PAYMENT_RECEIVED", { ...pix, billingType: "CREDIT_CARD" }));
  assert.ok(elegivel("PAYMENT_RECEIVED", { ...pix, split: [{ walletId: "x" }] }));
  assert.ok(elegivel("PAYMENT_RECEIVED", { ...pix, externalReference: "app:primicias:u1" }));
  assert.ok(elegivel("PAYMENT_RECEIVED", { ...pix, externalReference: "app:dizimo:u1:split" }));
  assert.ok(elegivel("PAYMENT_RECEIVED", { ...pix, externalReference: "app:rede_rosa:u1" }));
  assert.ok(elegivel("PAYMENT_RECEIVED", { ...pix, externalReference: "insc:ev1:u1" }));
  assert.equal(elegivel("PAYMENT_RECEIVED", { ...pix, externalReference: "app:oferta:u1" }), null);
  assert.equal(elegivel("PAYMENT_RECEIVED", { ...pix, externalReference: "dz:123" }), null);
  assert.ok(elegivel("PAYMENT_RECEIVED", { ...pix, value: 0 }));
});
