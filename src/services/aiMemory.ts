/**
 * AI Memory Service — Persistent Knowledge Base
 * 
 * Stores patterns, document types, field schemas, and training insights
 * so the AI can recall past sessions and provide better context-aware responses.
 * 
 * All data is stored locally in IndexedDB via Dexie.js.
 * 
 * Memory Types:
 *   - document_pattern:  Recurring document structure (invoice, contract, etc.)
 *   - field_schema:      Common fields found across multiple documents
 *   - training_insight:  Key takeaways from training sessions
 *   - user_preference:   How the user prefers documents to be processed
 */

import { db, type AIMemoryEntry } from '../db/schema';

/* ─── Types ─── */

export interface MemorySearchResult {
    entry: AIMemoryEntry;
    relevance: number; // 0-1 score
}

export interface MemoryContext {
    documentPatterns: AIMemoryEntry[];
    fieldSchemas: AIMemoryEntry[];
    trainingInsights: AIMemoryEntry[];
    userPreferences: AIMemoryEntry[];
    totalMemories: number;
}

/* ─── Core Functions ─── */

/**
 * Save a new memory entry from a training/scan session.
 * Automatically consolidates with existing similar memories.
 */
export async function saveMemory(params: {
    type: AIMemoryEntry['type'];
    category: string;
    title: string;
    content: string;
    tags: string[];
    sourceDocumentName?: string;
    metadata?: Record<string, unknown>;
}): Promise<number> {
    const now = Date.now();

    // Check for existing similar memory to consolidate
    const existing = await findSimilarMemory(params.category, params.tags);

    if (existing) {
        // Consolidate: update the existing memory with new data
        await db.aiMemory.update(existing.id!, {
            content: mergeContents(existing.content, params.content),
            tags: [...new Set([...existing.tags, ...params.tags])],
            occurrences: (existing.occurrences || 1) + 1,
            confidence: Math.min(1, (existing.confidence || 0.5) + 0.1),
            lastAccessedAt: now,
            updatedAt: now,
            metadata: {
                ...existing.metadata,
                ...params.metadata,
                consolidatedFrom: [
                    ...((existing.metadata?.consolidatedFrom as string[]) || []),
                    params.sourceDocumentName || 'unknown',
                ],
            },
        });
        return existing.id!;
    }

    // Create new memory
    return (await db.aiMemory.add({
        type: params.type,
        category: params.category,
        title: params.title,
        content: params.content,
        tags: params.tags,
        sourceDocumentName: params.sourceDocumentName,
        occurrences: 1,
        confidence: 0.5,
        metadata: params.metadata || {},
        createdAt: now,
        updatedAt: now,
        lastAccessedAt: now,
    })) as number;
}

/**
 * Save memories from a completed document scan.
 * Extracts and stores document patterns, field schemas, and SPATIAL LEARNING CUES.
 */
export async function saveMemoriesFromScan(params: {
    documentName: string;
    documentType: string;
    fields: { label: string; value: string; confidence: number }[];
    summary: string;
    rawText?: string;
    fieldLocations?: Record<string, { x: number; y: number; w: number; h: number }>;
    templateId?: number;
}): Promise<void> {
    // 1. Save the document pattern
    const fieldLabels = params.fields.map(f => f.label.toLowerCase());
    const docCategory = categorizeDocument(fieldLabels, params.summary);

    const tags = [...fieldLabels, docCategory, params.documentType];
    if (params.templateId) tags.push(`template_${params.templateId}`);

    await saveMemory({
        type: 'document_pattern',
        category: docCategory,
        title: params.templateId
            ? `Template #${params.templateId} Pattern` // Stable title for templates
            : `${docCategory} — ${params.documentName}`,
        content: JSON.stringify({
            documentType: params.documentType,
            templateId: params.templateId,
            structure: params.fields.map(f => ({
                label: f.label,
                sampleValue: f.value.slice(0, 100),
                confidence: f.confidence,
            })),
            locations: params.fieldLocations, // Persist spatial cues
            summary: params.summary,
        }),
        tags: tags,
        sourceDocumentName: params.documentName,
    });

    // 2. Save field schemas (group common fields)
    const fieldGroups = groupFields(params.fields);
    for (const [group, fields] of Object.entries(fieldGroups)) {
        await saveMemory({
            type: 'field_schema',
            category: group,
            title: `${group} fields`,
            content: JSON.stringify(fields.map(f => ({
                label: f.label,
                sampleValue: f.value.slice(0, 80),
            }))),
            tags: fields.map(f => f.label.toLowerCase()),
            sourceDocumentName: params.documentName,
        });
    }
}

/**
 * Save a training session summary as an insight.
 */
export async function saveTrainingInsight(params: {
    sessionName: string;
    documentName: string;
    summary: string;
    keyFindings: string[];
    messagesCount: number;
    templateCreated: boolean;
}): Promise<void> {
    await saveMemory({
        type: 'training_insight',
        category: 'training_session',
        title: params.sessionName || `Training — ${params.documentName}`,
        content: JSON.stringify({
            summary: params.summary,
            keyFindings: params.keyFindings,
            messagesCount: params.messagesCount,
            templateCreated: params.templateCreated,
        }),
        tags: ['training', params.documentName.toLowerCase()],
        sourceDocumentName: params.documentName,
        metadata: {
            messagesCount: params.messagesCount,
            templateCreated: params.templateCreated,
        },
    });
}

