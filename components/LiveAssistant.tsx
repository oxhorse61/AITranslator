import React, { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, X, Activity } from 'lucide-react';
import { LiveSession } from '../services/geminiService';

interface LiveAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

const LiveAssistant: React.FC<LiveAssistantProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState("Idle");
  const [isConnected, setIsConnected] = useState(false);
  const liveSessionRef = useRef<LiveSession | null>(null);

  useEffect(() => {
    if (isOpen && !liveSessionRef.current) {
      const session = new LiveSession((s) => {
        setStatus(s);
        setIsConnected(s === "Connected");
      });
      liveSessionRef.current = session;
      session.connect().catch(e => {
        console.error("Connection failed", e);
        setStatus("Error Connecting");
      });
    }

    // Cleanup on close or unmount
    return () => {
      if (!isOpen && liveSessionRef.current) {
        liveSessionRef.current.disconnect();
        liveSessionRef.current = null;
        setIsConnected(false);
        setStatus("Idle");
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-80 overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Activity className={`w-5 h-5 ${isConnected ? 'animate-pulse' : ''}`} />
            <span className="font-semibold">Voice Assistant</span>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center justify-center min-h-[200px] text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all duration-500 
            ${isConnected ? 'bg-red-50 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-gray-100 text-gray-400'}`}>
             <Mic size={32} className={isConnected ? 'animate-bounce' : ''} />
          </div>
          
          <h3 className="font-medium text-gray-800 mb-1">
            {isConnected ? "Listening..." : "Connecting..."}
          </h3>
          <p className="text-sm text-gray-500">
            {isConnected 
              ? "Ask me anything about the paper." 
              : status}
          </p>

          <div className="mt-6 flex gap-2">
            <button 
              onClick={() => onClose()}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              End Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveAssistant;