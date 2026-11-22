// Cada sincronização completa faz dezenas de requisições autenticadas ao
// YouTube. O coordenador fica no escopo do content script (um por aba) e
// garante duas coisas:
// - uma sincronização por vez: quem pedir enquanto uma está rodando recebe a
//   mesma promise, em vez de abrir outra em paralelo;
// - um intervalo mínimo depois de uma sincronização bem-sucedida, para cliques
//   repetidos não virarem rajadas de requisições (risco de rate-limit).
// Falhas não iniciam o intervalo: tentar de novo na hora é o esperado.
export const SYNC_COOLDOWN_MS = 60_000;

export function createSyncCoordinator(run, { now = Date.now, cooldownMs = SYNC_COOLDOWN_MS } = {}) {
  let inflight = null;
  let lastSuccessAt = null;
  const availableAt = () => (lastSuccessAt == null ? 0 : lastSuccessAt + cooldownMs);

  function sync() {
    if (inflight) return inflight;
    if (now() < availableAt()) return Promise.resolve(null);
    inflight = run()
      .then((result) => {
        lastSuccessAt = now();
        return result;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  }

  return { sync, isRunning: () => inflight !== null, availableAt };
}
