import React, { useState, useRef } from 'react';
import { ZoomIn, ZoomOut, Maximize, Undo2, Trash2 } from 'lucide-react';

export type AnnotationType = 'box' | 'freehand' | 'highlight';

export interface Annotation {
    id: string;
    type: AnnotationType;
    color: string;
    points?: { x: number; y: number }[]; // For freehand/highlight
    x?: number; // For box
    y?: number;
    w?: number;
    h?: number;
    label?: string;
    strokeWidth?: number;
}

interface ImageAnnotatorProps {
    imageSrc: string;
    annotations: Annotation[];
    onChange: (annotations: Annotation[]) => void;
    activeColor?: string;
    activeLabel?: string;
    readOnly?: boolean;
    className?: string;
    onDimensionsChange?: (w: number, h: number) => void;
}

export function ImageAnnotator({
    imageSrc,
    annotations,
    onChange,
    activeColor = '#ffff00', // Default yellow
    activeLabel,
    readOnly = false,
    className = '',
    onDimensionsChange
}: ImageAnnotatorProps) {
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentShape, setCurrentShape] = useState<Annotation | null>(null);
    const [strokeScale, setStrokeScale] = useState(1); // Muliplier for thickness
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const [imgDim, setImgDim] = useState({ w: 0, h: 0 });

    // Load image dimensions
    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        setImgDim({ w: naturalWidth, h: naturalHeight });
        if (onDimensionsChange) onDimensionsChange(naturalWidth, naturalHeight);
    };

    // Coordinate conversion: Screen -> Image Space (Robust to scaling & natural resolution)
    const getRelPos = (e: React.MouseEvent) => {
        if (!imageRef.current || imgDim.w === 0 || imgDim.h === 0) return { x: 0, y: 0 };
        const rect = imageRef.current.getBoundingClientRect();

        // Map screen position (relative to bounding box) to natural image coordinates
        const naturalW = imgDim.w || rect.width;
        const naturalH = imgDim.h || rect.height;

        return {
            x: ((e.clientX - rect.left) / rect.width) * naturalW,
            y: ((e.clientY - rect.top) / rect.height) * naturalH
        };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (readOnly) return;

        const pos = getRelPos(e);
        setIsDrawing(true);

        // Calculate stroke width based on image size and user setting
        const baseStroke = (imgDim.w || 800) / 60; // Base: ~1.6% of width
        const actualStroke = Math.max(5, baseStroke * strokeScale);

        const newId = Date.now().toString();
        setCurrentShape({
            id: newId,
            type: 'highlight',
            color: activeColor,
            points: [pos],
            strokeWidth: actualStroke,
            label: activeLabel
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDrawing || !currentShape) return;
        const pos = getRelPos(e);

        setCurrentShape(prev => prev ? ({
            ...prev,
            points: [...(prev.points || []), pos]
        }) : null);
    };

    const handleMouseUp = () => {
        if (isDrawing && currentShape) {
            if ((currentShape.points?.length || 0) > 2) {
                onChange([...annotations, currentShape]);
            }
        }
        setIsDrawing(false);
        setCurrentShape(null);
    };

    // Actions
    const handleUndo = () => {
        if (annotations.length > 0) {
            onChange(annotations.slice(0, -1));
        }
    };

    const handleClear = () => {
        if (annotations.length > 0 && confirm('¿Borrar todas las anotaciones?')) {
            onChange([]);
        }
    };

    // --- Pan/Zoom Logic (Wheel) ---
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = -e.deltaY * 0.001; // zoom speed
            setScale(s => Math.min(Math.max(0.1, s + delta), 5));
        }
    };

    return (
        <div className={`flex flex-col h-full bg-gray-100 ${className}`}>
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-2 p-2 bg-white border-b border-gray-200 shrink-0 z-10">
                {/* Left: Tools (Thickness, Undo) */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 border-r border-gray-200 pr-4">
                        <span className="text-xs font-semibold text-gray-500">Grosor</span>
                        <input
                            type="range" min="0.5" max="3" step="0.5"
                            value={strokeScale}
                            onChange={e => setStrokeScale(parseFloat(e.target.value))}
                            className="w-20 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#B8925C]"
                            title="Ajustar grosor"
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleUndo}
                            disabled={annotations.length === 0}
                            className={`p-1.5 rounded transition-colors ${annotations.length === 0 ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                            title="Deshacer (Ctrl+Z)"
                        >
                            <Undo2 size={18} />
                        </button>
                        <button
                            onClick={handleClear}
                            disabled={annotations.length === 0}
                            className={`p-1.5 rounded transition-colors ${annotations.length === 0 ? 'text-gray-300' : 'text-red-400 hover:bg-red-50 hover:text-red-600'}`}
                            title="Borrar Todo"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>

                {/* Right: Zoom */}
                <div className="flex items-center gap-1">
                    <button onClick={() => setScale(s => Math.min(5, s + 0.1))} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Acercar"><ZoomIn size={18} /></button>
                    <span className="text-xs font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
                    <button onClick={() => setScale(s => Math.max(0.1, s - 0.1))} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Alejar"><ZoomOut size={18} /></button>
                    <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Ajustar"><Maximize size={18} /></button>
                </div>
            </div>

            {/* Canvas Area */}
            <div
                ref={containerRef}
                className="flex-1 overflow-auto relative flex items-center justify-center p-8 cursor-crosshair select-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            >
                <div
                    className="relative shadow-xl transition-transform duration-75 origin-center bg-white"
                    style={{
                        transform: `scale(${scale}) translate(${pan.x}px, ${pan.y}px)`,
                        maxWidth: '100%',
                        maxHeight: '100%',
                        width: imgDim.w ? Math.min(imgDim.w, 800) : 'auto',
                    }}
                >
                    <img
                        ref={imageRef}
                        src={imageSrc}
                        alt="Target"
                        onLoad={handleImageLoad}
                        draggable={false}
                        className="block w-full h-auto"
                        style={{ maxHeight: 'calc(100vh - 200px)', objectFit: 'contain' }}
                    />

                    {/* SVG Overlay */}
                    <svg
                        className="absolute top-0 left-0 w-full h-full pointer-events-none"
                        viewBox={`0 0 ${imgDim.w} ${imgDim.h}`}
                    >
                        {/* Existing Annotations */}
                        {annotations.concat(currentShape ? [currentShape] : []).map((ann, i) => {
                            if (!ann) return null;
                            const key = ann.id || i; // fallback key
                            if (ann.type === 'box') {
                                return (
                                    <rect
                                        key={key}
                                        x={ann.x} y={ann.y} width={ann.w} height={ann.h}
                                        fill={ann.color} fillOpacity="0.2"
                                        stroke={ann.color} strokeWidth="2"
                                        vectorEffect="non-scaling-stroke"
                                    />
                                );
                            } else if (ann.type === 'freehand' && ann.points) {
                                const d = `M ${ann.points.map(p => `${p.x},${p.y}`).join(' L ')}`;
                                return (
                                    <path
                                        key={key}
                                        d={d}
                                        fill="none"
                                        stroke={ann.color} strokeWidth="3"
                                        strokeLinecap="round"
                                        vectorEffect="non-scaling-stroke"
                                        opacity="0.8"
                                    />
                                );
                            } else if (ann.type === 'highlight' && ann.points) {
                                const d = `M ${ann.points.map(p => `${p.x},${p.y}`).join(' L ')}`;
                                return (
                                    <path
                                        key={key}
                                        d={d}
                                        fill="none"
                                        stroke={ann.color}
                                        strokeWidth={ann.strokeWidth || Math.max(15, (imgDim.w || 800) / 60)} // Use stored width or fallback to dynamic default
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        vectorEffect="non-scaling-stroke"
                                        opacity="0.3" // Transparent
                                    />
                                );
                            }
                            return null;
                        })}
                    </svg>
                </div>
            </div>
        </div>
    );
}
