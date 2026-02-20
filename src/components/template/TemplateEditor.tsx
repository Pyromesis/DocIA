import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Save, Download, Printer, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, List, Undo, Redo, Sparkles, Loader2, Highlighter } from 'lucide-react';
import type { FormalTemplate } from '../../data/formalTemplates';
import { db } from '../../db/schema';
import { loadAISettings, callChat } from '../../services/ai';
import { DocumentEditor, DocumentEditorHandle } from '../DocumentEditor';

interface TemplateEditorProps {
  template: FormalTemplate;
  onBack: () => void;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ template, onBack }) => {
  const editorRef = useRef<DocumentEditorHandle>(null);
  const [content, setContent] = useState(template.content || '');
  const [isSaved, setIsSaved] = useState(false);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [showAIPrompt, setShowAIPrompt] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [hasPendingInstructions, setHasPendingInstructions] = useState(false);
  const [extractedVariables, setExtractedVariables] = useState<string[]>([]);
  const [variableDescriptions, setVariableDescriptions] = useState<Record<string, string>>({});
  const [expandedVarIdx, setExpandedVarIdx] = useState<number | null>(null);

  // Check for instructions and variables whenever content changes
  React.useEffect(() => {
    // Instructions
    if (content.includes('data-instruction="')) {
      setHasPendingInstructions(true);
    } else {
      setHasPendingInstructions(false);
    }

    // Variables ({{variable_name}})
    const matches = content.match(/\{\{([^}]+)\}\}/g);
    if (matches) {
      // Unique variables
      setExtractedVariables(Array.from(new Set(matches)));
    } else {
      setExtractedVariables([]);
    }
  }, [content]);

  const execCommand = (command: string, value?: string) => {
    editorRef.current?.execCommand(command, value);
    updateActiveFormats();
  };

  const updateActiveFormats = () => {
    const formats = new Set<string>();
    if (document.queryCommandState('bold')) formats.add('bold');
    if (document.queryCommandState('italic')) formats.add('italic');
    if (document.queryCommandState('underline')) formats.add('underline');
    if (document.queryCommandState('justifyLeft')) formats.add('justifyLeft');
    if (document.queryCommandState('justifyCenter')) formats.add('justifyCenter');
    if (document.queryCommandState('justifyRight')) formats.add('justifyRight');
    setActiveFormats(formats);
  };

  const handleAIImprove = async () => {
    if (!aiInstruction.trim()) return;

    setIsAIThinking(true);
    try {
      const currentHTML = content;
      const settings = await loadAISettings();

      const messages = [
        {
          role: 'system',
          content: `You are an expert HTML email/document template designer. 
Your task is to IMPROVE or MODIFY the user's HTML template based on their instruction.
IMPORTANT rules:
1. Return ONLY the full, valid HTML content for the body (inside the editor). Do not include <html>, <head>, or <body> tags.
2. Maintain existing variables (like {{name}}) unless asked to change them.
3. Use inline CSS styles for specific formatting requests.
4. Do not add markdown code blocks (no \`\`\`html). just raw HTML.`,
        },
        {
          role: 'user',
          content: `Current HTML Content:
${currentHTML}

Instruction: ${aiInstruction}

Rewrite the HTML to satisfy the instruction.`,
        },
      ];

      const response = await callChat(messages, settings);

      // Clean response
      const cleanHTML = response.replace(/```html/g, '').replace(/```/g, '').trim();

      if (editorRef.current) {
        editorRef.current.setContent(cleanHTML);
      }

      setShowAIPrompt(false);
      setAiInstruction('');
      // setHasPendingInstructions(false) will happen automatically via useEffect

      // Flash success
      const btn = document.getElementById('ai-btn');
      if (btn) {
        btn.classList.add('bg-green-100');
        setTimeout(() => btn.classList.remove('bg-green-100'), 1000);
      }

    } catch (err: any) {
      alert(`AI Error: ${err.message}`);
    } finally {
      setIsAIThinking(false);
    }
  };

  const handleApplyInstructions = async () => {
    if (!hasPendingInstructions) return;

    setIsAIThinking(true);
    try {
      const currentHTML = content;
      const settings = await loadAISettings();

      const messages = [
        {
          role: 'system',
          content: `You are an expert HTML document editor.
Your task is to process specific INSTRUCTIONS embedded in the HTML content.
The user has highlighted text and attached instructions using <span class="ai-highlight-instruction..." data-instruction="...">TAGS</span>.

RULES:
1. Scan the HTML for <span ... data-instruction="..."> elements.
2. For each instruction found, modify the text/content INSIDE that span (and potentially surrounding text if context requires) according to the value of the 'data-instruction' attribute.
3. After applying the change, REMOVE the instruction <span> wrapper (flatten it back to normal text/html) so the highlight disappears.
4. Return ONLY the fully updated, valid HTML body content. Do not include <html> or <body> tags.
5. Preserve all other formatting and variables {{...}} exactly as they are.`,
        },
        {
          role: 'user',
          content: `Here is the HTML content with embedded instructions:
\n${currentHTML}\n
Please apply all instructions and return the clean HTML.`,
        },
      ];

      const response = await callChat(messages, settings);

      // Clean response
      const cleanHTML = response.replace(/```html/g, '').replace(/```/g, '').trim();

      if (editorRef.current) {
        editorRef.current.setContent(cleanHTML);
      }

      // Flash success
      const btn = document.getElementById('apply-btn');
      if (btn) {
        btn.classList.add('bg-green-100', 'text-green-700', 'border-green-200');
        setTimeout(() => btn.classList.remove('bg-green-100', 'text-green-700', 'border-green-200'), 1000);
      }

    } catch (err: any) {
      alert(`AI Error: ${err.message}`);
    } finally {
      setIsAIThinking(false);
    }
  };

  const handleSave = async () => {
    // Content is already up to date via state
    const now = Date.now();

    // Check if this is a user-created template (from training)
    const isUserTemplate = template.id.startsWith('user-');
    const dbId = isUserTemplate ? parseInt(template.id.replace('user-', ''), 10) : null;

    if (isUserTemplate && dbId) {
      // Update existing template
      await db.templates.update(dbId, {
        schema: { variables: template.variables, htmlContent: content, fields: [] },
        updatedAt: now,
      });

      await db.activityLogs.add({
        action: 'template_update',
        entityType: 'template',
        entityName: template.name,
        details: `Template "${template.name}" updated`,
        timestamp: now,
      });
    } else {
      // Create new template
      await db.templates.add({
        name: template.name,
        description: template.description,
        schema: { variables: template.variables, htmlContent: content },
        outputFormat: 'pdf',
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });

      await db.activityLogs.add({
        action: 'template_create',
        entityType: 'template',
        entityName: template.name,
        details: `Template saved from "${template.name}" formal template`,
        timestamp: now,
      });
    }

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // ... (handlePrint, handleDownloadHTML, toolbarBtn remain the same) ...
  const handlePrint = () => {
    // Content is already in state
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${template.name} — DocIA</title>
          <style>
            @page { margin: 1in; size: letter; }
            body { font-family: 'Times New Roman', serif; font-size: 14px; line-height: 1.8; color: #000; }
            * { box-sizing: border-box; }
          </style>
        </head>
        <body>${content}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownloadHTML = () => {
    // Content is already in state
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${template.name}</title>
<style>
  @page { margin: 1in; size: letter; }
  body { font-family: 'Times New Roman', serif; font-size: 14px; line-height: 1.8; color: #000; max-width: 800px; margin: 0 auto; padding: 40px; }
</style>
</head>
<body>${content}</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name.replace(/\s+/g, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toolbarBtn = (command: string, icon: React.ReactNode, title: string) => {
    const isActive = activeFormats.has(command);
    return (
      <button
        onMouseDown={(e) => { e.preventDefault(); execCommand(command); }}
        className={`p-1.5 rounded transition-colors ${isActive ? 'bg-tan-100 text-tan-700' : 'hover:bg-gray-100 text-gray-600'}`}
        title={title}
      >
        {icon}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#e8e5e1] flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-gray-300 flex items-center justify-between px-6 bg-white shadow-sm shrink-0 relative">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">{template.name}</h2>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{template.category} • {template.format}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Apply Instructions Button (Only visible if instructions exist) */}
          <AnimatePresence>
            {hasPendingInstructions && (
              <motion.button
                id="apply-btn"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={handleApplyInstructions}
                disabled={isAIThinking}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-yellow-100 text-yellow-800 border border-yellow-200 hover:bg-yellow-200 transition-colors shadow-sm ring-2 ring-yellow-500/20"
              >
                {isAIThinking ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Apply Instructions
              </motion.button>
            )}
          </AnimatePresence>

          {/* AI Assistant Button */}
          <div className="relative">
            <button
              id="ai-btn"
              onClick={() => setShowAIPrompt(!showAIPrompt)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all border border-[#B8925C]/30
               ${showAIPrompt ? 'bg-[#ffedcf] text-[#7C5C3F]' : 'bg-white text-[#7C5C3F] hover:bg-[#fff9f0]'}`}
            >
              <Sparkles size={14} className={isAIThinking ? 'animate-pulse' : ''} />
              {isAIThinking ? 'Thinking...' : 'Improve with AI'}
            </button>

            {/* AI Prompt Popover */}
            {showAIPrompt && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">How should AI change this?</h3>
                <textarea
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                  placeholder='e.g., "Add a signature line at the bottom", "Make the title bigger", "Changing formatting to blue"'
                  className="w-full text-sm p-3 border border-gray-200 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-[#B8925C]/20 min-h-[80px]"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowAIPrompt(false)}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAIImprove}
                    disabled={!aiInstruction.trim() || isAIThinking}
                    className="px-3 py-1.5 text-xs bg-[#7C5C3F] text-white rounded-lg hover:bg-[#664D35] disabled:opacity-50 flex items-center gap-2"
                  >
                    {isAIThinking && <Loader2 size={12} className="animate-spin" />}
                    Apply Changes
                  </button>
                </div>
              </div>
            )}
            {/* Backdrop for popover */}
            {showAIPrompt && (
              <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowAIPrompt(false)} />
            )}
          </div>

          <div className="w-px h-6 bg-gray-200 mx-1"></div>

          <button onClick={handleDownloadHTML} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Download HTML">
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
          <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Print / Export PDF">
            <Printer className="w-3.5 h-3.5" />
            Print / PDF
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#7C5C3F] hover:bg-[#664D35] text-white rounded-lg transition-colors text-xs font-medium shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaved ? '✓ Saved!' : 'Save Template'}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="h-10 border-b border-gray-300 flex items-center gap-1 px-6 bg-white shrink-0">
        {toolbarBtn('bold', <Bold size={16} />, 'Bold')}
        {toolbarBtn('italic', <Italic size={16} />, 'Italic')}
        {toolbarBtn('underline', <Underline size={16} />, 'Underline')}

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {toolbarBtn('justifyLeft', <AlignLeft size={16} />, 'Align Left')}
        {toolbarBtn('justifyCenter', <AlignCenter size={16} />, 'Align Center')}
        {toolbarBtn('justifyRight', <AlignRight size={16} />, 'Align Right')}

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {toolbarBtn('insertUnorderedList', <List size={16} />, 'Bullet List')}

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <button
          onMouseDown={(e) => { e.preventDefault(); execCommand('undo'); }}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors"
          title="Undo"
        >
          <Undo size={16} />
        </button>
        <button
          onMouseDown={(e) => { e.preventDefault(); execCommand('redo'); }}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors"
          title="Redo"
        >
          <Redo size={16} />
        </button>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <div className="relative group">
          <button
            onClick={() => editorRef.current?.insertInstruction()}
            className="p-1.5 rounded hover:bg-yellow-100 text-yellow-600 transition-colors flex items-center gap-1.5"
            title="Select text → click here → write instructions for the AI on how to modify that part"
          >
            <Highlighter size={16} />
            <span className="text-xs font-medium">Mark AI</span>
          </button>
          {/* Tooltip on hover */}
          <div className="absolute hidden group-hover:block top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-50 pointer-events-none">
            <p className="font-semibold mb-1">📝 AI Instructions</p>
            <ol className="space-y-1 list-decimal list-inside text-gray-300">
              <li>Select the text you want to change</li>
              <li>Click this button</li>
              <li>Write what the AI should do with that part</li>
              <li>Use "Improve with AI" to apply the changes</li>
            </ol>
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
          </div>
        </div>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <select
          onChange={(e) => execCommand('fontSize', e.target.value)}
          className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-600 outline-none"
          defaultValue="3"
        >
          <option value="1">Small</option>
          <option value="2">Normal-</option>
          <option value="3">Normal</option>
          <option value="4">Medium</option>
          <option value="5">Large</option>
          <option value="6">X-Large</option>
        </select>

        <select
          onChange={(e) => execCommand('fontName', e.target.value)}
          className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-600 outline-none"
          defaultValue="Times New Roman"
        >
          <option value="Times New Roman">Times New Roman</option>
          <option value="Arial">Arial</option>
          <option value="Helvetica">Helvetica</option>
          <option value="Georgia">Georgia</option>
          <option value="Verdana">Verdana</option>
          <option value="Courier New">Courier New</option>
        </select>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Main Editor Area */}
        <div className="flex-1 overflow-auto flex justify-center py-8 px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative"
            style={{
              width: '8.5in',
              minHeight: '11in',
              background: 'white',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
              borderRadius: '2px',
            }}
          >
            {/* Page padding area */}
            <DocumentEditor
              ref={editorRef}
              initialContent={template.content || ''}
              onChange={setContent}
              onSelectionChange={updateActiveFormats}
              hideToolbar={true}
              editorClassName="outline-none"
              editorStyle={{
                padding: '1in',
                minHeight: '11in',
                fontSize: '14px',
                lineHeight: '1.8',
                fontFamily: "'Times New Roman', serif",
                color: '#1a1a1a',
              }}
            />
          </motion.div>
        </div>

        {/* Variables Sidebar */}
        <div className="w-64 bg-stone-50 border-l border-stone-200 p-4 overflow-y-auto hidden md:block">
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="bg-stone-200 px-1.5 py-0.5 rounded text-stone-600 font-bold">{extractedVariables.length}</span>
            Variables Found
          </h3>

          <div className="space-y-2">
            {extractedVariables.length === 0 ? (
              <p className="text-xs text-stone-400 italic">No variables found in this template. Add variables like {'{{name}}'}.</p>
            ) : (
              extractedVariables.map((variable, idx) => (
                <div
                  key={`${variable}-${idx}`}
                  className="rounded-lg bg-white border border-stone-200 hover:border-[#B8925C] hover:shadow-sm transition-all group overflow-hidden"
                >
                  <button
                    onClick={() => editorRef.current?.scrollToText(variable)}
                    className="w-full text-left p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#B8925C]"></div>
                      <code className="text-[11px] font-medium text-stone-700 bg-stone-100 px-1 py-0.5 rounded font-mono group-hover:bg-[#B8925C]/10 group-hover:text-[#7C5C3F] truncate flex-1 block">
                        {variable}
                      </code>
                    </div>
                  </button>
                  <div className="px-2.5 pb-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedVarIdx(expandedVarIdx === idx ? null : idx); }}
                      className="text-[10px] text-stone-400 hover:text-[#B8925C] transition-colors"
                    >
                      {expandedVarIdx === idx ? '▾ Hide description' : '▸ Add description'}
                    </button>
                    {expandedVarIdx === idx && (
                      <input
                        type="text"
                        value={variableDescriptions[variable] || ''}
                        onChange={(e) => setVariableDescriptions(prev => ({ ...prev, [variable]: e.target.value }))}
                        placeholder="e.g. Client full name"
                        className="w-full mt-1 text-[10px] px-2 py-1.5 bg-stone-50 border border-stone-200 rounded-md outline-none focus:border-[#B8925C] focus:ring-1 focus:ring-[#B8925C]/20"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-8 pt-4 border-t border-stone-200">
            <h4 className="text-xs font-medium text-stone-500 mb-2">Tips</h4>
            <ul className="text-[10px] text-stone-400 space-y-1.5 list-disc pl-3">
              <li>Click a variable to jump to it</li>
              <li>Variables are auto-detected</li>
              <li>Format: {'{{variable_name}}'}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Save notification */}
      {isSaved && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-sage-600 text-white px-6 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2"
        >
          ✓ Template saved to your library
        </motion.div>
      )}
    </div>
  );
};