/**
 * Load all relevant memories for a new session.
 * Builds a context object the AI can reference.
 */
export async function loadMemoryContext(): Promise<MemoryContext> {
    const all = await db.aiMemory.orderBy('lastAccessedAt').reverse().toArray();

    return {
        documentPatterns: all.filter(m => m.type === 'document_pattern').slice(0, 20),
        fieldSchemas: all.filter(m => m.type === 'field_schema').slice(0, 15),
        trainingInsights: all.filter(m => m.type === 'training_insight').slice(0, 10),
        userPreferences: all.filter(m => m.type === 'user_preference').slice(0, 10),
        totalMemories: all.length,
    };
}

/**
 * Search memories by tags, category, or free text.
 * @param templateId - (Optional) Boost results that match this template ID
 */
export async function searchMemories(query: string, templateId?: number): Promise<MemorySearchResult[]> {
    const all = await db.aiMemory.toArray();
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    const templateTag = templateId ? `template_${templateId}` : null;

    const results: MemorySearchResult[] = all.map(entry => {
        let relevance = 0;

        // 🚀 CRITICAL BOOST: Template Priority
        // If this memory belongs to the same template, it's virtually a perfect match.
        if (templateTag && entry.tags.includes(templateTag)) {
            relevance += 10.0; // Massive boost
        }

        // Tag matching (highest weight)
        const matchingTags = entry.tags.filter(t =>
            queryWords.some(w => t.toLowerCase().includes(w))
        );
        relevance += matchingTags.length * 0.3;

        // Category matching
        if (entry.category.toLowerCase().includes(queryLower)) relevance += 0.25;

        // Title matching
        if (entry.title.toLowerCase().includes(queryLower)) relevance += 0.2;

        // Content matching
        if (entry.content.toLowerCase().includes(queryLower)) relevance += 0.15;

        // Recency boost
        const ageDays = (Date.now() - entry.lastAccessedAt) / (1000 * 60 * 60 * 24);
        if (ageDays < 7) relevance += 0.1;

        // Confidence boost
        relevance += entry.confidence * 0.1;

        // Occurrence boost
        relevance += Math.min(entry.occurrences * 0.05, 0.2);

        return { entry, relevance: Math.min(1, relevance) };
    });

    return results
        .filter(r => r.relevance > 0.1)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 10);
}

/**
 * Build a formatted memory context string for LLM system prompts.
 * This is injected into the AI's context so it "remembers" past sessions.
 */
export async function buildMemoryPrompt(): Promise<string> {
    const ctx = await loadMemoryContext();

    if (ctx.totalMemories === 0) {
        return '';
    }

    let prompt = `\n\nAI MEMORY — KNOWLEDGE FROM PAST SESSIONS (${ctx.totalMemories} total memories):\n`;

    // Document patterns
    if (ctx.documentPatterns.length > 0) {
        prompt += '\n📄 KNOWN DOCUMENT TYPES:\n';
        for (const mem of ctx.documentPatterns.slice(0, 8)) {
            try {
                const data = JSON.parse(mem.content);
                prompt += `  • ${mem.category} (seen ${mem.occurrences}x, confidence: ${Math.round(mem.confidence * 100)}%)\n`;
                prompt += `    Fields: ${data.structure?.map((s: any) => s.label).join(', ') || 'N/A'}\n`;
                if (data.summary) prompt += `    Summary: ${data.summary.slice(0, 120)}\n`;
            } catch {
                prompt += `  • ${mem.title} (${mem.occurrences}x)\n`;
            }
        }
    }

    // Field schemas
    if (ctx.fieldSchemas.length > 0) {
        prompt += '\n🔤 RECURRING FIELD PATTERNS:\n';
        for (const mem of ctx.fieldSchemas.slice(0, 6)) {
            prompt += `  • ${mem.category}: ${mem.tags.join(', ')} (${mem.occurrences}x)\n`;
        }
    }

    // Training insights
    if (ctx.trainingInsights.length > 0) {
        prompt += '\n🧠 PAST TRAINING INSIGHTS:\n';
        for (const mem of ctx.trainingInsights.slice(0, 5)) {
            try {
                const data = JSON.parse(mem.content);
                prompt += `  • ${mem.title}: ${data.summary?.slice(0, 150) || 'No summary'}\n`;
                if (data.keyFindings?.length) {
                    prompt += `    Key findings: ${data.keyFindings.slice(0, 3).join('; ')}\n`;
                }
            } catch {
                prompt += `  • ${mem.title}\n`;
            }
        }
    }

    // User preferences
    if (ctx.userPreferences.length > 0) {
        prompt += '\n⚙️ USER PREFERENCES:\n';
        for (const mem of ctx.userPreferences.slice(0, 5)) {
            prompt += `  • ${mem.title}: ${mem.content.slice(0, 100)}\n`;
        }
    }

    prompt += '\nUse this memory to provide more accurate, context-aware responses. Reference past patterns when relevant.\n';

    return prompt;
}

