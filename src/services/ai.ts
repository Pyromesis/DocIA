/**
 * Centralized AI Service — Supports 10+ cloud providers + local models.
 *
 * Providers:
 *   OpenAI, Anthropic, Google Gemini, Groq, OpenRouter,
 *   Mistral, Together AI, Perplexity, Cohere, DeepSeek
 *
 * Local:
 *   Ollama, LM Studio, or any OpenAI-compatible endpoint
 */

import { db } from "../db/schema";
import { buildMemoryPrompt } from './aiMemory';

/* ─── Types ─── */

export type CloudProvider =
    | "openai"
    | "anthropic"
    | "gemini"
    | "groq"
    | "openrouter"
    | "mistral"
    | "together"
    | "perplexity"
    | "cohere"
    | "deepseek";

export interface ModelSelection {
    chatModel?: string;
    visionModel?: string;
}

export interface AISettings {
    mode: "cloud" | "local";
    provider: CloudProvider;
    apiKeys: Partial<Record<CloudProvider, string[]>>;
    customModels?: Partial<Record<CloudProvider, ModelSelection>>;
    local: {
        endpoint: string;
        model: string;
    };
}

export const DEFAULT_SETTINGS: AISettings = {
    mode: "cloud",
    provider: "openai",
    apiKeys: {},
    customModels: {},
    local: { endpoint: "http://localhost:11434", model: "llama3" },
};

export interface ProviderMeta {
    id: CloudProvider;
    name: string;
    description: string;
    keyUrl: string;
    keyHint: string;
    chatModel: string;
    visionModel?: string;
    supportsVision: boolean;
    color: string;
}

export interface ModelOption {
    id: string;
    name: string;
    free?: boolean;
    vision?: boolean;
    recommended?: boolean;
}

