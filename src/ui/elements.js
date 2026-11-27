// YouTube enforces Trusted Types in its CSP, so innerHTML throws. Creating nodes with
// createElement/textContent also keeps channel names from becoming HTML.
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) applyProp(node, key, value);
  // append turns strings into text nodes, never into HTML.
  node.append(...[].concat(children).filter((child) => child != null));
  return node;
}

function applyProp(node, key, value) {
  // null/undefined mean "no such attribute" (setAttribute would store the text "null").
  if (value == null) return;
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
  // SVG needs createElementNS; with createElement the browser doesn't render it.
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  // Size and color as attributes are a safe default: if no CSS rule matches the icon, the browser
  // would draw it at the container's size and in black.
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', pathData);
  svg.append(path);
  return svg;
}

// Swaps only the children that changed. Reinserting hundreds of identical nodes forced the browser
// to recompute the style of all of them on every click.
export function syncChildren(parent, nodes) {
  const current = [...parent.children];
  // Same count and no reordering: we can swap position by position.
  const samePositions = current.length === nodes.length && nodes.every((node, i) => node === current[i] || node.parentNode !== parent);
  if (!samePositions) {
    parent.replaceChildren(...nodes);
    return;
  }
  nodes.forEach((node, i) => node !== current[i] && current[i].replaceWith(node));
}
