// Livros da Bíblia: nome em português, nome aceito pela bible-api.com e nº de capítulos.
// Texto: João Ferreira de Almeida (domínio público), via https://bible-api.com (?translation=almeida).

export interface Livro { nome: string; api: string; caps: number; at: boolean }

const L = (nome: string, api: string, caps: number, at = true): Livro => ({ nome, api, caps, at });

export const LIVROS: Livro[] = [
  L("Gênesis", "genesis", 50), L("Êxodo", "exodus", 40), L("Levítico", "leviticus", 27), L("Números", "numbers", 36),
  L("Deuteronômio", "deuteronomy", 34), L("Josué", "joshua", 24), L("Juízes", "judges", 21), L("Rute", "ruth", 4),
  L("1 Samuel", "1 samuel", 31), L("2 Samuel", "2 samuel", 24), L("1 Reis", "1 kings", 22), L("2 Reis", "2 kings", 25),
  L("1 Crônicas", "1 chronicles", 29), L("2 Crônicas", "2 chronicles", 36), L("Esdras", "ezra", 10), L("Neemias", "nehemiah", 13),
  L("Ester", "esther", 10), L("Jó", "job", 42), L("Salmos", "psalms", 150), L("Provérbios", "proverbs", 31),
  L("Eclesiastes", "ecclesiastes", 12), L("Cânticos", "song of solomon", 8), L("Isaías", "isaiah", 66), L("Jeremias", "jeremiah", 52),
  L("Lamentações", "lamentations", 5), L("Ezequiel", "ezekiel", 48), L("Daniel", "daniel", 12), L("Oséias", "hosea", 14),
  L("Joel", "joel", 3), L("Amós", "amos", 9), L("Obadias", "obadiah", 1), L("Jonas", "jonah", 4), L("Miquéias", "micah", 7),
  L("Naum", "nahum", 3), L("Habacuque", "habakkuk", 3), L("Sofonias", "zephaniah", 3), L("Ageu", "haggai", 2),
  L("Zacarias", "zechariah", 14), L("Malaquias", "malachi", 4),
  L("Mateus", "matthew", 28, false), L("Marcos", "mark", 16, false), L("Lucas", "luke", 24, false), L("João", "john", 21, false),
  L("Atos", "acts", 28, false), L("Romanos", "romans", 16, false), L("1 Coríntios", "1 corinthians", 16, false),
  L("2 Coríntios", "2 corinthians", 13, false), L("Gálatas", "galatians", 6, false), L("Efésios", "ephesians", 6, false),
  L("Filipenses", "philippians", 4, false), L("Colossenses", "colossians", 4, false), L("1 Tessalonicenses", "1 thessalonians", 5, false),
  L("2 Tessalonicenses", "2 thessalonians", 3, false), L("1 Timóteo", "1 timothy", 6, false), L("2 Timóteo", "2 timothy", 4, false),
  L("Tito", "titus", 3, false), L("Filemom", "philemon", 1, false), L("Hebreus", "hebrews", 13, false), L("Tiago", "james", 5, false),
  L("1 Pedro", "1 peter", 5, false), L("2 Pedro", "2 peter", 3, false), L("1 João", "1 john", 5, false), L("2 João", "2 john", 1, false),
  L("3 João", "3 john", 1, false), L("Judas", "jude", 1, false), L("Apocalipse", "revelation", 22, false),
];

export interface Versiculo { verse: number; text: string }

export async function lerCapitulo(livro: Livro, cap: number): Promise<Versiculo[]> {
  const ref = encodeURIComponent(`${livro.api} ${cap}`);
  const r = await fetch(`https://bible-api.com/${ref}?translation=almeida`);
  if (!r.ok) throw new Error("Não foi possível carregar o capítulo agora.");
  const j = await r.json();
  return (j.verses || []).map((v: { verse: number; text: string }) => ({ verse: v.verse, text: v.text.trim() }));
}
