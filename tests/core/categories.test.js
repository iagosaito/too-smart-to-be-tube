import { describe, expect, it } from 'vitest';
import {
  assignChannel,
  assignChannels,
  createCategory,
  findCategoryOf,
  groupChannels,
  removeCategory,
  renameCategory,
  sortCategoriesByName,
} from '../../src/core/categories.js';

const makeId = () => 'id-1';
const music = { id: 'm', name: 'Música', channelIds: ['/@a'] };
const tech = { id: 't', name: 'Tech', channelIds: [] };

describe('createCategory', () => {
  it('adds an empty category with the trimmed name', () => {
    expect(createCategory([], '  Games ', makeId)).toEqual([{ id: 'id-1', name: 'Games', channelIds: [] }]);
  });

  it('ignores an empty name', () => {
    const categories = [tech];
    expect(createCategory(categories, '   ', makeId)).toBe(categories);
  });

  it('ignores a duplicate name, case-insensitively', () => {
    expect(createCategory([music], 'música', makeId)).toEqual([music]);
  });

  it("doesn't mutate the original array", () => {
    const categories = [tech];
    createCategory(categories, 'Nova', makeId);
    expect(categories).toEqual([tech]);
  });
});

describe('renameCategory', () => {
  it('renames the target category', () => {
    expect(renameCategory([music, tech], 't', 'Tecnologia')[1].name).toBe('Tecnologia');
  });

  it('ignores an empty name, null (prompt cancelled) or one already used by another category', () => {
    const categories = [music, tech];
    expect(renameCategory(categories, 't', '')).toBe(categories);
    expect(renameCategory(categories, 't', null)).toBe(categories);
    expect(renameCategory(categories, 't', 'MÚSICA')).toBe(categories);
  });

  it("allows changing only the capitalization of the category's own name", () => {
    expect(renameCategory([tech], 't', 'TECH')[0].name).toBe('TECH');
  });
});

describe('removeCategory', () => {
  it('removes by id and ignores an unknown id', () => {
    expect(removeCategory([music, tech], 'm')).toEqual([tech]);
    expect(removeCategory([music], 'x')).toEqual([music]);
  });
});

describe('assignChannel', () => {
  it('moves the channel to the new category, taking it out of the previous one', () => {
    const result = assignChannel([music, tech], '/@a', 't');
    expect(result[0].channelIds).toEqual([]);
    expect(result[1].channelIds).toEqual(['/@a']);
  });

  it('with a null category leaves the channel uncategorized', () => {
    const result = assignChannel([music, tech], '/@a', null);
    expect(result.every((c) => c.channelIds.length === 0)).toBe(true);
  });

  it("doesn't duplicate when assigning to the same category", () => {
    expect(assignChannel([music], '/@a', 'm')[0].channelIds).toEqual(['/@a']);
  });

  it("doesn't mutate the original categories", () => {
    assignChannel([music, tech], '/@a', 't');
    expect(music.channelIds).toEqual(['/@a']);
  });
});

describe('assignChannels', () => {
  it('moves several channels at once, taking them out of their previous categories', () => {
    const result = assignChannels([music, tech], ['/@a', '/@b'], 't');
    expect(result[0].channelIds).toEqual([]);
    expect(result[1].channelIds).toEqual(['/@a', '/@b']);
  });

  it('with an empty list returns the categories unchanged', () => {
    const categories = [music];
    expect(assignChannels(categories, [], 't')).toBe(categories);
  });
});

describe('findCategoryOf', () => {
  it("finds the channel's category or returns null", () => {
    expect(findCategoryOf([music, tech], '/@a')).toBe(music);
    expect(findCategoryOf([music, tech], '/@z')).toBeNull();
  });
});

describe('groupChannels', () => {
  const channels = {
    '/@a': { id: '/@a', name: 'Banda' },
    '/@b': { id: '/@b', name: 'Zeta' },
    '/@c': { id: '/@c', name: 'Alfa' },
  };

  it('groups by category and keeps the uncategorized ones apart, in alphabetical order', () => {
    const { groups, uncategorized } = groupChannels([music, tech], channels);
    expect(groups[0].channels.map((c) => c.id)).toEqual(['/@a']);
    expect(groups[1].channels).toEqual([]);
    expect(uncategorized.map((c) => c.name)).toEqual(['Alfa', 'Zeta']);
  });

  it('ignores ids of channels that no longer exist', () => {
    const ghost = { id: 'g', name: 'G', channelIds: ['/@sumiu'] };
    expect(groupChannels([ghost], channels).groups[0].channels).toEqual([]);
  });
});

describe('sortCategoriesByName', () => {
  it('sorts ignoring accents and case, without mutating the input', () => {
    const input = [{ name: 'viagem' }, { name: 'Ábaco' }, { name: 'Música' }, { name: 'livros' }];
    expect(sortCategoriesByName(input).map((c) => c.name)).toEqual(['Ábaco', 'livros', 'Música', 'viagem']);
    expect(input[0].name).toBe('viagem');
  });
});

describe('category name length', () => {
  it('createCategory and renameCategory cut names longer than 60 characters', () => {
    expect(createCategory([], 'y'.repeat(100), makeId)[0].name).toBe('y'.repeat(60));
    expect(renameCategory([tech], 't', 'z'.repeat(100))[0].name).toBe('z'.repeat(60));
  });
});