/** Curated list of popular models per provider. Users can also type a custom model name. */
export const PROVIDER_MODELS: Record<CloudProvider, ModelOption[]> = {
    openai: [
        { id: "gpt-4o", name: "GPT-4o", vision: true, recommended: true },
        { id: "gpt-4o-mini", name: "GPT-4o Mini", vision: true, recommended: true },
        { id: "gpt-4-turbo", name: "GPT-4 Turbo", vision: true },
        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
        { id: "o1-mini", name: "o1-mini (Reasoning)" },
        { id: "o3-mini", name: "o3-mini (Reasoning)" },
    ],
    anthropic: [
        { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", vision: true, recommended: true },
        { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", vision: true, recommended: true },
        { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", vision: true },
        { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", vision: true },
        { id: "claude-3-opus-20240229", name: "Claude 3 Opus", vision: true },
    ],
    gemini: [
        { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", vision: true, recommended: true },
        { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", vision: true },
        { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", vision: true },
        { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", vision: true },
    ],
    groq: [
        { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Fast)", free: true, recommended: true },
        { id: "llama-3.2-11b-vision-preview", name: "Llama 3.2 11B Vision (Free)", free: true, vision: true, recommended: true },
        { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill (Reasoning)", free: true },
        { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
    ],
    openrouter: [
        // ── Free models (verified working on OpenRouter feb 2026) ──
        { id: "mistralai/mistral-small-3.1-24b-instruct:free", name: "🆓 Mistral Small 3.1 24B", free: true, vision: true, recommended: true },
        { id: "google/gemma-3-27b-it:free", name: "🆓 Gemma 3 27B", free: true, vision: true, recommended: true },
        { id: "google/gemma-3-12b-it:free", name: "🆓 Gemma 3 12B", free: true, vision: true },
        { id: "google/gemma-3-4b-it:free", name: "🆓 Gemma 3 4B", free: true, vision: true },
        { id: "meta-llama/llama-3.3-70b-instruct:free", name: "🆓 Llama 3.3 70B", free: true, recommended: true },
        { id: "meta-llama/llama-3.2-3b-instruct:free", name: "🆓 Llama 3.2 3B", free: true },
        { id: "nousresearch/hermes-3-llama-3.1-405b:free", name: "🆓 Hermes 3 405B", free: true },
        // ── Paid models ──
        { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", vision: true, recommended: true },
        { id: "openai/gpt-4o", name: "GPT-4o", vision: true },
        { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", vision: true },
        { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", vision: true },
        { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", vision: true },
        { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B" },
        { id: "mistralai/mistral-large-2411", name: "Mistral Large" },
        { id: "deepseek/deepseek-r1", name: "DeepSeek R1" },
    ],
    mistral: [
        { id: "mistral-large-latest", name: "Mistral Large", recommended: true },
        { id: "mistral-small-latest", name: "Mistral Small" },
        { id: "pixtral-large-latest", name: "Pixtral Large", vision: true },
        { id: "codestral-latest", name: "Codestral (Code)" },
        { id: "open-mistral-nemo", name: "Mistral Nemo" },
    ],
    together: [
        { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", name: "Llama 3.3 70B Turbo", recommended: true },
        { id: "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo", name: "Llama 3.1 405B" },
        { id: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", name: "Llama 3.1 8B" },
        { id: "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo", name: "Llama 3.2 90B Vision", vision: true },
        { id: "Qwen/Qwen2.5-72B-Instruct-Turbo", name: "Qwen 2.5 72B" },
        { id: "deepseek-ai/DeepSeek-R1", name: "DeepSeek R1" },
        { id: "deepseek-ai/DeepSeek-V3", name: "DeepSeek V3" },
    ],
    perplexity: [
        { id: "sonar", name: "Sonar" },
        { id: "sonar-pro", name: "Sonar Pro", recommended: true },
        { id: "sonar-reasoning", name: "Sonar Reasoning" },
        { id: "sonar-reasoning-pro", name: "Sonar Reasoning Pro" },
    ],
    cohere: [
        { id: "command-r-plus", name: "Command R+", recommended: true },
        { id: "command-r", name: "Command R" },
        { id: "command-light", name: "Command Light" },
    ],
    deepseek: [
        { id: "deepseek-chat", name: "DeepSeek V3", vision: true, recommended: true },
        { id: "deepseek-reasoner", name: "DeepSeek R1 (Reasoning)" },
    ],
};

export const PROVIDERS: ProviderMeta[] = [
    {
        id: "openai",
        name: "OpenAI",
        description: "GPT-4o, GPT-4o-mini — industry leader",
        keyUrl: "https://platform.openai.com/api-keys",
        keyHint: "sk-...",
        chatModel: "gpt-4o-mini",
        visionModel: "gpt-4o",
        supportsVision: true,
        color: "#10a37f",
    },
    {
        id: "anthropic",
        name: "Anthropic",
        description: "Claude 3.5 Sonnet, Haiku — excellent reasoning",
        keyUrl: "https://console.anthropic.com/settings/keys",
        keyHint: "sk-ant-...",
        chatModel: "claude-3-haiku-20240307",
        visionModel: "claude-3-5-sonnet-20241022",
        supportsVision: true,
        color: "#d4a27f",
    },
    {
        id: "gemini",
        name: "Google Gemini",
        description: "Gemini 2.0 Flash — fast and capable",
        keyUrl: "https://aistudio.google.com/app/apikey",
        keyHint: "AIza...",
        chatModel: "gemini-2.0-flash",
        visionModel: "gemini-2.0-flash",
        supportsVision: true,
        color: "#4285f4",
    },
    {
        id: "groq",
        name: "Groq",
        description: "Llama 3.2 11B Vision & DeepSeek R1 — Fastest Inference",
        keyUrl: "https://console.groq.com/keys",
        keyHint: "gsk_...",
        chatModel: "llama-3.3-70b-versatile",
        visionModel: "llama-3.2-11b-vision-preview",
        supportsVision: true,
        color: "#f55036",
    },
    {
        id: "openrouter",
        name: "OpenRouter",
        description: "Hundreds of models — GPT-4, Claude, Llama, Mistral & more",
        keyUrl: "https://openrouter.ai/keys",
        keyHint: "sk-or-...",
        chatModel: "openai/gpt-4o-mini",
        visionModel: "openai/gpt-4o",
        supportsVision: true,
        color: "#6366f1",
    },
    {
        id: "mistral",
        name: "Mistral AI",
        description: "Mistral Large, Small — European AI leader",
        keyUrl: "https://console.mistral.ai/api-keys",
        keyHint: "...",
        chatModel: "mistral-small-latest",
        visionModel: "pixtral-large-latest",
        supportsVision: true,
        color: "#ff7000",
    },
    {
        id: "together",
        name: "Together AI",
        description: "Open-source models — Llama, Qwen, DeepSeek",
        keyUrl: "https://api.together.ai/settings/api-keys",
        keyHint: "...",
        chatModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        visionModel: "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo",
        supportsVision: true,
        color: "#0ea5e9",
    },
    {
        id: "perplexity",
        name: "Perplexity",
        description: "Search-augmented AI — live web access",
        keyUrl: "https://www.perplexity.ai/settings/api",
        keyHint: "pplx-...",
        chatModel: "sonar",
        supportsVision: false,
        color: "#20b2aa",
    },
    {
        id: "cohere",
        name: "Cohere",
        description: "Command R+ — multilingual, RAG-focused",
        keyUrl: "https://dashboard.cohere.com/api-keys",
        keyHint: "...",
        chatModel: "command-r-plus",
        supportsVision: false,
        color: "#39594d",
    },
    {
        id: "deepseek",
        name: "DeepSeek",
        description: "DeepSeek-V3, R1 — Chinese AI powerhouse",
        keyUrl: "https://platform.deepseek.com/api_keys",
        keyHint: "sk-...",
        chatModel: "deepseek-chat",
        visionModel: "deepseek-chat",
        supportsVision: true,
        color: "#4d6bfe",
    },
];

export function getProviderMeta(id: CloudProvider): ProviderMeta {
    return PROVIDERS.find((p) => p.id === id) || PROVIDERS[0];
}

/**
 * Resolves which model to actually use for a given purpose.
 * Priority: user custom pick → provider default.
 */
export function getActiveModel(
    settings: AISettings,
    purpose: "chat" | "vision"
): string {
    const custom = settings.customModels?.[settings.provider];
    if (purpose === "chat" && custom?.chatModel) return custom.chatModel;
    if (purpose === "vision" && custom?.visionModel) return custom.visionModel;
    const meta = getProviderMeta(settings.provider);
    return purpose === "vision"
        ? meta.visionModel || meta.chatModel
        : meta.chatModel;
}

/* ─── Load settings from IndexedDB ─── */

export async function loadAISettings(): Promise<AISettings> {
    const prefs = await db.preferences.toArray();
    const aiPref = prefs.find((p) => p.key === "ai_settings");
    if (aiPref && typeof aiPref.value === "object") {
        const settings = aiPref.value as unknown as AISettings;
        let needsSave = false;

        // Auto-migrate: convert old string apiKeys to string[] arrays
        if (settings.apiKeys) {
            for (const provider of Object.keys(settings.apiKeys) as CloudProvider[]) {
                const val = settings.apiKeys[provider] as any;
                if (typeof val === 'string') {
                    // Old format: comma-separated string → array
                    settings.apiKeys[provider] = val.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
                    needsSave = true;
                }
            }
        }

        // Auto-migrate deprecated/broken model IDs
        const migrated = migrateModelIds(settings);
        if (migrated || needsSave) {
            await db.preferences.put({ key: "ai_settings", value: settings as any });
        }
        return settings;
    }
    return DEFAULT_SETTINGS;
}

/**
 * Fixes deprecated OpenRouter model IDs saved in user settings.
 * Returns true if any migration was applied (so caller can save).
 */
function migrateModelIds(settings: AISettings): boolean {
    const DEPRECATED_MODELS: Record<string, string> = {
        // Models that have been retired or renamed on OpenRouter
        "google/gemini-2.0-flash-exp:free": "mistralai/mistral-small-3.1-24b-instruct:free",
        "google/gemini-2.0-flash-thinking-exp:free": "google/gemma-3-27b-it:free",
        "deepseek/deepseek-r1:free": "meta-llama/llama-3.3-70b-instruct:free",
        "deepseek/deepseek-chat-v3-0324:free": "meta-llama/llama-3.3-70b-instruct:free",
        "qwen/qwen-2.5-72b-instruct:free": "meta-llama/llama-3.3-70b-instruct:free",
        "meta-llama/llama-3.1-8b-instruct:free": "meta-llama/llama-3.2-3b-instruct:free",
        // Groq decommissioned vision models
        "llama-3.2-11b-vision-preview": "meta-llama/llama-4-scout-17b-16e-instruct",
        "llama-3.2-90b-vision-preview": "meta-llama/llama-4-scout-17b-16e-instruct",
    };

    let changed = false;

    if (settings.provider === "openrouter" && settings.customModels?.openrouter) {
        const models = settings.customModels.openrouter;
        for (const field of ["chatModel", "visionModel"] as const) {
            const current = models[field];
            if (current && DEPRECATED_MODELS[current]) {
                models[field] = DEPRECATED_MODELS[current];
                changed = true;
            }
        }
    }

    return changed;
}

/* ─── Chat Completion Calls ─── */

type ChatMessage = { role: string; content: string };

const OPENAI_COMPAT_CALL = async (
    url: string,
    model: string,
    messages: ChatMessage[],
    apiKey: string,
    extraHeaders: Record<string, string> = {},
    maxTokens: number = 1024
): Promise<string> => {
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            ...extraHeaders,
        },
        body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature: 0.7,
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `API error: ${res.status}`);
    }
    const data = await res.json();
    return data.choices[0].message.content;
};

/**
 * Helper to handle key rotation.
 * Accepts an array of keys (new format) or a comma-separated string (legacy compat).
 * Tries them sequentially if the previous one fails, and notifies the user on failover.
 */
export async function withKeyRotation<T>(
    keyData: string[] | string | undefined,
    provider: string,
    action: (key: string) => Promise<T>
): Promise<T> {
    // Support both new array format and legacy comma-separated string
    let keys: string[];
    if (Array.isArray(keyData)) {
        keys = keyData.filter(k => k.trim().length > 0);
    } else {
        keys = (keyData || "").split(',').map(k => k.trim()).filter(k => k.length > 0);
    }

    if (keys.length === 0) {
        throw new Error(`No API key configured for ${provider.toUpperCase()}. Go to Settings → AI Connectivity.`);
    }

    let lastError: any;
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        try {
            return await action(key);
        } catch (err: any) {
            const message = err.message || "";
            console.warn(`[AI] Key ${i + 1}/${keys.length} failed for ${provider}: ${message}`);
            lastError = err;

            // If there are more keys, notify the user about failover
            if (i < keys.length - 1) {
                notifyKeyFailover(provider, i + 1, i + 2, keys.length, message);
            }

            // If it's the last key, stop
            if (i === keys.length - 1) break;
        }
    }
    throw lastError || new Error(`All API keys failed for ${provider}.`);
}

/** Send a browser notification when an API key fails over to the next one */
function notifyKeyFailover(provider: string, failedIdx: number, nextIdx: number, total: number, reason: string) {
    const title = `API Key Failover — ${provider}`;
    const body = `Key #${failedIdx} failed (${reason.slice(0, 60)}). Switching to key #${nextIdx}/${total}.`;

    // Try browser Notification API
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => {
            if (p === 'granted') new Notification(title, { body, icon: '/favicon.ico' });
        });
    }

    // Also log visually in console
    console.info(`%c⚠️ ${title}: ${body}`, 'color: #B8925C; font-weight: bold;');
}

export async function callChat(
    messages: ChatMessage[],
    settings: AISettings,
    options?: { maxTokens?: number }
): Promise<string> {
    const maxTokens = options?.maxTokens || 1024;
    if (settings.mode === "local") {
        return callLocalChat(messages, settings.local);
    }

    const keyString = settings.apiKeys[settings.provider];

    return withKeyRotation(keyString, settings.provider, async (key) => {
        const chatModel = getActiveModel(settings, "chat");

        switch (settings.provider) {
            case "openai":
                return OPENAI_COMPAT_CALL(
                    "https://api.openai.com/v1/chat/completions",
                    chatModel,
                    messages,
                    key,
                    {},
                    maxTokens
                );

            case "anthropic": {
                const userMessages = messages.filter((m) => m.role !== "system");
                const systemMsg =
                    messages.find((m) => m.role === "system")?.content || "";
                const res = await fetch("https://api.anthropic.com/v1/messages", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": key,
                        "anthropic-version": "2023-06-01",
                        "anthropic-dangerous-direct-browser-access": "true",
                    },
                    body: JSON.stringify({
                        model: chatModel,
                        max_tokens: maxTokens,
                        system: systemMsg,
                        messages: userMessages,
                    }),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(
                        err.error?.message || `Anthropic error: ${res.status}`
                    );
                }
                const data = await res.json();
                return data.content[0].text;
            }

            case "gemini": {
                const contents = messages
                    .filter((m) => m.role !== "system")
                    .map((m) => ({
                        role: m.role === "assistant" ? "model" : "user",
                        parts: [{ text: m.content }],
                    }));
                const systemInstruction = messages.find(
                    (m) => m.role === "system"
                )?.content;
                const body: any = { contents };
                if (systemInstruction) {
                    body.systemInstruction = { parts: [{ text: systemInstruction }] };
                }
                const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${chatModel}:generateContent?key=${key}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body),
                    }
                );
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error?.message || `Gemini error: ${res.status}`);
                }
                const data = await res.json();
                return data.candidates[0].content.parts[0].text;
            }

            case "groq":
                return OPENAI_COMPAT_CALL(
                    "https://api.groq.com/openai/v1/chat/completions",
                    chatModel,
                    messages,
                    key,
                    {},
                    maxTokens
                );

            case "openrouter":
                return OPENAI_COMPAT_CALL(
                    "https://openrouter.ai/api/v1/chat/completions",
                    chatModel,
                    messages,
                    key,
                    {
                        "HTTP-Referer": window.location.origin,
                        "X-Title": "DocIA",
                    },
                    maxTokens
                );

            case "mistral":
                return OPENAI_COMPAT_CALL(
                    "https://api.mistral.ai/v1/chat/completions",
                    chatModel,
                    messages,
                    key,
                    {},
                    maxTokens
                );

            case "together":
                return OPENAI_COMPAT_CALL(
                    "https://api.together.xyz/v1/chat/completions",
                    chatModel,
                    messages,
                    key,
                    {},
                    maxTokens
                );

            case "perplexity":
                return OPENAI_COMPAT_CALL(
                    "https://api.perplexity.ai/chat/completions",
                    chatModel,
                    messages,
                    key,
                    {},
                    maxTokens
                );

            case "cohere": {
                const chat_history = messages
                    .filter((m) => m.role !== "system")
                    .slice(0, -1)
                    .map((m) => ({
                        role: m.role === "assistant" ? ("CHATBOT" as const) : ("USER" as const),
                        message: m.content,
                    }));
                const lastMsg = messages.filter((m) => m.role !== "system").slice(-1)[0];
                const preamble =
                    messages.find((m) => m.role === "system")?.content || "";
                const res = await fetch("https://api.cohere.com/v1/chat", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${key}`,
                    },
                    body: JSON.stringify({
                        model: chatModel,
                        message: lastMsg?.content || "",
                        preamble,
                        chat_history,
                    }),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.message || `Cohere error: ${res.status}`);
                }
                const data = await res.json();
                return data.text;
            }

            case "deepseek":
                return OPENAI_COMPAT_CALL(
                    "https://api.deepseek.com/chat/completions",
                    chatModel,
                    messages,
                    key,
                    {},
                    maxTokens
                );

            default:
                throw new Error(`Unknown provider: ${settings.provider}`);
        }
    });
}

/* ─── Local Chat (Ollama / LM Studio) ─── */

async function callLocalChat(
    messages: ChatMessage[],
    local: AISettings["local"]
): Promise<string> {
    const endpoint = local.endpoint.replace(/\/$/, "");
    // Try Ollama format first, then fall back to OpenAI-compatible
    try {
        const res = await fetch(`${endpoint}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: local.model,
                messages,
                stream: false,
            }),
        });
        if (res.ok) {
            const data = await res.json();
            return (
                data.message?.content ||
                data.choices?.[0]?.message?.content ||
                "No response from local model."
            );
        }
    } catch {
        // Ollama endpoint didn't work; try OpenAI-compatible
    }

    // OpenAI-compatible fallback (LM Studio, vLLM, etc.)
    const res = await fetch(`${endpoint}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: local.model,
            messages,
            max_tokens: 1024,
            temperature: 0.7,
        }),
    });
    if (!res.ok) {
        throw new Error(
            `Local AI error: ${res.status}. Is your server running at ${endpoint}?`
        );
    }
    const data = await res.json();
    return (
        data.choices?.[0]?.message?.content || "No response from local model."
    );
}

/* ─── Vision / Document Scanning ─── */

export interface ScanResult {
    fields: { label: string; value: string; confidence: number }[];
    rawText: string;
    summary: string;
    htmlStructure?: string;
    images?: { label: string; x: number; y: number; w: number; h: number }[];
}

const EXTRACTION_PROMPT = `You are a PROFESSIONAL document OCR and data extraction AI with expertise in reading printed AND handwritten text in Spanish, English, and other languages.

## YOUR TASK
Carefully analyze the document image. Read EVERY piece of text — printed, typed, stamped, or handwritten — with maximum precision. Then extract structured data.

## CRITICAL OCR RULES
1. **Handwritten text**: Pay EXTRA attention to handwritten annotations, signatures, and fill-in-the-blank fields. Sound out each character carefully. If unsure, provide your best reading with lower confidence.
2. **Dates**: Look for dates in formats like DD/MM/YYYY, DD-MMM-YYYY, "9-feb.-2026", etc. Read the EXACT date as written.
3. **Currency/Amounts**: Read numbers precisely including decimals, thousands separators (. or ,), and currency symbols ($, €, COP, USD).
4. **Reference Numbers**: Read order numbers, invoice numbers, NIT, cédulas, COT numbers, etc. character by character.
5. **Names**: Read full names (Nombre y Apellido) exactly as written, preserving accents (á, é, í, ó, ú, ñ).
6. **Addresses**: Capture complete addresses including city, street numbers, neighborhood.
7. **Tables**: If the document has tables, read each cell. Extract column headers and row values.
8. **Stamps/Seals**: Read any text inside stamps or seals.

## RESPONSE FORMAT
Return a JSON object with this EXACT structure:
{
  "fields": [
    {"label": "descriptive_field_name", "value": "extracted value exactly as written", "confidence": 0.95}
  ],
  "rawText": "Complete text of the document preserving ALL line breaks, spacing and structure",
  "summary": "Brief 1-2 sentence summary in the SAME LANGUAGE as the document",
  "images": [
    {"label": "company_logo", "x": 5.5, "y": 2.1, "w": 10.0, "h": 5.0}
  ]
}

## FIELD EXTRACTION PRIORITIES
- Extract ALL visible data: dates, names, amounts, addresses, IDs, titles, phone numbers, emails, references, descriptions, quantities, unit prices, totals, comments, observations.
- Use descriptive snake_case labels (e.g. "fecha_emision", "numero_orden", "nombre_cliente", "total_a_pagar").
- For "images": Return bounding box percentages (0-100) for logos, signatures, stamps, photos. x=0,y=0 is top-left.
- For "rawText": Include EVERY character visible in the document. Preserve exact layout.
- NEVER leave a field empty if you can read ANY text in that area. Use confidence < 0.5 for uncertain readings.`;

export async function scanDocument(
    base64: string,
    mimeType: string,
    settings: AISettings,
    targetVariables: string[] = [],
    learningCues: { variable: string; x: number; y: number; w: number; h: number }[] = [],
    options: { strictMode?: boolean } = {}
): Promise<ScanResult> {
    const provider = settings.provider;
    const keyString = settings.apiKeys[provider];

    // Check vision support first
    const meta = getProviderMeta(provider);
    const visionModel = getActiveModel(settings, "vision");
    if (!meta.supportsVision) {
        throw new Error(
            `${meta.name} does not support document vision. Switch to a provider that supports vision (OpenAI, Gemini, Anthropic, OpenRouter, Mistral, Together, DeepSeek).`
        );
    }

    // 🧠 Retrieve AI Memory (Adaptive Learning)
    const memoryContext = await buildMemoryPrompt();

    return withKeyRotation(keyString, provider, async (key) => {

        let prompt = EXTRACTION_PROMPT;

        // Inject Memory Context
        if (memoryContext) {
            prompt += `\n\n${memoryContext}\n\nIMPORTANT: Use the above 'AI MEMORY' to recognize this document type and its fields if a pattern matches.`;
        }

        if (targetVariables.length > 0) {
            // DETECT CROP MODE: If we are looking for EXACTLY 1 variable and have NO learning cues,
            // assume this is a cropped image containing JUST the value.
            const isCropMode = targetVariables.length === 1 && learningCues.length === 0;

            if (isCropMode) {
                prompt += `\n\n## 🎯 SINGLE FIELD CROP MODE (High Precision)\n` +
                    `The image is a targeted crop for field: "${targetVariables[0]}".\n` +
                    `YOUR GOAL: Extract the VALUE associated with "${targetVariables[0]}".\n` +
                    `RULES:\n` +
                    `1. If the crop contains "Label: Value" (e.g., "Total: $500"), return ONLY "Value" ("$500").\n` +
                    `2. If the crop contains ONLY the value (e.g., "$500"), return it exactly.\n` +
                    `3. If the crop contains multiple lines, try to identify the main value. If it's a block of text (description), return all of it.\n` +
                    `4. Ignore tiny noise or artifacts.\n` +
                    `5. Return result as JSON with key "${targetVariables[0]}".`;
            } else {
                prompt += `\n\n## ⚠️ STRICT EXTRACTION MODE — MANDATORY ⚠️\n` +
                    `You MUST extract values for the following ${targetVariables.length} template variables.\n` +
                    `Return EXACTLY ${targetVariables.length} fields — no more, no less.\n\n` +
                    `TEMPLATE VARIABLES (extract ONLY these):\n` +
                    targetVariables.map(v => `- "${v}"`).join('\n') +
                    `\n\n### CRITICAL SEMANTIC MAPPING RULES:\n` +
                    `1. Each "label" in your response MUST be EXACTLY one of the variable names listed above — use the EXACT same string, case-sensitive.\n` +
                    `2. USE SEMANTIC UNDERSTANDING to map document content to template variables. Examples:\n` +
                    `   - If you see "Fecha: 18-feb.-2026" and the variable is "date" or "fecha", the value is "18-feb.-2026"\n` +
                    `   - If you see "Total: $240,000" and the variable is "total_to_pay", the value is "$240,000"\n` +
                    `   - If you see "N° Orden: 245,278" and the variable is "order_number", the value is "245,278"\n` +
                    `   - If you see "Creada Por: ETAMIA CHACON" and the variable is "jobs_done" or "created_by", map accordingly\n` +
                    `3. Read the document VERY CAREFULLY. Scan EVERY part of the image — headers, tables, footer, handwritten areas, stamps.\n` +
                    `4. If the value is HANDWRITTEN, zoom in mentally and read each character. Provide your best OCR reading.\n` +
                    `5. If you truly cannot find a value for a variable, return it with value "" and confidence 0.\n` +
                    `6. For dates: read EXACT text as written (e.g. "9-feb.-2026", "18/02/2026").\n` +
                    `7. For amounts: read EXACT text including currency symbol and separators (e.g. "$ 240,000.00").\n` +
                    `8. For reference numbers: read character by character (e.g. "245,278", "COT-2024-001").\n` +
                    `9. DO NOT return empty values if you can see ANY relevant text in the document. Try harder.\n` +
                    `10. Variable names may be in English but the document may be in Spanish (or vice versa) — use your intelligence to match semantically.`;
            }
        }

        if (learningCues.length > 0) {
            prompt += `\n\nVISUAL HINTS (Use these coordinates to locate fields):` +
                learningCues.map(c => `\n- Field '${c.variable}' is located around X:${c.x.toFixed(1)}%, Y:${c.y.toFixed(1)}% (Width:${c.w.toFixed(1)}%, Height:${c.h.toFixed(1)}%)`).join('');
        }

        switch (provider) {
            case "openai":
            case "deepseek":
                return scanOpenAICompat(
                    provider === "openai"
                        ? "https://api.openai.com/v1/chat/completions"
                        : "https://api.deepseek.com/chat/completions",
                    visionModel,
                    base64,
                    mimeType,
                    key,
                    {},
                    prompt
                );

            case "openrouter":
                return scanOpenAICompat(
                    "https://openrouter.ai/api/v1/chat/completions",
                    visionModel,
                    base64,
                    mimeType,
                    key,
                    {
                        "HTTP-Referer": window.location.origin,
                        "X-Title": "DocIA",
                    },
                    prompt
                );

            case "mistral":
                return scanOpenAICompat(
                    "https://api.mistral.ai/v1/chat/completions",
                    visionModel,
                    base64,
                    mimeType,
                    key,
                    {},
                    prompt
                );

            case "together":
                return scanOpenAICompat(
                    "https://api.together.xyz/v1/chat/completions",
                    visionModel,
                    base64,
                    mimeType,
                    key,
                    {},
                    prompt
                );

            case "gemini":
                return scanWithGemini(base64, key, mimeType, visionModel, prompt);

            case "anthropic":
                return scanWithAnthropic(base64, key, mimeType, visionModel, prompt);

            case "groq":
                return scanWithGroq(base64, key, mimeType, visionModel, prompt);

            default:
                throw new Error(`Vision not supported for provider: ${provider}`);
        }
    }).then(result => {
        // STRICT MODE: Enforce extraction of ONLY requested variables
        if (options?.strictMode && targetVariables.length > 0) {
            // 1. Filter out unrequested fields (hallucinations) and normalize labels
            const filteredFields = result.fields
                .filter(f => {
                    const cleanLabel = f.label.replace(/^[{\s]+|[}\s]+$/g, '').trim().toLowerCase();
                    return targetVariables.some(tv => {
                        const cleanTv = tv.replace(/^[{\s]+|[}\s]+$/g, '').trim().toLowerCase();
                        return cleanTv === cleanLabel;
                    });
                })
                .map(f => {
                    // Normalize label to match EXACT template variable name
                    const cleanLabel = f.label.replace(/^[{\s]+|[}\s]+$/g, '').trim().toLowerCase();
                    const matchedVar = targetVariables.find(tv =>
                        tv.replace(/^[{\s]+|[}\s]+$/g, '').trim().toLowerCase() === cleanLabel
                    );
                    return matchedVar ? { ...f, label: matchedVar.replace(/^[{\s]+|[}\s]+$/g, '').trim() } : f;
                });

            // 2. Ensure ALL requested variables are present (fill missing with empty)
            const existingLabels = new Set(filteredFields.map(f => f.label.toLowerCase()));
            targetVariables.forEach(tv => {
                const cleanTv = tv.replace(/^[{\s]+|[}\s]+$/g, '').trim();
                if (!existingLabels.has(cleanTv.toLowerCase())) {
                    filteredFields.push({ label: cleanTv, value: '', confidence: 0 });
                }
            });

            // 3. Sort fields to match template order
            const cleanVarOrder = targetVariables.map(tv => tv.replace(/^[{\s]+|[}\s]+$/g, '').trim().toLowerCase());
            filteredFields.sort((a, b) => {
                const idxA = cleanVarOrder.indexOf(a.label.toLowerCase());
                const idxB = cleanVarOrder.indexOf(b.label.toLowerCase());
                return idxA - idxB;
            });

            console.log(`🔒 Strict mode: ${result.fields.length} → ${filteredFields.length} fields (template has ${targetVariables.length})`);
            return { ...result, fields: filteredFields };
        }
        return result;
    });
}

async function scanOpenAICompat(
    url: string,
    model: string,
    base64: string,
    mimeType: string,
    apiKey: string,
    extraHeaders: Record<string, string> = {},
    prompt: string = EXTRACTION_PROMPT
): Promise<ScanResult> {
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            ...extraHeaders,
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: { url: `data:${mimeType};base64,${base64}` },
                        },
                    ],
                },
            ],
            max_tokens: 8192,
            temperature: 0.1,
            response_format: { type: "json_object" },
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `API error: ${res.status}`);
    }
    const data = await res.json();
    const text = data.choices[0].message.content;
    const clean = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
    try {
        return JSON.parse(clean);
    } catch {
        const jsonMatch = clean.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        throw new Error("AI did not return valid JSON. Response: " + clean.slice(0, 200));
    }
}

