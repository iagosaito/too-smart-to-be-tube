import { createChannel } from '../core/channels.js';
import { SELECTORS } from './selectors.js';

export function scrapeChannels(doc) {
  // Duas fontes porque o menu lateral pode não listar todas as inscrições,
  // enquanto /feed/channels lista todas (mas só quando o usuário está lá).
  return [...scrapeGuideChannels(doc), ...scrapeFeedChannels(doc)];
}

export function scrapeGuideChannels(doc) {
  const section = findSubscriptionsSection(doc);
  if (!section) return [];
  return [...section.querySelectorAll(SELECTORS.guideEntryLink)].map(guideLinkToChannel).filter(Boolean);
}

export function scrapeFeedChannels(doc) {
  return [...doc.querySelectorAll(SELECTORS.feedChannel)].map(feedRendererToChannel).filter(Boolean);
}

function findSubscriptionsSection(doc) {
  // Restringe à seção de inscrições: a seção "Você" também tem links de canal
  // (ex.: "Seu canal") que não são inscrições.
  const sections = [...doc.querySelectorAll(SELECTORS.guideSection)];
  return sections.find((section) => section.querySelector(SELECTORS.subscriptionsMarker)) ?? null;
}

function guideLinkToChannel(link) {
  return createChannel({
    href: link.getAttribute('href'),
    // O atributo title tem o nome limpo, sem badges de "novo vídeo".
    name: link.getAttribute('title') ?? link.textContent,
    avatar: link.querySelector(SELECTORS.image)?.getAttribute('src'),
  });
}

function feedRendererToChannel(renderer) {
  return createChannel({
    href: renderer.querySelector(SELECTORS.feedChannelLink)?.getAttribute('href'),
    name: renderer.querySelector(SELECTORS.feedChannelName)?.textContent,
    avatar: renderer.querySelector(SELECTORS.image)?.getAttribute('src'),
  });
}
