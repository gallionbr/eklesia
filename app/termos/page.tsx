import Link from "next/link";

export const metadata = { title: "Termos de uso · Eklésia" };

export default function Termos() {
  return (
    <main className="pagina" style={{ maxWidth: 680, margin: "0 auto" }}>
      <Link href="/" className="linha" style={{ gap: 10 }}>
        <img src="/logo.svg" alt="" width={28} height={45} />
        <b>Eklésia</b>
      </Link>
      <h1>Termos de uso</h1>
      <p className="muted peq">Última atualização: 5 de novembro de 2026</p>
      <p>O app Eklésia é oferecido gratuitamente pela Igreja Eklésia para seus membros e visitantes.</p>
      <ul style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 20 }}>
        <li>Use o app com respeito. Pedidos de oração e informações devem ser verdadeiros e não ofender ninguém.</li>
        <li>A liderança pode remover conteúdos do mural e ajustar cadastros quando necessário.</li>
        <li>Ofertas e dízimos pelo Pix vão direto para a conta da igreja; o app apenas gera o código de pagamento e não guarda dados bancários.</li>
        <li>O texto bíblico vem da tradução João Ferreira de Almeida, em domínio público.</li>
        <li>Podemos atualizar o app e estes termos; mudanças importantes serão avisadas no próprio app.</li>
      </ul>
      <p className="muted peq"><Link href="/privacidade" style={{ color: "var(--primaria)" }}>Política de privacidade</Link></p>
    </main>
  );
}
