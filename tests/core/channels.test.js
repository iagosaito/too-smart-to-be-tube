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
  ])('extracts the id from %s', (href, expected) => {
    expect(channelIdFromHref(href)).toBe(expected);
  });

  it.each(['/feed/channels', '/watch?v=1', '/', '', null, undefined])('rejects %s', (href) => {
    expect(channelIdFromHref(href)).toBeNull();
  });
});

describe('createChannel', () => {
  it('creates a normalized channel', () => {
    expect(createChannel({ href: '/@alura', name: '  Alura ', avatar: 'a.jpg' })).toEqual({
      id: '/@alura',
      name: 'Alura',
      url: 'https://www.youtube.com/@alura',
      avatar: 'a.jpg',
    });
  });

  it('uses an empty avatar when there is no image', () => {
    expect(createChannel({ href: '/@x', name: 'X' }).avatar).toBe('');
  });

  it('returns null without a name or a channel href', () => {
    expect(createChannel({ href: '/@x', name: '   ' })).toBeNull();
    expect(createChannel({ href: '/feed/channels', name: 'X' })).toBeNull();
  });
});

describe('mergeChannels', () => {
  const alura = { id: '/@alura', name: 'Alura', url: 'u', avatar: 'old.jpg' };

  it('adds new channels and updates existing ones', () => {
    const merged = mergeChannels({ [alura.id]: alura }, [
      { ...alura, name: 'Alura Novo', avatar: 'new.jpg' },
      { id: '/@b', name: 'B', url: 'b', avatar: '' },
    ]);
    expect(merged['/@alura']).toMatchObject({ name: 'Alura Novo', avatar: 'new.jpg' });
    expect(merged['/@b'].name).toBe('B');
  });

  it('keeps the known avatar when the new read has no image', () => {
    const merged = mergeChannels({ [alura.id]: alura }, [{ ...alura, avatar: '' }]);
    expect(merged['/@alura'].avatar).toBe('old.jpg');
  });

  it("doesn't mutate the original object", () => {
    const existing = { [alura.id]: alura };
    mergeChannels(existing, [{ id: '/@b', name: 'B', url: 'b', avatar: '' }]);
    expect(Object.keys(existing)).toEqual(['/@alura']);
  });
});

describe('sortByName', () => {
  it('sorts ignoring case and accents without mutating the input', () => {
    const input = [{ name: 'zeta' }, { name: 'Ábaco' }, { name: 'beta' }];
    expect(sortByName(input).map((c) => c.name)).toEqual(['Ábaco', 'beta', 'zeta']);
    expect(input[0].name).toBe('zeta');
  });
});
