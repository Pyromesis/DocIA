/**
 * TrainingPage — Guided AI Training with document upload.
 * 
 * Flow:
 *   1. Upload a document (PDF/Word/Image)
 *   2. OCR AI scans and extracts content
 *   3. User guides the LLM agent to understand the document
 *   4. AI learns and saves the training session
 *   5. Option to create a template from the scanned document
 *
 * Two AIs:
 *   - Vision/OCR AI: Extracts raw content from documents
 *   - LLM Agent: Understands user intent, learns patterns, saves to DB
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import {
    Upload, Brain, MessageSquare, FileCheck, Sparkles, Send,
    ArrowRight, CheckCircle2, Loader2, Zap,
    FileText, Eye, Bot, RotateCcw, X,
    Image, GraduationCap, Palette
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { db, Template } from '../../db/schema';
import { loadAISettings, callChat, scanDocument } from '../../services/ai';
import { buildMemoryPrompt, saveMemoriesFromScan, saveTrainingInsight, getMemoryStats } from '../../services/aiMemory';
import { pdfBase64ToImage, pdfBase64ExtractText } from '../../services/pdfToImage';
import { generateFaithfulTemplate } from '../../services/pdfToTemplate';
import { ImageAnnotator, type Annotation } from '../ImageAnnotator';

// ─── Types ───
interface TrainingMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

interface ExtractedData {
    fields: { label: string; value: string; confidence: number }[];
    rawText: string;
    summary: string;
    htmlStructure?: string;
}

// ─── Step definitions ───
const STEPS = [
    { id: 'upload', icon: Upload, key: 'training.steps.upload' },
    { id: 'scan', icon: Eye, key: 'training.steps.scan' },
    { id: 'guide', icon: MessageSquare, key: 'training.steps.guide' },
    { id: 'complete', icon: FileCheck, key: 'training.steps.complete' },
];

// ─── Animated particles background ───
function ParticleField() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 20 }).map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute w-1 h-1 bg-[#B8925C]/20 rounded-full"
                    initial={{
                        x: Math.random() * 100 + '%',
                        y: Math.random() * 100 + '%',
                        scale: Math.random() * 0.5 + 0.5,
                    }}
                    animate={{
                        y: [Math.random() * 100 + '%', Math.random() * 100 + '%'],
                        x: [Math.random() * 100 + '%', Math.random() * 100 + '%'],
                        opacity: [0.2, 0.6, 0.2],
                    }}
                    transition={{
                        duration: Math.random() * 10 + 10,
                        repeat: Infinity,
                        ease: 'linear',
                    }}
                />
            ))}
        </div>
    );
}

// ─── Animated Pulsing Brain ───
function PulsingBrain() {
    return (
        <div className="relative">
            <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 bg-gradient-to-br from-[#B8925C]/30 to-[#7C5C3F]/20 rounded-full blur-xl"
            />
            <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="relative z-10 w-20 h-20 bg-gradient-to-br from-[#7C5C3F] to-[#B8925C] rounded-2xl flex items-center justify-center shadow-xl"
            >
                <Brain className="w-10 h-10 text-white" />
            </motion.div>
            <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full flex items-center justify-center z-20"
            >
                <Zap className="w-3 h-3 text-white" />
            </motion.div>
        </div>
    );
}

export function TrainingPage() {
    const { t } = useLanguage();
    const [currentStep, setCurrentStep] = useState(0);
    const [file, setFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [_isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [scanStage, setScanStage] = useState('');
    const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
    const [messages, setMessages] = useState<TrainingMessage[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isAIThinking, setIsAIThinking] = useState(false);
    const [sessionName, setSessionName] = useState('');
    const [createTemplate, setCreateTemplate] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [_isSaved, setIsSaved] = useState(false);
    const [memoryCount, setMemoryCount] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const templates = useLiveQuery<Template[]>(() =>
        db.templates.orderBy('createdAt').reverse().toArray()
    ) || [];
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | string>('none');

    // Auto-disable "Create Template" if using an existing one
    useEffect(() => {
        if (selectedTemplateId !== 'none') {
            setCreateTemplate(false);
        } else {
            setCreateTemplate(true);
        }
    }, [selectedTemplateId]);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Annotation State
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [isAgentOpen, setIsAgentOpen] = useState(false);

    // Variable-Color mapping (same as UploadScanPage)
    const [variableColorMap, setVariableColorMap] = useState<Record<string, string>>({});
    const [activeColorVariable, setActiveColorVariable] = useState<string | null>(null);

    // Color palette for variable-color mapping
    const VARIABLE_COLORS = [
        { name: 'Rojo', hex: '#EF4444', bg: 'bg-red-100', border: 'border-red-400', text: 'text-red-700' },
        { name: 'Azul', hex: '#3B82F6', bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-700' },
        { name: 'Verde', hex: '#22C55E', bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-700' },
        { name: 'Naranja', hex: '#F97316', bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-700' },
        { name: 'Morado', hex: '#A855F7', bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-700' },
        { name: 'Rosa', hex: '#EC4899', bg: 'bg-pink-100', border: 'border-pink-400', text: 'text-pink-700' },
        { name: 'Cian', hex: '#06B6D4', bg: 'bg-cyan-100', border: 'border-cyan-400', text: 'text-cyan-700' },
        { name: 'Amarillo', hex: '#EAB308', bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-yellow-700' },
        { name: 'Índigo', hex: '#6366F1', bg: 'bg-indigo-100', border: 'border-indigo-400', text: 'text-indigo-700' },
        { name: 'Teal', hex: '#14B8A6', bg: 'bg-teal-100', border: 'border-teal-400', text: 'text-teal-700' },
    ];

    // Parse template variables from HTML content (SINGLE SOURCE OF TRUTH)
    const getTemplateVariables = (): string[] => {
        if (selectedTemplateId === 'none') return [];
        const tpl = templates.find(t => t.id === Number(selectedTemplateId));
        if (!tpl?.schema) return [];

        const htmlContent = tpl.schema.htmlContent as string | undefined;
        if (htmlContent) {
            const matches = htmlContent.match(/\{\{([^}]+)\}\}/g);
            if (matches) {
                return Array.from(new Set(
                    matches.map(m => m.replace(/^\{\{|\}\}$/g, '').trim())
                ));
            }
        }
        if (Array.isArray(tpl.schema.variables)) {
            return (tpl.schema.variables as string[]).map((v: string) =>
                v.replace(/^[{\s]+|[}\s]+$/g, '').trim()
            );
        }
        return [];
    };

    const activeAnnotationColor = activeColorVariable
        ? (variableColorMap[activeColorVariable] || '#ffff00')
        : '#10b981';

    // Load memory stats on mount
    useEffect(() => {
        getMemoryStats().then(stats => setMemoryCount(stats.total));
    }, []);

    // Auto-scroll messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ─── File Upload Handlers ───
    const handleFile = useCallback((f: File) => {
        const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowed.includes(f.type)) {
            alert(t('training.unsupportedFile'));
            return;
        }
        // Security: 25MB limit
        if (f.size > 25 * 1024 * 1024) {
            alert(t('training.fileTooLarge'));
            return;
        }
        setFile(f);
        if (f.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => setFilePreview(e.target?.result as string);
            reader.readAsDataURL(f);
        } else {
            setFilePreview(null);
        }
    }, [t]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);
    const handleDragLeave = useCallback(() => setIsDragging(false), []);
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
    }, [handleFile]);

    // ─── OCR Scan ───
    const handleScan = async () => {
        if (!file) return;
        setCurrentStep(1);
        setIsScanning(true);
        setScanProgress(0);
        setScanStage(t('training.scanStages.reading'));

        try {
            const settings = await loadAISettings();

            // Step 1: Read file
            const rawBase64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const b64 = (reader.result as string).split(',')[1];
                    resolve(b64);
                };
                reader.readAsDataURL(file);
            });

            setScanProgress(20);

            // Step 1b: If PDF, convert first page to image for vision API
            let scanBase64 = rawBase64;
            let scanMimeType = file.type;
            if (file.type === 'application/pdf') {
                setScanStage(t('training.scanStages.reading') + ' (PDF → Image...)');
                const converted = await pdfBase64ToImage(rawBase64);
                scanBase64 = converted.base64;
                scanMimeType = converted.mimeType;
                setPreviewUrl(`data:${converted.mimeType};base64,${converted.base64}`);
                setScanProgress(40);
            } else {
                setPreviewUrl(URL.createObjectURL(file));
            }

            setScanStage(t('training.scanStages.ocr'));

            // Get target variables from selected template (parsed from HTML)
            const targetVariables = getTemplateVariables();
            let learningCues: any[] = [];
            if (selectedTemplateId && selectedTemplateId !== 'none') {
                const tpl = templates.find(t => t.id === Number(selectedTemplateId));
                if (tpl?.schema) {
                    if (Array.isArray(tpl.schema.learningCues)) {
                        learningCues = tpl.schema.learningCues;
                    }
                    setScanStage(`Extrayendo ${targetVariables.length} campos de plantilla...`);
                }
            }

            // Step 2: OCR scan — uses Vision AI with strict mode when template selected
            const strictMode = selectedTemplateId !== 'none' && targetVariables.length > 0;
            const result = await scanDocument(scanBase64, scanMimeType, settings, targetVariables, learningCues, { strictMode });

            setScanProgress(70);
            setScanStage(t('training.scanStages.analyzing'));

            // Step 3b: Extract text layer and generate faithful HTML template (PDF only)
            if (file.type === 'application/pdf') {
                try {
                    setScanStage('Extrayendo diseño del documento...');
                    const textLayers = await pdfBase64ExtractText(rawBase64, 5);

                    setScanStage('Generando plantilla fiel...');
                    setScanProgress(80);

                    const faithfulResult = await generateFaithfulTemplate(
                        scanBase64,
                        scanMimeType,
                        textLayers,
                        result,
                        settings
                    );

                    // Store the faithful HTML in the result
                    result.htmlStructure = faithfulResult.html;
                    // console.log('✅ Faithful template generated:', faithfulResult.variables.length, 'variables,', faithfulResult.pageCount, 'pages');
                } catch (faithfulErr: any) {
                    console.warn('⚠️ Faithful template generation failed, continuing without:', faithfulErr.message);
                    // Non-fatal — the scan result is still usable
                }
            }

            setScanProgress(85);
            setScanStage(t('training.scanStages.analyzing'));

            // Step 3: Save scan to AI memory
            await saveMemoriesFromScan({
                documentName: file.name,
                documentType: file.type,
                fields: result.fields,
                summary: result.summary,
                rawText: result.rawText,
            });

            // Step 4: LLM Agent analyzes — with memory context
            const memoryPrompt = await buildMemoryPrompt();
            const analysisPrompt = [
                { role: 'system', content: `You are a document analysis AI agent. Analyze the extracted document content and provide a comprehensive understanding of what this document is about, its purpose, structure, and key data points. Respond in the user's language. Here is the extracted data:\n\nFields: ${JSON.stringify(result.fields)}\nSummary: ${result.summary}\nRaw Text: ${result.rawText?.slice(0, 2000)}${memoryPrompt}` },
                { role: 'user', content: 'Analyze this document thoroughly. What type of document is it? What are the key elements? How could I create a reusable template from it? If you recognize this as a type of document you\'ve seen before, mention that.' },
            ];

            const analysis = await callChat(analysisPrompt, settings);

            // Update memory count
            getMemoryStats().then(stats => setMemoryCount(stats.total));

            setScanProgress(100);
            setScanStage(t('training.scanStages.complete'));

            setExtractedData(result);

            // Initialize the conversation with the AI's analysis
            setMessages([
                {
                    id: crypto.randomUUID(),
                    role: 'system',
                    content: `Document scanned successfully. ${result.fields.length} fields extracted.`,
                    timestamp: Date.now(),
                },
                {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: analysis,
                    timestamp: Date.now(),
                },
            ]);

            setTimeout(() => {
                setIsScanning(false);
                setCurrentStep(2);
            }, 800);
        } catch (err: any) {
            setIsScanning(false);
            setScanProgress(0);
            alert(err.message || t('training.scanError'));
            setCurrentStep(0);
        }
    };

    // ─── Chat with AI Agent ───
    const handleSendMessage = async () => {
        if (!inputMessage.trim() || isAIThinking) return;

        const userMsg: TrainingMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: inputMessage.trim(),
            timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setInputMessage('');
        setIsAIThinking(true);

        try {
            const settings = await loadAISettings();

            // Build context for the LLM Agent — inject AI memory
            const memoryCtx = await buildMemoryPrompt();
            const systemContext = `You are an intelligent document trainer AI agent for DocIA. You are helping the user understand and create templates from their scanned document.

DOCUMENT CONTEXT:
- Fields extracted: ${JSON.stringify(extractedData?.fields || [])}
- Summary: ${extractedData?.summary || 'N/A'}
- Raw text (excerpt): ${extractedData?.rawText?.slice(0, 1500) || 'N/A'}

CAPABILITIES:
1. Explain the document structure and content
2. Help the user define which fields are important
3. Suggest template layouts and formats
4. Answer questions about the document
5. Help create a reusable template from this document
6. Reference past training sessions and known document patterns from your memory

Be conversational, helpful, and proactive. Respond in the same language the user writes in.
If you recognize similarities with previously trained documents, proactively mention it.${memoryCtx}`;

            const chatHistory = messages
                .filter((m) => m.role !== 'system')
                .map((m) => ({ role: m.role, content: m.content }));

            chatHistory.push({ role: 'user', content: userMsg.content });

            const response = await callChat(
                [{ role: 'system', content: systemContext }, ...chatHistory],
                settings
            );

            const aiMsg: TrainingMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: response,
                timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, aiMsg]);

            // AI Agent logs the interaction to the database
            await db.activityLogs.add({
                action: 'training_chat',
                entityType: 'system',
                entityName: sessionName || file?.name || 'Training Session',
                details: `User: ${userMsg.content.slice(0, 100)}`,
                timestamp: Date.now(),
            });
        } catch (err: any) {
            const errMsg: TrainingMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: `⚠️ ${err.message || t('training.chatError')}`,
                timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, errMsg]);
        } finally {
            setIsAIThinking(false);
        }
    };

    // ─── Save Training Session & Create Template ───
    const handleComplete = async () => {
        setIsSaving(true);
        const now = Date.now();

        try {
            // Save training session as activity log
            await db.activityLogs.add({
                action: 'training_complete',
                entityType: 'system',
                entityName: sessionName || file?.name || 'Training Session',
                details: JSON.stringify({
                    extractedFields: extractedData?.fields?.length || 0,
                    messagesCount: messages.length,
                    summary: extractedData?.summary,
                }),
                timestamp: now,
            });

            // Save training insight to AI memory
            const aiMessages = messages.filter(m => m.role === 'assistant');
            const keyFindings = aiMessages.slice(0, 3).map(m => m.content.slice(0, 150));
            await saveTrainingInsight({
                sessionName: sessionName || file?.name || 'Training Session',
                documentName: file?.name || 'Unknown',
                summary: extractedData?.summary || '',
                keyFindings,
                messagesCount: messages.length,
                templateCreated: createTemplate,
            });

            // 🧠 Learn Patterns: Save structural memories
            if (extractedData) {
                // console.log('🧠 Saving document pattern to AI Memory...');
                await saveMemoriesFromScan({
                    documentName: file?.name || 'Unknown',
                    documentType: 'unknown',
                    fields: extractedData.fields,
                    summary: extractedData.summary,
                    rawText: extractedData.rawText
                });
            }

            // Update memory count
            getMemoryStats().then(stats => setMemoryCount(stats.total));

            // If user wants to create a template
            if (createTemplate && extractedData) {
                try {
                    const templateName = sessionName || file?.name?.replace(/\.\w+$/, '') || 'Trained Template';

                    // Get variables from HTML content (the real template variables)
                    let variables: string[] = [];
                    if (extractedData.htmlStructure) {
                        const matches = extractedData.htmlStructure.match(/\{\{([^}]+)\}\}/g);
                        if (matches) {
                            variables = Array.from(new Set(
                                matches.map(m => `{{${m.replace(/^\{\{|\}\}$/g, '').trim()}}}`)
                            ));
                        }
                    }
                    // Fallback: derive from extracted fields if no HTML
                    if (variables.length === 0) {
                        variables = extractedData.fields
                            .map((f) => `{{${f.label.toLowerCase().replace(/\s+/g, '_')}}}`)
                            .slice(0, 10);
                    }

                    const templateId = await db.templates.add({
                        name: templateName,
                        description: extractedData.summary || 'Template created from AI training',
                        schema: {
                            variables,
                            fields: extractedData.fields,
                            htmlContent: extractedData.htmlStructure, // Save the AI-generated HTML structure
                            trainingMessages: messages.filter(m => m.role !== 'system').length,
                            learningCues: annotations,
                        },
                        outputFormat: 'pdf',
                        isDefault: false,
                        createdAt: now,
                        updatedAt: now,
                    });

                    // console.log('✅ Template created with ID:', templateId, 'Name:', templateName);

                    await db.activityLogs.add({
                        action: 'template_create',
                        entityType: 'template',
                        entityName: templateName,
                        details: `Template created from AI training session (ID: ${templateId})`,
                        timestamp: now,
                    });
                } catch (templateErr: any) {
                    console.error('❌ Template creation failed:', templateErr);
                    alert(`Error creating template: ${templateErr.message}`);
                }
            }

            // Save processed document
            await db.documents.add({
                name: file?.name || 'Trained Document',
                type: file?.type?.split('/')[1] || 'pdf',
                size: file?.size || 0,
                status: 'completed',
                content: extractedData?.rawText,
                metadata: {
                    fields: extractedData?.fields,
                    summary: extractedData?.summary,
                    rawText: extractedData?.rawText,
                    trainedAt: now,
                },
                createdAt: now,
                updatedAt: now,
            });

            setIsSaved(true);
            setCurrentStep(3);
        } catch (err: any) {
            console.error('❌ handleComplete error:', err);
            alert(err.message || 'Error saving training session');
        } finally {
            setIsSaving(false);
        }
    };

    // ─── Reset ───
    const handleReset = () => {
        setCurrentStep(0);
        setFile(null);
        setFilePreview(null);
        setExtractedData(null);
        setMessages([]);
        setInputMessage('');
        setSessionName('');
        setCreateTemplate(false);
        setIsSaved(false);
        setIsSaving(false);
        setIsScanning(false);
        setScanProgress(0);
        setAnnotations([]);
        setVariableColorMap({});
        setActiveColorVariable(null);
    };

    // Initialize variable colors when template changes
    useEffect(() => {
        const vars = getTemplateVariables();
        if (vars.length > 0) {
            const colorMap: Record<string, string> = {};
            vars.forEach((v, i) => {
                colorMap[v] = VARIABLE_COLORS[i % VARIABLE_COLORS.length].hex;
            });
            setVariableColorMap(colorMap);
        }
    }, [selectedTemplateId, templates]);

    // ───────────── RENDER ─────────────

    return (
        <div className="relative max-w-7xl mx-auto">
            <ParticleField />

            {/* ── Header ── */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-5 mb-8"
            >
                <PulsingBrain />
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900 font-display">
                        {t('training.title')}
                    </h1>
                    <p className="text-gray-500 mt-1 max-w-lg">
                        {t('training.subtitle')}
                    </p>
                </div>
                {/* Memory indicator */}
                {memoryCount > 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200/60 rounded-xl"
                    >
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            <Brain size={16} className="text-purple-500" />
                        </motion.div>
                        <div>
                            <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider">
                                {t('training.memory') || 'AI Memory'}
                            </p>
                            <p className="text-sm font-bold text-purple-700">
                                {memoryCount} {t('training.memories') || 'memories'}
                            </p>
                        </div>
                    </motion.div>
                )}
            </motion.div>

            {/* ── Step Indicator ── */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center justify-center gap-2 mb-10"
            >
                {STEPS.map((step, i) => {
                    const Icon = step.icon;
                    const isActive = i === currentStep;
                    const isDone = i < currentStep;
                    return (
                        <div key={step.id} className="flex items-center gap-2">
                            <motion.div
                                animate={{
                                    scale: isActive ? 1.1 : 1,
                                    backgroundColor: isDone ? '#7C5C3F' : isActive ? '#B8925C' : '#e5e7eb',
                                }}
                                className="relative flex items-center justify-center w-10 h-10 rounded-full transition-colors"
                            >
                                {isDone ? (
                                    <CheckCircle2 className="w-5 h-5 text-white" />
                                ) : (
                                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                                )}
                                {isActive && (
                                    <motion.div
                                        layoutId="stepGlow"
                                        className="absolute inset-0 rounded-full ring-4 ring-[#B8925C]/30"
                                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                    />
                                )}
                            </motion.div>
                            <span className={`text-xs font-medium hidden sm:block ${isActive ? 'text-[#7C5C3F]' : isDone ? 'text-gray-700' : 'text-gray-400'}`}>
                                {t(step.key)}
                            </span>
                            {i < STEPS.length - 1 && (
                                <div className="w-8 sm:w-16 h-0.5 bg-gray-200 mx-1">
                                    <motion.div
                                        animate={{ width: isDone ? '100%' : '0%' }}
                                        className="h-full bg-gradient-to-r from-[#7C5C3F] to-[#B8925C]"
                                        transition={{ duration: 0.6 }}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </motion.div>

            {/* ── Step Contents ── */}
            <AnimatePresence mode="wait">
                {/* ═══ Step 0: Upload ═══ */}
                {currentStep === 0 && (
                    <motion.div
                        key="upload"
                        initial={{ opacity: 0, y: 30, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.97 }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                        className="space-y-6"
                    >
                        {/* Template Selection for Refinement */}
                        <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-gray-100 shadow-sm max-w-2xl mx-auto mb-6 hover:shadow-md transition-shadow">
                            <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <Sparkles size={14} className="text-[#B8925C]" />
                                {t('training.refineExisting')}
                            </h3>
                            <select
                                value={selectedTemplateId}
                                onClick={(e) => e.stopPropagation()}
                                onChange={e => setSelectedTemplateId(e.target.value)}
                                className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 outline-none focus:ring-2 focus:ring-[#B8925C]/20 cursor-pointer"
                            >
                                <option value="none">{t('training.createNew')}</option>
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name} ({(t.schema?.fields as any[])?.length || 0} fields)</option>
                                ))}
                            </select>
                            {selectedTemplateId !== 'none' && (
                                <p className="text-[10px] text-gray-500 mt-2 px-1">
                                    {t('training.refineHint')}
                                </p>
                            )}
                        </div>
                        {/* Dropzone */}
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 group overflow-hidden
                ${isDragging
                                    ? 'border-[#B8925C] bg-[#B8925C]/5 scale-[1.01]'
                                    : file
                                        ? 'border-emerald-300 bg-emerald-50/50'
                                        : 'border-gray-200 hover:border-[#B8925C]/50 bg-white hover:bg-[#B8925C]/5'
                                }`}
                        >
                            {/* Glass overlay on hover */}
                            <div className="absolute inset-0 bg-gradient-to-b from-white/0 to-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg,.webp,.docx"
                                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                                className="hidden"
                            />

                            {file ? (
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="relative z-10 space-y-3"
                                >
                                    <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-2xl flex items-center justify-center">
                                        {file.type.startsWith('image/') ? (
                                            <Image className="w-8 h-8 text-emerald-600" />
                                        ) : (
                                            <FileText className="w-8 h-8 text-emerald-600" />
                                        )}
                                    </div>
                                    <p className="text-sm font-semibold text-gray-800">{file.name}</p>
                                    <p className="text-xs text-gray-500">
                                        {(file.size / 1024).toFixed(1)} KB • {file.type.split('/')[1]?.toUpperCase()}
                                    </p>
                                    {filePreview && (
                                        <img
                                            src={filePreview}
                                            alt="Preview"
                                            className="mx-auto mt-3 max-h-40 rounded-lg shadow-md border border-gray-200"
                                        />
                                    )}
                                </motion.div>
                            ) : (
                                <div className="relative z-10 space-y-3">
                                    <motion.div
                                        animate={{ y: [0, -6, 0] }}
                                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                        className="w-16 h-16 mx-auto bg-gradient-to-br from-[#B8925C]/10 to-[#7C5C3F]/10 rounded-2xl flex items-center justify-center"
                                    >
                                        <Upload className="w-8 h-8 text-[#7C5C3F]" />
                                    </motion.div>
                                    <p className="text-sm font-semibold text-gray-700">
                                        {t('training.dropzone')}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {t('training.supportedFormats')}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Session Name */}
                        {file && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-xl border border-gray-200 p-5 space-y-3"
                            >
                                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <GraduationCap size={16} className="text-[#7C5C3F]" />
                                    {t('training.sessionName')}
                                </label>
                                <input
                                    type="text"
                                    value={sessionName}
                                    onChange={(e) => setSessionName(e.target.value)}
                                    placeholder={t('training.sessionNamePlaceholder')}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#B8925C] focus:ring-2 focus:ring-[#B8925C]/20 transition-all"
                                />
                            </motion.div>
                        )}

                        {/* Start Button */}
                        {file && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="flex justify-center"
                            >
                                <button
                                    onClick={handleScan}
                                    className="group flex items-center gap-3 px-8 py-3.5 bg-gradient-to-r from-[#7C5C3F] to-[#B8925C] text-white font-semibold rounded-xl
                    hover:from-[#664D35] hover:to-[#9E7848] transition-all shadow-lg hover:shadow-xl hover:shadow-[#7C5C3F]/20"
                                >
                                    <Brain className="w-5 h-5" />
                                    {t('training.startTraining')}
                                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                </button>
                            </motion.div>
                        )}
                    </motion.div>
                )}

                {/* ═══ Step 1: Scanning ═══ */}
                {currentStep === 1 && (
                    <motion.div
                        key="scan"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="flex flex-col items-center justify-center py-16 space-y-8"
                    >
                        {/* Animated scanner */}
                        <div className="relative w-32 h-32">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                                className="absolute inset-0 rounded-full border-4 border-dashed border-[#B8925C]/30"
                            />
                            <motion.div
                                animate={{ rotate: -360 }}
                                transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                                className="absolute inset-3 rounded-full border-4 border-dashed border-[#7C5C3F]/20"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <motion.div
                                    animate={{ scale: [1, 1.15, 1] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                >
                                    <Eye className="w-12 h-12 text-[#7C5C3F]" />
                                </motion.div>
                            </div>
                            {/* Scan line */}
                            <motion.div
                                animate={{ y: [0, 100, 0] }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-[#B8925C] to-transparent"
                            />
                        </div>

                        {/* Progress bar */}
                        <div className="w-80 space-y-2">
                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>{scanStage}</span>
                                <span>{scanProgress}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <motion.div
                                    animate={{ width: `${scanProgress}%` }}
                                    className="h-full bg-gradient-to-r from-[#7C5C3F] to-[#B8925C] rounded-full"
                                    transition={{ duration: 0.5 }}
                                />
                            </div>
                        </div>

                        <p className="text-sm text-gray-500 animate-pulse">
                            {t('training.scanning')}
                        </p>
                    </motion.div>
                )}

                {/* ═══ Step 2: Guide AI (Split View) ═══ */}
                {currentStep === 2 && (
                    <motion.div
                        key="guide"
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -40 }}
                        transition={{ duration: 0.4 }}
                        className="flex flex-col h-[80vh] gap-4"
                    >
                        {/* Toolbar / Actions */}
                        <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-4">
                                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <Eye size={18} className="text-[#7C5C3F]" />
                                    Training y Revisión
                                </h3>
                                <div className="h-4 w-px bg-gray-200" />
                                <button
                                    onClick={() => setCreateTemplate(!createTemplate)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${createTemplate ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}
                                >
                                    {createTemplate ? <CheckCircle2 size={14} /> : <div className="w-3.5 h-3.5 border-2 border-gray-400 rounded-sm" />}
                                    Crear Plantilla
                                </button>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setIsAgentOpen(!isAgentOpen)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${isAgentOpen ? 'bg-[#7C5C3F] text-white border-[#7C5C3F]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                                >
                                    <Bot size={16} />
                                    {isAgentOpen ? 'Ocultar Agente' : 'Preguntar al Agente IA'}
                                </button>
                                <button
                                    onClick={handleReset}
                                    className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <RotateCcw size={16} />
                                </button>
                                <button
                                    onClick={handleComplete}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-[#7C5C3F] to-[#B8925C] text-white font-medium rounded-lg shadow-md hover:shadow-lg hover:shadow-[#7C5C3F]/20 disabled:opacity-50 transition-all"
                                >
                                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                    {isSaving ? 'Guardando...' : 'Finalizar Entrenamiento'}
                                </button>
                            </div>
                        </div>

                        {/* Split View Content */}
                        <div className="flex-1 flex gap-4 min-h-0 relative">
                            {/* LEFT: Image Source */}
                            <div className="flex-1 min-w-0 flex flex-col bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-inner relative">
                                <div className="absolute top-0 left-0 right-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200 px-3 py-2 flex justify-between items-center">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Documento Fuente</span>
                                    {file && <span className="text-[10px] text-gray-400">{file.name}</span>}
                                </div>
                                <div className="flex-1 mt-8 relative">
                                    {previewUrl ? (
                                        <ImageAnnotator
                                            imageSrc={previewUrl}
                                            annotations={annotations}
                                            onChange={setAnnotations}
                                            activeColor={activeAnnotationColor}
                                            className="w-full h-full"
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-gray-400">
                                            <p>No hay vista previa disponible</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* RIGHT: Extracted Fields (structured view) */}
                            <div className="flex-1 min-w-0 flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm h-full relative">
                                <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex justify-between items-center shrink-0">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos Extraídos</span>
                                    <span className="text-[10px] text-gray-400">{extractedData?.fields?.length || 0} campos</span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {extractedData?.fields?.map((field, idx) => {
                                        const color = VARIABLE_COLORS[idx % VARIABLE_COLORS.length];
                                        return (
                                            <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color.hex }} />
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{field.label}</span>
                                                    {field.confidence > 0 && (
                                                        <span className="ml-auto text-[10px] text-gray-400">{Math.round(field.confidence * 100)}%</span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-800 font-medium pl-4">{field.value || <span className="text-gray-300 italic">sin valor</span>}</p>
                                            </div>
                                        );
                                    })}

                                    {extractedData?.summary && (
                                        <div className="mt-4 bg-blue-50 rounded-lg p-3 border border-blue-100">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Resumen</span>
                                            <p className="text-xs text-blue-800 mt-1">{extractedData.summary}</p>
                                        </div>
                                    )}
                                </div>

                                {/* AGENT OVERLAY (Absolute over Right Panel or Slide-over) */}
                                <AnimatePresence>
                                    {isAgentOpen && (
                                        <motion.div
                                            initial={{ x: '100%', opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            exit={{ x: '100%', opacity: 0 }}
                                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                            className="absolute inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col"
                                        >
                                            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-[#FAFAFA]">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 bg-gradient-to-br from-[#7C5C3F] to-[#B8925C] rounded-lg flex items-center justify-center">
                                                        <Bot size={16} className="text-white" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-semibold text-gray-800">Asistente de Entrenamiento</h3>
                                                        <p className="text-[10px] text-gray-500">En línea • Contexto activo</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => setIsAgentOpen(false)} className="text-gray-400 hover:text-gray-600">
                                                    <X size={18} />
                                                </button>
                                            </div>

                                            {/* Chat Messages */}
                                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                                                {messages.filter(m => m.role !== 'system').map((msg) => (
                                                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                        <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${msg.role === 'user' ? 'bg-[#7C5C3F] text-white rounded-tr-none' : 'bg-white border border-gray-200 text-gray-700 rounded-tl-none shadow-sm'}`}>
                                                            {msg.content}
                                                        </div>
                                                    </div>
                                                ))}
                                                {isAIThinking && (
                                                    <div className="flex justify-start">
                                                        <div className="bg-white border border-gray-200 px-4 py-3 rounded-xl rounded-tl-none shadow-sm flex gap-1">
                                                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                                                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75" />
                                                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150" />
                                                        </div>
                                                    </div>
                                                )}
                                                <div ref={messagesEndRef} />
                                            </div>

                                            {/* Chat Input */}
                                            <div className="p-4 border-t border-gray-100 bg-white">
                                                <div className="flex gap-2">
                                                    <input
                                                        value={inputMessage}
                                                        onChange={(e) => setInputMessage(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                                        placeholder="Pregunta lo que sea..."
                                                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#B8925C]/20 outline-none"
                                                    />
                                                    <button
                                                        onClick={handleSendMessage}
                                                        disabled={!inputMessage.trim() || isAIThinking}
                                                        className="p-2 bg-[#7C5C3F] text-white rounded-lg hover:bg-[#664D35] disabled:opacity-50"
                                                    >
                                                        <Send size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* VARIABLE COLOR MAPPING PANEL */}
                            {selectedTemplateId !== 'none' && getTemplateVariables().length > 0 && (
                                <div className="w-56 shrink-0 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 px-3 py-2 flex items-center gap-2 shrink-0">
                                        <Palette size={14} className="text-amber-600" />
                                        <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Mapa de Colores</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                                        <p className="text-[9px] text-gray-400 mb-2">Selecciona una variable, luego marca el área en el documento con el resaltador.</p>
                                        {getTemplateVariables().map((v, idx) => {
                                            const color = VARIABLE_COLORS[idx % VARIABLE_COLORS.length];
                                            const isActive = activeColorVariable === v;
                                            return (
                                                <button
                                                    key={v}
                                                    onClick={() => setActiveColorVariable(isActive ? null : v)}
                                                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${isActive ? `${color.bg} ring-1 ring-offset-1` : 'hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <div
                                                        className={`w-3 h-3 rounded-full shrink-0 border ${isActive ? 'ring-2 ring-offset-1' : ''}`}
                                                        style={{ backgroundColor: color.hex }}
                                                    />
                                                    <span className={`truncate ${isActive ? color.text + ' font-semibold' : 'text-gray-600'}`}>{v}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* ═══ Step 3: Complete ═══ */}
                {currentStep === 3 && (
                    <motion.div
                        key="complete"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                        className="flex flex-col items-center justify-center py-16 space-y-6"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.2 }}
                            className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-200"
                        >
                            <CheckCircle2 className="w-12 h-12 text-white" />
                        </motion.div>

                        <motion.h2
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="text-2xl font-bold text-gray-900"
                        >
                            {t('training.complete')}
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="text-gray-500 text-center max-w-md"
                        >
                            {t('training.completeDesc')}
                        </motion.p>

                        {/* Stats */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="flex gap-8 mt-4"
                        >
                            <div className="text-center">
                                <p className="text-3xl font-bold text-[#7C5C3F]">{extractedData?.fields.length || 0}</p>
                                <p className="text-xs text-gray-400">{t('training.fieldsExtracted')}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-3xl font-bold text-[#7C5C3F]">{messages.filter(m => m.role !== 'system').length}</p>
                                <p className="text-xs text-gray-400">{t('training.messagesExchanged')}</p>
                            </div>
                            {createTemplate && (
                                <div className="text-center">
                                    <p className="text-3xl font-bold text-emerald-500">1</p>
                                    <p className="text-xs text-gray-400">{t('training.templateCreated')}</p>
                                </div>
                            )}
                        </motion.div>

                        <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                            onClick={handleReset}
                            className="mt-6 flex items-center gap-2 px-6 py-3 bg-[#7C5C3F] text-white font-medium rounded-xl hover:bg-[#664D35] transition-colors shadow-lg"
                        >
                            <RotateCcw size={16} />
                            {t('training.newSession')}
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
