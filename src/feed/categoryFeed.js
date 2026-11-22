// Regras puras do feed por categoria (sem DOM, sem rede).

export const FEED_TAB = { VIDEOS: 'videos', SHORTS: 'shorts', CHANNELS: 'channels' };

// Canais mais ativos primeiro: carregar nessa ordem faz os primeiros lotes
// trazerem o que é mais provável de ser novo, com menos requisições.
export function orderByActivity(channels, latestUploads = {}) {
  const activity = (channel) => latestUploads[channel.id] ?? -Infinity;
  return [...channels].sort((a, b) => activity(b) - activity(a) || a.name.localeCompare(b.name));
}

// Vídeos da categoria: os do feed de Inscrições (já baixados na sincronização)
// mais os carregados canal a canal, sem repetição, do mais novo ao mais antigo.
export function categoryVideos(feedItems, channelIds, extraLists = []) {
  const ids = new Set(channelIds);
  const all = [...feedItems.filter((video) => ids.has(video.channelId)), ...extraLists.flat()];
  return [...new Map(all.map((video) => [video.videoId, video])).values()].sort((a, b) => b.publishedAt - a.publishedAt);
}

// Shorts não têm data: intercala um de cada canal por vez (na ordem de
// atividade), para um canal muito produtivo não ocupar a tela inteira.
export function interleave(lists) {
  const result = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let index = 0; index < longest; index += 1) {
    for (const list of lists) if (index < list.length) result.push(list[index]);
  }
  return result;
}

// Próximo lote de canais ainda não pedidos que podem ser consultados (têm ucid).
export function nextChannels(ordered, requested, size) {
  return ordered.filter((channel) => channel.ucid && !requested.has(channel.id)).slice(0, size);
}
