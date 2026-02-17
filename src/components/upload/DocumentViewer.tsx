import React, { useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { Annotation, AnnotationType } from '../../types/annotation';
import { AnnotationCanvas } from './AnnotationCanvas';

interface DocumentViewerProps {
  file: File | null;
  onFileUpload: (file: File) => void;
  mode: 'scan' | 'edit';
  annotationTool: AnnotationType | null;
  annotations: Annotation[];
  onAnnotationsChange: (annotations: Annotation[]) => void;
}

export function DocumentViewer({
  file,
  onFileUpload,
  mode,
  annotationTool,
  annotations,
  onAnnotationsChange,
}: DocumentViewerProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles: File[]) => {
      if (acceptedFiles?.[0]) onFileUpload(acceptedFiles[0]);
    },
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
      'application/pdf': ['.pdf'],
    },
    multiple: false,
  });

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setImageSrc(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setDimensions({
      width: e.currentTarget.naturalWidth,
      height: e.currentTarget.naturalHeight
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      // Simple zoom logic
      const delta = e.deltaY * -0.001;
      const newScale = Math.min(Math.max(0.5, scale + delta), 4);
      setScale(newScale);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode === 'edit' && annotationTool) return; // Allow drawing
    setIsDragging(true);
    // Adjust drag start to be relative to the container
    if (containerRef.current) {
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50/50 rounded-xl border border-gray-200 overflow-hidden relative shadow-inner">
      {/* Toolbar */}
      <div className="absolute top-4 right-4 z-20 flex gap-2 bg-white p-1.5 rounded-lg shadow-sm border border-gray-200">
        <button
          onClick={() => setScale((s) => Math.min(s + 0.1, 4))}
          className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
          title="Zoom In"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
          className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
          title="Zoom Out"
        >
          <ZoomOut size={18} />
        </button>
        <button
          onClick={() => {
            setScale(1);
            setPosition({ x: 0, y: 0 });
          }}
          className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
          title="Reset View"
        >
          <Maximize size={18} />
        </button>
      </div>

      {/* Main Content Area */}
      {!imageSrc ? (
        <div
          {...getRootProps()}
          className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed m-4 rounded-xl transition-colors cursor-pointer ${
            isDragActive
              ? 'border-brand-tan bg-brand-tan/5'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="bg-white p-4 rounded-full shadow-sm mb-4">
            <UploadCloud className="w-8 h-8 text-brand-tan" />
          </div>
          <p className="text-gray-900 font-medium text-lg">
            Upload document to scan
          </p>
          <p className="text-gray-500 text-sm mt-1">
            Drag & drop or click to browse
          </p>
          <div className="mt-4 flex gap-2 text-xs text-gray-400">
            <span className="bg-gray-100 px-2 py-1 rounded">PDF</span>
            <span className="bg-gray-100 px-2 py-1 rounded">JPG</span>
            <span className="bg-gray-100 px-2 py-1 rounded">PNG</span>
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing bg-gray-100"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            cursor: mode === 'edit' && annotationTool ? 'crosshair' : isDragging ? 'grabbing' : 'grab',
          }}
        >
          <div
            className="absolute origin-top-left transition-transform duration-75 ease-out"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            }}
          >
            <div className="relative inline-block shadow-lg">
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Document Preview"
                onLoad={handleImageLoad}
                className="max-w-none block bg-white"
                draggable={false}
                style={{
                  minWidth: '600px', // Ensure visible size
                }}
              />
              {mode === 'edit' && dimensions.width > 0 && (
                <div className="absolute inset-0">
                  <AnnotationCanvas
                    width={dimensions.width}
                    height={dimensions.height}
                    mode={annotationTool}
                    annotations={annotations}
                    onAnnotationsChange={onAnnotationsChange}
                  />
                </div>
              )}
              
              {/* Overlay for Scan Mode (Results Visualization would go here) */}
              {mode === 'scan' && (
                <div className="absolute inset-0 pointer-events-none">
                  {/* Future: Render extracted bounding boxes here */}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
