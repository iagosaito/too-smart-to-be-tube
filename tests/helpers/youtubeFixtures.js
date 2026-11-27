// Trimmed HTML mimicking the real structure of the sidebar and of /feed/channels.

export function guideEntry(href, title, avatar = '') {
  const img = avatar ? `<yt-img-shadow><img src="${avatar}"></yt-img-shadow>` : '';
  return `<ytd-guide-entry-renderer><a id="endpoint" href="${href}" title="${title}">${img}${title}</a></ytd-guide-entry-renderer>`;
}

export const GUIDE_HTML = `
<ytd-guide-renderer>
  <div id="sections">
    <ytd-guide-section-renderer id="main">
      <div id="items">
        ${guideEntry('/', 'Início')}
        ${guideEntry('/feed/subscriptions', 'Inscrições')}
      </div>
    </ytd-guide-section-renderer>
    <ytd-guide-section-renderer id="you">
      <a href="/feed/you">Você</a>
      <div id="items">${guideEntry('/channel/UCme', 'Seu canal')}</div>
    </ytd-guide-section-renderer>
    <ytd-guide-section-renderer id="subs">
      <a href="/feed/channels">Inscrições</a>
      <div id="items">
        ${guideEntry('/@alura', 'Alura', 'https://yt3.example/alura.jpg')}
        ${guideEntry('/channel/UCabc', 'Canal Antigo')}
        <ytd-guide-collapsible-entry-renderer>
          <div id="expandable-items">${guideEntry('/@escondido', 'Escondido')}</div>
        </ytd-guide-collapsible-entry-renderer>
        ${guideEntry('/feed/channels', 'Todas as inscrições')}
      </div>
    </ytd-guide-section-renderer>
  </div>
</ytd-guide-renderer>`;

export function feedChannel(href, name) {
  return `<ytd-channel-renderer>
    <a id="main-link" href="${href}"><img src="https://yt3.example${href}.jpg"></a>
    <ytd-channel-name><div id="container"><yt-formatted-string id="text">${name}</yt-formatted-string></div></ytd-channel-name>
  </ytd-channel-renderer>`;
}
