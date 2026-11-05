import Link from "next/link";

export const metadata = { title: "Privacidade · Eklésia" };

export default function Privacidade() {
  return (
    <main className="pagina" style={{ maxWidth: 680, margin: "0 auto" }}>
      <Link href="/" className="linha" style={{ gap: 10 }}>
        <img src="/logo.svg" alt="" width={28} height={45} />
        <b>Eklésia</b>
      </Link>
      <h1>Política de privacidade</h1>
      <p className="muted peq">Última atualização: 5 de novembro de 2026</p>

      <section className="secao">
        <h2>Quem somos</h2>
        <p>O app Eklésia (eklesia.international) é o aplicativo de comunicação e cuidado da Igreja Eklésia com seus membros e visitantes.</p>
      </section>
      <section className="secao">
        <h2>Dados que coletamos</h2>
        <p>Nome e e-mail (no cadastro ou pelo login com Google) e, se você quiser informar, telefone, data de nascimento, bairro e data em que se tornou membro. Também guardamos o que você faz no app: célula escolhida, inscrições em eventos e pedidos de oração.</p>
        <p>Do login com Google recebemos apenas nome, e-mail e foto do perfil. Não temos acesso à sua senha nem a outros dados da sua conta Google.</p>
      </section>
      <section className="secao">
        <h2>Para que usamos</h2>
        <p>Para cuidado pastoral, organização de células e eventos e comunicação da igreja. Não vendemos nem compartilhamos seus dados com terceiros para publicidade.</p>
      </section>
      <section className="secao">
        <h2>Quem vê seus dados</h2>
        <p>Os administradores da igreja veem os dados de cadastro. O líder da sua célula vê seu nome e telefone. Pedidos de oração marcados para o mural são vistos pelos membros (com ou sem seu nome, como você escolher); os demais, só pela liderança.</p>
      </section>
      <section className="secao">
        <h2>Onde ficam</h2>
        <p>Em servidores da Supabase (banco de dados) e da Vercel (hospedagem), com acesso protegido por login e regras de permissão.</p>
      </section>
      <section className="secao">
        <h2>Seus direitos (LGPD)</h2>
        <p>Você pode ver e corrigir seus dados em “Meu perfil”, apagar seus pedidos de oração a qualquer momento e pedir a exclusão completa da sua conta falando com a secretaria da igreja.</p>
      </section>
      <p className="muted peq"><Link href="/termos" style={{ color: "var(--primaria)" }}>Termos de uso</Link></p>
    </main>
  );
}
