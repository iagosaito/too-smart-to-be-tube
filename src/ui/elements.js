// O YouTube aplica Trusted Types na CSP, então innerHTML lança erro. Criar nós
// com createElement/textContent também impede que nomes de canais virem HTML.
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) applyProp(node, key, value);
  // append converte strings em nós de texto, nunca em HTML.
  node.append(...[].concat(children).filter((child) => child != null));
  return node;
}

function applyProp(node, key, value) {
  if (key.startsWith('on')) {
    node.addEventListener(key.slice(2).toLowerCase(), value);
  } else if (key === 'className' || key === 'value') {
    node[key] = value;
  } else if (typeof value === 'boolean') {
    node.toggleAttribute(key, value);
  } else {
    node.setAttribute(key, value);
  }
}

export function svgIcon(pathData) {
  // SVG precisa de createElementNS; com createElement o navegador não o renderiza.
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  // Tamanho e cor como atributos servem de padrão seguro: se nenhuma regra CSS
  // pegar o ícone, o navegador o desenharia do tamanho do contêiner e em preto.
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', pathData);
  svg.append(path);
  return svg;
}

// Troca só os filhos que mudaram. Reinserir centenas de nós iguais forçava o
// navegador a recalcular o estilo de todos a cada clique.
export function syncChildren(parent, nodes) {
  const current = [...parent.children];
  // Mesma quantidade e sem reordenação: dá para trocar posição a posição.
  const samePositions = current.length === nodes.length && nodes.every((node, i) => node === current[i] || node.parentNode !== parent);
  if (!samePositions) {
    parent.replaceChildren(...nodes);
    return;
  }
  nodes.forEach((node, i) => node !== current[i] && current[i].replaceWith(node));
}