async function scanWithGroq(
    base64: string,
    apiKey: string,
    mimeType: string,
    model: string,
    prompt: string = EXTRACTION_PROMPT
): Promise<ScanResult> {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: "system",
                    content: "You are a document data extraction AI. You MUST respond with ONLY valid JSON, no extra text, no explanations, no markdown. Output raw JSON only.",
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt + "\n\nIMPORTANT: Return ONLY the raw JSON object. No markdown, no explanations, no text before or after the JSON." },
                        {
                            type: "image_url",
                            image_url: { url: `data:${mimeType};base64,${base64}` },
                        },
                    ],
                },
            ],
            max_completion_tokens: 4096,
            temperature: 0.1,
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Groq API error: ${res.status}`);
    }
    const data = await res.json();
    const text = data.choices[0].message.content;

    // Robust JSON extraction — handle models that wrap JSON in text
    let clean = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

    // Try direct parse first
    try {
        return JSON.parse(clean);
    } catch {
        // Fallback: find the first { ... } block in the response
        const jsonMatch = clean.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error("AI did not return valid JSON. Response: " + clean.slice(0, 200));
    }
}

async function scanWithGemini(
    base64: string,
    apiKey: string,
    mimeType: string,
    model: string,
    prompt: string = EXTRACTION_PROMPT
): Promise<ScanResult> {
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text:
                                    prompt +
                                    "\n\nIMPORTANT: Return ONLY valid JSON, no markdown, no explanations.",
                            },
                            { inline_data: { mime_type: mimeType, data: base64 } },
                        ],
                    },
                ],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.1,
                },
            }),
        }
    );
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Gemini error: ${res.status}`);
    }
    const data = await res.json();
    const text = data.candidates[0].content.parts[0].text;
    const clean = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
    try {
        return JSON.parse(clean);
    } catch {
        const jsonMatch = clean.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        throw new Error("Gemini did not return valid JSON. Response: " + clean.slice(0, 200));
    }
}

