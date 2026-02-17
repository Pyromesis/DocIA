/**
 * pdfToTemplate — Generates faithful HTML templates from PDF documents.
 * 
 * Multi-pass approach:
 *   Pass 1: pdf.js text layer extraction (exact text + positions)  [pdfToImage.ts]
 *   Pass 2: AI vision for field extraction                         [ai.ts scanDocument]
 *   Pass 3: Build HTML skeleton from text positions + AI refinement [this file]
 * 
 * The skeleton builder uses text positions to reconstruct the exact layout.
 * AI refinement is optional and used to polish the result.
 */

import { loadAISettings, type AISettings, withKeyRotation, getActiveModel } from './ai';
import { buildMemoryPrompt } from './aiMemory';
import type { PageTextLayer, TextItem } from './pdfToImage';

/* ─── Types ─── */

export interface ScanResult {
    fields: { label: string; value: string; confidence: number }[];
    rawText: string;
    summary: string;
    htmlStructure?: string;
    images?: { label: string; x: number; y: number; w: number; h: number }[];
}

export interface FaithfulTemplateResult {
    html: string;
    variables: string[];
    confidence: number;
    pageCount: number;
}

/* ─── Line Grouping & Skeleton Building (Deterministic) ─── */

interface TextLine {
    y: number;           // average Y position (%)
    items: TextItem[];   // items on this line, sorted left-to-right
    minX: number;        // leftmost X position
    maxX: number;        // rightmost X + width position
    avgFontSize: number;
}

function groupIntoLines(items: TextItem[], pageWidth: number): TextLine[] {
    if (items.length === 0) return [];

    // Sort by Y position first
    const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);

    const lines: TextLine[] = [];
    let currentGroup: TextItem[] = [sorted[0]];
    let currentY = sorted[0].y;

    for (let i = 1; i < sorted.length; i++) {
        const item = sorted[i];
        // Items within 1.5% Y distance are on the same line
        // (adjusted for typical font height in percentage terms)
        const tolerance = Math.max(1.5, (item.fontSize / pageWidth) * 100 * 2);
        if (Math.abs(item.y - currentY) <= tolerance) {
            currentGroup.push(item);
        } else {
            // Flush current group as a line
            const line = buildLine(currentGroup);
            if (line) lines.push(line);
            currentGroup = [item];
            currentY = item.y;
        }
    }
    // Flush last group
    const lastLine = buildLine(currentGroup);
    if (lastLine) lines.push(lastLine);

    return lines;
}

function buildLine(items: TextItem[]): TextLine | null {
    if (items.length === 0) return null;
    const sorted = items.sort((a, b) => a.x - b.x);
    const avgY = sorted.reduce((s, i) => s + i.y, 0) / sorted.length;
    const avgFs = sorted.reduce((s, i) => s + i.fontSize, 0) / sorted.length;
    const minX = Math.min(...sorted.map(i => i.x));
    const maxX = Math.max(...sorted.map(i => i.x + i.width));

    return {
        y: avgY,
        items: sorted,
        minX,
        maxX,
        avgFontSize: avgFs,
    };
}

/* ─── Alignment Detection ─── */

type Alignment = 'left' | 'center' | 'right' | 'justify' | 'split';

function detectAlignment(line: TextLine, pageLeftMargin: number): Alignment {
    const { items, minX, maxX } = line;

    // Two-column "split" layout: items far apart (left AND right side)
    if (items.length >= 2) {
        const leftMost = items[0].x;
        const rightMost = items[items.length - 1].x;
        // If there's a gap of >25% of page width between items, it's a split layout
        if (rightMost - leftMost > 30) {
            return 'split';
        }
    }

    // Calculate center of the text content
    const contentCenter = (minX + maxX) / 2;

    // Page center is ~50%
    const distFromCenter = Math.abs(contentCenter - 50);

    // If text starts close to left margin → left aligned
    if (minX < pageLeftMargin + 5 && distFromCenter > 8) {
        return 'left';
    }

    // If content is centered on the page (center within 8% of page center)
    if (distFromCenter < 8) {
        return 'center';
    }

    // If text is far right
    if (minX > 60) {
        return 'right';
    }

    return 'left';
}

