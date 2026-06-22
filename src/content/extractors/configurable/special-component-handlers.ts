import type { SpecialComponentHandler } from '../../adapters/index.js';

const registeredHandlers = new Map<string, SpecialComponentHandler>();

export function registerSpecialComponentHandler(handler: SpecialComponentHandler): void {
  const handlerId = handler.handlerId.trim();
  if (!handlerId) {
    return;
  }

  registeredHandlers.set(handlerId, {
    ...handler,
    handlerId
  });
}

export function getSpecialComponentHandler(handlerId: string): SpecialComponentHandler | null {
  const handler = registeredHandlers.get(handlerId);
  if (!handler) {
    return null;
  }

  return handler;
}

export function clearSpecialComponentHandlersForTest(): void {
  registeredHandlers.clear();
}