async function scanWithAnthropic(
    base64: string,
    apiKey: string,
    mimeType: string,
    model: string,
    prompt: string = EXTRACTION_PROMPT
): Promise<ScanResult> {
    const mediaType = mimeType as
        | "image/jpeg"
        | "image/png"
        | "image/gif"
        | "image/webp";
    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
            model,
            max_tokens: 4096,
            temperature: 0.1,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "image",
                            source: { type: "base64", media_type: mediaType, data: base64 },
                        },
                        {
                            type: "text",
                            text:
                                prompt + "\n\nReturn ONLY the JSON, no extra text.",
                        },
                    ],
                },
            ],
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Anthropic error: ${res.status}`);
    }
    const data = await res.json();
    const text = data.content[0].text;
    const clean = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
    return JSON.parse(clean);
}

/* ─── Connection Test ─── */

export async function testConnection(
    settings: AISettings
): Promise<{ success: boolean; message: string }> {
    if (settings.mode === "local") {
        try {
            const endpoint = settings.local.endpoint.replace(/\/$/, "");
            const res = await fetch(`${endpoint}/api/tags`);
            if (res.ok) {
                const data = await res.json();
                const models =
                    data.models?.map((m: any) => m.name).join(", ") || "none listed";
                return {
                    success: true,
                    message: `✓ Connected! Available models: ${models}`,
                };
            }
            return {
                success: false,
                message: `Server responded with status ${res.status}.`,
            };
        } catch {
            return {
                success: false,
                message: `Cannot reach ${settings.local.endpoint}. Is your local AI running?`,
            };
        }
    }

    const keys = settings.apiKeys[settings.provider];
    const key = Array.isArray(keys) ? keys[0] : keys;
    if (!key || key.length < 5) {
        return { success: false, message: "Missing or invalid API Key." };
    }

    const meta = getProviderMeta(settings.provider);

    // Build test request based on provider
    let testUrl = "";
    let headers: Record<string, string> = {};

    switch (settings.provider) {
        case "openai":
            testUrl = "https://api.openai.com/v1/models";
            headers = { Authorization: `Bearer ${key}` };
            break;
        case "anthropic":
            testUrl = "https://api.anthropic.com/v1/messages";
            headers = {
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
                "anthropic-dangerous-direct-browser-access": "true",
            };
            break;
        case "gemini":
            testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
            break;
        case "groq":
            testUrl = "https://api.groq.com/openai/v1/models";
            headers = { Authorization: `Bearer ${key}` };
            break;
        case "openrouter":
            testUrl = "https://openrouter.ai/api/v1/models";
            headers = { Authorization: `Bearer ${key}` };
            break;
        case "mistral":
            testUrl = "https://api.mistral.ai/v1/models";
            headers = { Authorization: `Bearer ${key}` };
            break;
        case "together":
            testUrl = "https://api.together.xyz/v1/models";
            headers = { Authorization: `Bearer ${key}` };
            break;
        case "perplexity":
            // Perplexity has no models endpoint; format check only
            return {
                success: true,
                message: `Key format looks valid for Perplexity. Save and try chatting.`,
            };
        case "cohere":
            testUrl = "https://api.cohere.com/v1/models";
            headers = { Authorization: `Bearer ${key}` };
            break;
        case "deepseek":
            testUrl = "https://api.deepseek.com/models";
            headers = { Authorization: `Bearer ${key}` };
            break;
    }

    try {
        const res = await fetch(testUrl, { headers });
        if (res.ok) {
            return {
                success: true,
                message: `✓ Connected to ${meta.name} — API key is valid.`,
            };
        }
        const err = await res.json().catch(() => ({}));
        return {
            success: false,
            message:
                err.error?.message ||
                `API returned status ${res.status}. Check your key.`,
        };
    } catch {
        if (key.length > 10) {
            return {
                success: true,
                message: `Key format looks valid for ${meta.name}. Save and try scanning a document.`,
            };
        }
        return { success: false, message: "Network error — could not reach API." };
    }
}
