import { describe, expect, it } from 'vitest';
import { channelIdFromHref, createChannel, mergeChannels, sortByName } from '../../src/core/channels.js';

describe('channelIdFromHref', () => {
  it.each([
    ['/@alura', '/@alura'],
    ['/@alura/videos', '/@alura'],
    ['/channel/UC123?x=1', '/channel/UC123'],
    ['/c/antigo', '/c/antigo'],
    ['/user/velho', '/user/velho'],
    ['https://www.youtube.com/@abs', '/@abs'],
  ])('extrai o id de %s', (href, expected) => {
    expect(channelIdFromHref(href)).toBe(expected);
  });

  it.each(['/feed/channels', '/watch?v=1', '/', '', null, undefined])('rejeita %s', (href) => {
    expect(channelIdFromHref(href)).toBeNull();
  });
});

describe('createChannel', () => {
  it('cria um canal normalizado', () => {
    expect(createChannel({ href: '/@alura', name: '  Alura ', avatar: 'a.jpg' })).toEqual({
      id: '/@alura',
      name: 'Alura',
      url: 'https://www.youtube.com/@alura',
      avatar: 'a.jpg',
    });
  });

  it('usa avatar vazio quando não há imagem', () => {
    expect(createChannel({ href: '/@x', name: 'X' }).avatar).toBe('');
  });

  it('retorna null sem nome ou sem href de canal', () => {
    expect(createChannel({ href: '/@x', name: '   ' })).toBeNull();
    expect(createChannel({ href: '/feed/channels', name: 'X' })).toBeNull();
  });
});

describe('mergeChannels', () => {
  const alura = { id: '/@alura', name: 'Alura', url: 'u', avatar: 'old.jpg' };

  it('adiciona canais novos e atualiza os existentes', () => {
    const merged = mergeChannels({ [alura.id]: alura }, [
      { ...alura, name: 'Alura Novo', avatar: 'new.jpg' },
      { id: '/@b', name: 'B', url: 'b', avatar: '' },
    ]);
    expect(merged['/@alura']).toMatchObject({ name: 'Alura Novo', avatar: 'new.jpg' });
    expect(merged['/@b'].name).toBe('B');
  });

  it('preserva o avatar conhecido quando a nova leitura vem sem imagem', () => {
    const merged = mergeChannels({ [alura.id]: alura }, [{ ...alura, avatar: '' }]);
    expect(merged['/@alura'].avatar).toBe('old.jpg');
  });

  it('não muta o objeto original', () => {
    const existing = { [alura.id]: alura };
    mergeChannels(existing, [{ id: '/@b', name: 'B', url: 'b', avatar: '' }]);
    expect(Object.keys(existing)).toEqual(['/@alura']);
  });
});

describe('sortByName', () => {
  it('ordena ignorando maiúsculas e acentos sem mutar a entrada', () => {
    const input = [{ name: 'zeta' }, { name: 'Ábaco' }, { name: 'beta' }];
    expect(sortByName(input).map((c) => c.name)).toEqual(['Ábaco', 'beta', 'zeta']);
    expect(input[0].name).toBe('zeta');
  });
});
