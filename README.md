# Too Smart To Be Tube

Extensão do Chrome (Manifest V3) que adiciona um item **Categorias** ao menu lateral do YouTube para organizar suas inscrições.

## Desenvolvimento

```sh
npm install
npm test        # testes unitários (Vitest + jsdom)
npm run build   # gera dist/content.js
npm run watch   # rebuild automático
```

## Instalar no Chrome

1. `npm run build`
2. Abra `chrome://extensions` e ative o **Modo do desenvolvedor**.
3. **Carregar sem compactação** → selecione esta pasta.
4. Abra o YouTube logado e clique em **Categorias** no menu lateral. As inscrições
   são sincronizadas automaticamente (no máximo uma vez por hora) ou pelo botão
   **Sincronizar inscrições**.

## Ordenar por vídeo mais recente

No título de cada categoria, **Ordenar** alterna entre A–Z e **Vídeo mais recente**.
A data vem do feed de Inscrições do YouTube, lido junto com a sincronização; canais
que não aparecem no feed (sem vídeos nas últimas semanas) ficam no fim.

## Exportar e importar CSV

Na página de Categorias, **Exportar CSV** baixa todas as inscrições com as colunas
`Canal, Categoria, URL, Identificador`. Para categorizar em lote, edite a coluna
**Categoria** (numa planilha ou com ajuda de alguém) e use **Importar CSV**:

- antes de aplicar, a extensão mostra quantos canais serão organizados, quais
  categorias serão criadas e quais linhas não correspondem às suas inscrições;
- canais fora do arquivo mantêm a categoria atual; `Sem categoria` ou célula vazia
  tira o canal de qualquer categoria;
- aceita `,` ou `;` (Excel em português) e cabeçalhos em português ou inglês;
- depois de aplicar, o aviso oferece **Desfazer** por alguns segundos.

## Estrutura

- `src/core` — regras puras (canais, categorias), sem DOM nem `chrome.*`.
- `src/storage` — persistência em `chrome.storage.local`.
- `src/dom` — leitura e injeção no DOM do YouTube. Seletores em `src/dom/selectors.js`.
- `src/export` / `src/import` — geração e leitura de CSV (funções puras).
- `src/youtube` — busca de todas as inscrições via API interna do YouTube (InnerTube).
- `src/ui` — página de categorias, montada dentro do layout do YouTube.
- `src/content/main.js` — ponto de entrada do content script.
