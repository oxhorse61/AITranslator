import React, { useState, useRef, useEffect } from 'react';
import { Document, Page } from 'react-pdf';
import { ZoomIn, ZoomOut, Loader2, Crop, MousePointer2, ChevronLeft, ChevronRight, Type } from 'lucide-react';
import { SelectionData } from '../types';

interface PDFViewerProps {
  file: File | null;
  onSelection: (data: SelectionData) => void;
}

// Internal Page Component to handle specific page logic
const InteractivePage = ({ 
  pageNumber, 
  scale, 
  containerWidth,
  mode,
  onImageCapture,
  onTextSelect
}: { 
  pageNumber: number, 
  scale: number,
  containerWidth: number,
  mode: 'text' | 'box',
  onImageCapture: (imgData: string) => void,
  onTextSelect: (text: string) => void
}) => {
  const pageRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  // Box Selection State
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

  // Text Selection Popup State
  const [showTextTooltip, setShowTextTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState("");

  // Helper: Get coordinates relative to the page container
  const getRelPos = (e: React.MouseEvent) => {
    if (!pageRef.current) return { x: 0, y: 0 };
    const rect = pageRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  // --- Box Selection Handlers ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'box') return;
    e.preventDefault();
    const pos = getRelPos(e);
    setStartPos(pos);
    setCurrentPos(pos);
    setIsSelecting(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mode !== 'box' || !isSelecting) return;
    setCurrentPos(getRelPos(e));
  };

  const handleMouseUp = () => {
    if (mode !== 'box' || !isSelecting) return;
    setIsSelecting(false);

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const w = Math.abs(currentPos.x - startPos.x);
    const h = Math.abs(currentPos.y - startPos.y);

    if (w < 10 || h < 10) return;

    if (pageRef.current) {
      const canvas = pageRef.current.querySelector('canvas');
      if (canvas) {
        try {
          const scaleX = canvas.width / canvas.offsetWidth;
          const scaleY = canvas.height / canvas.offsetHeight;
          const tmpCanvas = document.createElement('canvas');
          tmpCanvas.width = w * scaleX;
          tmpCanvas.height = h * scaleY;
          const ctx = tmpCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(canvas, x * scaleX, y * scaleY, w * scaleX, h * scaleY, 0, 0, w * scaleX, h * scaleY);
            onImageCapture(tmpCanvas.toDataURL('image/png'));
          }
        } catch (e) {
          console.error("Capture failed", e);
        }
      }
    }
  };

  // --- Text Selection Handlers ---
  useEffect(() => {
    const handleDocumentMouseUp = (e: MouseEvent) => {
      if (mode !== 'text') return;
      
      // If clicking inside the tooltip, ignore this event to let the button action fire
      // Note: We use onMouseDown for the button action, but this safety check helps
      if (tooltipRef.current && tooltipRef.current.contains(e.target as Node)) {
        return;
      }
      
      const selection = window.getSelection();
      
      // If valid selection exists
      if (selection && selection.toString().trim().length > 0) {
        const text = selection.toString();
        // Check if selection is inside this page
        if (pageRef.current && pageRef.current.contains(selection.anchorNode)) {
          // If we just clicked the tooltip, we don't want to re-calculate position
          // But since we checked tooltipRef above, we are safe here.

          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const pageRect = pageRef.current.getBoundingClientRect();
          
          setSelectedText(text);
          setTooltipPos({
            x: rect.left + rect.width / 2 - pageRect.left,
            y: rect.top - pageRect.top - 45 // Position slightly higher
          });
          setShowTextTooltip(true);
          return;
        }
      } 
      
      // If no selection or outside page, hide tooltip
      setShowTextTooltip(false);
    };

    document.addEventListener('mouseup', handleDocumentMouseUp);
    return () => document.removeEventListener('mouseup', handleDocumentMouseUp);
  }, [mode]);

  const handleTooltipMouseDown = (e: React.MouseEvent) => {
    // Use onMouseDown to trigger before the document mouseup listener
    e.stopPropagation();
    e.preventDefault();
    onTextSelect(selectedText);
    setShowTextTooltip(false);
    window.getSelection()?.removeAllRanges();
  };

  // Calculate dynamic width based on container + zoom
  // We substract padding (32px * 2 = 64px) roughly or just use percentage
  const pageWidth = containerWidth ? Math.min(containerWidth - 64, 1000) * scale : undefined;

  return (
    <div 
      ref={pageRef} 
      className={`relative mb-8 shadow-md inline-block bg-white group ${mode === 'box' ? 'cursor-crosshair' : 'cursor-text'}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setIsSelecting(false)}
    >
      {/* Box Selection Overlay */}
      {mode === 'box' && (
        <div className="selection-overlay pointer-events-none">
           <div className="selection-box" style={{
              left: Math.min(startPos.x, currentPos.x),
              top: Math.min(startPos.y, currentPos.y),
              width: Math.abs(currentPos.x - startPos.x),
              height: Math.abs(currentPos.y - startPos.y),
              display: isSelecting ? 'block' : 'none',
           }}></div>
        </div>
      )}

      {/* Text Selection Tooltip */}
      {showTextTooltip && mode === 'text' && (
        <div 
          ref={tooltipRef}
          className="absolute z-50 transform -translate-x-1/2 bg-gray-900 text-white px-3 py-1.5 rounded-lg shadow-lg text-sm font-medium cursor-pointer flex items-center gap-2 hover:bg-gray-800 transition-colors animate-in fade-in zoom-in duration-200 select-none"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
          onMouseDown={handleTooltipMouseDown}
        >
          <span>Translate</span>
          <ChevronRight size={14} />
          {/* Triangle Pointer */}
          <div className="absolute -bottom-1.5 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-900"></div>
        </div>
      )}

      <Page 
        pageNumber={pageNumber} 
        width={pageWidth}
        renderTextLayer={true} 
        renderAnnotationLayer={false}
        className="block"
      />
    </div>
  );
};

const PDFViewer: React.FC<PDFViewerProps> = ({ file, onSelection }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [mode, setMode] = useState<'text' | 'box'>('text');
  const [containerWidth, setContainerWidth] = useState<number>(0);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure container width for perfect PDF scaling
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const changePage = (offset: number) => {
    setPageNumber(prev => Math.max(1, Math.min(prev + offset, numPages)));
  };

  const handleImageCapture = (base64: string) => {
    onSelection({
      type: 'image',
      content: base64,
      id: Date.now()
    });
  };

  const handleTextSelect = (text: string) => {
    onSelection({
      type: 'text',
      content: text,
      id: Date.now()
    });
  };

  if (!file) return null;

  return (
    <div className="flex flex-col h-full bg-gray-100 border-r border-gray-200">
      {/* Toolbar */}
      <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 shadow-sm z-30 flex-shrink-0 gap-4">
        <span className="font-semibold text-gray-700 truncate max-w-[150px] text-xs" title={file.name}>{file.name}</span>
        
        {/* Pagination */}
        <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5 border border-gray-200">
          <button 
            onClick={() => changePage(-1)}
            disabled={pageNumber <= 1}
            className="p-1 hover:bg-white hover:shadow-sm rounded disabled:opacity-30 text-gray-600"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-semibold w-16 text-center text-gray-700 select-none">
            {pageNumber} / {numPages || '-'}
          </span>
          <button 
            onClick={() => changePage(1)}
            disabled={pageNumber >= numPages}
            className="p-1 hover:bg-white hover:shadow-sm rounded disabled:opacity-30 text-gray-600"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-4">
           {/* Mode Switcher */}
           <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
              <button 
                onClick={() => setMode('text')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${mode === 'text' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <MousePointer2 size={12} />
                Text
              </button>
              <button 
                onClick={() => setMode('box')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${mode === 'box' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Crop size={12} />
                Crop
              </button>
           </div>

            {/* Zoom */}
            <div className="flex items-center gap-1">
                <button 
                    onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
                    className="p-1 hover:bg-gray-100 rounded text-gray-600"
                >
                    <ZoomOut size={16} />
                </button>
                <span className="text-xs font-medium w-8 text-center text-gray-600 select-none">{Math.round(scale * 100)}%</span>
                <button 
                    onClick={() => setScale(s => Math.min(2.5, s + 0.2))}
                    className="p-1 hover:bg-gray-100 rounded text-gray-600"
                >
                    <ZoomIn size={16} />
                </button>
            </div>
        </div>
      </div>

      {/* PDF Scroll Area */}
      <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center bg-gray-100" ref={containerRef}>
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex flex-col items-center gap-3 mt-20 justify-center text-gray-400">
              <Loader2 className="animate-spin text-blue-500" size={24} />
              <span className="text-sm font-medium">Loading Document...</span>
            </div>
          }
          className="flex flex-col items-center min-h-0"
        >
          {numPages > 0 && containerWidth > 0 && (
            <InteractivePage 
              pageNumber={pageNumber} 
              scale={scale} 
              containerWidth={containerWidth}
              mode={mode}
              onImageCapture={handleImageCapture}
              onTextSelect={handleTextSelect}
            />
          )}
        </Document>
      </div>
    </div>
  );
};

export default PDFViewer;