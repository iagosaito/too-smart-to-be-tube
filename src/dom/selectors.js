// Todos os seletores do YouTube ficam aqui porque o HTML do site muda com
// frequência: quando algo quebrar, este é o único arquivo a corrigir.
export const SELECTORS = {
  guide: 'ytd-guide-renderer',
  guideSection: 'ytd-guide-section-renderer',
  // Versão recolhida do menu: outro componente, montado só quando é exibido.
  miniGuideItems: 'ytd-mini-guide-renderer #items',
  miniGuideEntry: 'ytd-mini-guide-entry-renderer',
  // O item de Categorias entra logo antes de Inscrições (ou depois do Shorts, se Inscrições sumir).
  miniGuideSubscriptions: 'a[href="/feed/subscriptions"]',
  miniGuideShorts: 'a[href^="/shorts"]',
  guideEntryLink: 'ytd-guide-entry-renderer a#endpoint',
  // A seção de inscrições é a única cujo cabeçalho/rodapé aponta para /feed/channels.
  subscriptionsMarker: 'a[href="/feed/channels"]',
  feedChannel: 'ytd-channel-renderer',
  feedChannelLink: 'a#main-link',
  feedChannelName: 'ytd-channel-name #text',
  image: 'img',
  // Contêiner das páginas do YouTube; a página de Categorias é montada aqui dentro.
  pageManager: 'ytd-page-manager',
};
