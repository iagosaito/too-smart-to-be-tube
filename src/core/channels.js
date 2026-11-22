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

export function createChannel({ href, name, avatar }) {
  const id = channelIdFromHref(href);
  const cleanName = name?.trim();
  // Sem id ou nome o canal não pode ser exibido nem identificado depois.
  if (!id || !cleanName) return null;
  return { id, name: cleanName, url: `${YOUTUBE_ORIGIN}${id}`, avatar: avatar || '' };
}

export function mergeChannels(existing, incoming) {
  const merged = { ...existing };
  for (const channel of incoming) {
    const previous = merged[channel.id];
    // Avatares são lazy-loaded no YouTube; não perdemos um avatar já
    // conhecido só porque a imagem ainda não carregou nesta leitura.
    merged[channel.id] = { ...channel, avatar: channel.avatar || previous?.avatar || '' };
  }
  return merged;
}

export function sortByName(channels) {
  // localeCompare para ordenar acentos e maiúsculas de forma natural em pt-BR.
  return [...channels].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
