import React, { useState, useEffect, useRef } from 'react';
import { TranslationResult, SelectionData } from '../types';
import { analyzeImageRegion, translateText, generateSpeech, explainWithSearch } from '../services/geminiService';
import { Volume2, Search, Loader2, ArrowRight, Image as ImageIcon, Copy, Check, Type, Trash2, AlertCircle } from 'lucide-react';

interface TranslationPanelProps {
  selectionData: SelectionData | null;
}

const TranslationPanel: React.FC<TranslationPanelProps> = ({ selectionData }) => {
  // History Stack (Newest first) - Initialize from LocalStorage
  const [history, setHistory] = useState<TranslationResult[]>(() => {
    try {
      const saved = localStorage.getItem('paperpal_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load history", e);
      return [];
    }
  });

  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  
  // Audio State
  const [audioPlayingId, setAudioPlayingId] = useState<number | null>(null);

  // Copy State
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Deep Dive State
  const [deepDiveLoadingId, setDeepDiveLoadingId] = useState<number | null>(null);

  const listEndRef = useRef<HTMLDivElement>(null);

  // Effect: Save history to LocalStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('paperpal_history', JSON.stringify(history));
  }, [history]);

  // Effect: Handle new incoming selection
  useEffect(() => {
    if (!selectionData) return;

    const processNewSelection = async () => {
      const newId = selectionData.id;
      setActiveId(newId);
      setLoading(true);

      // Create a placeholder entry
      const newEntry: TranslationResult = {
        id: newId,
        type: selectionData.type,
        originalText: selectionData.type === 'text' ? selectionData.content : "Reading text from image...",
        translatedText: "",
        imageUrl: selectionData.type === 'image' ? selectionData.content : undefined,
        timestamp: Date.now()
      };

      // Add to history immediately (at top)
      setHistory(prev => [newEntry, ...prev]);

      try {
        let resultOriginal = "";
        let resultTranslated = "";

        if (selectionData.type === 'image') {
          const analysis = await analyzeImageRegion(selectionData.content);
          resultOriginal = analysis.originalText;
          resultTranslated = analysis.translatedText;
        } else {
          resultOriginal = selectionData.content;
          resultTranslated = await translateText(selectionData.content);
        }

        // Update the entry with actual results
        setHistory(prev => prev.map(item => 
          item.id === newId 
            ? { ...item, originalText: resultOriginal, translatedText: resultTranslated } 
            : item
        ));

      } catch (e: any) {
        console.error(e);
        let errorMessage = "Translation failed. Please try again.";
        
        // Friendly error message for Quota Exceeded
        if (e.message?.includes('429') || e.message?.includes('quota') || e.message?.includes('exhausted')) {
          errorMessage = "Usage limit reached. Please wait a moment and try again.";
        }

        setHistory(prev => prev.map(item => 
            item.id === newId 
              ? { ...item, translatedText: errorMessage } 
              : item
          ));
      } finally {
        setLoading(false);
      }
    };

    processNewSelection();
  }, [selectionData]);


  const handlePlayAudio = async (text: string, id: number) => {
    if (audioPlayingId) return;
    setAudioPlayingId(id);
    try {
      const buffer = await generateSpeech(text);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      source.onended = () => setAudioPlayingId(null);
    } catch (e) {
      console.error(e);
      setAudioPlayingId(null);
    }
  };

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeepDive = async (text: string, id: number) => {
    setDeepDiveLoadingId(id);
    try {
      const { explanation, sources } = await explainWithSearch(text);
      setHistory(prev => prev.map(item => 
        item.id === id 
          ? { ...item, explanation, searchSources: sources } 
          : item
      ));
    } catch (e) {
      console.error(e);
    } finally {
      setDeepDiveLoadingId(null);
    }
  };

  const clearHistory = () => {
      if (window.confirm("Are you sure you want to clear all history?")) {
        setHistory([]);
        localStorage.removeItem('paperpal_history');
      }
  };

  if (history.length === 0 && !loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center bg-gray-50">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm">
           <Type size={32} className="opacity-30" />
        </div>
        <p className="text-lg font-medium text-gray-600">No Translations Yet</p>
        <p className="text-sm mt-2 max-w-xs leading-relaxed">
          Select text or use the screenshot tool to start translating. Your history will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden border-l border-gray-200">
      <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center shadow-sm z-10">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          History
          <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{history.length}</span>
        </h2>
        {history.length > 0 && (
            <button onClick={clearHistory} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Clear History">
                <Trash2 size={16} />
            </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {history.map((item) => (
          <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in slide-in-from-right-4 fade-in duration-300">
            
            {/* Header: Original Context */}
            <div className="bg-gray-50 p-3 border-b border-gray-100 flex gap-3 items-start">
              <div className="mt-0.5 flex-shrink-0 text-gray-400">
                {item.type === 'image' ? <ImageIcon size={14} /> : <Type size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                 {item.imageUrl && (
                    <img src={item.imageUrl} alt="Context" className="h-16 object-contain rounded-md border border-gray-200 mb-2 bg-white" />
                 )}
                 <p className="text-xs text-gray-500 line-clamp-3 italic font-serif">
                    {item.originalText || "Processing..."}
                 </p>
              </div>
            </div>

            {/* Body: Translation */}
            <div className="p-4 space-y-3">
               {loading && item.id === activeId && !item.translatedText ? (
                 <div className="flex items-center gap-2 text-blue-600">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">Translating...</span>
                 </div>
               ) : (
                 <div className={`leading-relaxed font-medium ${item.translatedText.includes('failed') || item.translatedText.includes('limit') ? 'text-red-600 flex items-start gap-2' : 'text-gray-900'}`}>
                    {item.translatedText.includes('limit') && <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />}
                    {item.translatedText}
                 </div>
               )}

               {/* Toolbar - Only show if successful */}
               {!item.translatedText.includes('failed') && !item.translatedText.includes('limit') && (
               <div className="flex items-center justify-between pt-2 border-t border-gray-50 mt-2">
                  <div className="flex gap-1">
                      <button 
                        onClick={() => handlePlayAudio(item.translatedText, item.id)}
                        disabled={!!audioPlayingId}
                        className={`p-1.5 rounded-md hover:bg-gray-100 transition-colors ${audioPlayingId === item.id ? 'text-blue-500' : 'text-gray-400'}`}
                        title="Read Aloud"
                      >
                         <Volume2 size={16} className={audioPlayingId === item.id ? 'animate-pulse' : ''} />
                      </button>
                      <button 
                        onClick={() => handleCopy(item.translatedText, item.id)}
                        className={`p-1.5 rounded-md hover:bg-gray-100 transition-colors ${copiedId === item.id ? 'text-green-500' : 'text-gray-400'}`}
                        title="Copy Translation"
                      >
                         {copiedId === item.id ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                  </div>

                  {!item.explanation && (
                      <button 
                        onClick={() => handleDeepDive(item.originalText, item.id)}
                        disabled={deepDiveLoadingId === item.id}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                      >
                        {deepDiveLoadingId === item.id ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                        Explain
                      </button>
                  )}
               </div>
               )}
            </div>

            {/* Deep Dive Section */}
            {item.explanation && (
                <div className="bg-indigo-50/50 p-4 border-t border-indigo-100">
                    <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <Search size={12} /> Context & Explanation
                    </h4>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {item.explanation}
                    </p>
                    {item.searchSources && item.searchSources.length > 0 && (
                        <div className="mt-3 space-y-1">
                            {item.searchSources.slice(0, 3).map((source, idx) => (
                                <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="block text-xs text-indigo-600 truncate hover:underline">
                                    • {source.title}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            )}
          </div>
        ))}
        
        {/* Spacer for bottom scrolling */}
        <div ref={listEndRef} />
      </div>
    </div>
  );
};

export default TranslationPanel;