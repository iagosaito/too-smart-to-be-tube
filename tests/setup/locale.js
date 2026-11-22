// A maior parte dos testes verifica textos em português; fixar o idioma da
// página (como o YouTube faz com <html lang>) mantém esses testes estáveis.
// Testes de outros idiomas trocam o atributo e restauram no fim.
document.documentElement.lang = 'pt-BR';
