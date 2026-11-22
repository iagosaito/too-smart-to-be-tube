// Interações do site. Tudo é melhoria progressiva: sem JavaScript a página
// continua completa (o tour mostra a primeira imagem, o FAQ usa <details>).

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Tour: abas verticais no padrão WAI-ARIA (setas mudam de aba, só a ativa é tabulável).
function setupTour() {
  const tabs = [...document.querySelectorAll('.tour-tab')];
  const panel = document.getElementById('panel-tour');
  const image = document.getElementById('tour-image');
  if (!tabs.length || !panel || !image) return;

  const select = (tab, { focus = false } = {}) => {
    for (const other of tabs) {
      const active = other === tab;
      other.setAttribute('aria-selected', String(active));
      other.tabIndex = active ? 0 : -1;
    }
    panel.setAttribute('aria-labelledby', tab.id);
    panel.style.setProperty('--ratio', tab.dataset.ratio);
    swapImage(image, `assets/${tab.dataset.shot}.webp`, tab.dataset.alt);
    if (focus) tab.focus();
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (event) => {
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
      if (event.key === 'Home') select(tabs[0], { focus: true });
      else if (event.key === 'End') select(tabs.at(-1), { focus: true });
      else if (step) select(tabs[(index + step + tabs.length) % tabs.length], { focus: true });
      else return;
      event.preventDefault();
    });
  });
  // Pré-carrega as outras telas para a troca ser instantânea.
  for (const tab of tabs) new Image().src = `assets/${tab.dataset.shot}.webp`;
}

// Troca a imagem com um fade curto; sem animação para quem pediu menos movimento.
function swapImage(image, src, alt) {
  if (image.getAttribute('src') === src) return;
  const apply = () => {
    image.src = src;
    image.alt = alt;
    image.classList.remove('is-swapping');
  };
  if (prefersReducedMotion) return apply();
  image.classList.add('is-swapping');
  setTimeout(apply, 160);
}

// Revela blocos ao entrar na tela (uma vez só, para não distrair ao rolar de volta).
function setupReveal() {
  const items = document.querySelectorAll('.reveal');
  if (prefersReducedMotion || !('IntersectionObserver' in window)) return;
  // O que já está na tela aparece de imediato: animar o conteúdo visível só atrasa a leitura.
  for (const item of items) {
    if (item.getBoundingClientRect().top < window.innerHeight) item.classList.add('is-visible');
  }
  document.documentElement.classList.add('js-reveal');
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  items.forEach((item) => observer.observe(item));
}

// Destaca no menu do topo a seção que está sendo lida.
function setupActiveNav() {
  const links = new Map([...document.querySelectorAll('.nav-links a')].map((link) => [link.hash.slice(1), link]));
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const link = links.get(entry.target.id);
      if (entry.isIntersecting) {
        links.forEach((other) => other.removeAttribute('aria-current'));
        link?.setAttribute('aria-current', 'true');
      }
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((_, id) => {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  });
}

// Botão "Copiar" dos comandos de instalação, com retorno visível e anunciado.
function setupCopy() {
  for (const button of document.querySelectorAll('[data-copy]')) {
    button.setAttribute('aria-live', 'polite');
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        button.textContent = 'Copied!';
      } catch {
        button.textContent = 'Select & copy';
      }
      setTimeout(() => { button.textContent = 'Copy'; }, 2000);
    });
  }
}

// Sombra no menu do topo só depois de rolar, para separá-lo do conteúdo.
function setupNavShadow() {
  const nav = document.querySelector('.nav');
  const update = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', update, { passive: true });
  update();
}

setupTour();
setupReveal();
setupActiveNav();
setupCopy();
setupNavShadow();
