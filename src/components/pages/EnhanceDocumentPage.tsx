/**
 * EnhanceDocumentPage — AI-powered document improvement.
 * Users can paste text OR upload a file (Word, PDF, TXT),
 * then apply 12 enhancement actions with AI.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sparkles,
    Copy,
    Check,
    RotateCcw,
    ArrowRight,
    Loader2,
    FileText,
    Wand2,
    Upload,
    X,
    FileUp,
    Bot,
    Send,
    Printer,
    FileType,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { DocumentEditor } from "../DocumentEditor";
import { callChat, loadAISettings, getActiveModel, getProviderMeta, scanDocument } from "../../services/ai";
import { buildMemoryPrompt } from "../../services/aiMemory";
import { pdfBase64ToImage } from "../../services/pdfToImage";

type EnhanceAction =
    | "formal"
    | "concise"
    | "grammar"
    | "restructure"
    | "translate"
    | "creative"
    | "academic"
    | "simplify"
    | "expand"
    | "email"
    | "legal"
    | "ideas";

const ACTIONS: EnhanceAction[] = [
    "formal",
    "concise",
    "grammar",
    "restructure",
    "translate",
    "creative",
    "academic",
    "simplify",
    "expand",
    "email",
    "legal",
    "ideas",
];

const ACTION_ICONS: Record<EnhanceAction, string> = {
    formal: "📜",
    concise: "✂️",
    grammar: "✍️",
    restructure: "🏗️",
    translate: "🌍",
    creative: "🎨",
    academic: "🎓",
    simplify: "💡",
    expand: "📖",
    email: "📧",
    legal: "⚖️",
    ideas: "💭",
};

const ACTION_COLORS: Record<EnhanceAction, string> = {
    formal: "from-amber-500/10 to-amber-600/5 border-amber-200/60 hover:border-amber-400 hover:shadow-amber-100/50",
    concise: "from-red-500/10 to-red-600/5 border-red-200/60 hover:border-red-400 hover:shadow-red-100/50",
    grammar: "from-blue-500/10 to-blue-600/5 border-blue-200/60 hover:border-blue-400 hover:shadow-blue-100/50",
    restructure: "from-purple-500/10 to-purple-600/5 border-purple-200/60 hover:border-purple-400 hover:shadow-purple-100/50",
    translate: "from-green-500/10 to-green-600/5 border-green-200/60 hover:border-green-400 hover:shadow-green-100/50",
    creative: "from-pink-500/10 to-pink-600/5 border-pink-200/60 hover:border-pink-400 hover:shadow-pink-100/50",
    academic: "from-indigo-500/10 to-indigo-600/5 border-indigo-200/60 hover:border-indigo-400 hover:shadow-indigo-100/50",
    simplify: "from-yellow-500/10 to-yellow-600/5 border-yellow-200/60 hover:border-yellow-400 hover:shadow-yellow-100/50",
    expand: "from-teal-500/10 to-teal-600/5 border-teal-200/60 hover:border-teal-400 hover:shadow-teal-100/50",
    email: "from-cyan-500/10 to-cyan-600/5 border-cyan-200/60 hover:border-cyan-400 hover:shadow-cyan-100/50",
    legal: "from-gray-500/10 to-gray-600/5 border-gray-200/60 hover:border-gray-400 hover:shadow-gray-100/50",
    ideas: "from-violet-500/10 to-violet-600/5 border-violet-200/60 hover:border-violet-400 hover:shadow-violet-100/50",
};

function buildPrompt(action: EnhanceAction, text: string, targetLang?: string): string {
    const base: Record<EnhanceAction, string> = {
        formal: `You are a professional document editor. Transform the following text into a formal, professional document. Maintain the same information but use proper formal language, professional structure, and appropriate tone. Add proper salutations, headers, or closing remarks if applicable.\n\nIMPORTANT: The text contains user instructions in <span data-instruction="..."> tags. Follow these specific instructions for the highlighted text.\n\nText:\n${text}`,
        concise: `You are an expert editor. Make the following text more concise and clear. Remove redundancy, tighten sentences, and keep only the essential information. Maintain the original meaning.\n\nIMPORTANT: The text contains user instructions in <span data-instruction="..."> tags. Follow these specific instructions for the highlighted text.\n\nText:\n${text}`,
        grammar: `You are a professional proofreader. Fix all grammar, spelling, punctuation, and style errors in the following text. Keep the original tone and meaning. Show the corrected version.\n\nIMPORTANT: The text contains user instructions in <span data-instruction="..."> tags. Follow these specific instructions for the highlighted text.\n\nText:\n${text}`,
        restructure: `You are a document organization expert. Restructure the following text for better flow, clarity, and readability. Add appropriate headings, bullet points, or numbered lists where beneficial. Improve paragraph organization.\n\nIMPORTANT: The text contains user instructions in <span data-instruction="..."> tags. Follow these specific instructions for the highlighted text.\n\nText:\n${text}`,
        translate: `You are a professional translator. Translate the following text to ${targetLang || 'English'}. Maintain the original tone, style, and meaning. Ensure natural, fluent translation.\n\nIMPORTANT: The text contains user instructions in <span data-instruction="..."> tags. Follow these specific instructions for the highlighted text.\n\nText:\n${text}`,
        creative: `You are a creative writer. Rewrite the following text with a more engaging, creative, and dynamic tone. Add vivid language, metaphors, or storytelling elements while keeping the core message.\n\nIMPORTANT: The text contains user instructions in <span data-instruction="..."> tags. Follow these specific instructions for the highlighted text.\n\nText:\n${text}`,
        academic: `You are an academic writing expert. Convert the following text to academic/scientific writing style. Use formal academic language, proper citations format suggestions, and scholarly tone. Add relevant academic structure.\n\nIMPORTANT: The text contains user instructions in <span data-instruction="..."> tags. Follow these specific instructions for the highlighted text.\n\nText:\n${text}`,
        simplify: `You are a plain language expert. Simplify the following text so it can be easily understood by anyone, including non-native speakers. Use short sentences, simple words, and clear structure.\n\nIMPORTANT: The text contains user instructions in <span data-instruction="..."> tags. Follow these specific instructions for the highlighted text.\n\nText:\n${text}`,
        expand: `You are a content expansion expert. Expand the following text with more detail, examples, explanations, and depth. Add relevant supporting information while maintaining the original focus.\n\nIMPORTANT: The text contains user instructions in <span data-instruction="..."> tags. Follow these specific instructions for the highlighted text.\n\nText:\n${text}`,
        email: `You are a professional email writer. Convert the following text into a professional email format. Add an appropriate subject line, greeting, well-structured body, and professional closing.\n\nIMPORTANT: The text contains user instructions in <span data-instruction="..."> tags. Follow these specific instructions for the highlighted text.\n\nText:\n${text}`,
        legal: `You are a legal writing expert. Rewrite the following text using appropriate legal terminology, formal structure, and precision. Add relevant legal clauses, disclaimers, or formal structure as appropriate.\n\nIMPORTANT: The text contains user instructions in <span data-instruction="..."> tags. Follow these specific instructions for the highlighted text.\n\nText:\n${text}`,
        ideas: `You are a document improvement consultant. Analyze the following text and provide:\n1. 5 specific suggestions to improve the content\n2. Alternative approaches or angles to consider\n3. Missing information that should be added\n4. Tone and style recommendations\n5. A brief improved version incorporating your suggestions\n\nIMPORTANT: The text contains user instructions in <span data-instruction="..."> tags. Follow these specific instructions for the highlighted text.\n\nText:\n${text}`,
    };
    return base[action];
}

export function EnhanceDocumentPage() {
    const { t } = useLanguage();
    const [inputText, setInputText] = useState("");
    const [outputText, setOutputText] = useState("");
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [selectedAction, setSelectedAction] = useState<EnhanceAction | null>(null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState("");
    const [showTranslateMenu, setShowTranslateMenu] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isExtractingFile, setIsExtractingFile] = useState(false);
    const [aiChatInput, setAiChatInput] = useState("");
    const [aiChatResponse, setAiChatResponse] = useState("");
    const [isAiChatting, setIsAiChatting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const TRANSLATE_LANGS = ["en", "es", "fr", "de", "pt", "it", "zh", "ja", "ko", "ar"] as const;

    // Get current AI provider info
    const [providerInfo, setProviderInfo] = useState("");
    useEffect(() => {
        loadAISettings().then((s) => {
            if (s.mode === "local") {
                setProviderInfo(`Local (${s.local.model})`);
            } else {
                const meta = getProviderMeta(s.provider);
                setProviderInfo(`${meta.name} · ${getActiveModel(s, "chat")}`);
            }
        });
    }, []);

    // ── File Upload & Text Extraction ──
    const handleFileUpload = useCallback(async (file: File) => {
        const validTypes = [
            'text/plain',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/png',
            'image/jpeg',
            'image/webp'
        ];
        const ext = file.name.split('.').pop()?.toLowerCase();

        // Relax type check
        const isSupported = validTypes.includes(file.type) || ['txt', 'doc', 'docx', 'pdf', 'md', 'rtf', 'png', 'jpg', 'jpeg', 'webp'].includes(ext || '');

        if (!isSupported) {
            setError(t('enhance.unsupportedFile') || 'Unsupported file type. Use TXT, DOC, PDF, or Images.');
            return;
        }

        if (file.size > 25 * 1024 * 1024) {
            setError(t('enhance.fileTooLarge') || 'File too large. Max 25MB.');
            return;
        }

        setUploadedFile(file);
        setError("");
        setIsExtractingFile(true);

        try {
            // Text/MD
            if (file.type === 'text/plain' || ext === 'txt' || ext === 'md') {
                const text = await file.text();
                setInputText(text);
                return;
            }

            const settings = await loadAISettings();
            const b64 = await fileToBase64(file);

            // PDF -> Image -> Vision
            if (file.type === 'application/pdf' || ext === 'pdf') {
                try {
                    const img = await pdfBase64ToImage(b64);
                    const scanRes = await scanDocument(img.base64, img.mimeType, settings);
                    setInputText(scanRes.rawText || scanRes.summary || "No text extracted from PDF.");
                } catch (e) {
                    // Fallback to text extraction if vision fails
                    console.warn("PDF vision failed, falling back to LLM extract", e);
                    throw e; // Or fallback
                }
            }
            // Image -> Vision
            else if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) {
                const mime = file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
                const scanRes = await scanDocument(b64, mime, settings);
                setInputText(scanRes.rawText || scanRes.summary || "No text extracted from image.");
            }
            // Word/Create -> System Extract
            else {
                // For DOCX, use AI to extract text via base64 prompt
                const memoryCtx = await buildMemoryPrompt();
                const result = await callChat([
                    { role: 'system', content: `You are a document extraction AI. The user has uploaded a ${ext?.toUpperCase()} file as base64. Your job is to READ the base64 content and output ONLY the plain text content of the document. Preserve headings and lists. If you cannot read it, say "Unable to read binary file".${memoryCtx}` },
                    { role: 'user', content: `Extract text from this file "${file.name}" (${file.size} bytes). Base64:\n\n${b64.slice(0, 15000)}` }, // Limit size for token limits
                ], settings);
                setInputText(result);
            }
        } catch (err: any) {
            console.error("Extraction error:", err);
            setError(err.message || 'Failed to extract text. Ensure you are using a Vision-capable AI model (e.g. GPT-4o, Gemini 1.5, Claude 3.5).');
        } finally {
            setIsExtractingFile(false);
        }
    }, [t]);

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                resolve(result.split(',')[1] || result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    // ── Drag & Drop ──
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);
    const handleDragLeave = useCallback(() => setIsDragging(false), []);
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileUpload(file);
    }, [handleFileUpload]);

    const handleEnhance = async (action: EnhanceAction, targetLang?: string) => {
        if (!inputText.trim()) {
            setError(t("enhance.noText"));
            return;
        }
        setError("");
        setSelectedAction(action);
        setIsEnhancing(true);
        setOutputText("");

        try {
            const settings = await loadAISettings();
            const prompt = buildPrompt(action, inputText, targetLang);
            const memoryCtx = await buildMemoryPrompt();
            const result = await callChat(
                [
                    { role: "system", content: `You are a document enhancement AI. Return only the enhanced text, no explanations or preamble unless the action is 'ideas'. Respond in the same language the text is written in unless told otherwise.${memoryCtx}` },
                    { role: "user", content: prompt },
                ],
                settings
            );
            setOutputText(result);
        } catch (err: any) {
            setError(err.message || t("enhance.error"));
        } finally {
            setIsEnhancing(false);
        }
    };

    // ── AI Chat (inline assistant) ──
    const handleAiChat = async () => {
        if (!aiChatInput.trim()) return;
        setIsAiChatting(true);
        setAiChatResponse("");
        try {
            const settings = await loadAISettings();
            const memoryCtx = await buildMemoryPrompt();
            const context = inputText
                ? `\n\nThe user's document text:\n${inputText.slice(0, 3000)}`
                : '';
            const enhanced = outputText
                ? `\n\nThe AI-enhanced version:\n${outputText.slice(0, 3000)}`
                : '';
            const result = await callChat([
                { role: 'system', content: `You are DocIA's document enhancement assistant. Help the user improve, analyze, or modify their documents. Be concise and helpful. Respond in the same language the user writes in.${context}${enhanced}${memoryCtx}` },
                { role: 'user', content: aiChatInput },
            ], settings);
            setAiChatResponse(result);
        } catch (err: any) {
            setAiChatResponse(`Error: ${err.message}`);
        } finally {
            setIsAiChatting(false);
        }
    };

    const handleCopy = async () => {
        if (!outputText) return;
        await navigator.clipboard.writeText(outputText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleUseAsInput = () => {
        if (outputText) {
            setInputText(outputText);
            setOutputText("");
            setSelectedAction(null);
        }
    };

    const wordCount = (text: string) => {
        const div = document.createElement('div');
        div.innerHTML = text;
        const plain = div.innerText || div.textContent || "";
        return plain.trim() ? plain.trim().split(/\s+/).length : 0;
    };

    // ── Export Handlers ──
    const handleDownloadWord = useCallback((content: string, filename: string) => {
        if (!content) return;
        const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
            "xmlns:w='urn:schemas-microsoft-com:office:word' " +
            "xmlns='http://www.w3.org/TR/REC-html40'> " +
            "<head><meta charset='utf-8'><title>" + filename + "</title></head><body>";
        const footer = "</body></html>";
        const sourceHTML = header + content.replace(/\n/g, "<br/>") + footer;

        const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
        const fileDownload = document.createElement("a");
        document.body.appendChild(fileDownload);
        fileDownload.href = source;
        fileDownload.download = `${filename}-${Date.now()}.doc`;
        fileDownload.click();
        document.body.removeChild(fileDownload);
    }, []);

    const handlePrint = useCallback((content: string) => {
        if (!content) return;
        const printWindow = window.open('', '', 'width=800,height=600');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Print Document - DocIA</title>
                        <style>
                            @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&display=swap');
                            body { 
                                font-family: 'Merriweather', serif; 
                                font-size: 12pt; 
                                line-height: 1.6; 
                                color: #1c1917; 
                                padding: 40px; 
                                max-width: 800px;
                                margin: 0 auto;
                            }
                            p { margin-bottom: 1em; }
                        </style>
                    </head>
                    <body>
                        ${content.replace(/\n/g, '<br/>')}
                    </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    }, []);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Title */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-[#B8925C]" />
                        {t("enhance.title")}
                    </h2>
                    <p className="text-sm text-stone-500 mt-1">{t("enhance.subtitle")}</p>
                </div>
                {providerInfo && (
                    <div className="text-xs text-stone-400 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200/60">
                        🤖 {providerInfo}
                    </div>
                )}
            </div>

            {/* Action Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {ACTIONS.map((action) => (
                    <div key={action} className="relative">
                        <button
                            onClick={() => {
                                if (action === "translate") {
                                    setShowTranslateMenu(!showTranslateMenu);
                                } else {
                                    setShowTranslateMenu(false);
                                    handleEnhance(action);
                                }
                            }}
                            disabled={isEnhancing}
                            className={`w-full p-3 rounded-2xl bg-gradient-to-br border text-left transition-all duration-200 hover:shadow-md ${ACTION_COLORS[action]} ${selectedAction === action
                                ? "ring-2 ring-[#B8925C]/40 border-[#B8925C] shadow-md"
                                : ""
                                } ${isEnhancing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                            <div className="text-lg mb-1">{ACTION_ICONS[action]}</div>
                            <div className="text-xs font-semibold text-stone-800 leading-tight">
                                {t(`enhance.actions.${action}`).replace(/^[^\s]+ /, '')}
                            </div>
                            <div className="text-[9px] text-stone-500 mt-0.5 leading-tight line-clamp-2">
                                {t(`enhance.actions.${action}Desc`)}
                            </div>
                        </button>

                        {/* Translate language dropdown */}
                        <AnimatePresence>
                            {action === "translate" && showTranslateMenu && (
                                <motion.div
                                    initial={{ opacity: 0, y: -5, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                                    className="absolute z-40 top-full left-0 mt-1 bg-white rounded-2xl shadow-xl border border-stone-200 p-2 min-w-[180px]"
                                    style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
                                >
                                    <p className="text-[10px] font-semibold text-stone-400 px-2 py-1 uppercase tracking-wide">
                                        {t("enhance.translateTo")}
                                    </p>
                                    {TRANSLATE_LANGS.map((lang) => (
                                        <button
                                            key={lang}
                                            onClick={() => {
                                                setShowTranslateMenu(false);
                                                handleEnhance("translate", t(`enhance.languages.${lang}`));
                                            }}
                                            className="w-full text-left px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50 rounded-xl transition-colors flex items-center gap-2"
                                        >
                                            <span className="text-xs">{t(`enhance.languages.${lang}`)}</span>
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>

            {/* Editor Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Input */}
                <div
                    className={`flex flex-col bg-white rounded-sm border shadow-lg overflow-hidden transition-all min-h-[600px] ${isDragging ? 'border-[#B8925C] ring-2 ring-[#B8925C]/20 shadow-xl' : 'border-stone-200'}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div className="flex items-center justify-between px-6 py-3 border-b border-stone-100 bg-stone-50/50">
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-stone-400" />
                            <span className="text-sm font-semibold text-stone-700 font-serif tracking-wide">{t("enhance.inputLabel") || "Original Document"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* File upload button */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="text-[10px] text-[#B8925C] hover:text-[#9a7848] bg-[#B8925C]/5 hover:bg-[#B8925C]/10 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 font-medium"
                            >
                                <FileUp className="w-3 h-3" />
                                {t('enhance.uploadFile') || 'Upload File'}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".txt,.doc,.docx,.pdf,.md,.rtf"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleFileUpload(f);
                                }}
                                className="hidden"
                            />
                            <div className="flex items-center gap-2 text-[10px] text-stone-400">
                                <span>{inputText.length} {t("enhance.characterCount")}</span>
                                <span>·</span>
                                <span>{wordCount(inputText)} {t("enhance.wordCount")}</span>
                            </div>
                        </div>
                    </div>

                    {/* File badge */}
                    {uploadedFile && (
                        <div className="px-4 py-2 bg-[#B8925C]/5 border-b border-[#B8925C]/10 flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-[#B8925C]" />
                            <span className="text-xs font-medium text-[#7C5C3F] truncate">{uploadedFile.name}</span>
                            <span className="text-[10px] text-stone-400">({(uploadedFile.size / 1024).toFixed(1)} KB)</span>
                            <button
                                onClick={() => { setUploadedFile(null); }}
                                className="ml-auto text-stone-400 hover:text-stone-600 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    {/* Loading overlay for file extraction */}
                    <div className="relative flex-1">
                        {isExtractingFile && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm rounded-b-2xl">
                                <Loader2 className="w-8 h-8 text-[#B8925C] animate-spin mb-3" />
                                <p className="text-sm font-medium text-stone-600">{t('enhance.extractingText') || 'Extracting text from file...'}</p>
                                <p className="text-xs text-stone-400 mt-1">{uploadedFile?.name}</p>
                            </div>
                        )}

                        {/* Drag overlay */}
                        {isDragging && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#B8925C]/5 backdrop-blur-sm rounded-b-2xl border-2 border-dashed border-[#B8925C]/40">
                                <Upload className="w-10 h-10 text-[#B8925C] mb-2" />
                                <p className="text-sm font-semibold text-[#7C5C3F]">{t('enhance.dropFile') || 'Drop file here'}</p>
                                <p className="text-xs text-stone-400">TXT, DOC, DOCX, PDF, MD</p>
                            </div>
                        )}

                        <DocumentEditor
                            initialContent={inputText}
                            onChange={(content) => { setInputText(content); setError(""); }}
                            placeholder={t("enhance.inputPlaceholder") || "Paste text here or upload a file..."}
                        />
                    </div>

                    <div className="flex items-center justify-between px-6 py-2 border-t border-stone-100 bg-stone-50/30">
                        <button
                            onClick={() => { setInputText(""); setOutputText(""); setSelectedAction(null); setError(""); setUploadedFile(null); }}
                            className="text-xs text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1"
                        >
                            <RotateCcw className="w-3 h-3" />
                            {t("enhance.clear")}
                        </button>
                        {error && (
                            <p className="text-xs text-red-500 font-medium animate-in fade-in">{error}</p>
                        )}
                    </div>
                </div>

                {/* Output */}
                <div className="flex flex-col bg-white rounded-sm border border-stone-200 shadow-lg min-h-[600px] relative">
                    <div className="flex items-center justify-between px-6 py-3 border-b border-stone-100 bg-stone-50/30">
                        <div className="flex items-center gap-2">
                            <Wand2 className="w-4 h-4 text-[#B8925C]" />
                            <span className="text-sm font-semibold text-stone-700 font-serif tracking-wide">{t("enhance.outputLabel") || "Improved Document"}</span>
                            {selectedAction && (
                                <span className="text-[10px] px-2 py-0.5 bg-[#B8925C]/10 text-[#B8925C] rounded-full font-medium">
                                    {ACTION_ICONS[selectedAction]} {t(`enhance.actions.${selectedAction}`).replace(/^[^\s]+ /, '')}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {outputText && (
                                <>
                                    <button
                                        onClick={() => handleDownloadWord(outputText, "enhanced-doc")}
                                        className="text-xs text-stone-500 hover:text-[#B8925C] transition-colors flex items-center gap-1.5 px-2 py-1.5 hover:bg-stone-100 rounded"
                                        title="Download as Word"
                                    >
                                        <FileType className="w-4 h-4" />
                                        <span className="hidden sm:inline">Word</span>
                                    </button>
                                    <button
                                        onClick={() => handlePrint(outputText)}
                                        className="text-xs text-stone-500 hover:text-[#B8925C] transition-colors flex items-center gap-1.5 px-2 py-1.5 hover:bg-stone-100 rounded"
                                        title="Print / Save as PDF"
                                    >
                                        <Printer className="w-4 h-4" />
                                        <span className="hidden sm:inline">PDF</span>
                                    </button>
                                    <div className="w-px h-4 bg-stone-200 mx-1"></div>
                                    <button
                                        onClick={handleCopy}
                                        className="text-xs text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-stone-100"
                                    >
                                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={handleUseAsInput}
                                        className="text-xs text-[#B8925C] hover:text-[#9a7848] transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-[#B8925C]/5"
                                        title="Use as Input"
                                    >
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="relative flex-1 min-h-[500px] bg-white group hover:bg-stone-50/10 transition-colors">
                        {isEnhancing && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
                                <Loader2 className="w-8 h-8 text-[#B8925C] animate-spin mb-3" />
                                <p className="text-sm font-medium text-stone-600 font-serif">{t("enhance.enhancing")}</p>
                                <p className="text-xs text-stone-400 mt-1">{selectedAction && t(`enhance.actions.${selectedAction}`)}</p>
                            </div>
                        )}
                        <DocumentEditor
                            initialContent={outputText}
                            onChange={(content) => setOutputText(content)}
                            placeholder={t("enhance.outputPlaceholder") || "AI generated content will appear here..."}
                        />
                    </div>
                    {outputText && (
                        <div className="flex items-center justify-between px-6 py-2 border-t border-stone-100 bg-stone-50/30">
                            <div className="text-[10px] text-stone-400 font-medium">
                                {outputText.length} chars · {wordCount(outputText)} words
                            </div>
                        </div>
                    )}
                </div>
            </div>


            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-r from-[#7C5C3F]/5 via-[#B8925C]/5 to-[#7C5C3F]/5 rounded-2xl border border-[#B8925C]/15 p-5"
            >
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-[#7C5C3F] to-[#B8925C] rounded-xl flex items-center justify-center">
                        <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-gray-800">
                            {t('enhance.aiAssistant') || 'AI Document Assistant'}
                        </h4>
                        <p className="text-[10px] text-gray-500">
                            {t('enhance.aiAssistantDesc') || 'Ask the AI for specific improvements, translations, or help with your document'}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={aiChatInput}
                        onChange={(e) => setAiChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAiChat()}
                        placeholder={t('enhance.aiChatPlaceholder') || 'Ask AI to do something specific with your document...'}
                        className="flex-1 text-sm bg-white border border-stone-200/60 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#B8925C]/20 focus:border-[#B8925C] outline-none transition-all placeholder:text-stone-300"
                    />
                    <button
                        onClick={handleAiChat}
                        disabled={isAiChatting || !aiChatInput.trim()}
                        className="px-4 py-2.5 bg-[#7C5C3F] text-white rounded-xl hover:bg-[#664D35] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isAiChatting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                </div>

                {/* AI Response */}
                <AnimatePresence>
                    {aiChatResponse && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 bg-white rounded-xl border border-stone-200/60 p-4 text-sm text-stone-700 leading-relaxed whitespace-pre-wrap"
                        >
                            {aiChatResponse}
                            <div className="mt-3 flex gap-2">
                                <button
                                    onClick={() => { setOutputText(aiChatResponse); setSelectedAction(null); }}
                                    className="text-[10px] text-[#B8925C] hover:text-[#7C5C3F] px-2 py-1 rounded-lg bg-[#B8925C]/5 hover:bg-[#B8925C]/10 transition-colors font-medium"
                                >
                                    {t('enhance.useAsOutput') || 'Use as output →'}
                                </button>
                                <button
                                    onClick={() => { setInputText(aiChatResponse); }}
                                    className="text-[10px] text-stone-500 hover:text-stone-700 px-2 py-1 rounded-lg bg-stone-50 hover:bg-stone-100 transition-colors font-medium"
                                >
                                    {t('enhance.useAsInput')}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div >
    );
}
