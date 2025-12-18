
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, Download, Image as ImageIcon, SlidersHorizontal, Wand2, Maximize, Palette, 
  RotateCw, Type, Layers, Layout, Undo2, Redo2, 
  Trash2, Plus, Minus, Move, Grid, Copy, Sparkles,
  FlipHorizontal, FlipVertical, X
} from 'lucide-react';
import { Adjustments, EditorTool, DrawingStroke, TextOverlay, EditorState, OverlayState } from './types';
import { INITIAL_ADJUSTMENTS, ULTRA_PRESETS, BLEND_MODES } from './constants';

export default function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [overlay, setOverlay] = useState<OverlayState>({ image: null, opacity: 0.5, blendMode: 'screen' });
  const [activeTool, setActiveTool] = useState<EditorTool>('adjust');
  const [adjustments, setAdjustments] = useState<Adjustments>(INITIAL_ADJUSTMENTS);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(0.8);
  const [canvasBg, setCanvasBg] = useState('#0a0f1a');
  const [showGrid, setShowGrid] = useState(false);
  
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [texts, setTexts] = useState<TextOverlay[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSettings, setBrushSettings] = useState({ color: '#3b82f6', width: 5, mode: 'pencil' as const });

  const [history, setHistory] = useState<EditorState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);

  const saveToHistory = useCallback(() => {
    const state: EditorState = { adjustments, rotation, flipH: false, flipV: false, strokes, texts, canvasBg };
    setHistory(prev => {
      const next = [...prev.slice(0, historyIndex + 1), JSON.parse(JSON.stringify(state))];
      return next.slice(-20); // Keep last 20 steps
    });
    setHistoryIndex(prev => prev + 1);
  }, [adjustments, rotation, strokes, texts, canvasBg, historyIndex]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, isOverlay = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        if (isOverlay) {
          setOverlay(prev => ({ ...prev, image: img }));
        } else {
          setImage(img);
          resetEditor();
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    // Reset input value so same file can be uploaded again
    e.target.value = '';
  };

  const resetEditor = () => {
    setAdjustments(INITIAL_ADJUSTMENTS);
    setRotation(0);
    setStrokes([]);
    setTexts([]);
    setOverlay({ image: null, opacity: 0.5, blendMode: 'screen' });
    setHistory([]);
    setHistoryIndex(-1);
    setZoom(0.8);
  };

  // Fix: Implement the download function to export the canvas as an image
  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `pixelforge-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const isRotated = rotation % 180 !== 0;
    canvas.width = isRotated ? image.height : image.width;
    canvas.height = isRotated ? image.width : image.height;

    // Background fill
    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Main Image with adjustments
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.filter = `
      brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%)
      saturate(${adjustments.saturation}%) grayscale(${adjustments.grayscale}%)
      blur(${adjustments.blur}px) invert(${adjustments.invert}%)
      brightness(${adjustments.exposure / 100})
    `;
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
    ctx.restore();

    // Duotone (Pixel processing - expensive, only run if enabled)
    if (adjustments.duotoneEnabled) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const light = hexToRgb(adjustments.duotoneLight) || { r: 255, g: 255, b: 255 };
      const dark = hexToRgb(adjustments.duotoneDark) || { r: 0, g: 0, b: 0 };
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3 / 255;
        data[i] = dark.r + (light.r - dark.r) * avg;
        data[i + 1] = dark.g + (light.g - dark.g) * avg;
        data[i + 2] = dark.b + (light.b - dark.b) * avg;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // Overlay Mixing
    if (overlay.image) {
      ctx.save();
      ctx.globalAlpha = overlay.opacity;
      ctx.globalCompositeOperation = overlay.blendMode;
      ctx.drawImage(overlay.image, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // Film Grain Effect
    if (adjustments.grain > 0) {
      for (let i = 0; i < (canvas.width * canvas.height * adjustments.grain) / 5000; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
        ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1, 1);
      }
    }

    // Hand-drawn Strokes
    strokes.forEach(s => {
      if (s.points.length < 1) return;
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (s.mode === 'glow') {
        ctx.shadowBlur = s.width * 1.5;
        ctx.shadowColor = s.color;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.moveTo(s.points[0].x, s.points[0].y);
      s.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    // Text Layers
    texts.forEach(t => {
      ctx.font = `${t.fontWeight} ${t.size}px sans-serif`;
      ctx.fillStyle = t.color;
      ctx.textAlign = t.align;
      ctx.textBaseline = 'middle';
      ctx.fillText(t.text, t.x, t.y);
    });
  }, [image, adjustments, rotation, overlay, strokes, texts, canvasBg]);

  useEffect(() => {
    if (image) {
      render();
    }
  }, [render, image]);

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (activeTool !== 'draw' || !image) return;

    if (e.type === 'mousedown' || e.type === 'touchstart') {
      const pos = getCanvasPos(e);
      setIsDrawing(true);
      setStrokes(prev => [...prev, { 
        id: Date.now().toString(), 
        points: [pos], 
        color: brushSettings.color, 
        width: brushSettings.width, 
        mode: brushSettings.mode 
      }]);
    } else if ((e.type === 'mousemove' || e.type === 'touchmove') && isDrawing) {
      if (e.cancelable) e.preventDefault();
      const pos = getCanvasPos(e);
      setStrokes(prev => {
        const last = prev[prev.length - 1];
        if (!last) return prev;
        return [...prev.slice(0, -1), { ...last, points: [...last.points, pos] }];
      });
    } else if (e.type === 'mouseup' || e.type === 'touchend' || e.type === 'mouseleave') {
      if (isDrawing) {
        setIsDrawing(false);
        saveToHistory();
      }
    }
  };

  const addText = () => {
    const content = prompt("Enter text:", "STUDIO PRO");
    if (!content || !canvasRef.current) return;
    const canvas = canvasRef.current;
    setTexts(prev => [...prev, {
      id: Date.now().toString(),
      text: content,
      x: canvas.width / 2,
      y: canvas.height / 2,
      color: brushSettings.color,
      size: Math.max(40, canvas.height / 10),
      fontWeight: '900',
      align: 'center',
      letterSpacing: 2
    }]);
    saveToHistory();
  };

  return (
    <div className="flex h-screen w-full bg-[#05080f] text-slate-100 overflow-hidden font-sans select-none">
      {/* Sidebar navigation */}
      <nav className="w-16 md:w-20 bg-[#0f172a] border-r border-white/5 flex flex-col items-center py-6 space-y-6 z-30 shadow-2xl">
        <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/20 mb-2 cursor-pointer hover:rotate-6 transition-transform">
          <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-white" />
        </div>
        
        <NavBtn icon={<SlidersHorizontal className="w-5 h-5" />} label="Edit" active={activeTool === 'adjust'} onClick={() => setActiveTool('adjust')} />
        <NavBtn icon={<Wand2 className="w-5 h-5" />} label="LUTS" active={activeTool === 'filter'} onClick={() => setActiveTool('filter')} />
        <NavBtn icon={<Copy className="w-5 h-5" />} label="Mix" active={activeTool === 'overlay'} onClick={() => setActiveTool('overlay')} />
        <NavBtn icon={<Maximize className="w-5 h-5" />} label="Crop" active={activeTool === 'transform'} onClick={() => setActiveTool('transform')} />
        <NavBtn icon={<Palette className="w-5 h-5" />} label="Draw" active={activeTool === 'draw'} onClick={() => setActiveTool('draw')} />
        <NavBtn icon={<Type className="w-5 h-5" />} label="Text" active={activeTool === 'text'} onClick={() => setActiveTool('text')} />
        
        <div className="mt-auto space-y-4 pt-4 border-t border-white/5 w-full flex flex-col items-center">
          <button onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-500 hover:text-white transition-colors" title="Open Image"><Upload className="w-5 h-5" /></button>
          <button onClick={download} className="p-3 text-blue-500 hover:text-blue-400 transition-colors" title="Export"><Download className="w-5 h-5" /></button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col min-w-0">
        {/* Workspace Header */}
        <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#0f172a]/95 backdrop-blur-md z-20">
          <div className="flex items-center space-x-6">
            <h1 className="text-xs md:text-sm font-black tracking-[0.2em] text-white">PIXEL<span className="text-blue-500">FORGE</span> ULTRA</h1>
            <div className="hidden md:flex bg-white/5 p-1 rounded-lg space-x-2">
              <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="p-1 hover:bg-white/10 rounded"><Minus className="w-3 h-3" /></button>
              <span className="text-[10px] font-bold w-10 text-center flex items-center justify-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(5, z + 0.1))} className="p-1 hover:bg-white/10 rounded"><Plus className="w-3 h-3" /></button>
            </div>
          </div>
          <div className="flex items-center space-x-3">
             <button onClick={() => setShowGrid(!showGrid)} className={`p-2 rounded-lg transition-colors ${showGrid ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}><Grid className="w-4 h-4" /></button>
             <button onClick={download} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-black tracking-widest transition-all shadow-lg shadow-blue-500/20 active:scale-95">EXPORT FINAL</button>
          </div>
        </header>

        {/* The Viewport */}
        <div className="flex-1 relative overflow-hidden bg-[#05080f] flex items-center justify-center p-4 md:p-8 touch-none">
          <input type="file" ref={fileInputRef} onChange={(e) => handleFile(e)} className="hidden" accept="image/*" />
          <input type="file" ref={overlayInputRef} onChange={(e) => handleFile(e, true)} className="hidden" accept="image/*" />
          
          {showGrid && (
            <div className="absolute inset-0 pointer-events-none opacity-10" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          )}

          {!image ? (
            <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer group flex flex-col items-center justify-center p-12 md:p-24 border border-white/5 rounded-[3rem] bg-[#0f172a]/40 hover:bg-blue-600/5 transition-all duration-700">
               <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center mb-6 md:mb-8 shadow-2xl group-hover:scale-110 transition-transform">
                 <Upload className="w-6 h-6 md:w-8 md:h-8 text-white" />
               </div>
               <h2 className="text-lg md:text-xl font-bold text-white mb-2 tracking-tight">Open Studio Project</h2>
               <p className="text-slate-500 text-[10px] font-medium uppercase tracking-widest opacity-60 text-center">Tap to start editing</p>
            </div>
          ) : (
            <div className="relative shadow-[0_0_100px_rgba(0,0,0,0.8)]" style={{ transform: `scale(${zoom})`, transition: 'transform 0.15s ease-out' }}>
              <canvas 
                ref={canvasRef} 
                onMouseDown={handleInteraction} 
                onMouseMove={handleInteraction} 
                onMouseUp={handleInteraction}
                onMouseLeave={handleInteraction}
                onTouchStart={handleInteraction}
                onTouchMove={handleInteraction}
                onTouchEnd={handleInteraction}
                className={`block rounded shadow-2xl ${activeTool === 'draw' ? 'cursor-crosshair' : 'cursor-default'}`} 
              />
            </div>
          )}
        </div>

        {/* Bottom Toolbar */}
        <footer className="h-44 md:h-48 bg-[#0f172a] border-t border-white/5 p-4 md:p-6 z-20 flex items-center overflow-x-auto overflow-y-hidden">
          <div className="max-w-screen-2xl mx-auto w-full flex items-center justify-center">
            {activeTool === 'adjust' && (
              <div className="flex space-x-8 md:grid md:grid-cols-5 md:gap-x-12 md:gap-y-4 w-full px-4 md:px-8">
                <ControlSlider label="Exposure" val={adjustments.exposure} min={0} max={200} onChange={v => setAdjustments({...adjustments, exposure: v})} />
                <ControlSlider label="Contrast" val={adjustments.contrast} min={0} max={200} onChange={v => setAdjustments({...adjustments, contrast: v})} />
                <ControlSlider label="Saturation" val={adjustments.saturation} min={0} max={200} onChange={v => setAdjustments({...adjustments, saturation: v})} />
                <ControlSlider label="Blur" val={adjustments.blur} min={0} max={20} onChange={v => setAdjustments({...adjustments, blur: v})} />
                <ControlSlider label="Grain" val={adjustments.grain} min={0} max={5000} onChange={v => setAdjustments({...adjustments, grain: v})} />
                
                <div className="hidden md:flex col-span-5 items-center space-x-6 mt-2 border-t border-white/5 pt-4">
                  <span className="text-[10px] font-black uppercase text-slate-500">Duotone</span>
                  <button onClick={() => setAdjustments({...adjustments, duotoneEnabled: !adjustments.duotoneEnabled})} className={`w-8 h-4 rounded-full relative transition-colors ${adjustments.duotoneEnabled ? 'bg-blue-600' : 'bg-slate-800'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${adjustments.duotoneEnabled ? 'left-4.5' : 'left-0.5'}`} />
                  </button>
                  {adjustments.duotoneEnabled && (
                    <div className="flex space-x-3">
                      <ColorInput value={adjustments.duotoneLight} label="Hi" onChange={c => setAdjustments({...adjustments, duotoneLight: c})} />
                      <ColorInput value={adjustments.duotoneDark} label="Sh" onChange={c => setAdjustments({...adjustments, duotoneDark: c})} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTool === 'filter' && (
              <div className="flex space-x-4 md:space-x-8 px-4">
                {ULTRA_PRESETS.map(p => (
                  <button key={p.id} onClick={() => { setAdjustments(p.adj); saveToHistory(); }} className="group flex flex-col items-center space-y-2">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-800 rounded-2xl border border-white/10 group-hover:border-blue-500/50 flex items-center justify-center p-2 text-center transition-all overflow-hidden">
                       <span className="text-[8px] md:text-[9px] font-black uppercase tracking-tighter leading-none">{p.name}</span>
                    </div>
                    <span className="text-[7px] md:text-[8px] font-bold text-slate-500 uppercase">{p.name}</span>
                  </button>
                ))}
              </div>
            )}

            {activeTool === 'overlay' && (
              <div className="flex items-center space-x-8 md:space-x-12 px-4 md:px-8">
                 {!overlay.image ? (
                   <button onClick={() => overlayInputRef.current?.click()} className="flex flex-col items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-2xl border border-dashed border-white/20 hover:border-blue-500 text-slate-500 hover:text-blue-500 transition-all">
                      <Plus className="w-5 h-5 mb-1" />
                      <span className="text-[7px] font-bold uppercase">Add Mix</span>
                   </button>
                 ) : (
                   <div className="flex items-center space-x-6 md:space-x-10">
                      <ControlSlider label="Opacity" val={overlay.opacity * 100} min={0} max={100} onChange={v => setOverlay({...overlay, opacity: v/100})} />
                      <div className="flex flex-col space-y-1">
                        <span className="text-[8px] font-black uppercase text-slate-500">Mode</span>
                        <select 
                          value={overlay.blendMode} 
                          onChange={(e) => setOverlay({...overlay, blendMode: e.target.value as GlobalCompositeOperation})}
                          className="bg-slate-800 text-[9px] font-bold uppercase p-1.5 rounded-lg border border-white/5 outline-none"
                        >
                          {BLEND_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <button onClick={() => setOverlay({ image: null, opacity: 0.5, blendMode: 'screen' })} className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 transition-all hover:text-white"><Trash2 className="w-4 h-4" /></button>
                   </div>
                 )}
              </div>
            )}

            {activeTool === 'draw' && (
              <div className="flex items-center space-x-8 md:space-x-12 px-4 md:px-8">
                 <div className="flex flex-col space-y-2">
                    <span className="text-[8px] font-black uppercase text-slate-500">Color</span>
                    <div className="flex space-x-1.5 md:space-x-2">
                      {['#3b82f6', '#ef4444', '#10b981', '#ffffff', '#000000'].map(c => (
                        <button key={c} onClick={() => setBrushSettings({...brushSettings, color: c})} className={`w-5 h-5 md:w-6 md:h-6 rounded-full border-2 transition-transform ${brushSettings.color === c ? 'scale-125 border-white' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                 </div>
                 <div className="flex flex-col space-y-2">
                    <span className="text-[8px] font-black uppercase text-slate-500">Style</span>
                    <div className="flex bg-slate-800 p-0.5 md:p-1 rounded-lg">
                      {['pencil', 'glow'].map(m => (
                        <button key={m} onClick={() => setBrushSettings({...brushSettings, mode: m as any})} className={`px-2 md:px-3 py-1 text-[7px] md:text-[8px] font-bold uppercase rounded ${brushSettings.mode === m ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>{m}</button>
                      ))}
                    </div>
                 </div>
                 <ControlSlider label="Size" val={brushSettings.width} min={1} max={100} onChange={v => setBrushSettings({...brushSettings, width: v})} />
                 <button onClick={() => { setStrokes([]); saveToHistory(); }} className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-4 h-4" /></button>
              </div>
            )}

            {activeTool === 'text' && (
              <div className="flex items-center space-x-10">
                <button onClick={addText} className="flex flex-col items-center space-y-2 group">
                  <div className="p-4 bg-blue-600/10 rounded-2xl group-hover:bg-blue-600 text-blue-500 group-hover:text-white transition-all"><Type className="w-5 h-5" /></div>
                  <span className="text-[8px] font-black uppercase text-slate-500">Add Text Layer</span>
                </button>
                <button onClick={() => { setTexts([]); saveToHistory(); }} className="flex flex-col items-center space-y-2 group">
                  <div className="p-4 bg-red-600/10 rounded-2xl group-hover:bg-red-600 text-red-500 group-hover:text-white transition-all"><Trash2 className="w-5 h-5" /></div>
                  <span className="text-[8px] font-black uppercase text-slate-500">Clear Text</span>
                </button>
              </div>
            )}

            {activeTool === 'transform' && (
              <div className="flex items-center space-x-10">
                 <button onClick={() => { setRotation(r => (r + 90) % 360); saveToHistory(); }} className="flex flex-col items-center space-y-2 group">
                   <div className="p-4 bg-slate-800 rounded-2xl group-hover:bg-blue-600/10 group-hover:text-blue-500 transition-all"><RotateCw className="w-5 h-5" /></div>
                   <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Rotate 90°</span>
                 </button>
                 <button onClick={() => { setRotation(0); saveToHistory(); }} className="flex flex-col items-center space-y-2 group">
                   <div className="p-4 bg-slate-800 rounded-2xl group-hover:bg-red-600/10 group-hover:text-red-500 transition-all"><X className="w-5 h-5" /></div>
                   <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Reset Orientation</span>
                 </button>
              </div>
            )}
          </div>
        </footer>
      </main>

      <style>{`
        @keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}

function NavBtn({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`group flex flex-col items-center space-y-1.5 w-full transition-all ${active ? 'text-blue-500' : 'text-slate-500 hover:text-slate-200'}`}>
      <div className={`p-2 md:p-2.5 rounded-xl transition-all ${active ? 'bg-blue-600/10' : 'group-hover:bg-white/5'}`}>{icon}</div>
      <span className="text-[6px] md:text-[7px] font-black uppercase tracking-widest opacity-80">{label}</span>
    </button>
  );
}

function ControlSlider({ label, val, min, max, onChange }: { label: string, val: number, min: number, max: number, onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col space-y-2.5 min-w-[100px] md:min-w-[140px]">
      <div className="flex justify-between items-center">
        <label className="text-[7px] md:text-[8px] font-black uppercase text-slate-500 tracking-wider">{label}</label>
        <span className="text-[8px] md:text-[9px] font-mono text-blue-400">{Math.round(val)}</span>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        value={val} 
        onChange={(e) => onChange(Number(e.target.value))} 
        className="w-full h-[3px] bg-slate-800 rounded-full appearance-none accent-blue-500 cursor-pointer" 
      />
    </div>
  );
}

function ColorInput({ value, label, onChange }: { value: string, label: string, onChange: (c: string) => void }) {
  return (
    <div className="flex items-center space-x-2 bg-slate-800/50 p-1.5 rounded-lg border border-white/5">
       <span className="text-[7px] font-black uppercase text-slate-500">{label}</span>
       <input type="color" value={value} onChange={e => onChange(e.target.value)} className="w-4 h-4 bg-transparent border-none cursor-pointer rounded" />
    </div>
  );
}
