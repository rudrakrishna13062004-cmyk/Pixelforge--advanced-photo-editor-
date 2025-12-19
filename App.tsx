import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, Download, SlidersHorizontal, Wand2, Maximize, Palette, 
  RotateCw, Type, Trash2, Plus, Minus, Grid, Copy, Sparkles, X
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
      return next.slice(-15);
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

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `pixelforge-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const isRotated = rotation % 180 !== 0;
    canvas.width = isRotated ? image.height : image.width;
    canvas.height = isRotated ? image.width : image.height;

    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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

    if (overlay.image) {
      ctx.save();
      ctx.globalAlpha = overlay.opacity;
      ctx.globalCompositeOperation = overlay.blendMode;
      ctx.drawImage(overlay.image, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

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
      }
      ctx.moveTo(s.points[0].x, s.points[0].y);
      s.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    texts.forEach(t => {
      ctx.font = `bold ${t.size}px sans-serif`;
      ctx.fillStyle = t.color;
      ctx.textAlign = t.align;
      ctx.textBaseline = 'middle';
      ctx.fillText(t.text, t.x, t.y);
    });
  }, [image, adjustments, rotation, overlay, strokes, texts, canvasBg]);

  useEffect(() => {
    if (image) render();
  }, [render, image]);

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (activeTool !== 'draw' || !image || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const x = (clientX - rect.left) * (canvasRef.current.width / rect.width);
    const y = (clientY - rect.top) * (canvasRef.current.height / rect.height);

    if (e.type === 'mousedown' || e.type === 'touchstart') {
      setIsDrawing(true);
      setStrokes(prev => [...prev, { id: Date.now().toString(), points: [{x, y}], color: brushSettings.color, width: brushSettings.width, mode: brushSettings.mode }]);
    } else if ((e.type === 'mousemove' || e.type === 'touchmove') && isDrawing) {
      if (e.cancelable) e.preventDefault();
      setStrokes(prev => {
        const last = prev[prev.length - 1];
        if (!last) return prev;
        return [...prev.slice(0, -1), { ...last, points: [...last.points, {x, y}] }];
      });
    } else if (e.type === 'mouseup' || e.type === 'touchend' || e.type === 'mouseleave') {
      if (isDrawing) {
        setIsDrawing(false);
        saveToHistory();
      }
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#05080f] text-slate-100 overflow-hidden font-sans select-none">
      {/* Tool Sidebar */}
      <nav className="w-16 md:w-20 bg-[#0f172a] border-r border-white/5 flex flex-col items-center py-6 space-y-6 z-30 shadow-2xl">
        <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/20 mb-2 hover:scale-110 transition-transform cursor-pointer">
          <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-white" />
        </div>
        
        <NavBtn icon={<SlidersHorizontal className="w-5 h-5" />} label="Edit" active={activeTool === 'adjust'} onClick={() => setActiveTool('adjust')} />
        <NavBtn icon={<Wand2 className="w-5 h-5" />} label="LUTS" active={activeTool === 'filter'} onClick={() => setActiveTool('filter')} />
        <NavBtn icon={<Copy className="w-5 h-5" />} label="Mix" active={activeTool === 'overlay'} onClick={() => setActiveTool('overlay')} />
        <NavBtn icon={<Maximize className="w-5 h-5" />} label="Crop" active={activeTool === 'transform'} onClick={() => setActiveTool('transform')} />
        <NavBtn icon={<Palette className="w-5 h-5" />} label="Draw" active={activeTool === 'draw'} onClick={() => setActiveTool('draw')} />
        <NavBtn icon={<Type className="w-5 h-5" />} label="Text" active={activeTool === 'text'} onClick={() => setActiveTool('text')} />
        
        <div className="mt-auto space-y-4 pt-4 border-t border-white/5 w-full flex flex-col items-center">
          <button onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-500 hover:text-white transition-colors" title="Open"><Upload className="w-5 h-5" /></button>
          <button onClick={download} className="p-3 text-blue-500 hover:text-blue-400 transition-colors" title="Export"><Download className="w-5 h-5" /></button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col min-w-0 bg-[#05080f]">
        <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#0f172a]/95 backdrop-blur-md z-20">
          <div className="flex items-center space-x-6">
            <h1 className="text-[10px] md:text-sm font-black tracking-[0.2em] text-white">PIXEL<span className="text-blue-500">FORGE</span> ULTRA</h1>
          </div>
          <div className="flex items-center space-x-3">
             <button onClick={() => setShowGrid(!showGrid)} className={`p-2 rounded-lg transition-colors ${showGrid ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}><Grid className="w-4 h-4" /></button>
             <button onClick={download} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-black tracking-widest shadow-lg shadow-blue-500/20">EXPORT</button>
          </div>
        </header>

        <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4 md:p-8 touch-none">
          <input type="file" ref={fileInputRef} onChange={(e) => handleFile(e)} className="hidden" accept="image/*" />
          <input type="file" ref={overlayInputRef} onChange={(e) => handleFile(e, true)} className="hidden" accept="image/*" />
          
          {showGrid && (
            <div className="absolute inset-0 pointer-events-none opacity-5" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          )}

          {!image ? (
            <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer group flex flex-col items-center justify-center p-12 md:p-24 border border-white/5 rounded-[3rem] bg-[#0f172a]/40 hover:bg-blue-600/5 transition-all duration-500">
               <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl group-hover:scale-105 transition-transform">
                 <Upload className="w-6 h-6 md:w-8 md:h-8 text-white" />
               </div>
               <h2 className="text-lg md:text-xl font-bold text-white mb-2 tracking-tight">Open New Project</h2>
               <p className="text-slate-500 text-[10px] font-medium uppercase tracking-widest text-center">Tap here to select an image</p>
            </div>
          ) : (
            <div className="relative shadow-2xl transition-transform duration-300 ease-out" style={{ transform: `scale(${zoom})` }}>
              <canvas 
                ref={canvasRef} 
                onMouseDown={handleInteraction} 
                onMouseMove={handleInteraction} 
                onMouseUp={handleInteraction}
                onMouseLeave={handleInteraction}
                onTouchStart={handleInteraction}
                onTouchMove={handleInteraction}
                onTouchEnd={handleInteraction}
                className={`block rounded shadow-2xl max-w-full max-h-[70vh] object-contain ${activeTool === 'draw' ? 'cursor-crosshair' : 'cursor-default'}`} 
              />
            </div>
          )}
        </div>

        {/* Dynamic Controls Footer */}
        <footer className="h-44 md:h-48 bg-[#0f172a] border-t border-white/5 p-4 md:p-6 z-20 flex items-center overflow-x-auto">
          <div className="max-w-screen-2xl mx-auto w-full flex items-center justify-center">
            {!image && <div className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">Select an image to unlock controls</div>}
            
            {image && activeTool === 'adjust' && (
              <div className="flex space-x-6 md:grid md:grid-cols-5 md:gap-x-12 md:gap-y-4 w-full px-4">
                <ControlSlider label="Exposure" val={adjustments.exposure} min={0} max={200} onChange={v => setAdjustments({...adjustments, exposure: v})} />
                <ControlSlider label="Contrast" val={adjustments.contrast} min={0} max={200} onChange={v => setAdjustments({...adjustments, contrast: v})} />
                <ControlSlider label="Saturation" val={adjustments.saturation} min={0} max={200} onChange={v => setAdjustments({...adjustments, saturation: v})} />
                <ControlSlider label="Blur" val={adjustments.blur} min={0} max={20} onChange={v => setAdjustments({...adjustments, blur: v})} />
                <ControlSlider label="Grain" val={adjustments.grain} min={0} max={5000} onChange={v => setAdjustments({...adjustments, grain: v})} />
              </div>
            )}

            {image && activeTool === 'filter' && (
              <div className="flex space-x-4 md:space-x-8 px-4">
                {ULTRA_PRESETS.map(p => (
                  <button key={p.id} onClick={() => { setAdjustments(p.adj); saveToHistory(); }} className="group flex flex-col items-center space-y-2">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-800 rounded-2xl border border-white/10 group-hover:border-blue-500 flex items-center justify-center text-center transition-all overflow-hidden">
                       <span className="text-[8px] font-black uppercase tracking-tighter">{p.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {image && activeTool === 'overlay' && (
              <div className="flex items-center space-x-8">
                 {!overlay.image ? (
                   <button onClick={() => overlayInputRef.current?.click()} className="flex flex-col items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-2xl border border-dashed border-white/20 hover:border-blue-500 text-slate-500 transition-all">
                      <Plus className="w-5 h-5 mb-1" />
                      <span className="text-[7px] font-bold uppercase">Add Overlay</span>
                   </button>
                 ) : (
                   <div className="flex items-center space-x-8">
                      <ControlSlider label="Opacity" val={overlay.opacity * 100} min={0} max={100} onChange={v => setOverlay({...overlay, opacity: v/100})} />
                      <button onClick={() => setOverlay({ image: null, opacity: 0.5, blendMode: 'screen' })} className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-4 h-4" /></button>
                   </div>
                 )}
              </div>
            )}

            {image && activeTool === 'draw' && (
              <div className="flex items-center space-x-8">
                 <div className="flex flex-col space-y-2">
                    <span className="text-[8px] font-black uppercase text-slate-500">Color</span>
                    <div className="flex space-x-2">
                      {['#3b82f6', '#ef4444', '#10b981', '#ffffff', '#000000'].map(c => (
                        <button key={c} onClick={() => setBrushSettings({...brushSettings, color: c})} className={`w-5 h-5 md:w-6 md:h-6 rounded-full border-2 ${brushSettings.color === c ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                 </div>
                 <ControlSlider label="Brush Size" val={brushSettings.width} min={1} max={100} onChange={v => setBrushSettings({...brushSettings, width: v})} />
                 <button onClick={() => setStrokes([])} className="p-3 bg-red-500/10 text-red-500 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
              </div>
            )}

            {image && activeTool === 'transform' && (
              <div className="flex items-center space-x-10">
                 <button onClick={() => { setRotation(r => (r + 90) % 360); saveToHistory(); }} className="flex flex-col items-center space-y-2 group">
                   <div className="p-4 bg-slate-800 rounded-2xl group-hover:bg-blue-600/10 group-hover:text-blue-500 transition-all"><RotateCw className="w-5 h-5" /></div>
                   <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Rotate 90°</span>
                 </button>
                 <button onClick={() => { setRotation(0); setZoom(0.8); }} className="flex flex-col items-center space-y-2 group">
                   <div className="p-4 bg-slate-800 rounded-2xl group-hover:bg-red-500/10 group-hover:text-red-500 transition-all"><X className="w-5 h-5" /></div>
                   <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Reset</span>
                 </button>
              </div>
            )}
          </div>
        </footer>
      </main>
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
      <input type="range" min={min} max={max} value={val} onChange={(e) => onChange(Number(e.target.value))} className="w-full h-[3px] bg-slate-800 rounded-full appearance-none accent-blue-500 cursor-pointer" />
    </div>
  );
}
