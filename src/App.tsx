/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, Printer, CheckCircle2, ChevronDown, ChevronUp, 
  Beaker, GraduationCap, Clock, BookOpen, LayoutDashboard, 
  Library, Archive, Settings, Share2, Search
} from 'lucide-react';
import { CHAPTER_1_PAPER, Question, Section, ViewState, Paper } from './types';
import { cn } from './lib/utils';

import { generatePaperFromImages } from './services/geminiService';

export default function App() {
  const [activeView, setActiveView] = useState<ViewState>('config');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPaper, setCurrentPaper] = useState<Paper>(CHAPTER_1_PAPER);
  const [marks, setMarks] = useState(40);
  const [difficulty, setDifficulty] = useState('Standard');
  const [archive, setArchive] = useState<Paper[]>([
    { ...CHAPTER_1_PAPER, id: 'p0', title: 'Unit Test - April', generatedAt: '2024-04-12' }
  ]);
  const [scannedImages, setScannedImages] = useState<{ id: string; url: string; name: string }[]>([]);

  const handlePrint = () => {
    window.print();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages = Array.from(files).map((file: File) => ({
      id: Math.random().toString(36).substr(2, 9),
      url: URL.createObjectURL(file),
      name: file.name
    }));

    setScannedImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => {
    setScannedImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      // Cleanup URLs to prevent memory leaks
      const removed = prev.find(img => img.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return filtered;
    });
  };

  const [generationStep, setGenerationStep] = useState<string>("");

  const handleGenerate = async () => {
    if (scannedImages.length === 0) {
      alert("Please upload at least one textbook page image first.");
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    setGenerationStep("Analyzing images...");
    
    try {
      setGenerationStep("Converting focus areas...");
      const paper = await generatePaperFromImages(scannedImages, marks, difficulty);
      setGenerationStep("Finalizing structure...");
      setCurrentPaper(paper);
      setArchive(prev => [paper, ...prev]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to generate paper. Please check your API key in Secrets.");
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg font-sans text-slate-200 flex flex-col md:flex-row print:bg-white print:text-black">
      {/* Sidebar - Left Section */}
      <aside className="w-full md:w-64 bg-dark-surface border-r border-dark-border flex flex-col p-6 gap-8 print:hidden">
        <div className="flex items-center gap-2 text-white font-bold text-xl tracking-tight cursor-default">
          PaperSmith <span className="text-accent-green">AI</span>
        </div>

        <nav className="flex flex-col gap-1">
          <NavItem 
            icon={<LayoutDashboard className="w-4 h-4" />} 
            label="Dashboard" 
            active={activeView === 'config'} 
            onClick={() => setActiveView('config')}
          />
          <NavItem 
            icon={<Library className="w-4 h-4" />} 
            label="Template Library" 
            active={activeView === 'library'}
            onClick={() => setActiveView('library')}
          />
          <NavItem 
            icon={<Archive className="w-4 h-4" />} 
            label="Archive" 
            active={activeView === 'archive'}
            onClick={() => setActiveView('archive')}
          />
          <NavItem 
            icon={<Settings className="w-4 h-4" />} 
            label="Settings" 
            active={activeView === 'settings'}
            onClick={() => setActiveView('settings')}
          />
        </nav>

        <div className="mt-auto pt-6 border-t border-dark-border">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3">Recent Generation</p>
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-200 truncate">{currentPaper.title}</p>
            <p className="text-[10px] text-slate-500">Last updated recently</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      {activeView === 'config' && (
        <main className="flex-1 flex flex-col p-8 gap-8 overflow-y-auto print:hidden">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-medium text-white tracking-tight">Paper Configuration</h1>
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", isGenerating ? "bg-amber-400" : "bg-accent-green animate-pulse")} />
              <span className="text-xs text-slate-500 uppercase tracking-tighter font-semibold">
                {isGenerating ? "Processing Content..." : "Analysis Complete"}
              </span>
            </div>
          </div>

          {/* Source Card */}
          <div className="bg-dark-surface border border-dark-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Source Content</span>
              <div className="flex gap-2">
                {scannedImages.length > 0 && (
                  <button 
                    onClick={() => setScannedImages([])}
                    className="text-[10px] text-slate-500 hover:text-red-400 font-bold transition-colors"
                  >
                    CLEAR ALL
                  </button>
                )}
                <label className="bg-accent-green-muted text-accent-green text-[10px] font-bold px-3 py-1 rounded-full hover:brightness-125 transition-all cursor-pointer">
                  ADD PAGE SCAN
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    className="hidden" 
                    onChange={handleFileUpload}
                    disabled={isGenerating}
                  />
                </label>
              </div>
            </div>

            {scannedImages.length > 0 ? (
              <div className="space-y-3">
                <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                  {scannedImages.map((img) => (
                    <div key={img.id} className="relative flex-shrink-0 group">
                      <img 
                        src={img.url} 
                        alt={img.name} 
                        className="w-20 h-28 object-cover rounded-md border border-slate-700 bg-dark-bg"
                      />
                      <button 
                        onClick={() => removeImage(img.id)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <Settings className="w-3 h-3 rotate-45" /> 
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 italic">
                  {scannedImages.length} {scannedImages.length === 1 ? 'page' : 'pages'} uploaded for analysis.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 bg-dark-bg/50 p-8 rounded-lg border border-dashed border-slate-800">
                <div className="p-3 bg-dark-surface rounded-full">
                  <BookOpen className="w-6 h-6 text-slate-600" />
                </div>
                <p className="text-sm text-slate-600 text-center">No images added yet.<br/>Upload textbook pages to start generating questions.</p>
              </div>
            )}
          </div>

          {/* Configuration Grid */}
          <div className="grid grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Total Marks</span>
              <div className="bg-dark-panel p-4 rounded-xl border border-dark-border flex items-center justify-between">
                <button onClick={() => setMarks(m => Math.max(10, m - 5))} className="text-slate-400 hover:text-white">-</button>
                <span className="text-xl font-bold text-white">{marks}</span>
                <button onClick={() => setMarks(m => Math.min(100, m + 5))} className="text-slate-400 hover:text-white">+</button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Difficulty</span>
              <select 
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="bg-dark-panel p-4 rounded-xl border border-dark-border text-sm font-bold text-white outline-none cursor-pointer"
              >
                <option>Standard</option>
                <option>Challenging</option>
                <option>Conceptual</option>
                <option>Board Pattern</option>
              </select>
            </div>
          </div>

          {/* Question Distribution */}
          <div className="flex flex-col gap-3">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Distribution Logic</span>
            <div className="flex gap-2">
              <DistBadge label="MCQ" count={Math.floor(marks * 0.25)} />
              <DistBadge label="VSA" count={Math.floor(marks * 0.15)} />
              <DistBadge label="SA" count={Math.floor(marks * 0.2)} />
              <DistBadge label="LA" count={Math.floor(marks * 0.1)} />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg text-red-400 text-xs">
              <p className="font-bold mb-1">Generation Failed</p>
              <p>{error}</p>
            </div>
          )}

          <div className="mt-auto flex flex-col gap-3">
            <button 
              onClick={handleGenerate}
              disabled={isGenerating}
              className={cn(
                "w-full font-bold py-3.5 rounded-lg transition-all flex items-center justify-center gap-2 group disabled:opacity-50",
                isGenerating ? "bg-dark-panel text-slate-400" : "bg-accent-green text-black hover:brightness-110"
              )}
            >
              {isGenerating ? (
                <div className="w-5 h-5 border-2 border-slate-600 border-t-accent-green rounded-full animate-spin" />
              ) : (
                <Beaker className="w-4 h-4 group-hover:scale-110 transition-transform" />
              )}
              {isGenerating ? generationStep.toUpperCase() : "REGENERATE PAPER"}
            </button>

            <button 
              onClick={handlePrint}
              disabled={isGenerating}
              className="w-full bg-white text-black font-bold py-3.5 rounded-lg hover:bg-slate-200 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              <Printer className="w-4 h-4 group-hover:scale-110 transition-transform" />
              PRINT FINAL PAPER
            </button>
          </div>
        </main>
      )}

      {activeView === 'archive' && (
        <main className="flex-1 flex flex-col p-8 gap-6 overflow-y-auto print:hidden">
          <h1 className="text-2xl font-medium text-white tracking-tight">Archive</h1>
          <div className="grid gap-4">
            {archive.map(paper => (
              <div 
                key={paper.id} 
                className="bg-dark-surface border border-dark-border p-5 rounded-xl flex items-center justify-between hover:border-slate-500 transition-colors cursor-pointer group"
                onClick={() => {
                  setCurrentPaper(paper);
                  setActiveView('config');
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-dark-bg rounded-lg text-slate-500 group-hover:text-accent-green">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-200">{paper.title}</h3>
                    <p className="text-xs text-slate-500">{paper.chapter} • {paper.totalMarks} Marks</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-600 font-mono uppercase tracking-tighter">{paper.generatedAt}</p>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {activeView === 'library' && (
        <main className="flex-1 flex flex-col p-8 gap-6 overflow-y-auto print:hidden">
          <h1 className="text-2xl font-medium text-white tracking-tight">Template Library</h1>
          <div className="grid grid-cols-2 gap-4">
            {['CBSE Board Pattern', 'Internal Mock Exam', 'Conceptual Workbook', 'Revision Worksheet'].map(temp => (
              <div key={temp} className="bg-dark-surface border border-dark-border p-6 rounded-xl hover:bg-dark-panel transition-all cursor-pointer">
                <BookOpen className="w-8 h-8 text-accent-green mb-4" />
                <h3 className="font-bold text-slate-200">{temp}</h3>
                <p className="text-xs text-slate-500 mt-1">Ready to use blueprint for standard assessments.</p>
              </div>
            ))}
          </div>
        </main>
      )}

      {activeView === 'settings' && (
        <main className="flex-1 flex flex-col p-8 gap-6 overflow-y-auto print:hidden">
          <h1 className="text-2xl font-medium text-white tracking-tight">Settings</h1>
          <div className="max-w-md space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">AI Consistency</label>
              <div className="flex items-center gap-4">
                <input type="range" className="flex-1 accent-accent-green" />
                <span className="text-xs font-mono">80%</span>
              </div>
            </div>
            <div className="space-y-4 pt-6 border-t border-dark-border">
              <h4 className="text-sm font-bold">Preferences</h4>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Auto-save on generate</span>
                <div className="w-10 h-5 bg-accent-green rounded-full flex items-center px-1">
                  <div className="w-3 h-3 bg-white rounded-full ml-auto" />
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Live Preview - Right Section */}
      <section className="w-full md:w-[460px] lg:w-[540px] xl:w-[680px] bg-dark-panel border-l border-dark-border p-6 flex flex-col gap-4 overflow-y-auto print:w-full print:p-0 print:bg-white">
        <div className="flex items-center justify-between border-b border-dark-border pb-4 print:hidden">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Live Preview</span>
          <div className="flex items-center gap-2">
            <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded font-mono">v1.2</span>
          </div>
        </div>

        {/* The Paper Sheet */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 print:overflow-visible">
          <motion.div 
            key={currentPaper.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white text-black min-h-screen rounded-sm p-10 md:p-14 shadow-2xl font-serif text-[12px] md:text-sm leading-relaxed print:shadow-none print:p-0"
          >
            {/* Paper Header */}
            <div className="text-center pb-6 border-b-2 border-black border-double mb-8">
              <p className="text-sm italic text-slate-600 mb-2 font-medium">Made by Ravi Kishan</p>
              <h2 className="text-xl font-bold tracking-tight uppercase mb-2">{currentPaper.title}</h2>
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                <span>Time: {currentPaper.time}</span>
                <span>Max Marks: {currentPaper.totalMarks}</span>
              </div>
              <p className="mt-4 text-base font-bold underline decoration-1 underline-offset-4">{currentPaper.chapter}</p>
            </div>

            {/* Questions Container */}
            <div className="space-y-10">
              {currentPaper.sections.map((section, sIdx) => (
                <div key={section.title} className="space-y-4">
                  <h3 className="font-bold border-b border-slate-300 pb-1 mb-4 flex justify-between items-center">
                    <span>{section.title}</span>
                    <span className="text-[10px] italic font-normal">{section.description}</span>
                  </h3>

                  <div className="space-y-6">
                    {section.questions.map((question, qIdx) => (
                      <div key={question.id} className="relative pl-6">
                        <span className="absolute left-0 top-0 font-bold">
                          {currentPaper.sections.slice(0, sIdx).reduce((acc, curr) => acc + curr.questions.length, 0) + qIdx + 1}.
                        </span>
                        <div className="flex justify-between gap-4">
                          <div className="flex-grow space-y-3">
                            <p className="whitespace-pre-line">{question.text}</p>
                            
                            {question.options && (
                              <div className="grid grid-cols-2 gap-x-8 gap-y-1 pl-4 mt-2">
                                {question.options.map((option, oIdx) => (
                                  <div key={oIdx} className="flex gap-2">
                                    <span className="font-bold">({String.fromCharCode(97 + oIdx)})</span>
                                    <span>{option}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="font-bold whitespace-nowrap">[{question.marks}]</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-16 pt-8 border-t border-slate-200 text-center text-[10px] uppercase tracking-[0.25em] font-bold text-slate-400">
              *** End of Examination Paper ***
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm font-medium",
        active ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/50"
      )}
    >
      {icon}
      {label}
    </div>
  );
}

function ConfigItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{label}</span>
      <div className="bg-dark-panel p-4 rounded-xl border border-dark-border text-xl font-bold text-white text-center">
        {value}
      </div>
    </div>
  );
}

function DistBadge({ label, count }: { label: string, count: number }) {
  return (
    <div className="flex-1 bg-dark-panel border border-dark-border py-2 px-3 rounded-lg flex flex-col items-center justify-center gap-1">
      <span className="text-white font-bold text-sm">{count}</span>
      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">{label}</span>
    </div>
  );
}