/* ─── Variable Replacement ─── */

function buildValueToVarMap(fields: ScanResult['fields']): Map<string, string> {
    const map = new Map<string, string>();
    for (const f of fields) {
        if (f.value && f.value.trim().length > 1) {
            const varName = f.label
                .toLowerCase()
                .replace(/[^a-z0-9áéíóúñü\s]/gi, '')
                .replace(/\s+/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/g, '');
            map.set(f.value.trim(), `{{${varName}}}`);
        }
    }
    return map;
}

function replaceWithVariables(text: string, valueToVar: Map<string, string>): string {
    let result = text;
    // Sort by length descending to match longer values first
    const entries = Array.from(valueToVar.entries())
        .sort((a, b) => b[0].length - a[0].length);

    for (const [value, varName] of entries) {
        // Try exact match first
        if (result.includes(value)) {
            result = result.replace(value, varName);
            continue;
        }
        // Try case-insensitive match
        const idx = result.toLowerCase().indexOf(value.toLowerCase());
        if (idx >= 0) {
            result = result.substring(0, idx) + varName + result.substring(idx + value.length);
        }
    }
    return result;
}

/* ─── Detect Page Margins ─── */

function detectMargins(lines: TextLine[]): { left: number; right: number } {
    if (lines.length < 3) return { left: 8, right: 92 };

    // Collect all left positions for left-aligned lines
    const leftPositions = lines
        .filter(l => l.minX < 40) // Only consider lines that start in left half
        .map(l => l.minX);

    if (leftPositions.length === 0) return { left: 8, right: 92 };

    // Most common left margin (mode)
    const leftMargin = leftPositions.sort((a, b) => a - b)[Math.floor(leftPositions.length / 4)] || 8;

    return { left: leftMargin, right: 100 - leftMargin };
}

/* ─── Build HTML Skeleton ─── */

function buildHTMLSkeleton(pages: PageTextLayer[], fields: ScanResult['fields']): string {
    const valueToVar = buildValueToVarMap(fields);
    const parts: string[] = [];

    // Wrapper div — letter-size document styling
    parts.push(`<div style="font-family:'Times New Roman',Georgia,serif;max-width:680px;margin:0 auto;padding:50px 65px;line-height:1.6;color:#1a1a2e;font-size:12pt;background:white;">`);

    for (const page of pages) {
        if (page.pageNumber > 1) {
            parts.push(`  <div style="border-top:1px solid #ccc;margin:40px 0;page-break-before:always;"></div>`);
        }

        const lines = groupIntoLines(page.items, page.width);
        if (lines.length === 0) continue;

        const margins = detectMargins(lines);
        let prevY = lines[0]?.y || 0;
        let isFirstLine = true;

        for (const line of lines) {
            // Calculate vertical gap for spacing
            const gap = isFirstLine ? 0 : line.y - prevY;
            prevY = line.y;
            isFirstLine = false;

            // Determine margin based on gap size  
            let marginTop = '';
            if (gap > 6) marginTop = 'margin-top:28px;';
            else if (gap > 4) marginTop = 'margin-top:20px;';
            else if (gap > 2.5) marginTop = 'margin-top:12px;';
            else marginTop = 'margin-top:2px;';

            const alignment = detectAlignment(line, margins.left);
            const isBold = line.avgFontSize > 12.5 || line.items.some(i =>
                i.fontName.toLowerCase().includes('bold') || i.fontSize > 13
            );
            const isLargeFont = line.avgFontSize > 14;

            if (alignment === 'split') {
                // Two-column layout: date left, document number right
                const midPoint = 50;
                const leftItems = line.items.filter(i => i.x < midPoint);
                const rightItems = line.items.filter(i => i.x >= midPoint);

                const leftText = replaceWithVariables(
                    leftItems.map(i => i.text).join(' '), valueToVar
                );
                const rightText = replaceWithVariables(
                    rightItems.map(i => i.text).join(' '), valueToVar
                );

                let style = `display:flex;justify-content:space-between;align-items:base-line;${marginTop}`;
                if (isBold) style += 'font-weight:bold;';

                parts.push(`  <div style="${style}">`);
                parts.push(`    <span>${leftText}</span>`);
                parts.push(`    <span>${rightText}</span>`);
                parts.push(`  </div>`);

            } else {
                // Single alignment block
                const fullText = replaceWithVariables(
                    line.items.map(i => i.text).join(' '), valueToVar
                );

                let style = `text-align:${alignment};${marginTop}`;
                if (isBold) style += 'font-weight:bold;';
                if (isLargeFont) style += `font-size:${Math.round(line.avgFontSize)}pt;`;

                // Use margin for different alignment types
                if (alignment === 'center') {
                    style += 'margin-left:auto;margin-right:auto;';
                }

                parts.push(`  <p style="${style}">${escapeHTML(fullText)}</p>`);
            }
        }
    }

    // Signature line placeholder
    parts.push(`  <div style="margin-top:40px;">`);
    parts.push(`    <div style="border-bottom:1px solid #333;width:200px;height:40px;"></div>`);
    parts.push(`  </div>`);

    parts.push(`</div>`);
    return parts.join('\n');
}

