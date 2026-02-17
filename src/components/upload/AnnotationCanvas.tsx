import React, { useState, useRef } from 'react';
import { Annotation, AnnotationType } from '../../types/annotation';
import { Trash2 } from 'lucide-react';

interface AnnotationCanvasProps {
  width: number;
  height: number;
  mode: AnnotationType | null; // null = pan/zoom mode
  annotations: Annotation[];
  onAnnotationsChange: (annotations: Annotation[]) => void;
}

const COLORS = {
  variable: 'rgba(239, 68, 68, 0.4)', // Red-500
  anchor: 'rgba(59, 130, 246, 0.4)', // Blue-500
  table: 'rgba(34, 197, 94, 0.4)', // Green-500
};

const BORDER_COLORS = {
  variable: '#ef4444',
  anchor: '#3b82f6',
  table: '#22c55e',
};

export function AnnotationCanvas({
  width,
  height,
  mode,
  annotations,
  onAnnotationsChange,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentRect, setCurrentRect] = useState<Partial<Annotation> | null>(null);

  // Helper: Convert mouse event to percentage relative to image
  const getCoordinates = (e: React.MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!mode) return; // Pan mode
    const coords = getCoordinates(e);
    setStartPos(coords);
    setIsDrawing(true);
    setCurrentRect({
      x: coords.x,
      y: coords.y,
      width: 0,
      height: 0,
      type: mode,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !startPos || !mode) return;
    const coords = getCoordinates(e);
    
    const x = Math.min(startPos.x, coords.x);
    const y = Math.min(startPos.y, coords.y);
    const w = Math.abs(coords.x - startPos.x);
    const h = Math.abs(coords.y - startPos.y);

    setCurrentRect({
      x,
      y,
      width: w,
      height: h,
      type: mode,
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentRect || !mode) return;
    
    if (currentRect.width && currentRect.width > 1 && currentRect.height && currentRect.height > 1) {
      const newAnnotation: Annotation = {
        id: crypto.randomUUID(),
        type: mode,
        x: currentRect.x || 0,
        y: currentRect.y || 0,
        width: currentRect.width || 0,
        height: currentRect.height || 0,
        label: `New ${mode}`,
      };
      onAnnotationsChange([...annotations, newAnnotation]);
    }
    
    setIsDrawing(false);
    setCurrentRect(null);
  };

  const removeAnnotation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onAnnotationsChange(annotations.filter((a) => a.id !== id));
  };

  return (
    <div 
      className="absolute top-0 left-0 w-full h-full pointer-events-auto"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: mode ? 'crosshair' : 'default' }}
    >
      {/* Render Existing Annotations */}
      {annotations.map((ann) => (
        <div
          key={ann.id}
          className="absolute border-2 group flex items-start justify-end p-1 transition-all hover:bg-opacity-60"
          style={{
            left: `${ann.x}%`,
            top: `${ann.y}%`,
            width: `${ann.width}%`,
            height: `${ann.height}%`,
            backgroundColor: COLORS[ann.type],
            borderColor: BORDER_COLORS[ann.type],
          }}
        >
          {/* Label Badge */}
          <div 
            className="absolute -top-6 left-0 px-2 py-0.5 text-[10px] font-medium text-white rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10"
            style={{ backgroundColor: BORDER_COLORS[ann.type] }}
          >
            {ann.type.toUpperCase()}
          </div>
          
          {/* Delete Button */}
          <button
            onClick={(e) => removeAnnotation(ann.id, e)}
            className="opacity-0 group-hover:opacity-100 bg-white/90 p-1 rounded-full text-red-500 hover:text-red-700 hover:bg-white shadow-sm transition-all transform hover:scale-110"
            title="Remove Annotation"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}

      {/* Render Current Drawing Rect */}
      {isDrawing && currentRect && mode && (
        <div
          className="absolute border-2 border-dashed pointer-events-none"
          style={{
            left: `${currentRect.x}%`,
            top: `${currentRect.y}%`,
            width: `${currentRect.width}%`,
            height: `${currentRect.height}%`,
            backgroundColor: COLORS[mode],
            borderColor: BORDER_COLORS[mode],
          }}
        />
      )}
      
      {/* Interaction Layer for Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        width={width}
        height={height}
      />
    </div>
  );
}
