"use client";

/** Foto redonda; sem foto mostra a inicial. Com `anel`, desenha o anel de story. */
export default function Avatar({
  src, nome, tam = 32, anel, visto, aovivo, logo,
}: { src?: string | null; nome?: string | null; tam?: number; anel?: boolean; visto?: boolean; aovivo?: boolean; logo?: boolean }) {
  const inicial = (nome || "?").trim().charAt(0).toUpperCase();
  const miolo = (
    <div className="av" style={{ width: tam, height: tam, fontSize: tam * 0.4, background: logo ? "#fff" : undefined, outline: logo ? "1px solid var(--linha)" : undefined }}>
      {logo ? (
        <img src="/logo.svg" alt="" style={{ objectFit: "contain", padding: tam * 0.12 }} />
      ) : src ? (
        <img src={src} alt="" loading="lazy" />
      ) : (
        inicial
      )}
    </div>
  );
  if (!anel) return miolo;
  return (
    <div className={`anel ${visto ? "visto" : ""} ${aovivo ? "aovivo" : ""}`}>
      <div className="miolo">{miolo}</div>
    </div>
  );
}