function escapeHTML(text: string): string {
    // Don't escape already-inserted handlebars variables or HTML entities
    if (text.includes('&')) return text;
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/* ─── AI Refinement (Vision) ─── */

const REFINE_PROMPT = `You are an elite expert in Document Replication and HTML/CSS. 
Your GOAL is to create a PIXEL-PERFECT HTML version of the document image provided.

I will provide:
1. An image of the original document
2. An HTML skeleton auto-generated from text positions

TASK:
Refine the HTML skeleton to match the image EXACTLY. You must output a single <div> wrapper containing the entire document.

ADVANCED LAYOUT RULES:
- **Structure**: Use modern CSS Flexbox and Grid where appropriate for complex alignments.
- **Tables**: If the document contains a table, user proper HTML <table> tags with border-collapse: collapse; and precise styling.
- **Fonts**: Detect if the text is Serif (Times) or Sans-Serif (Arial/Helvetica) and apply the correct font-family.
- **Spacing**: Replicate whitespace, padding, and margins EXACTLY. The document should look identical when printed.
- **Borders & Lines**: If there are horizontal lines, signatures lines, or box borders, replicate them using CSS borders (e.g., border-bottom: 2px solid #000).
- **Colors**: If there is colored text, use standard hex codes to match.
- **Signatures**: For signature areas, ensure there is a line and space for signing.
- **Variables**: PRESERVE ALL {{handlebars_variables}} exactly as they appear in the skeleton. Do not change their names.

CRITICAL:
- Do NOT return markdown fences like \`\`\`html.
- Return ONLY the raw HTML string starting with <div.
- Do NOT start with <!DOCTYPE html> or <html> tags.`;

async function callVisionHTML(
    settings: AISettings,
    base64: string,
    mimeType: string,
    prompt: string,
    skeleton: string
): Promise<string> {
    const provider = settings.provider;
    const model = getActiveModel(settings, 'vision');
    const keyString = settings.apiKeys[provider];

    return withKeyRotation(keyString, provider, async (apiKey) => {
        let content = '';

        if (provider === 'openai' || provider === 'deepseek' || provider === 'mistral' || provider === 'together' || provider === 'groq' || provider === 'openrouter') {
            const baseUrl = {
                'openai': "https://api.openai.com/v1/chat/completions",
                'deepseek': "https://api.deepseek.com/chat/completions",
                'mistral': "https://api.mistral.ai/v1/chat/completions",
                'together': "https://api.together.xyz/v1/chat/completions",
                'groq': "https://api.groq.com/openai/v1/chat/completions",
                'openrouter': "https://openrouter.ai/api/v1/chat/completions",
            }[provider] || "https://api.openai.com/v1/chat/completions";

            const headers: any = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            };

            if (provider === 'openrouter') {
                headers['HTTP-Referer'] = window.location.origin;
                headers['X-Title'] = 'DocIA';
            }

            const res = await fetch(baseUrl, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    model,
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: prompt + "\n\nSKELETON:\n" + skeleton },
                                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
                            ],
                        },
                    ],
                    max_tokens: 4096,
                }),
            });
            if (!res.ok) throw new Error(`Vision API error: ${res.status}`);
            const data = await res.json();
            content = data.choices[0].message.content;

        } else if (provider === 'gemini') {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: prompt + "\n\nSKELETON:\n" + skeleton },
                                { inline_data: { mime_type: mimeType, data: base64 } },
                            ],
                        }],
                    }),
                }
            );
            if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
            const data = await res.json();
            content = data.candidates[0].content.parts[0].text;

        } else if (provider === 'anthropic') {
            const mediaType = mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
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
                    messages: [{
                        role: "user",
                        content: [
                            {
                                type: "image",
                                source: { type: "base64", media_type: mediaType, data: base64 },
                            },
                            { type: "text", text: prompt + "\n\nSKELETON:\n" + skeleton },
                        ],
                    }],
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error?.message || `Anthropic error: ${res.status}`);
            }
            const data = await res.json();
            content = data.content[0].text;
        }

        return content;
    });
}


