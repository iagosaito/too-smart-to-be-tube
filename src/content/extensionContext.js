// Quando a extensão é recarregada ou atualizada, o script que já estava rodando
// na aba fica "órfão": o DOM continua acessível, mas qualquer chamada a
// chrome.* lança "Extension context invalidated". Detectar isso evita erros
// no console e permite orientar o usuário a recarregar a página.

export function isExtensionAlive(chromeApi = globalThis.chrome) {
  try {
    // runtime.id some (ou o acesso lança) assim que o contexto é invalidado.
    return Boolean(chromeApi?.runtime?.id);
  } catch {
    return false;
  }
}

export function isContextInvalidated(error) {
  return /extension context invalidated/i.test(String(error?.message ?? error));
}

// Executa a tarefa só se a extensão ainda estiver viva; se o contexto se
// perder no meio do caminho, chama onOrphaned em vez de deixar o erro escapar.
export async function runIfAlive(task, onOrphaned, chromeApi = globalThis.chrome) {
  if (!isExtensionAlive(chromeApi)) return onOrphaned();
  try {
    return await task();
  } catch (error) {
    if (isContextInvalidated(error) || !isExtensionAlive(chromeApi)) return onOrphaned();
    throw error;
  }
}
