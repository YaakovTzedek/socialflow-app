/**
 * Fill the variables a user can put in a public reply or a private message.
 *
 * The editor inserts them in the user's own language ("{commenter name}",
 * "{שם הפונה}", ...), so every locale's spelling is accepted here, plus the
 * short forms {name}, {keyword} and {page}. An unknown name is dropped and the
 * space before the following punctuation tidied ("Hi {name}!" -> "Hi!").
 */
const NAME = ['{name}', '{commenter name}', '{שם הפונה}', '{اسم المعلّق}', '{Name des Kommentators}', '{nombre del comentarista}', '{nom du commentateur}', '{hozzászóló neve}', '{nome del commentatore}', '{投稿者名}'];
const KEYWORD = ['{keyword}', '{מילת המפתח}', '{الكلمة المفتاحية}', '{Schlüsselwort}', '{palabra clave}', '{mot-clé}', '{kulcsszó}', '{parola chiave}', '{キーワード}'];
const PAGE = ['{page}', '{page name}', '{שם הדף}', '{اسم الصفحة}', '{Seitenname}', '{nombre de la página}', '{nom de la page}', '{oldal neve}', '{nome della pagina}', '{ページ名}'];

export type TemplateVars = { name?: string | null; keyword?: string | null; page?: string | null };

export function fillVars(text: string, v: TemplateVars): string {
  if (!text || !text.includes('{')) return text;
  let out = text;
  const put = (tokens: string[], value: string) => {
    for (const t of tokens) out = out.split(t).join(value);
  };
  put(NAME, (v.name || '').trim());
  put(KEYWORD, (v.keyword || '').trim());
  put(PAGE, (v.page || '').trim());
  return out.replace(/[ \t]+([!?.,:،])/g, '$1').replace(/[ \t]{2,}/g, ' ');
}
