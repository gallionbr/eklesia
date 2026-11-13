import { test } from "node:test";
import assert from "node:assert/strict";

process.env.ASAAS_API_KEY = "teste";
const { processarRepassePix } = await import("./repasse-pix.ts");

// Banco falso: só o que o repasse por Pix usa.
function bancoFalso() {
  const repasses = new Map<string, Record<string, unknown>>();
  const tabelas: Record<string, Record<string, unknown>[]> = {
    eventos: [{ id: "ev1", rede: "rede_azul" }],
    asaas_carteiras: [{ tipo: "primicias" }],
    destinos_pix: [
      { tipo: "rede_rosa", chave: "rederosabrasil@eklesia.international", tipo_chave: "EMAIL", ativo: true },
      { tipo: "rede_azul", chave: "redeazul@eklesia.international", tipo_chave: "EMAIL", ativo: true },
      { tipo: "missoes", chave: "missoes@eklesia.international", tipo_chave: "EMAIL", ativo: true },
    ],
  };
  const db = {
    from(t: string) {
      const filtros: [string, unknown][] = [];
      let upd: Record<string, unknown> | null = null;
      const q = {
        select() { return q; },
        eq(c: string, v: unknown) { filtros.push([c, v]); if (upd) { for (const r of repasses.values()) if (filtros.every(([k, x]) => r[k] === x)) Object.assign(r, upd); return Promise.resolve({}); } return q; },
        maybeSingle() { return Promise.resolve({ data: (tabelas[t] || []).find((r) => filtros.every(([k, x]) => r[k] === x)) || null }); },
        insert(row: Record<string, unknown>) {
          if (repasses.has(row.cobranca_id as string)) return Promise.resolve({ error: { code: "23505", message: "dup" } });
          repasses.set(row.cobranca_id as string, { ...row }); return Promise.resolve({ error: null });
        },
        update(v: Record<string, unknown>) { upd = v; return q; },
      };
      return q;
    },
  };
  return { db: db as never, repasses };
}

test("cada pagamento vai para a chave da sua rede, mesmo chegando juntos", async () => {
  const enviados: Record<string, unknown>[] = [];
  globalThis.fetch = (async (_u: string, o: { body: string }) => {
    enviados.push(JSON.parse(o.body));
    return new Response(JSON.stringify({ id: `tr_${enviados.length}`, status: "PENDING" }), { status: 200 });
  }) as typeof fetch;
  const { db, repasses } = bancoFalso();
  const ev = (id: string, ref: string, v: number, liq: number) => ({ event: "PAYMENT_RECEIVED", payment: { id, value: v, netValue: liq, externalReference: ref } });

  const r = await Promise.all([
    processarRepassePix(db, ev("pay_a", "app:rede_rosa:u1", 50, 49.01)),
    processarRepassePix(db, ev("pay_b", "insc:ev1:u2", 30, 29.01)),
    processarRepassePix(db, ev("pay_c", "app:missoes:u3", 20, 19.01)),
    processarRepassePix(db, ev("pay_d", "app:dizimo:u4:split", 100, 99)),   // dízimo: não é de rede
    processarRepassePix(db, ev("pay_e", "app:rede_familia:u5", 10, 9)),     // sem chave: fica na igreja
  ]);
  assert.deepEqual(r.map((x) => x.feito), [true, true, true, false, false]);
  const porRef = Object.fromEntries(enviados.map((b) => [b.externalReference, [b.pixAddressKey, b.value]]));
  assert.deepEqual(porRef, {
    "repasse:pay_a": ["rederosabrasil@eklesia.international", 49.01],
    "repasse:pay_b": ["redeazul@eklesia.international", 29.01],
    "repasse:pay_c": ["missoes@eklesia.international", 19.01],
  });
  assert.equal(repasses.get("pay_a")!.status, "aguardando");

  // O Asaas reenviou o mesmo aviso: não transfere de novo.
  const de_novo = await processarRepassePix(db, ev("pay_a", "app:rede_rosa:u1", 50, 49.01));
  assert.equal(de_novo.feito, false);
  assert.equal(enviados.length, 3);
});
