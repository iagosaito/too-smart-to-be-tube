import { describe, expect, it } from 'vitest';
import {
  assignChannel,
  assignChannels,
  createCategory,
  findCategoryOf,
  groupChannels,
  removeCategory,
  renameCategory,
} from '../../src/core/categories.js';

const makeId = () => 'id-1';
const music = { id: 'm', name: 'Música', channelIds: ['/@a'] };
const tech = { id: 't', name: 'Tech', channelIds: [] };

describe('createCategory', () => {
  it('adiciona uma categoria vazia com o nome limpo', () => {
    expect(createCategory([], '  Games ', makeId)).toEqual([{ id: 'id-1', name: 'Games', channelIds: [] }]);
  });

  it('ignora nome vazio', () => {
    const categories = [tech];
    expect(createCategory(categories, '   ', makeId)).toBe(categories);
  });

  it('ignora nome duplicado sem diferenciar maiúsculas', () => {
    expect(createCategory([music], 'música', makeId)).toEqual([music]);
  });

  it('não muta o array original', () => {
    const categories = [tech];
    createCategory(categories, 'Nova', makeId);
    expect(categories).toEqual([tech]);
  });
});

describe('renameCategory', () => {
  it('renomeia a categoria alvo', () => {
    expect(renameCategory([music, tech], 't', 'Tecnologia')[1].name).toBe('Tecnologia');
  });

  it('ignora nome vazio, null (prompt cancelado) ou já usado por outra', () => {
    const categories = [music, tech];
    expect(renameCategory(categories, 't', '')).toBe(categories);
    expect(renameCategory(categories, 't', null)).toBe(categories);
    expect(renameCategory(categories, 't', 'MÚSICA')).toBe(categories);
  });

  it('permite mudar só a capitalização da própria categoria', () => {
    expect(renameCategory([tech], 't', 'TECH')[0].name).toBe('TECH');
  });
});

describe('removeCategory', () => {
  it('remove pelo id e ignora id inexistente', () => {
    expect(removeCategory([music, tech], 'm')).toEqual([tech]);
    expect(removeCategory([music], 'x')).toEqual([music]);
  });
});

describe('assignChannel', () => {
  it('move o canal para a nova categoria, tirando da anterior', () => {
    const result = assignChannel([music, tech], '/@a', 't');
    expect(result[0].channelIds).toEqual([]);
    expect(result[1].channelIds).toEqual(['/@a']);
  });

  it('com categoria null deixa o canal sem categoria', () => {
    const result = assignChannel([music, tech], '/@a', null);
    expect(result.every((c) => c.channelIds.length === 0)).toBe(true);
  });

  it('não duplica ao atribuir à mesma categoria', () => {
    expect(assignChannel([music], '/@a', 'm')[0].channelIds).toEqual(['/@a']);
  });

  it('não muta as categorias originais', () => {
    assignChannel([music, tech], '/@a', 't');
    expect(music.channelIds).toEqual(['/@a']);
  });
});

describe('assignChannels', () => {
  it('move vários canais de uma vez, tirando-os das categorias anteriores', () => {
    const result = assignChannels([music, tech], ['/@a', '/@b'], 't');
    expect(result[0].channelIds).toEqual([]);
    expect(result[1].channelIds).toEqual(['/@a', '/@b']);
  });

  it('com lista vazia devolve as categorias sem mudança', () => {
    const categories = [music];
    expect(assignChannels(categories, [], 't')).toBe(categories);
  });
});

describe('findCategoryOf', () => {
  it('encontra a categoria do canal ou retorna null', () => {
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

  it('agrupa por categoria e separa os sem categoria em ordem alfabética', () => {
    const { groups, uncategorized } = groupChannels([music, tech], channels);
    expect(groups[0].channels.map((c) => c.id)).toEqual(['/@a']);
    expect(groups[1].channels).toEqual([]);
    expect(uncategorized.map((c) => c.name)).toEqual(['Alfa', 'Zeta']);
  });

  it('ignora ids de canais que não existem mais', () => {
    const ghost = { id: 'g', name: 'G', channelIds: ['/@sumiu'] };
    expect(groupChannels([ghost], channels).groups[0].channels).toEqual([]);
  });
});
