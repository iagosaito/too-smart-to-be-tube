import { describe, expect, it } from 'vitest';
import { createStore } from '../../src/storage/store.js';
import { createFakeStorageArea } from '../helpers/fakeStorage.js';

describe('createStore', () => {
  it('retorna estado padrão quando o storage está vazio', async () => {
    const store = createStore(createFakeStorageArea());
    expect(await store.load()).toEqual({ channels: {}, categories: [], lastSyncedAt: null, latestUploads: {}, uploadsSyncedAt: null, preferences: {} });
  });

  it('salva e recarrega categorias', async () => {
    const store = createStore(createFakeStorageArea());
    const categories = [{ id: '1', name: 'Tech', channelIds: [] }];
    await store.saveCategories(categories);
    expect((await store.load()).categories).toEqual(categories);
  });

  it('mescla canais novos com os já salvos', async () => {
    const area = createFakeStorageArea({ channels: { '/@a': { id: '/@a', name: 'A', url: 'a', avatar: 'a.jpg' } } });
    const store = createStore(area);
    await store.mergeChannels([{ id: '/@b', name: 'B', url: 'b', avatar: '' }]);
    expect(Object.keys(area.dump().channels)).toEqual(['/@a', '/@b']);
  });

  it('não apaga categorias ao mesclar canais', async () => {
    const categories = [{ id: '1', name: 'Tech', channelIds: ['/@a'] }];
    const store = createStore(createFakeStorageArea({ categories }));
    await store.mergeChannels([{ id: '/@a', name: 'A', url: 'a', avatar: '' }]);
    expect((await store.load()).categories).toEqual(categories);
  });

  it('replaceChannels substitui a lista inteira e registra a data', async () => {
    const area = createFakeStorageArea({ channels: { '/@velho': { id: '/@velho', name: 'Velho', url: 'v', avatar: '' } } });
    const store = createStore(area);
    await store.replaceChannels([{ id: '/@novo', name: 'Novo', url: 'n', avatar: '' }], 123);
    const state = await store.load();
    expect(Object.keys(state.channels)).toEqual(['/@novo']);
    expect(state.lastSyncedAt).toBe(123);
  });

  it('saveUploads mantém a data mais nova por canal e registra quando sincronizou', async () => {
    const store = createStore(createFakeStorageArea({ latestUploads: { '/@a': 50, '/@b': 10 } }));
    await store.saveUploads({ '/@a': 20, '/@b': 40, '/@c': 30 }, 999);
    const state = await store.load();
    expect(state.latestUploads).toEqual({ '/@a': 50, '/@b': 40, '/@c': 30 });
    expect(state.uploadsSyncedAt).toBe(999);
  });

  it('savePreferences mescla com as preferências existentes', async () => {
    const store = createStore(createFakeStorageArea({ preferences: { outra: true } }));
    await store.savePreferences({ sortBy: 'recent' });
    expect((await store.load()).preferences).toEqual({ outra: true, sortBy: 'recent' });
  });
});
