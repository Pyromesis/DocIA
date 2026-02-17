/**
 * Seed data — only sets default preferences on first run.
 * No fake documents are created.
 */
import { db } from "./schema";

export async function seedDatabase(): Promise<void> {
  const prefCount = await db.preferences.count();
  if (prefCount > 0) return; // already initialized

  // Set default preferences only
  await db.preferences.bulkAdd([
    { key: "theme", value: "light" },
    { key: "language", value: "en" },
    { key: "autoProcess", value: true },
    { key: "encryptExports", value: false },
    {
      key: "ai_settings",
      value: {
        mode: 'cloud',
        provider: 'openai',
        apiKeys: {
          openai: '',
          anthropic: '',
          gemini: '',
          groq: '',
          openrouter: '',
          mistral: '',
          together: '',
          perplexity: '',
          cohere: '',
          deepseek: ''
        },
        customModels: {},
        local: {
          endpoint: 'http://localhost:11434',
          model: 'llama3'
        }
      }
    }
  ]);
}