/* ─── Main Function ─── */

export async function generateFaithfulTemplate(
    imageBase64: string,
    imageMimeType: string,
    textLayers: PageTextLayer[],
    scanResult: ScanResult,
    settings?: AISettings
): Promise<FaithfulTemplateResult> {
    const aiSettings = settings || await loadAISettings();

    // Step 1: Build HTML skeleton from text positions (deterministic, no AI needed)
    const htmlSkeleton = buildHTMLSkeleton(textLayers, scanResult.fields);
    console.log('📐 HTML skeleton built from text positions (' + textLayers.reduce((s, p) => s + p.items.length, 0) + ' text items)');

    // Step 2: Try AI refinement (optional — skeleton is usable without it)
    let html = htmlSkeleton;

    try {
        const provider = aiSettings.provider;
        const supportsVision = ['openai', 'gemini', 'anthropic', 'openrouter', 'mistral', 'together', 'deepseek'].includes(provider);

        if (supportsVision) {
            console.log(`🧠 Refining template with AI (${provider})...`);

            // Retrieve learnings
            const memoryContext = await buildMemoryPrompt();

            // Augment prompt with memory
            let finalPrompt = REFINE_PROMPT;
            if (memoryContext) {
                finalPrompt += `\n\n${memoryContext}\n\nIMPORTANT: Use the above 'AI MEMORY' to apply any learned style preferences or corrections.`;
            }

            const rawResponse = await callVisionHTML(
                aiSettings,
                imageBase64,
                imageMimeType,
                finalPrompt,
                htmlSkeleton
            );

            // Clean up
            let refined = rawResponse
                .replace(/```html\n?/gi, '')
                .replace(/```\n?/g, '')
                .trim();

            // Extract only the div content
            const divMatch = refined.match(/<div[\s\S]*<\/div>\s*$/i);
            if (divMatch) {
                refined = divMatch[0];
            }

            // Validate — the refined version should still have variables
            const hasVariables = /\{\{[^}]+\}\}/.test(refined);
            const hasDiv = refined.startsWith('<div');

            if (hasDiv) {
                html = refined;
                console.log('✨ AI refinement applied variables:', hasVariables);
            } else {
                console.warn('⚠️ AI refinement rejected (invalid structure), using skeleton');
            }
        }
    } catch (err: any) {
        console.warn('⚠️ AI refinement failed, using skeleton:', err.message);
    }

    // Extract variables from final HTML
    const variableMatches = html.match(/\{\{([^}]+)\}\}/g) || [];
    const variables = Array.from(new Set(variableMatches));

    return {
        html,
        variables,
        confidence: variables.length > 3 ? 0.85 : 0.6,
        pageCount: textLayers.length,
    };
}
