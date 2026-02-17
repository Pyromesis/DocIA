import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileCheck, ScanLine, Wand2, ArrowRight, FileText } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface DocumentUploaderProps {
  onContinue?: (file: File) => void;
}

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({ onContinue }) => {
  const { t } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<'idle' | 'scanning' | 'optimizing' | 'extracting' | 'complete'>('idle');

  const [instructions, setInstructions] = useState('');

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const startProcessing = () => {
    if (!file) return;
    simulateProcessing();
  };

  const simulateProcessing = () => {
    setIsProcessing(true);
    setStage('scanning');
    
    // Simulate Pattern Scanning
    setTimeout(() => {
      setProgress(33);
      setStage('optimizing');
    }, 2000);

    // Simulate Optimization
    setTimeout(() => {
      setProgress(66);
      setStage('extracting');
    }, 4500);

    // Simulate Variable Extraction
    setTimeout(() => {
      setProgress(100);
      setStage('complete');
      setIsProcessing(false);
    }, 7000);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 relative overflow-hidden">
      
      <AnimatePresence mode="wait">
        {stage === 'idle' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-6"
          >
            {/* Upload Area */}
            <div className="relative border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-docia-coffee/50 hover:bg-docia-coffee/5 transition-colors group">
              <input 
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onChange={handleUpload}
                disabled={isProcessing}
              />
              <div className="w-12 h-12 bg-docia-coffee/10 rounded-full flex items-center justify-center mb-3 text-docia-coffee mx-auto group-hover:scale-110 transition-transform">
                <Upload size={24} />
              </div>
              <h3 className="text-lg font-medium text-gray-800 mb-1">
                {file ? file.name : t('templates.uploadTitle')}
              </h3>
              <p className="text-sm text-gray-500 max-w-xs mx-auto">
                {file ? 'Click to change file' : t('templates.uploadDesc')}
              </p>
            </div>

            {/* AI Instructions */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 block text-left">
                AI Instructions <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder='e.g., "Put the date on the top left and the invoice number on the right..."'
                className="w-full h-24 p-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-docia-coffee/20 focus:border-docia-coffee outline-none resize-none"
              />
            </div>

            <button
              onClick={startProcessing}
              disabled={!file}
              className="w-full py-3 bg-docia-coffee text-white rounded-lg font-medium shadow-lg hover:bg-docia-coffee-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Wand2 size={18} />
              Analyze & Generate Template
            </button>
          </motion.div>
        )}

        {(stage === 'scanning' || stage === 'optimizing' || stage === 'extracting') && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-12"
          >
            <div className="relative w-20 h-20 mb-6">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-4 border-docia-coffee/10 border-t-docia-coffee rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center text-docia-coffee">
                {stage === 'scanning' && <ScanLine size={32} className="animate-pulse" />}
                {stage === 'optimizing' && <Wand2 size={32} className="animate-bounce" />}
                {stage === 'extracting' && <FileText size={32} className="animate-pulse" />}
              </div>
            </div>

            <h3 className="text-lg font-medium text-gray-800 mb-1">
              {stage === 'scanning' && t('templates.processing')}
              {stage === 'optimizing' && t('templates.optimizing')}
              {stage === 'extracting' && t('templates.extracting')}
            </h3>
            <p className="text-sm text-gray-400 mb-6">{file?.name}</p>

            <div className="w-64 h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-docia-coffee"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </motion.div>
        )}

        {stage === 'complete' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-8"
          >
            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-4">
              <FileCheck size={32} />
            </div>
            <h3 className="text-xl font-medium text-gray-800 mb-2">{t('templates.success')}</h3>
            <p className="text-gray-500 mb-6">Found 5 variables in {file?.name}</p>
            
            <div className="bg-gray-50 rounded-lg p-4 w-full max-w-sm mb-6 text-left">
              <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-3">Detected Patterns</div>
              <div className="flex flex-wrap gap-2">
                {['{{date}}', '{{total_amount}}', '{{invoice_id}}'].map(v => (
                  <span key={v} className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono text-docia-coffee">
                    {v}
                  </span>
                ))}
              </div>
            </div>

            <button 
              onClick={() => {
                if (file && onContinue) {
                  onContinue(file);
                }
                setFile(null);
                setStage('idle');
              }}
              className="px-6 py-2 bg-docia-coffee text-white rounded-lg hover:bg-docia-coffee-dark transition-colors flex items-center gap-2"
            >
              Continue to Editor <ArrowRight size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
