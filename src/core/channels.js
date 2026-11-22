const YOUTUBE_ORIGIN = 'https://www.youtube.com';

// Só aceitamos caminhos de canal: o menu lateral também tem links como
// /feed/channels ou /playlist, que não devem virar "canais".
const CHANNEL_PATH = /^\/(@[^/?#]+|channel\/[^/?#]+|c\/[^/?#]+|user\/[^/?#]+)/;

export function channelIdFromHref(href) {
  if (!href) return null;
  try {
    // A base permite aceitar tanto hrefs relativos quanto absolutos.
    const { pathname } = new URL(href, YOUTUBE_ORIGIN);
    const match = pathname.match(CHANNEL_PATH);
    return match ? `/${match[1]}` : null;
  } catch {
    return null;
  }
}

// Id interno do YouTube (UC + 22 caracteres): é o que a API pública dos canais
// exige para buscar vídeos e Shorts; o handle (/@nome) não serve.
const UCID = /^UC[\w-]{22}$/;

export function createChannel({ href, name, avatar, ucid }) {
  const id = channelIdFromHref(href);
  const cleanName = name?.trim();
  // Sem id ou nome o canal não pode ser exibido nem identificado depois.
  if (!id || !cleanName) return null;
  const channel = { id, name: cleanName, url: `${YOUTUBE_ORIGIN}${id}`, avatar: avatar || '' };
  return UCID.test(ucid ?? '') ? { ...channel, ucid } : channel;
}

export function mergeChannels(existing, incoming) {
  const merged = { ...existing };
  for (const channel of incoming) {
    const previous = merged[channel.id];
    // Avatares são lazy-loaded no YouTube; não perdemos um avatar já
    // conhecido só porque a imagem ainda não carregou nesta leitura.
    const ucid = channel.ucid ?? previous?.ucid;
    // O menu lateral não traz o ucid; uma leitura dele não pode apagar o que a sincronização guardou.
    merged[channel.id] = { ...channel, avatar: channel.avatar || previous?.avatar || '', ...(ucid ? { ucid } : {}) };
  }
  return merged;
}

// locale opcional (ex.: "pt-BR"): a ordem alfabética muda entre idiomas. O
// núcleo não sabe qual idioma está ativo; quem chama informa.
export function sortByName(channels, locale) {
  // localeCompare para ordenar acentos e maiúsculas de forma natural.
  return [...channels].sort((a, b) => a.name.localeCompare(b.name, locale, { sensitivity: 'base' }));
}
