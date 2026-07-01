import { registerSubstackAssets3ComponentHandlers } from '../substack/assets3-component-handler.js';
import { registerSubstackTwitterEmbedHandler } from '../substack/twitter-embed-handler.js';
import { registerXSimpleTweetHandler } from '../x/simple-tweet-handler.js';

export function registerBuiltInSpecialHandlers(): void {
  registerXSimpleTweetHandler();
  registerSubstackAssets3ComponentHandlers();
  registerSubstackTwitterEmbedHandler();
}

registerBuiltInSpecialHandlers();
