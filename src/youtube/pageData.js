// O content script roda num "mundo isolado": não enxerga as variáveis JS da
// página (ytcfg, ytInitialData). Por isso lemos esses dados direto do HTML
// baixado, que o YouTube embute em <script> inline.

export function extractInitialData(html) {
  // O YouTube escapa "<" dentro do JSON como <, então "};</script>" só
  // aparece no fim real do objeto e o match não-guloso é seguro.
  const match = html.match(/ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

export function extractConfig(html) {
  return {
    clientVersion: matchConfigValue(html, 'INNERTUBE_CLIENT_VERSION'),
    apiKey: matchConfigValue(html, 'INNERTUBE_API_KEY'),
    // Índice da conta Google logada; importa quando há várias contas no navegador.
    sessionIndex: matchConfigValue(html, 'SESSION_INDEX') ?? '0',
    // Presente quando o usuário está usando uma conta de marca (brand account).
    delegatedSessionId: matchConfigValue(html, 'DELEGATED_SESSION_ID'),
  };
}

function matchConfigValue(html, key) {
  // Aceita valores com ou sem aspas porque SESSION_INDEX vem como número.
  const match = html.match(new RegExp(`"${key}"\\s*:\\s*"?([^",}]+)"?`));
  return match ? match[1] : null;
}

// A versão do cliente também está nos <script> da própria página aberta; ler
// daqui evita baixar outra página só para descobri-la.
export function clientVersionFromDocument(doc = document) {
  for (const script of doc.querySelectorAll('script')) {
    const text = script.textContent;
    if (text.includes('INNERTUBE_CLIENT_VERSION')) return extractConfig(text).clientVersion;
  }
  return null;
}
