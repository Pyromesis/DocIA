import React, { useRef, useState, useEffect } from 'react';
import { Bold, Italic, Underline, Highlighter, MessageSquarePlus, X, Save, Eraser } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';

interface DocumentEditorProps {
    initialContent: string;
    onChange: (content: string) => void;
    placeholder?: string;
    readOnly?: boolean;
    className?: string;
    style?: React.CSSProperties;
    hideToolbar?: boolean;
    editorClassName?: string;
    editorStyle?: React.CSSProperties;
    onSelectionChange?: () => void;
}

// Export a ref type for external control if needed
export interface DocumentEditorHandle {
    focus: () => void;
    execCommand: (command: string, value?: string) => void;
    insertInstruction: () => void;
    setContent: (content: string) => void;
    scrollToText: (text: string) => void;
}

export const DocumentEditor = React.forwardRef<DocumentEditorHandle, DocumentEditorProps>(({
    initialContent,
    onChange,
    placeholder = "Type or paste your document here...",
    readOnly = false,
    className = "",
    style = {},
    hideToolbar = false,
    editorClassName = "",
    editorStyle = {},
    onSelectionChange
}, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [showInstructionInput, setShowInstructionInput] = useState<{ x: number, y: number, text: string } | null>(null);
    const [currentInstruction, setCurrentInstruction] = useState("");
    const [selectionRange, setSelectionRange] = useState<Range | null>(null);

    // Initial load
    useEffect(() => {
        if (editorRef.current && initialContent && !editorRef.current.innerHTML) {
            // Detect if content is already HTML (has tags) vs plain text
            const isHTML = /<\w+[\s>]/.test(initialContent);
            const processed = isHTML
                ? initialContent  // Already HTML — don't add <br/> inside tags
                : initialContent.replace(/\n/g, '<br/>');  // Plain text — convert newlines
            // Allow style attributes so inline CSS from templates is preserved
            editorRef.current.innerHTML = DOMPurify.sanitize(processed, {
                ADD_ATTR: ['style'],
                ADD_TAGS: ['span'],
            });
        }
    }, [initialContent]);

    const handleInput = () => {
        if (editorRef.current) {
            // We want to pass back full HTML to preserve highlights and instructions
            const content = editorRef.current.innerHTML;
            onChange(content);
        }
    };

    const handleSelectionChange = () => {
        if (onSelectionChange) {
            onSelectionChange();
        }
    };

    const handleHighlight = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

        const range = selection.getRangeAt(0);
        const text = selection.toString();

        // Calculate position for input popup
        const rect = range.getBoundingClientRect();

        setSelectionRange(range); // Save range
        setShowInstructionInput({
            x: rect.left + rect.width / 2,
            y: rect.top - 10,
            text
        });
    };

    const saveInstruction = () => {
        if (!selectionRange || !showInstructionInput) return;

        const span = document.createElement('span');
        span.className = 'ai-highlight-instruction bg-yellow-200/50 border-b-2 border-yellow-400 cursor-help relative group';
        span.setAttribute('data-instruction', currentInstruction);
        span.title = `Instruction: ${currentInstruction}`;

        // Extract content
        span.appendChild(selectionRange.extractContents());
        selectionRange.insertNode(span);

        // Clear selection
        window.getSelection()?.removeAllRanges();

        // Reset state
        setShowInstructionInput(null);
        setCurrentInstruction("");
        setSelectionRange(null);

        handleInput(); // Trigger change
    };

    // Expose methods via ref
    React.useImperativeHandle(ref, () => ({
        focus: () => editorRef.current?.focus(),
        execCommand: (cmd, val) => {
            document.execCommand(cmd, false, val);
            editorRef.current?.focus();
            handleInput();
            handleSelectionChange();
        },
        insertInstruction: handleHighlight,
        setContent: (content: string) => {
            if (editorRef.current) {
                editorRef.current.innerHTML = DOMPurify.sanitize(content, {
                    ADD_ATTR: ['style'],
                    ADD_TAGS: ['span'],
                });
                handleInput();
            }
        },
        scrollToText: (text: string) => {
            if (!editorRef.current) return;

            // Basic text search using window.find (simple but works for exact matches)
            // Or traverse the DOM. Let's start with a recursive search for text nodes.
            const findTextNode = (node: Node, target: string): Node | null => {
                if (node.nodeType === Node.TEXT_NODE && node.textContent?.includes(target)) {
                    return node;
                }
                for (let i = 0; i < node.childNodes.length; i++) {
                    const found = findTextNode(node.childNodes[i], target);
                    if (found) return found;
                }
                return null;
            };

            const textNode = findTextNode(editorRef.current, text);
            if (textNode && textNode.parentElement) {
                textNode.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Also highlight briefly
                const originalBg = textNode.parentElement.style.backgroundColor;
                textNode.parentElement.style.backgroundColor = '#93c5fd'; // blue-300 (not yellow — reserved for AI instructions)
                setTimeout(() => {
                    if (textNode.parentElement) {
                        textNode.parentElement.style.backgroundColor = originalBg;
                    }
                }, 1500);
            }
        }
    }));

    const cancelInstruction = () => {
        setShowInstructionInput(null);
        setCurrentInstruction("");
        setSelectionRange(null);
    };

    // Toolbar actions (simple execCommand for standard format, custom for highlight)
    const format = (command: string) => {
        document.execCommand(command, false);
        editorRef.current?.focus();
        handleSelectionChange();
    };

    return (
        <div className={`flex flex-col h-full border border-stone-200 rounded-sm bg-white shadow-sm overflow-hidden relative ${className}`} style={style}>
            {/* Toolbar - Only show if not hidden */}
            {!readOnly && !hideToolbar && (
                <div className="flex items-center gap-1 p-2 bg-stone-50 border-b border-stone-100">
                    <button onClick={() => format('bold')} className="p-1.5 hover:bg-stone-200 rounded text-stone-600" title="Bold"><Bold size={16} /></button>
                    <button onClick={() => format('italic')} className="p-1.5 hover:bg-stone-200 rounded text-stone-600" title="Italic"><Italic size={16} /></button>
                    <button onClick={() => format('underline')} className="p-1.5 hover:bg-stone-200 rounded text-stone-600" title="Underline"><Underline size={16} /></button>
                    <div className="w-px h-4 bg-stone-300 mx-1" />
                    <button
                        onClick={handleHighlight}
                        className="p-1.5 hover:bg-yellow-100 text-yellow-600 rounded flex items-center gap-1.5"
                        title="Highlight & Instruct AI"
                    >
                        <Highlighter size={16} />
                        <span className="text-xs font-medium">Highlight Instruction</span>
                    </button>
                    <button
                        onClick={() => format('removeFormat')}
                        className="ml-auto p-1.5 hover:bg-stone-200 rounded text-stone-500"
                        title="Clear Formatting"
                    >
                        <Eraser size={16} />
                    </button>
                </div>
            )}

            {/* Editable Area */}
            <div
                ref={editorRef}
                contentEditable={!readOnly}
                onInput={handleInput}
                onMouseUp={handleSelectionChange}
                onKeyUp={handleSelectionChange}
                className={`flex-1 p-8 md:p-12 outline-none overflow-y-auto font-serif text-lg leading-relaxed text-stone-800 ${editorClassName}`}
                style={{
                    minHeight: '100%',
                    ...(!hideToolbar ? { minHeight: '500px' } : {}),
                    ...editorStyle
                }}
                suppressContentEditableWarning
                data-placeholder={placeholder}
            />

            {/* Instruction Popover */}
            <AnimatePresence>
                {showInstructionInput && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="fixed z-50 bg-white rounded-xl shadow-xl border border-[#B8925C]/20 p-3 w-72"
                        style={{
                            left: showInstructionInput.x,
                            top: showInstructionInput.y - 120, // Position above
                            transform: 'translateX(-50%)'
                        }}
                    >
                        <div className="flex items-start justify-between mb-2">
                            <span className="text-xs font-semibold text-[#B8925C] flex items-center gap-1">
                                <MessageSquarePlus size={12} />
                                Add Instruction
                            </span>
                            <button onClick={cancelInstruction} className="text-stone-400 hover:text-stone-600">
                                <X size={12} />
                            </button>
                        </div>
                        <p className="text-[10px] text-stone-500 mb-2 italic border-l-2 border-stone-200 pl-2 line-clamp-2">
                            "{showInstructionInput.text}"
                        </p>
                        <textarea
                            value={currentInstruction}
                            onChange={(e) => setCurrentInstruction(e.target.value)}
                            placeholder="Example: Keep this exact formatting..."
                            className="w-full text-xs p-2 bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-[#B8925C] mb-2 resize-none h-16"
                            autoFocus
                        />
                        <button
                            onClick={saveInstruction}
                            disabled={!currentInstruction.trim()}
                            className="w-full py-1.5 bg-[#B8925C] text-white text-xs font-medium rounded-lg hover:bg-[#9a7848] flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                            <Save size={12} />
                            Save Instruction
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Styles for contentEditable placeholder behavior */}
            <style>{`
                [contenteditable]:empty:before {
                    content: attr(data-placeholder);
                    color: #a8a29e;
                    pointer-events: none;
                    display: block; /* For Firefox */
                }
            `}</style>
        </div>
    );
});