/**
 * Get memory statistics for display in the UI.
 */
export async function getMemoryStats(): Promise<{
    total: number;
    patterns: number;
    schemas: number;
    insights: number;
    preferences: number;
    topCategories: { name: string; count: number }[];
}> {
    const all = await db.aiMemory.toArray();

    const catCounts = new Map<string, number>();
    for (const mem of all) {
        catCounts.set(mem.category, (catCounts.get(mem.category) || 0) + 1);
    }
    const topCategories = [...catCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

    return {
        total: all.length,
        patterns: all.filter(m => m.type === 'document_pattern').length,
        schemas: all.filter(m => m.type === 'field_schema').length,
        insights: all.filter(m => m.type === 'training_insight').length,
        preferences: all.filter(m => m.type === 'user_preference').length,
        topCategories,
    };
}

/**
 * Clear all AI memories.
 */
export async function clearAllMemories(): Promise<void> {
    await db.aiMemory.clear();
}

/* ─── Internal Helpers ─── */

/**
 * Find a similar existing memory to consolidate with.
 */
async function findSimilarMemory(
    category: string,
    tags: string[]
): Promise<AIMemoryEntry | null> {
    const candidates = await db.aiMemory
        .where('category')
        .equals(category)
        .toArray();

    for (const mem of candidates) {
        const overlap = mem.tags.filter(t => tags.includes(t));
        if (overlap.length >= Math.min(3, tags.length * 0.5)) {
            return mem;
        }
    }
    return null;
}

/**
 * Merge two content strings (JSON-aware).
 */
function mergeContents(existing: string, incoming: string): string {
    try {
        const a = JSON.parse(existing);
        const b = JSON.parse(incoming);

        // Merge structures/fields
        if (a.structure && b.structure) {
            const existingLabels = new Set(a.structure.map((s: any) => s.label));
            for (const field of b.structure) {
                if (!existingLabels.has(field.label)) {
                    a.structure.push(field);
                }
            }
        }

        // Keep latest summary
        if (b.summary) a.summary = b.summary;

        return JSON.stringify(a);
    } catch {
        // Not JSON, just append
        return existing + '\n---\n' + incoming;
    }
}

/**
 * Categorize a document based on its fields and summary.
 */
function categorizeDocument(fieldLabels: string[], summary: string): string {
    const text = [...fieldLabels, summary.toLowerCase()].join(' ');

    const categories: [string, string[]][] = [
        ['invoice', ['invoice', 'total', 'amount', 'subtotal', 'tax', 'bill', 'payment', 'due date', 'factura']],
        ['contract', ['contract', 'agreement', 'party', 'terms', 'conditions', 'clause', 'contrato', 'acuerdo']],
        ['resume', ['resume', 'cv', 'experience', 'education', 'skills', 'curriculum']],
        ['letter', ['letter', 'dear', 'sincerely', 'regards', 'carta']],
        ['receipt', ['receipt', 'purchase', 'transaction', 'paid', 'recibo']],
        ['report', ['report', 'analysis', 'findings', 'conclusion', 'informe', 'reporte']],
        ['form', ['form', 'application', 'fill', 'field', 'formulario', 'solicitud']],
        ['certificate', ['certificate', 'certify', 'awarded', 'certificado']],
        ['id_document', ['passport', 'id', 'license', 'identification', 'cédula', 'pasaporte']],
        ['medical', ['patient', 'diagnosis', 'prescription', 'medical', 'health', 'médico']],
    ];

    for (const [category, keywords] of categories) {
        const matches = keywords.filter(k => text.includes(k));
        if (matches.length >= 2) return category;
    }

    return 'general_document';
}

/**
 * Group fields into semantic categories.
 */
function groupFields(
    fields: { label: string; value: string; confidence: number }[]
): Record<string, typeof fields> {
    const groups: Record<string, typeof fields> = {};

    const fieldCategories: [string, string[]][] = [
        ['personal_info', ['name', 'nombre', 'email', 'phone', 'address', 'dirección', 'teléfono', 'age', 'date of birth']],
        ['financial', ['amount', 'total', 'price', 'cost', 'tax', 'discount', 'subtotal', 'payment', 'monto']],
        ['dates', ['date', 'fecha', 'created', 'expires', 'due', 'from', 'to', 'period']],
        ['identifiers', ['id', 'number', 'reference', 'code', 'número', 'referencia', 'código']],
        ['organization', ['company', 'organization', 'department', 'empresa', 'organización']],
    ];

    for (const field of fields) {
        const labelLower = field.label.toLowerCase();
        let assigned = false;

        for (const [group, keywords] of fieldCategories) {
            if (keywords.some(k => labelLower.includes(k))) {
                if (!groups[group]) groups[group] = [];
                groups[group].push(field);
                assigned = true;
                break;
            }
        }

        if (!assigned) {
            if (!groups['other']) groups['other'] = [];
            groups['other'].push(field);
        }
    }

    return groups;
}
