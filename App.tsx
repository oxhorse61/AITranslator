import React, { useState } from 'react';
import { Upload, Mic } from 'lucide-react';
import PDFViewer from './components/PDFViewer';
import TranslationPanel from './components/TranslationPanel';
import LiveAssistant from './components/LiveAssistant';
import { SelectionData } from './types';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [selectionData, setSelectionData] = useState<SelectionData | null>(null);
  const [isLiveOpen, setIsLiveOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setSelectionData(null);
    }
  };

  const handleSelection = (data: SelectionData) => {
    setSelectionData(data);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans">
      
      {/* Header */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
            P
          </div>
          <h1 className="text-xl font-bold text-gray-800">PaperPal Translator</h1>
        </div>

        <div className="flex items-center gap-4">
           {/* Voice Button */}
           {file && (
             <button 
               onClick={() => setIsLiveOpen(true)}
               className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-full font-medium transition-colors border border-indigo-200"
             >
               <Mic size={18} />
               <span>Talk to PDF</span>
             </button>
           )}

          {/* Upload Button */}
          <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 rounded-lg font-medium transition-all shadow-sm">
            <Upload size={18} />
            <span>{file ? 'Replace PDF' : 'Upload PDF'}</span>
            <input 
              type="file" 
              accept="application/pdf" 
              className="hidden" 
              onChange={handleFileChange}
            />
          </label>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {file ? (
          <>
            {/* Left: PDF Viewer (65%) */}
            <div className="w-[65%] h-full relative">
              <PDFViewer file={file} onSelection={handleSelection} />
            </div>
            
            {/* Right: Translation Panel (35%) */}
            <div className="w-[35%] h-full relative shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)] z-10">
              <TranslationPanel selectionData={selectionData} />
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6 text-blue-600">
              <Upload size={40} />
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Upload a Research Paper</h2>
            <p className="text-gray-500 max-w-md text-center mb-8">
              Select any English PDF academic paper. We'll help you translate sections and explain complex terms with AI.
            </p>
            <label className="cursor-pointer px-8 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
              Choose PDF File
              <input 
                type="file" 
                accept="application/pdf" 
                className="hidden" 
                onChange={handleFileChange}
              />
            </label>
          </div>
        )}
      </main>

      {/* Voice Assistant Modal */}
      <LiveAssistant isOpen={isLiveOpen} onClose={() => setIsLiveOpen(false)} />
      
    </div>
  );
}

export default App;