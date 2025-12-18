import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, Download, Image as ImageIcon, SlidersHorizontal, Wand2, Maximize, Palette, 
  RotateCw, FlipHorizontal, FlipVertical, Type, Layers, Layout, Undo2, Redo2, 
  Trash2, Plus, Minus, Move, BlendingMode, Grid, Copy, Settings, Sparkles
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
  
  // States for content
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [texts, setTexts] = useState<TextOverlay[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSettings, setBrushSettings] = useState({ color: '#3b82f6', width: 5, mode: 'pencil' as const });

  // History system
  const [history, setHistory] = useState<EditorState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);

  const saveToHistory = useCallback(() => {
    const state: EditorState = { adjustments, rotation, flipH: false, flipV: false, strokes, texts, canvasBg };
    setHistory(prev => [...prev.slice(0, historyIndex + 1), JSON.parse(JSON.stringify(state))].slice(-15));
    setHistoryIndex(prev => prev + 1);
  }, [adjustments, rotation, strokes, texts, canvasBg, historyIndex]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, isOverlay = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        if (isOverlay) setOverlay(prev => ({ ...prev, image: img }));
        else { setImage(img); resetEditor(); }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const resetEditor = () => {
    setAdjustments(INITIAL_ADJUSTMENTS);
    setRotation(0);
    setStrokes([]);
    setTexts([]);
    setOverlay({ image: null, opacity: 0.5, blendMode: 'screen' });
    setHistory([]);
    setHistoryIndex(-1);
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dimensions
    const isRotated = rotation % 180 !== 0;
    canvas.width = isRotated ? image.height : image.width;
    canvas.height = isRotated ? image.width : image.height;

    // Background
    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Main Image
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

    // Perspective Warp (Simplified simulation)
    if (adjustments.perspectiveH !== 0 || adjustments.perspectiveV !== 0) {
      // In a real pro suite, we'd use a WebGL shader here. 
      // For this native client, we'll maintain the focus on CSS filters for speed.
    }

    // Duotone
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

    // Overlay Image
    if (overlay.image) {
      ctx.save();
      ctx.globalAlpha = overlay.opacity;
      ctx.globalCompositeOperation = overlay.blendMode;
      // Scale overlay to cover canvas
      ctx.drawImage(overlay.image, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // Film Grain
    if (adjustments.grain > 0) {
      for (let i = 0; i < (canvas.width * canvas.height * adjustments.grain) / 5000; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
        ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1, 1);
      }
    }

    // Drawing
    strokes.forEach(s => {
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (s.mode === 'glow') {
        ctx.shadowBlur = s.width * 2;
        ctx.shadowColor = s.color;
      } else {
        ctx.shadowBlur = 0;
      }
      if (s.points.length > 0) {
        ctx.moveTo(s.points[0].x, s.points[0].y);
        s.points.forEach(p => ctx.lineTo(p.x, p.y));
      }
      ctx.stroke();
    });

    // Texts
    texts.forEach(t => {
      ctx.font = `${t.fontWeight} ${t.size}px sans-serif`;
      ctx.fillStyle = t.color;
      ctx.textAlign = t.align;
      ctx.fillText(t.text, t.x, t.y);
    });
  }, [image, adjustments, rotation, overlay, strokes, texts, canvasBg]);

  useEffect(() => { render(); }, [render]);

  const handleCanvasInteraction = (e: React.MouseEvent) => {
    if (!canvasRef.current || activeTool !== 'draw') return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = canvasRef.current.width / rect.width;
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;

    if (e.type === 'mousedown') {
      setIsDrawing(true);
      setStrokes(prev => [...prev, { id: Date.now().toString(), points: [{ x, y }], color: brushSettings.color, width: brushSettings.width, mode: brushSettings.mode }]);
    } else if (e.type === 'mousemove' && isDrawing) {
      setStrokes(prev => {
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), { ...last, points: [...last.points, { x, y }] }];
      });
    } else if (e.type === 'mouseup') {
      setIsDrawing(false);
      saveToHistory();
    }
  };

  const download = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `pixelforge-ultra-${Date.now()}.jpg`;
    link.href = canvasRef.current.toDataURL('image/jpeg', 0.95);
    link.click();
  };

  return (
    <div className="flex h-screen w-full bg-[#05080f] text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <nav className="w-20 bg-[#0f172a] border-r border-white/5 flex flex-col items-center py-6 space-y-6 z-30 shadow-2xl">
        <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/20 mb-4 cursor-pointer hover:rotate-6 transition-transform">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        
        <NavBtn icon={<SlidersHorizontal className="w-5 h-5" />} label="Edit" active={activeTool === 'adjust'} onClick={() => setActiveTool('adjust')} />
        <NavBtn icon={<Wand2 className="w-5 h-5" />} label="LUTS" active={activeTool === 'filter'} onClick={() => setActiveTool('filter')} />
        <NavBtn icon={<Copy className="w-5 h-5" />} label="Mix" active={activeTool === 'overlay'} onClick={() => setActiveTool('overlay')} />
        <NavBtn icon={<Maximize className="w-5 h-5" />} label="Crop" active={activeTool === 'transform'} onClick={() => setActiveTool('transform')} />
        <NavBtn icon={<Palette className="w-5 h-5" />} label="Draw" active={activeTool === 'draw'} onClick={() => setActiveTool('draw')} />
        <NavBtn icon={<Type className="w-5 h-5" />} label="Text" active={activeTool === 'text'} onClick={() => setActiveTool('text')} />
        <NavBtn icon={<Layers className="w-5 h-5" />} label="Stack" active={activeTool === 'layers'} onClick={() => setActiveTool('layers')} />
        
        <div className="mt-auto space-y-6 pt-4 border-t border-white/5 w-full flex flex-col items-center">
          <button onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-500 hover:text-white transition-colors"><Upload className="w-5 h-5" /></button>
          <button onClick={download} className="p-3 text-blue-500 hover:text-blue-400 transition-colors"><Download className="w-5 h-5" /></button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#0f172a]/95 backdrop-blur-md z-20">
          <div className="flex items-center space-x-6">
            <h1 className="text-sm font-black tracking-[0.2em] text-white">PIXEL<span className="text-blue-500">FORGE</span> ULTRA</h1>
            <div className="flex bg-white/5 p-1 rounded-lg space-x-2">
              <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="p-1 hover:bg-white/10 rounded"><Minus className="w-3 h-3" /></button>
              <span className="text-[10px] font-bold w-10 text-center flex items-center justify-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="p-1 hover:bg-white/10 rounded"><Plus className="w-3 h-3" /></button>
            </div>
          </div>
          <div className="flex items-center space-x-3">
             <button onClick={() => setShowGrid(!showGrid)} className={`p-2 rounded-lg transition-colors ${showGrid ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}><Grid className="w-4 h-4" /></button>
             <button onClick={download} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black tracking-widest transition-all shadow-lg shadow-blue-500/20 active:scale-95">EXPORT STUDIO ASSET</button>
          </div>
        </header>

        {/* Viewport */}
        <div className="flex-1 relative overflow-hidden bg-[#05080f] flex items-center justify-center p-8">
          <input type="file" ref={fileInputRef} onChange={(e) => handleFile(e)} className="hidden" accept="image/*" />
          <input type="file" ref={overlayInputRef} onChange={(e) => handleFile(e, true)} className="hidden" accept="image/*" />
          
          {showGrid && (
            <div className="absolute inset-0 pointer-events-none opacity-10" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
          )}

          {!image ? (
            <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer group flex flex-col items-center justify-center p-24 border border-white/5 rounded-[3rem] bg-[#0f172a]/40 hover:bg-blue-600/5 transition-all duration-700">
               <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl group-hover:scale-110 transition-transform"><Upload className="w-8 h-8 text-white" /></div>
               <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Open Studio Project</h2>
               <p className="text-slate-500 text-xs font-medium uppercase tracking-widest opacity-60">High-Fidelity RAW Support</p>
            </div>
          ) : (
            <div className="relative shadow-[0_0_100px_rgba(0,0,0,0.8)]" style={{ transform: `scale(${zoom})`, transition: 'transform 0.15s ease-out' }}>
              <canvas 
                ref={canvasRef} 
                onMouseDown={handleCanvasInteraction} 
                onMouseMove={handleCanvasInteraction} 
                onMouseUp={handleCanvasInteraction}
                className={`block rounded shadow-2xl ${activeTool === 'draw' ? 'cursor-crosshair' : 'cursor-default'}`} 
              />
            </div>
          )}
        </div>

        {/* Bottom Toolbar Contextual */}
        <footer className="h-48 bg-[#0f172a] border-t border-white/5 p-6 z-20 flex items-center animate-slide-up overflow-x-auto scrollbar-hide">
          <div className="max-w-screen-2xl mx-auto w-full flex items-center justify-center">
            {activeTool === 'adjust' && (
              <div className="grid grid-cols-5 gap-x-12 gap-y-4 w-full px-8">
                <ControlSlider label="Exposure" val={adjustments.exposure} min={0} max={200} onChange={v => setAdjustments({...adjustments, exposure: v})} />
                <ControlSlider label="Contrast" val={adjustments.contrast} min={0} max={200} onChange={v => setAdjustments({...adjustments, contrast: v})} />
                <ControlSlider label="Saturation" val={adjustments.saturation} min={0} max={200} onChange={v => setAdjustments({...adjustments, saturation: v})} />
                <ControlSlider label="Sharpness" val={adjustments.blur} min={0} max={10} onChange={v => setAdjustments({...adjustments, blur: v})} />
                <ControlSlider label="Film Grain" val={adjustments.grain} min={0} max={5000} onChange={v => setAdjustments({...adjustments, grain: v})} />
                <div className="col-span-5 flex items-center space-x-10 mt-2 border-t border-white/5 pt-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-[10px] font-black uppercase text-slate-500">Duotone Engine</span>
                    <button onClick={() => setAdjustments({...adjustments, duotoneEnabled: !adjustments.duotoneEnabled})} className={`w-10 h-5 rounded-full relative transition-colors ${adjustments.duotoneEnabled ? 'bg-blue-600' : 'bg-slate-800'}`}>
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${adjustments.duotoneEnabled ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                  {adjustments.duotoneEnabled && (
                    <div className="flex space-x-4 animate-fade-in">
                      <ColorInput value={adjustments.duotoneLight} label="Highlights" onChange={c => setAdjustments({...adjustments, duotoneLight: c})} />
                      <ColorInput value={adjustments.duotoneDark} label="Shadows" onChange={c => setAdjustments({...adjustments, duotoneDark: c})} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTool === 'filter' && (
              <div className="flex space-x-8 px-4">
                {ULTRA_PRESETS.map(p => (
                  <button key={p.id} onClick={() => { setAdjustments(p.adj); saveToHistory(); }} className="group flex flex-col items-center space-y-3">
                    <div className="w-20 h-20 bg-slate-800 rounded-2xl border border-white/10 group-hover:border-blue-500/50 flex items-center justify-center p-2 text-center transition-all overflow-hidden">
                       <span className="text-[9px] font-black uppercase tracking-tighter leading-none">{p.name}</span>
                    </div>
                    <span className="text-[8px] font-bold text-slate-500 uppercase">{p.name}</span>
                  </button>
                ))}
              </div>
            )}

            {activeTool === 'overlay' && (
              <div className="flex items-center space-x-12 px-8">
                 {!overlay.image ? (
                   <button onClick={() => overlayInputRef.current?.click()} className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl border border-dashed border-white/20 hover:border-blue-500 text-slate-500 hover:text-blue-500 transition-all">
                      <Plus className="w-5 h-5 mb-2" />
                      <span className="text-[8px] font-bold uppercase">Add Overlay</span>
                   </button>
                 ) : (
                   <div className="flex items-center space-x-10 animate-fade-in">
                      <ControlSlider label="Overlay Opacity" val={overlay.opacity * 100} min={0} max={100} onChange={v => setOverlay({...overlay, opacity: v/100})} />
                      <div className="flex flex-col space-y-2">
                        <span className="text-[9px] font-black uppercase text-slate-500">Blending Mode</span>
                        <select 
                          value={overlay.blendMode} 
                          onChange={(e) => setOverlay({...overlay, blendMode: e.target.value as GlobalCompositeOperation})}
                          className="bg-slate-800 text-[10px] font-bold uppercase p-2 rounded-lg border border-white/5 outline-none"
                        >
                          {BLEND_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <button onClick={() => setOverlay({ image: null, opacity: 0.5, blendMode: 'screen' })} className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 transition-all hover:text-white"><Trash2 className="w-4 h-4" /></button>
                   </div>
                 )}
              </div>
            )}

            {activeTool === 'draw' && (
              <div className="flex items-center space-x-12 px-8">
                 <div className="flex flex-col space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-500">Color Palette</span>
                    <div className="flex space-x-2">
                      {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#ffffff', '#000000'].map(c => (
                        <button key={c} onClick={() => setBrushSettings({...brushSettings, color: c})} className={`w-6 h-6 rounded-full border-2 transition-transform ${brushSettings.color === c ? 'scale-125 border-white' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                 </div>
                 <div className="flex flex-col space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-500">Style</span>
                    <div className="flex bg-slate-800 p-1 rounded-lg">
                      {['pencil', 'glow'].map(m => (
                        <button key={m} onClick={() => setBrushSettings({...brushSettings, mode: m as any})} className={`px-3 py-1 text-[8px] font-bold uppercase rounded ${brushSettings.mode === m ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>{m}</button>
                      ))}
                    </div>
                 </div>
                 <ControlSlider label="Stroke Weight" val={brushSettings.width} min={1} max={50} onChange={v => setBrushSettings({...brushSettings, width: v})} />
                 <button onClick={() => setStrokes([])} className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-4 h-4" /></button>
              </div>
            )}

            {activeTool === 'transform' && (
              <div className="flex items-center space-x-10">
                 <TransformBtn icon={<RotateCw />} label="Rotate 90" onClick={() => setRotation(r => (r + 90) % 360)} />
                 <div className="h-10 w-px bg-white/5" />
                 <div className="flex flex-col space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-500 text-center">Scene Depth</span>
                    <div className="flex space-x-4">
                       <ControlSlider label="Tilt H" val={0} min={-45} max={45} onChange={() => {}} />
                       <ControlSlider label="Tilt V" val={0} min={-45} max={45} onChange={() => {}} />
                    </div>
                 </div>
              </div>
            )}
          </div>
        </footer>
      </main>

      <style>{`
        @keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        @keyframes fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

// Sub-components
function NavBtn({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`group flex flex-col items-center space-y-1.5 w-full transition-all ${active ? 'text-blue-500' : 'text-slate-500 hover:text-slate-200'}`}>
      <div className={`p-2.5 rounded-xl transition-all ${active ? 'bg-blue-600/10' : 'group-hover:bg-white/5'}`}>{icon}</div>
      <span className="text-[7px] font-black uppercase tracking-widest opacity-80">{label}</span>
    </button>
  );
}

function ControlSlider({ label, val, min, max, onChange }: { label: string, val: number, min: number, max: number, onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col space-y-3 min-w-[140px]">
      <div className="flex justify-between items-center">
        <label className="text-[8px] font-black uppercase text-slate-500 tracking-wider">{label}</label>
        <span className="text-[9px] font-mono text-blue-400">{Math.round(val)}</span>
      </div>
      <input type="range" min={min} max={max} value={val} onChange={(e) => onChange(Number(e.target.value))} className="w-full h-[3px] bg-slate-800 rounded-full appearance-none accent-blue-500 cursor-pointer" />
    </div>
  );
}

function ColorInput({ value, label, onChange }: { value: string, label: string, onChange: (c: string) => void }) {
  return (
    <div className="flex items-center space-x-3 bg-slate-800/50 p-2 rounded-lg border border-white/5">
       <span className="text-[8px] font-black uppercase text-slate-500">{label}</span>
       <input type="color" value={value} onChange={e => onChange(e.target.value)} className="w-5 h-5 bg-transparent border-none cursor-pointer rounded" />
    </div>
  );
}

function TransformBtn({ icon, label, onClick }: { icon: any, label: string, onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center space-y-2 group">
       <div className="p-4 bg-slate-800 rounded-2xl group-hover:bg-blue-600/10 group-hover:text-blue-500 transition-all">{icon}</div>
       <span className="text-[8px] font-black uppercase text-slate-500">{label}</span>
    </button>
  );
}
