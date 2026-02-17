import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings2, Play, CheckCircle2, UploadCloud, Loader2, Copy, Download, RotateCcw, FileText, FileType, Brain, FolderPlus, Palette, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { db } from '../../db/schema';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDropzone } from 'react-dropzone';
import {
  loadAISettings,
  scanDocument,
  getProviderMeta,
  type ScanResult,
} from '../../services/ai';
import { pdfBase64ToImage } from '../../services/pdfToImage';
import { ImageAnnotator, type Annotation } from '../ImageAnnotator';
// DocumentEditor used for template-based editing in future versions

// ─── Helpers ───
function loadImage(src: string | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src instanceof File ? URL.createObjectURL(src) : src;
  });
}

function cropImage(img: HTMLImageElement, rect: { x: number, y: number, w: number, h: number }): string {
  const canvas = document.createElement('canvas');
  canvas.width = rect.w;
  canvas.height = rect.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No context');
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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

export function UploadScanPage() {
  // ─── State ───
  const [file, setFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStage, setScanStage] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | string>('none');
  const [outputName, setOutputName] = useState('');

  // Split View State  
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  // Variable-Color mapping
  const [variableColorMap, setVariableColorMap] = useState<Record<string, string>>({});
  const [activeColorVariable, setActiveColorVariable] = useState<string | null>(null);

  // Smart Refinement State
  const [imgDim, setImgDim] = useState({ w: 0, h: 0 });
  const [isRefining, setIsRefining] = useState(false);
  const lastProcessedAnns = useRef<string>('');

  // ─── Automatic Semantic Refinement ───
  useEffect(() => {
    const labeledAnnotations = annotations.filter(a => a.label);
    // Create a signature of the semantic annotations (ID + positions) to detect meaningful changes
    const signature = JSON.stringify(labeledAnnotations.map(a => ({ id: a.id, pts: a.points })));

    if (!file || !result || labeledAnnotations.length === 0) return;
    if (signature === lastProcessedAnns.current) return;

    // Debounce re-scan
    const timer = setTimeout(() => {
      lastProcessedAnns.current = signature;
      handleSmartRefineCrop(labeledAnnotations);
    }, 1500); // 1.5s delay to let user finish drawing

    return () => clearTimeout(timer);
  }, [annotations, file, result]);

  /* 🧠 Smart Refinement: Uses "Cropping Strategy" to force AI focus */
  const handleSmartRefineCrop = async (hints: Annotation[]) => {
    if (!file || !result || !imageSrc) return;
    setIsRefining(true);
    try {
      // Load the PREVIEW image (which handles PDF conversion if needed)
      const img = await loadImage(imageSrc);
      const settings = await loadAISettings();
      const newFields = [...(result.fields || [])];
      let updatedCount = 0;

      // Process each hint in parallel
      await Promise.all(hints.map(async (ann) => {
        if (!ann.label) return;

        // 1. Calculate Crop Rect (Natural Pixels from Annotation)
        let minX = 0, minY = 0, w = 0, h = 0;
        if (ann.points && ann.points.length > 0) {
          const xs = ann.points.map(p => p.x);
          const ys = ann.points.map(p => p.y);
          minX = Math.min(...xs);
          minY = Math.min(...ys);
          w = Math.max(...xs) - minX;
          h = Math.max(...ys) - minY;
        } else if (ann.x !== undefined) {
          minX = ann.x; minY = ann.y || 0; w = ann.w || 0; h = ann.h || 0;
        }

        // Add padding (10%) to context for better OCR
        const padX = w * 0.1;
        const padY = h * 0.1;

        const startX = Math.max(0, minX - padX);
        const startY = Math.max(0, minY - padY);
        const cropW = Math.min(img.naturalWidth - startX, w + padX * 2);
        const cropH = Math.min(img.naturalHeight - startY, h + padY * 2);

        if (cropW <= 0 || cropH <= 0) return;

        // 2. Crop Image
        const cropBase64 = cropImage(img, { x: startX, y: startY, w: cropW, h: cropH });

        // 3. Scan ONLY this snippet
        console.log(`✂️ Scanning crop for variable: ${ann.label}`);
        const cropResult = await scanDocument(
          cropBase64,
          'image/jpeg',
          settings,
          [ann.label], // Target ONLY this variable
          [],
          { strictMode: true }
        );

        // 4. Update Field in Result
        const extractedValue = cropResult.fields?.find(f => f.label === ann.label)?.value;
        if (extractedValue && extractedValue !== '(Vacio)') {
          const existingIdx = newFields.findIndex(f => f.label === ann.label);
          if (existingIdx !== -1) {
            newFields[existingIdx] = { ...newFields[existingIdx], value: extractedValue, confidence: 0.99 };
          } else {
            newFields.push({ label: ann.label, value: extractedValue, confidence: 0.99 });
          }
          updatedCount++;
        }
      }));

      if (updatedCount > 0) {
        console.log(`🧠 Smart Refine: Updated ${updatedCount} fields via cropping`);
        setResult({ ...result, fields: newFields });
      }

    } catch (e) {
      console.error("Smart refinement failed", e);
    } finally {
      setIsRefining(false);
    }
  };

  // handleSmartRefine removed — replaced by handleSmartRefineCrop above
  const [showVariablePanel, setShowVariablePanel] = useState(true);


  const templates = useLiveQuery(() =>
    db.templates.orderBy('createdAt').reverse().toArray()
  ) || [];

  const projects = useLiveQuery(() =>
    db.projects.orderBy('createdAt').reverse().toArray()
  ) || [];

  const [selectedProjectId, setSelectedProjectId] = useState<number | string>('none');

  const handleCreateProject = async () => {
    const name = window.prompt("Nombre del nuevo proyecto:");
    if (!name) return;
    try {
      const id = await db.projects.add({
        name,
        description: '',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      if (id) setSelectedProjectId(id);
    } catch (e) {
      console.error(e);
      alert("Error al crear proyecto");
    }
  };

  const [trainingSelection, setTrainingSelection] = useState<Record<string, boolean>>({});
  const [isTraining, setIsTraining] = useState(false);

  // Get template variables by parsing {{...}} from actual HTML content (SINGLE SOURCE OF TRUTH)
  const getTemplateVariables = (): string[] => {
    if (selectedTemplateId === 'none') return [];
    const tpl = templates.find(t => t.id === Number(selectedTemplateId));
    if (!tpl?.schema) return [];

    // PRIMARY: Parse variables from the actual HTML content
    const htmlContent = tpl.schema.htmlContent as string | undefined;
    if (htmlContent) {
      const matches = htmlContent.match(/\{\{([^}]+)\}\}/g);
      if (matches) {
        const uniqueVars = Array.from(new Set(
          matches.map(m => m.replace(/^\{\{|\}\}$/g, '').trim())
        ));
        return uniqueVars;
      }
    }

    // FALLBACK: Use schema.variables only if no htmlContent exists
    if (Array.isArray(tpl.schema.variables)) {
      return (tpl.schema.variables as string[]).map((v: string) =>
        v.replace(/^[{\s]+|[}\s]+$/g, '').trim()
      );
    }
    return [];
  };

  // Auto-initialize training selection and Smart Rename
  useEffect(() => {
    if (result?.fields) {
      const initial: Record<string, boolean> = {};
      result.fields.forEach(f => initial[f.label] = true);
      setTrainingSelection(initial);

      // Smart Rename
      if (selectedTemplateId !== 'none') {
        const tpl = templates.find(t => t.id === Number(selectedTemplateId));
        if (tpl) {
          const numField = result.fields.find(f =>
            /number|id|folio|factura|order|invoice|consecutivo/i.test(f.label) && f.value.length > 0 && f.value.length < 20
          );
          const suffix = numField ? ` #${numField.value}` : '';
          setOutputName(`${tpl.name}${suffix}`);
        }
      }
    }

    // Editor content is generated on-demand via getMergedContent()
  }, [result, selectedTemplateId, templates]);

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

  const handleSaveAndTrain = async () => {
    if (!result || !file) return;
    setIsTraining(true);
    try {
      const trainingFields = result.fields.filter(f => trainingSelection[f.label]);
      const { saveMemoriesFromScan } = await import('../../services/aiMemory');
      await saveMemoriesFromScan({
        documentName: outputName,
        documentType: file.type,
        fields: trainingFields,
        summary: result.summary,
        rawText: result.rawText
      });

      const btn = document.getElementById('train-btn');
      if (btn) {
        btn.innerText = "¡Guardado!";
        setTimeout(() => {
          if (btn) btn.innerText = "Guardar en Memoria IA";
          setIsTraining(false);
        }, 2000);
      } else {
        setIsTraining(false);
      }
    } catch (e: any) {
      console.error("Save error:", e);
      setIsTraining(false);
      alert(`Error: ${e.message || 'Error desconocido'}`);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (f) {
      setFile(f);
      setResult(null);
      setError(null);
      setOutputName(f.name.replace(/\.[^/.]+$/, ""));
      setAnnotations([]);

      if (f.type === 'application/pdf') {
        try {
          const b64 = await fileToBase64(f);
          const converted = await pdfBase64ToImage(b64);
          setImageSrc(`data:${converted.mimeType};base64,${converted.base64}`);
        } catch (e) {
          console.error("PDF Preview Error", e);
          setImageSrc(null);
        }
      } else {
        setImageSrc(URL.createObjectURL(f));
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
      'application/pdf': ['.pdf'],
    },
    multiple: false,
  });

  const handleProcess = async () => {
    if (!file) return;
    setIsScanning(true);
    setError(null);
    setResult(null);

    try {
      setScanStage('Leyendo documento...');
      setScanProgress(10);

      const settings = await loadAISettings();
      let mimeType = file.type || 'image/jpeg';
      let base64 = await fileToBase64(file);

      if (file.type === 'application/pdf') {
        setScanStage('Renderizando PDF...');
        setScanProgress(20);
        const converted = await pdfBase64ToImage(base64);
        base64 = converted.base64;
        mimeType = converted.mimeType;
      }

      const meta = getProviderMeta(settings.provider);
      setScanStage(`Analizando con ${meta.name}...`);
      setScanProgress(40);

      // Get target variables from selected template (parsed from HTML content)
      let targetVariables: string[] = getTemplateVariables();
      if (targetVariables.length > 0) {
        setScanStage(`Extrayendo ${targetVariables.length} campos de plantilla...`);
      }

      const scanResult = await scanDocument(base64, mimeType, settings, targetVariables, [], { strictMode: !!selectedTemplateId && selectedTemplateId !== 'none' });

      setScanStage('Procesando resultados...');
      setScanProgress(80);

      setResult(scanResult);

      // Save to database
      const now = Date.now();
      await db.documents.add({
        name: outputName || file.name,
        type: file.type.split('/')[1] || 'unknown',
        size: file.size,
        status: 'completed',
        projectId: selectedProjectId !== 'none' ? Number(selectedProjectId) : undefined,
        templateId: selectedTemplateId && selectedTemplateId !== 'none' ? Number(selectedTemplateId) : undefined,
        content: scanResult.rawText,
        metadata: {
          fields: scanResult.fields,
          summary: scanResult.summary,
          visionModel: meta.visionModel || meta.chatModel,
        },
        createdAt: now,
        updatedAt: now,
      });

      await db.activityLogs.add({
        action: 'process',
        entityType: 'document',
        entityName: outputName || file.name,
        details: `Escaneado con ${meta.name}. ${scanResult.fields.length} campos extraídos.`,
        timestamp: now,
      });

      setScanProgress(100);
      setScanStage('¡Completo!');
    } catch (err: any) {
      setError(err.message || 'Error de escaneo. Verifica tu configuración de API.');
      setScanStage('');
    } finally {
      setIsScanning(false);
    }
  };

  const copyResults = () => {
    if (!result) return;
    const text = result.fields.map(f => `${f.label}: ${f.value}`).join('\n');
    navigator.clipboard.writeText(text);
  };

  const downloadResults = () => {
    if (!result) return;
    const data = JSON.stringify(result, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scan-${file?.name || 'result'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getMergedContent = (): { html: string; css: string } => {
    if (!result) return { html: '', css: '' };
    let html = '';
    let css = '';

    // If a template was used, try to use its HTML structure
    if (selectedTemplateId && selectedTemplateId !== 'none') {
      const tpl = templates.find(t => t.id === Number(selectedTemplateId));
      if (tpl && tpl.schema && tpl.schema.htmlContent) {
        let raw = tpl.schema.htmlContent as string;

        // Extract <style> blocks from template HTML
        const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
        let styleMatch;
        while ((styleMatch = styleRegex.exec(raw)) !== null) {
          css += styleMatch[1] + '\n';
        }
        // Remove <style> from body content
        html = raw.replace(styleRegex, '');

        // Replace variables: {{label}} -> value (try multiple formats)
        result.fields.forEach(f => {
          // Original label
          const re1 = new RegExp(`\\{\\{\\s*${f.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`, 'gi');
          html = html.replace(re1, f.value || '');

          // lower_snake_case
          const snakeKey = f.label.toLowerCase().replace(/\s+/g, '_');
          const re2 = new RegExp(`\\{\\{\\s*${snakeKey}\\s*\\}\\}`, 'gi');
          html = html.replace(re2, f.value || '');

          // UPPER_SNAKE_CASE
          const upperKey = f.label.toUpperCase().replace(/\s+/g, '_');
          const re3 = new RegExp(`\\{\\{\\s*${upperKey}\\s*\\}\\}`, 'gi');
          html = html.replace(re3, f.value || '');
        });

        // Clean up any remaining {{variable}} placeholders
        html = html.replace(/\{\{[^}]+\}\}/g, '___');
      }
    }

    // Fallback if no template or no HTML content
    if (!html) {
      html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; background: white;">
          <h1 style="color: #1a1a1a; font-size: 20pt; margin-bottom: 8px; border-bottom: 2px solid #B8925C; padding-bottom: 8px;">${outputName || file?.name || 'Datos Extraídos'}</h1>
          <p style="color: #666; font-size: 10pt; margin-bottom: 24px;">${result.summary || ''}</p>
          <table style="border-collapse: collapse; width: 100%; border: 1px solid #e0e0e0;">
            <thead>
              <tr style="background: #f8f6f3;">
                <th style="text-align: left; padding: 10px 12px; border: 1px solid #e0e0e0; font-size: 10pt; color: #555; text-transform: uppercase; letter-spacing: 0.5px;">Campo</th>
                <th style="text-align: left; padding: 10px 12px; border: 1px solid #e0e0e0; font-size: 10pt; color: #555; text-transform: uppercase; letter-spacing: 0.5px;">Valor</th>
                <th style="text-align: center; padding: 10px 12px; border: 1px solid #e0e0e0; font-size: 10pt; color: #555; text-transform: uppercase; letter-spacing: 0.5px;">Confianza</th>
              </tr>
            </thead>
            <tbody>
              ${result.fields.map(f => `
                <tr>
                  <td style="padding: 8px 12px; border: 1px solid #e0e0e0; font-weight: 600; color: #333;">${f.label}</td>
                  <td style="padding: 8px 12px; border: 1px solid #e0e0e0; color: #1a1a1a;">${f.value || '<em style="color:#999;">vacío</em>'}</td>
                  <td style="padding: 8px 12px; border: 1px solid #e0e0e0; text-align: center; color: ${f.confidence > 0.8 ? '#16a34a' : f.confidence > 0.5 ? '#d97706' : '#dc2626'}; font-weight: 600;">${Math.round(f.confidence * 100)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p style="color: #999; font-size: 8pt; margin-top: 24px; text-align: right;">Generado por DocIA</p>
        </div>
      `;
      css = `
        @page { margin: 0.75in; size: letter; }
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; color: #000; }
      `;
    }

    return { html, css };
  };

  const handleDownloadWord = () => {
    if (!result) return;
    const { html, css } = getMergedContent();
    const fullDoc = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${outputName || file?.name || 'Documento'}</title>
        <style>
          @page { margin: 1in; size: letter; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12pt; line-height: 1.6; color: #000; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          img { max-width: 100%; }
          ${css}
        </style>
      </head>
      <body>${html}</body>
    </html>`;

    const blob = new Blob(['\ufeff', fullDoc], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${outputName || file?.name || 'document'}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
    if (!result) return;
    const { html, css } = getMergedContent();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`<!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>${outputName || file?.name || 'Documento'}</title>
            <style>
              @page { margin: 0.75in; size: letter; }
              body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12pt; line-height: 1.5; color: #000; margin: 0; padding: 0; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
              * { box-sizing: border-box; }
              img { max-width: 100%; }
              ${css}
            </style>
          </head>
          <body>${html}</body>
        </html>`);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  const resetScan = () => {
    setFile(null);
    setImageSrc(null);
    setResult(null);
    setError(null);
    setScanProgress(0);
    setScanStage('');
    setAnnotations([]);
    setOutputName('');
    setVariableColorMap({});
    setActiveColorVariable(null);
  };

  // ─── Color-Variable Mapping Functions ───
  const handleVariableColorSelect = (variableName: string) => {
    if (activeColorVariable === variableName) {
      setActiveColorVariable(null); // Deselect
    } else {
      setActiveColorVariable(variableName);
    }
  };

  // When a variable is active, update the ImageAnnotator's active color
  const activeAnnotationColor = activeColorVariable
    ? (variableColorMap[activeColorVariable] || '#ffff00')
    : '#ffff00';

  // Get template vars for sidebar
  const templateVars = getTemplateVariables();

  return (
    <div className="h-full flex flex-col max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shrink-0 mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900 font-display">
            Document Scanner
          </h1>
          <p className="text-gray-500 mt-0.5 text-xs md:text-sm">
            Sube documentos para extracción inteligente con IA
          </p>
        </div>
        {file && (
          <button
            onClick={resetScan}
            className="flex items-center gap-2 px-4 py-2 text-sm text-stone-600 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors"
          >
            <RotateCcw size={16} />
            Nuevo Escaneo
          </button>
        )}
      </div>

      {/* MAIN CONTENT: 3-column layout when template selected, stacks on mobile */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-3 overflow-y-auto md:overflow-hidden">

        {/* LEFT PANEL: Document Preview / Upload */}
        <div className="min-h-[300px] md:min-h-0 md:flex-1 flex flex-col bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-inner relative min-w-0">
          <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200 px-4 py-2.5 flex justify-between items-center shrink-0 z-10">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Documento Original</span>
            {file && !result && (
              <span className="text-[10px] text-gray-400">{file.name} • {(file.size / 1024).toFixed(0)} KB</span>
            )}
          </div>

          <div className="flex-1 relative overflow-hidden">
            {imageSrc ? (
              <ImageAnnotator
                imageSrc={imageSrc}
                annotations={annotations}
                onChange={setAnnotations}
                activeColor={activeAnnotationColor}
                activeLabel={activeColorVariable || undefined}
                readOnly={isScanning}
                onDimensionsChange={(w, h) => setImgDim({ w, h })}
                className="w-full h-full"
              />
            ) : (
              <div
                {...getRootProps()}
                className={`absolute inset-0 flex flex-col items-center justify-center m-4 rounded-xl border-2 border-dashed transition-all cursor-pointer ${isDragActive
                  ? 'border-[#B8925C] bg-[#B8925C]/5 scale-[1.01]'
                  : 'border-gray-300 hover:border-[#B8925C]/50 hover:bg-[#B8925C]/5'
                  }`}
              >
                <input {...getInputProps()} />
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-16 h-16 bg-gradient-to-br from-[#B8925C]/10 to-[#7C5C3F]/20 rounded-2xl flex items-center justify-center mb-4 shadow-sm"
                >
                  <UploadCloud className="w-8 h-8 text-[#7C5C3F]" />
                </motion.div>
                <p className="text-gray-800 font-semibold text-base">Sube tu documento</p>
                <p className="text-gray-400 text-xs mt-1">Arrastra y suelta PDF o Imagen</p>
                <p className="text-gray-300 text-[10px] mt-3">PNG, JPG, WEBP, PDF</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Configuration OR Results */}
        <div className={`flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm w-full md:shrink-0 ${result ? 'md:w-[480px]' : 'md:w-[380px]'}`}>
          {!result ? (
            /* ═══ CONFIGURATION MODE ═══ */
            <div className="flex flex-col h-full">
              <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center gap-2 text-[#7C5C3F] font-medium shrink-0">
                <Settings2 size={18} />
                <h3>Configuración</h3>
              </div>

              <div className="p-5 space-y-5 flex-1 overflow-y-auto">
                {/* Output Name */}
                {file && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-1"
                  >
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Nombre del Documento
                    </label>
                    <input
                      type="text"
                      value={outputName}
                      onChange={(e) => setOutputName(e.target.value)}
                      className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-700 focus:ring-2 focus:ring-[#B8925C]/20 outline-none transition-all hover:bg-white focus:bg-white"
                      placeholder="Nombre del archivo de salida..."
                    />
                  </motion.div>
                )}

                {/* Project */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex justify-between">
                    Proyecto
                    <button onClick={handleCreateProject} className="text-[#B8925C] hover:text-[#917142] flex items-center gap-1" title="Nuevo Proyecto">
                      <FolderPlus size={12} /> Nuevo
                    </button>
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    disabled={isScanning}
                    className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-700 focus:ring-2 focus:ring-[#B8925C]/20 outline-none transition-all hover:bg-white"
                  >
                    <option value="none">📂 Sin Proyecto (Raíz)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        📁 {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Template */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Plantilla de Extracción</label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    disabled={isScanning}
                    className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-700 focus:ring-2 focus:ring-[#B8925C]/20 outline-none transition-all hover:bg-white"
                  >
                    <option value="none">✨ Auto-detectar todos los campos</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        📄 {t.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-400">
                    Selecciona una plantilla para extraer solo sus campos específicos
                  </p>
                </div>

                {/* Template Variables Preview */}
                {templateVars.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                      <Palette size={12} />
                      Variables de la Plantilla ({templateVars.length})
                    </label>
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-2 space-y-1 max-h-[180px] overflow-y-auto">
                      {templateVars.map((v, i) => {
                        const color = VARIABLE_COLORS[i % VARIABLE_COLORS.length];
                        return (
                          <div
                            key={v}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${activeColorVariable === v ? `${color.bg} ring-1 ring-offset-1` : 'hover:bg-white'
                              }`}
                          >
                            <div
                              className="w-3 h-3 rounded-full shrink-0 border"
                              style={{ backgroundColor: color.hex, borderColor: color.hex }}
                            />
                            <span className="font-medium text-gray-700 truncate">{v}</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-gray-400 leading-relaxed">
                      La IA extraerá <strong>únicamente</strong> estas {templateVars.length} variables
                    </p>
                  </motion.div>
                )}

                {/* AI Provider */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Proveedor IA</label>
                  <div className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-700">
                    Usa el proveedor configurado en <strong>Configuración → IA</strong>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Visión: OpenAI, Gemini, Anthropic, OpenRouter, Mistral, Together, DeepSeek
                  </p>
                </div>

                {/* Start Button */}
                <div className="pt-2">
                  <button
                    onClick={handleProcess}
                    disabled={!file || isScanning}
                    className="w-full bg-gradient-to-r from-[#7C5C3F] to-[#B8925C] text-white font-medium py-3 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isScanning ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        {scanStage}
                      </>
                    ) : (
                      <>
                        <Play size={18} />
                        Iniciar Extracción
                      </>
                    )}
                  </button>
                  {/* Progress Bar */}
                  {isScanning && (
                    <div className="mt-3">
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-[#B8925C] to-[#7C5C3F]"
                          initial={{ width: 0 }}
                          animate={{ width: `${scanProgress}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ═══ RESULTS MODE ═══ */
            <div className="flex flex-col h-full">
              {/* Result Header */}
              <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  {isRefining ? (
                    <div key="refining" className="flex items-center gap-2 text-[#B8925C]">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <h3 className="font-semibold text-sm">Refinando extracción...</h3>
                    </div>
                  ) : (
                    <div key="complete" className="flex items-center gap-2 text-emerald-500">
                      <CheckCircle2 className="w-5 h-5" />
                      <h3 className="font-semibold text-gray-800 text-sm">Extracción Completa</h3>
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={copyResults} className="p-1.5 hover:bg-gray-100 rounded text-gray-500" title="Copiar">
                    <Copy size={14} />
                  </button>
                  <button onClick={downloadResults} className="p-1.5 hover:bg-gray-100 rounded text-gray-500" title="Descargar JSON">
                    <Download size={14} />
                  </button>
                </div>
              </div>

              {/* Output Name & Export */}
              <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-100 space-y-2 shrink-0">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                  <Download size={10} /> Guardar Documento Como...
                </label>
                <input
                  type="text"
                  value={outputName}
                  onChange={(e) => setOutputName(e.target.value)}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#B8925C]/20 focus:border-[#B8925C]/40 transition-all bg-white"
                  placeholder="Nombre del archivo..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadWord}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-[#2b579a] text-white rounded hover:bg-[#204580] transition-colors shadow-sm font-medium text-xs"
                  >
                    <FileText size={14} /> Word
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-[#b30b00] text-white rounded hover:bg-[#8f0900] transition-colors shadow-sm font-medium text-xs"
                  >
                    <FileType size={14} /> PDF
                  </button>
                </div>
              </div>

              {/* Summary */}
              <div className="px-4 py-2 bg-amber-50/30 border-b border-gray-100 shrink-0">
                <p className="text-[11px] text-stone-600 line-clamp-2">{result.summary}</p>
              </div>

              {/* Extracted Fields - scrollable */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                      Campos Extraídos ({result.fields.length})
                    </p>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                    {result.fields.map((field, idx) => {
                      const colorInfo = variableColorMap[field.label]
                        ? VARIABLE_COLORS.find(c => c.hex === variableColorMap[field.label])
                        : null;
                      return (
                        <div key={field.label || idx} className="p-2.5 hover:bg-gray-50 transition-colors group">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                              {colorInfo && (
                                <div
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: colorInfo.hex }}
                                />
                              )}
                              <span>{field.label}</span>
                            </label>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${field.confidence > 0.8 ? 'bg-emerald-100 text-emerald-700' :
                              field.confidence > 0.5 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                              }`}>
                              {Math.round(field.confidence * 100)}%
                            </span>
                          </div>
                          <input
                            type="text"
                            value={field.value}
                            onChange={(e) => {
                              if (!result) return;
                              const newFields = [...result.fields];
                              newFields[idx] = { ...field, value: e.target.value, confidence: 1 };
                              setResult({ ...result, fields: newFields });
                            }}
                            className="w-full text-sm font-medium text-gray-900 bg-transparent border-0 border-b border-dashed border-gray-200 hover:border-gray-300 focus:border-[#B8925C] focus:ring-0 px-0 py-1 transition-all"
                            placeholder="(Vacío)"
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Train Action */}
                  <div className="pt-1">
                    <button
                      id="train-btn"
                      onClick={handleSaveAndTrain}
                      disabled={isTraining}
                      className="w-full py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {isTraining ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
                      Confirmar y Entrenar IA
                    </button>
                    <p className="text-[9px] text-gray-400 mt-1.5 text-center">
                      Los campos se guardarán en la memoria IA para mejorar futuras extracciones.
                    </p>
                  </div>
                </div>
              </div>

              {/* Raw Text */}
              {result.rawText && (
                <div className="border-t border-gray-100 p-3 shrink-0">
                  <details className="group">
                    <summary className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 transition-colors">
                      Texto Crudo Extraído
                    </summary>
                    <pre className="mt-2 text-[10px] text-gray-600 bg-gray-50 p-2 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-[150px] overflow-y-auto border border-gray-100">
                      {result.rawText}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          )}
        </div>

        {/* VARIABLE COLOR PANEL (only when template selected & file uploaded) */}
        {templateVars.length > 0 && file && imageSrc && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-[200px] shrink-0 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col"
          >
            <div className="bg-gray-50 border-b border-gray-200 px-3 py-2.5 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Palette size={12} /> Mapa de Colores
              </span>
              <button
                onClick={() => setShowVariablePanel(!showVariablePanel)}
                className="p-1 hover:bg-gray-200 rounded text-gray-400"
              >
                {showVariablePanel ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>
            {showVariablePanel && (
              <div className="flex-1 p-2 space-y-1 overflow-y-auto">
                <p className="text-[9px] text-gray-400 px-1 mb-2 leading-relaxed">
                  Selecciona una variable, luego marca el área en el documento con el resaltador
                </p>
                {templateVars.map((v, i) => {
                  const color = VARIABLE_COLORS[i % VARIABLE_COLORS.length];
                  const isActive = activeColorVariable === v;
                  return (
                    <button
                      key={v}
                      onClick={() => handleVariableColorSelect(v)}
                      className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-[11px] font-medium transition-all text-left ${isActive
                        ? `${color.bg} ${color.border} border-2 shadow-sm`
                        : 'hover:bg-gray-50 border border-transparent'
                        }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-md shrink-0 flex items-center justify-center ${isActive ? 'ring-2 ring-offset-1' : ''}`}
                        style={{
                          backgroundColor: color.hex
                        }}
                      >
                        {isActive && (
                          <Eye size={10} className="text-white" />
                        )}
                      </div>
                      <span className={`truncate ${isActive ? color.text : 'text-gray-600'}`}>{v}</span>
                    </button>
                  );
                })}

                {activeColorVariable && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-3 p-2 bg-amber-50 rounded-lg border border-amber-200"
                  >
                    <p className="text-[9px] text-amber-700 font-medium">
                      ✏️ Activo: <strong>{activeColorVariable}</strong>
                    </p>
                    <p className="text-[9px] text-amber-600 mt-0.5">
                      Usa el resaltador en el documento para marcar esta variable
                    </p>
                    <button
                      onClick={() => setActiveColorVariable(null)}
                      className="mt-1.5 text-[9px] text-amber-600 hover:text-amber-800 underline"
                    >
                      Deseleccionar
                    </button>
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700"
          >
            <p className="font-medium mb-1">⚠️ Error de Escaneo</p>
            <p className="text-xs">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}