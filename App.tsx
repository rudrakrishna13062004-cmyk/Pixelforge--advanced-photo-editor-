import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, Download, SlidersHorizontal, Wand2, Maximize, Palette, 
  RotateCw, Type, Trash2, Plus, Minus, Grid, Copy, Sparkles, X,
  Undo2, Redo2, Layers, Sun, Contrast, Droplets, Cloud
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);

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
          setAdjustments(INITIAL_ADJUSTMENTS);
          setRotation(0);
          setStrokes([]);
          setTexts([]);
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `pixelforge_export_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
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

    // Background
    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Main Image
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.filter = `
      brightness(${adjustments.brightness}%) 
      contrast(${adjustments.contrast}%) 
      saturate(${adjustments.saturation}%) 
      grayscale(${adjustments.grayscale}%) 
      sepia(${adjustments.sepia}%) 
      hue-rotate(${adjustments.hueRotate}deg) 
      blur(${adjustments.blur}px) 
      invert(${adjustments.invert}%)
    `;
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
    ctx.restore();

    // Overlay
    if (overlay.image) {
      ctx.save();
      ctx.globalAlpha = overlay.opacity;
      ctx.globalCompositeOperation = overlay.blendMode;
      ctx.drawImage(overlay.image, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // Drawing
    strokes.forEach(s => {
      if (s.points.length < 1) return;
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (s.mode === 'glow') {
        ctx.shadowBlur = s.width * 2;
        ctx.shadowColor = s.color;
      }
      ctx.moveTo(s.points[0].x, s.points[0].y);
      s.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    // Text
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
    
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    if (e.type === 'mousedown' || e.type === 'touchstart') {
      setIsDrawing(true);
      setStrokes(prev => [...prev, { 
        id: Date.now().toString(), 
        points: [{x, y}], 
        color: brushSettings.color, 
        width: brushSettings.width, 
        mode: brushSettings.mode 
      }]);
    } else if ((e.type === 'mousemove' || e.type === 'touchmove') && isDrawing) {
      if (e.cancelable) e.preventDefault();
      setStrokes(prev => {
        const last = prev[prev.length - 1];
        if (!last) return prev;
        return [...prev.slice(0, -1), { ...last, points: [...last.points, {x, y}] }];
      });
    } else if (e.type === 'mouseup' || e.type === 'touchend' || e.type === 'mouseleave') {
      setIsDrawing(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#05080f] text-slate-100 overflow-hidden font-sans select-none">
      {/* Sidebar */}
      <nav className="w-16 md:w-20 bg-[#0f172a] border-r border-white/5 flex flex-col items-center py-6 space-y-4 z-30 shadow-2xl">
        <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/20 mb-4 hover:scale-105 transition-transform cursor-pointer">
          <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-white" />
        </div>
        
        <NavBtn icon={<SlidersHorizontal className="w-5 h-5" />} label="Tune" active={activeTool === 'adjust'} onClick={() => setActiveTool('adjust')} />
        <NavBtn icon={<Wand2 className="w-5 h-5" />} label="LUTS" active={activeTool === 'filter'} onClick={() => setActiveTool('filter')} />
        <NavBtn icon={<Copy className="w-5 h-5" />} label="Mix" active={activeTool === 'overlay'} onClick={() => setActiveTool('overlay')} />
        <NavBtn icon={<Maximize className="w-5 h-5" />} label="Crop" active={activeTool === 'transform'} onClick={() => setActiveTool('transform')} />
        <NavBtn icon={<Palette className="w-5 h-5" />} label="Ink" active={activeTool === 'draw'} onClick={() => setActiveTool('draw')} />
        <NavBtn icon={<Type className="w-5 h-5" />} label="Type" active={activeTool === 'text'} onClick={() => setActiveTool('text')} />
        
        <div className="mt-auto space-y-4 pt-4 border-t border-white/5 w-full flex flex-col items-center">
          <button onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-500 hover:text-white transition-colors" title="Import"><Upload className="w-5 h-5" /></button>
          <button onClick={download} className="p-3 text-blue-500 hover:text-blue-400 transition-colors" title="Export"><Download className="w-5 h-5" /></button>
        </div>
      </nav>

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#05080f]">
        <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#0f172a]/80 backdrop-blur-xl z-20">
          <div className="flex items-center space-x-4">
            <h1 className="text-[10px] md:text-xs font-black tracking-[0.3em] text-white opacity-80 uppercase">PixelForge <span className="text-blue-500">Ultra</span></h1>
          </div>
          <div className="flex items-center space-x-3">
             <button onClick={() => setShowGrid(!showGrid)} className={`p-2 rounded-lg transition-colors ${showGrid ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}><Grid className="w-4 h-4" /></button>
             <button onClick={download} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[9px] font-black tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/20">SAVE</button>
          </div>
        </header>

        {/* Canvas Viewport */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center p-6 md:p-12 touch-none">
          <input type="file" ref={fileInputRef} onChange={(e) => handleFile(e)} className="hidden" accept="image/*" />
          <input type="file" ref={overlayInputRef} onChange={(e) => handleFile(e, true)} className="hidden" accept="image/*" />
          
          {showGrid && (
            <div className="absolute inset-0 pointer-events-none opacity-5" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
          )}

          {!image ? (
            <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer group flex flex-col items-center justify-center p-16 md:p-32 border border-white/5 rounded-[4rem] bg-[#0f172a]/30 hover:bg-blue-600/5 transition-all duration-500">
               <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mb-8 shadow-2xl group-hover:scale-110 transition-transform">
                 <Upload className="w-8 h-8 text-white" />
               </div>
               <h2 className="text-xl md:text-2xl font-bold text-white mb-2 tracking-tight">Load High-Res Asset</h2>
               <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Drop or tap to start editing</p>
            </div>
          ) : (
            <div className="relative shadow-[0_0_100px_rgba(0,0,0,0.8)] transition-transform duration-300 ease-out" style={{ transform: `scale(${zoom})` }}>
              <canvas 
                ref={canvasRef} 
                onMouseDown={handleInteraction} 
                onMouseMove={handleInteraction} 
                onMouseUp={handleInteraction}
                onMouseLeave={handleInteraction}
                onTouchStart={handleInteraction}
                onTouchMove={handleInteraction}
                onTouchEnd={handleInteraction}
                className={`block rounded-lg shadow-2xl max-w-full max-h-[75vh] object-contain ${activeTool === 'draw' ? 'cursor-crosshair' : 'cursor-default'}`} 
              />
            </div>
          )}
        </div>

        {/* Toolbars */}
        <footer className="h-48 bg-[#0f172a] border-t border-white/5 p-6 z-20 flex items-center overflow-x-auto scrollbar-hide">
          <div className="max-w-screen-xl mx-auto w-full flex items-center justify-center min-w-max px-8">
            {image && activeTool === 'adjust' && (
              <div className="flex space-x-12">
                <ControlSlider icon={<Sun className="w-3 h-3"/>} label="Exp" val={adjustments.exposure} min={0} max={200} onChange={v => setAdjustments({...adjustments, exposure: v})} />
                <ControlSlider icon={<Contrast className="w-3 h-3"/>} label="Con" val={adjustments.contrast} min={0} max={200} onChange={v => setAdjustments({...adjustments, contrast: v})} />
                <ControlSlider icon={<Droplets className="w-3 h-3"/>} label="Sat" val={adjustments.saturation} min={0} max={200} onChange={v => setAdjustments({...adjustments, saturation: v})} />
                <ControlSlider icon={<Cloud className="w-3 h-3"/>} label="Blu" val={adjustments.blur} min={0} max={20} onChange={v => setAdjustments({...adjustments, blur: v})} />
              </div>
            )}

            {image && activeTool === 'filter' && (
              <div className="flex space-x-6">
                {ULTRA_PRESETS.map(p => (
                  <button key={p.id} onClick={() => setAdjustments(p.adj)} className="group flex flex-col items-center space-y-3">
                    <div className={`w-20 h-20 rounded-2xl border-2 transition-all flex items-center justify-center p-2 text-center ${adjustments === p.adj ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 bg-white/5 group-hover:border-white/20'}`}>
                       <span className="text-[9px] font-black uppercase tracking-tighter leading-none">{p.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {image && activeTool === 'overlay' && (
              <div className="flex items-center space-x-12">
                 {!overlay.image ? (
                   <button onClick={() => overlayInputRef.current?.click()} className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl border border-dashed border-white/10 hover:border-blue-500 hover:text-blue-500 text-slate-500 transition-all bg-white/5">
                      <Plus className="w-6 h-6 mb-2" />
                      <span className="text-[8px] font-black uppercase tracking-widest">Add Texture</span>
                   </button>
                 ) : (
                   <div className="flex items-center space-x-12">
                      <ControlSlider label="Mix Opacity" val={overlay.opacity * 100} min={0} max={100} onChange={v => setOverlay({...overlay, opacity: v/100})} />
                      <button onClick={() => setOverlay({ image: null, opacity: 0.5, blendMode: 'screen' })} className="p-4 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-5 h-5" /></button>
                   </div>
                 )}
              </div>
            )}

            {image && activeTool === 'draw' && (
              <div className="flex items-center space-x-12">
                 <div className="flex flex-col space-y-3">
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Palette</span>
                    <div className="flex space-x-3">
                      {['#3b82f6', '#ef4444', '#10b981', '#ffffff', '#000000'].map(c => (
                        <button key={c} onClick={() => setBrushSettings({...brushSettings, color: c})} className={`w-6 h-6 rounded-full border-2 transition-transform ${brushSettings.color === c ? 'scale-125 border-white ring-4 ring-blue-500/20' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                 </div>
                 <ControlSlider label="Diameter" val={brushSettings.width} min={1} max={100} onChange={v => setBrushSettings({...brushSettings, width: v})} />
                 <button onClick={() => setStrokes([])} className="p-4 bg-red-500/10 text-red-500 rounded-2xl transition-all hover:bg-red-500 hover:text-white"><Trash2 className="w-5 h-5" /></button>
              </div>
            )}

            {!image && <div className="text-slate-600 text-xs font-black uppercase tracking-[0.4em] opacity-30">Import Workspace Asset To Start</div>}
          </div>
        </footer>
      </main>
    </div>
  );
}

function NavBtn({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`group flex flex-col items-center space-y-2 w-full transition-all ${active ? 'text-blue-500' : 'text-slate-500 hover:text-slate-200'}`}>
      <div className={`p-2.5 rounded-xl transition-all ${active ? 'bg-blue-600/15 scale-110 shadow-lg shadow-blue-500/10' : 'group-hover:bg-white/5'}`}>{icon}</div>
      <span className="text-[7px] font-black uppercase tracking-widest opacity-60 group-hover:opacity-100">{label}</span>
    </button>
  );
}

function ControlSlider({ label, icon, val, min, max, onChange }: { label: string, icon?: any, val: number, min: number, max: number, onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col space-y-3 min-w-[160px]">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          {icon}
          <label className="text-[8px] font-black uppercase text-slate-500 tracking-[0.1em]">{label}</label>
        </div>
        <span className="text-[10px] font-mono text-blue-400 font-bold">{Math.round(val)}</span>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        value={val} 
        onChange={(e) => onChange(Number(e.target.value))} 
        className="w-full h-1 bg-slate-800 rounded-full appearance-none accent-blue-500 cursor-pointer hover:accent-blue-400 transition-all" 
      />
    </div>
  );
}
