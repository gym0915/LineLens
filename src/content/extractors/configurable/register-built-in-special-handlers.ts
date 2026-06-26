import { registerSubstackTwitterEmbedHandler } from '../substack/twitter-embed-handler.js';
import { registerXSimpleTweetHandler } from '../x/simple-tweet-handler.js';

export function registerBuiltInSpecialHandlers(): void {
  registerXSimpleTweetHandler();
  registerSubstackTwitterEmbedHandler();
}

registerBuiltInSpecialHandlers();
