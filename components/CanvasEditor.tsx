
import React, { useState, useRef, useEffect } from 'react';
import { 
  Move, Type, Image as ImageIcon, RotateCw, Trash2, 
  AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline,
  Undo2, Redo2, ChevronDown, Plus, Minus, X, Download, MousePointer2,
  MoreHorizontal, ArrowUp, ArrowDown, Type as TypeIcon, BoxSelect, Loader2,
  Palette, Maximize, Circle, Save, Wallpaper, Layers, ArrowUpFromLine, ArrowDownToLine,
  Expand, Shrink, Lock, Unlock, Sparkles, Wand2, Grid3X3, Group, Ungroup, PaintBucket,
  Droplets, Move3d, RefreshCw, ChevronsUp, ChevronsDown, FlipHorizontal, FlipVertical,
  Maximize2, Minimize2, Search, LayoutTemplate, Copy, Share2, ZoomIn, ZoomOut, Check,
  Upload, AlignVerticalJustifyCenter, AlignHorizontalJustifyCenter, AlignHorizontalJustifyStart,
  AlignHorizontalJustifyEnd, AlignVerticalJustifyStart, AlignVerticalJustifyEnd, BringToFront, SendToBack, Eye,
  ArrowRight
} from 'lucide-react';
import { Button } from './ui/Button';
import { generateImage, editImageWithGemini } from '../services/geminiService';

// --- Types ---

export type CanvasElement = {
  id: string;
  type: 'text' | 'image' | 'cta' | 'logo' | 'shape';
  content: string; // Text content or Image URL or Color for shape
  x: number;
  y: number;
  width: number; 
  height: number; 
  rotation: number;
  scaleX?: number;
  scaleY?: number;
  groupId?: string; // For grouping elements
  locked?: boolean; // For locking elements
  style: {
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
    lineHeight?: number;
    letterSpacing?: number;
    color?: string;
    gradient?: string; // Added gradient support
    backgroundColor?: string;
    textAlign?: 'left' | 'center' | 'right';
    borderRadius?: number;
    padding?: number;
    zIndex: number;
    opacity?: number;
    borderWidth?: number;
    borderColor?: string;
  };
};

export type AspectRatio = '1:1' | '16:9' | '9:16' | '3:4' | '4:5';

export interface BackgroundState {
    type: 'image' | 'color' | 'gradient';
    value: string;
    opacity: number;
    scale?: number;
    x?: number;
    y?: number;
}

interface CanvasEditorProps {
  backgroundImage: string; // Default/Fallback image
  initialElements: CanvasElement[];
  initialBackgroundState?: BackgroundState; // For persisting edits
  aspectRatio: AspectRatio;
  onClose: () => void;
  onSave: (finalImage: string, elements: CanvasElement[], bgState: BackgroundState) => void;
}

// --- Constants ---
const SNAP_THRESHOLD = 10;
const GRID_SIZE = 40;

const FONTS = [
  'Inter', 'Montserrat', 'Playfair Display', 'Oswald', 
  'Dancing Script', 'Lobster', 'Monoton', 'Arial', 'Courier New'
];

const COLORS = [
    '#ffffff', '#000000', '#1f2937', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'
];

const GRADIENTS = [
    'linear-gradient(to right, #ec4899, #8b5cf6)', // Pink to Purple
    'linear-gradient(to right, #3b82f6, #10b981)', // Blue to Green
    'linear-gradient(to right, #f59e0b, #ef4444)', // Orange to Red
    'linear-gradient(to right, #ffffff, #9ca3af)', // White to Gray
    'linear-gradient(to right, #6366f1, #a855f7, #ec4899)', // Indigo Purple Pink
];

const SUGGESTED_BG_PROMPTS = [
    "Minimalist workspace with coffee and laptop",
    "Abstract neon geometric shapes, dark background",
    "Soft pastel clouds in a blue sky",
    "Modern luxury interior, marble textures",
    "Nature landscape, mountains at sunset",
    "Cyberpunk city street, rainy night"
];

export const CanvasEditor: React.FC<CanvasEditorProps> = ({ 
  backgroundImage, 
  initialElements,
  initialBackgroundState,
  aspectRatio, 
  onClose,
  onSave
}) => {
  // --- State ---
  
  // Background State (Initialize from prop if available, else default to image type with input url)
  const [bgType, setBgType] = useState<'image' | 'color' | 'gradient'>(initialBackgroundState?.type || 'image');
  const [bgValue, setBgValue] = useState<string>(initialBackgroundState?.value || backgroundImage); 
  const [bgOpacity, setBgOpacity] = useState<number>(initialBackgroundState?.opacity ?? 1);
  const [bgScale, setBgScale] = useState<number>(initialBackgroundState?.scale ?? 1);
  const [bgX, setBgX] = useState<number>(initialBackgroundState?.x ?? 0);
  const [bgY, setBgY] = useState<number>(initialBackgroundState?.y ?? 0);
  const [lastGenPrompt, setLastGenPrompt] = useState<string>('');

  // Editor Layout State
  const [activeSidebar, setActiveSidebar] = useState<'design' | 'elements' | 'text' | 'uploads' | 'ai' | 'layers' | null>('text');
  const [zoomLevel, setZoomLevel] = useState(0.6);
  const [activeLayerTab, setActiveLayerTab] = useState<'arrange' | 'layers'>('arrange');

  // Canvas State
  const [elements, setElements] = useState<CanvasElement[]>(
    JSON.parse(JSON.stringify(initialElements)).map((el: any) => ({ ...el, scaleX: el.scaleX ?? 1, scaleY: el.scaleY ?? 1 }))
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Tools State
  const [showGrid, setShowGrid] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isBgColorPickerOpen, setIsBgColorPickerOpen] = useState(false);
  
  // History
  const [history, setHistory] = useState<any[]>([{ elements: initialElements, bgValue, bgType, bgOpacity, bgScale, bgX, bgY }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // AI State
  const [isGenModalOpen, setIsGenModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [genPrompt, setGenPrompt] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Interaction State
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [potentialDrag, setPotentialDrag] = useState(false);
  
  // Background Interaction State
  const [isDraggingBg, setIsDraggingBg] = useState(false);
  const [isResizingBg, setIsResizingBg] = useState(false);
  const bgDragStart = useRef({ x: 0, y: 0, initialX: 0, initialY: 0, initialScale: 1 });
  
  // Snap Guides
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});

  // Refs
  const dragStart = useRef({ x: 0, y: 0 });
  const elementsStart = useRef<Record<string, Partial<CanvasElement>>>({}); 
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // --- Keyboard Listeners ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0 && !isEditingText) {
        deleteSelected();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
          e.preventDefault();
          duplicateSelected();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, isEditingText, historyIndex]);

  // --- Dimensions Logic ---
  const getCanvasDimensions = () => {
    const baseHeight = 800; // Increased base resolution
    switch (aspectRatio) {
      case '16:9': return { width: baseHeight * (16/9), height: baseHeight };
      case '9:16': return { width: baseHeight * (9/16), height: baseHeight };
      case '3:4': return { width: baseHeight * (3/4), height: baseHeight };
      case '4:5': return { width: baseHeight * (4/5), height: baseHeight };
      case '1:1': default: return { width: baseHeight, height: baseHeight };
    }
  };
  const dims = getCanvasDimensions();

  // --- History Management ---
  const saveToHistory = (
      newElements: CanvasElement[] = elements, 
      newBg = bgValue, 
      newBgType = bgType, 
      newBgOpacity = bgOpacity, 
      newBgScale = bgScale,
      newBgX = bgX,
      newBgY = bgY
    ) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
        elements: JSON.parse(JSON.stringify(newElements)),
        bgValue: newBg,
        bgType: newBgType,
        bgOpacity: newBgOpacity,
        bgScale: newBgScale,
        bgX: newBgX,
        bgY: newBgY
    });
    if (newHistory.length > 20) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setElements(JSON.parse(JSON.stringify(prev.elements)));
      setBgValue(prev.bgValue);
      setBgType(prev.bgType);
      setBgOpacity(prev.bgOpacity ?? 1);
      setBgScale(prev.bgScale ?? 1);
      setBgX(prev.bgX ?? 0);
      setBgY(prev.bgY ?? 0);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setElements(JSON.parse(JSON.stringify(next.elements)));
      setBgValue(next.bgValue);
      setBgType(next.bgType);
      setBgOpacity(next.bgOpacity ?? 1);
      setBgScale(next.bgScale ?? 1);
      setBgX(next.bgX ?? 0);
      setBgY(next.bgY ?? 0);
    }
  };

  // --- Actions ---

  const updateSelected = (updates: Partial<CanvasElement> | Partial<CanvasElement['style']>) => {
    const updated = elements.map(el => {
      if (!selectedIds.includes(el.id)) return el;
      if (el.locked) return el; 
      
      const styleKeys = ['fontSize', 'fontFamily', 'fontWeight', 'fontStyle', 'textDecoration', 'lineHeight', 'letterSpacing', 'color', 'gradient', 'backgroundColor', 'textAlign', 'borderRadius', 'padding', 'opacity', 'zIndex', 'borderWidth', 'borderColor'];
      const isStyleUpdate = Object.keys(updates).some(k => styleKeys.includes(k));
      
      if (isStyleUpdate) {
        return { ...el, style: { ...el.style, ...updates } };
      }
      return { ...el, ...updates };
    });
    setElements(updated);
    saveToHistory(updated);
  };

  const deleteSelected = () => {
      const updated = elements.filter(el => !selectedIds.includes(el.id));
      setElements(updated);
      setSelectedIds([]);
      saveToHistory(updated);
  };

  const duplicateSelected = () => {
      const newElements = [...elements];
      const newIds: string[] = [];
      
      elements.forEach(el => {
          if (selectedIds.includes(el.id)) {
              const newId = `${el.type}-${Date.now()}-${Math.random()}`;
              const clone: CanvasElement = {
                  ...JSON.parse(JSON.stringify(el)),
                  id: newId,
                  x: el.x + 20,
                  y: el.y + 20
              };
              newElements.push(clone);
              newIds.push(newId);
          }
      });
      
      setElements(newElements);
      setSelectedIds(newIds);
      saveToHistory(newElements);
  };

  const toggleLock = () => {
      const updated = elements.map(el => {
          if (selectedIds.includes(el.id)) {
              return { ...el, locked: !el.locked };
          }
          return el;
      });
      setElements(updated);
      saveToHistory(updated);
  };

  // --- Layer Management ---
  const changeZIndex = (type: 'front' | 'back' | 'forward' | 'backward') => {
      if (selectedIds.length === 0) return;
      const id = selectedIds[0];
      
      // 1. Sort all elements by current zIndex
      const sorted = [...elements].sort((a, b) => (a.style.zIndex || 0) - (b.style.zIndex || 0));
      
      // 2. Normalize Z-Indices (10, 20, 30...)
      const idToZ: Record<string, number> = {};
      sorted.forEach((el, i) => {
          idToZ[el.id] = (i + 1) * 10;
      });

      const currentZ = idToZ[id];
      const currentIndex = sorted.findIndex(e => e.id === id);

      if (type === 'front') {
           idToZ[id] = (sorted.length + 1) * 10;
      } else if (type === 'back') {
           idToZ[id] = 0; 
      } else if (type === 'forward') {
          if (currentIndex < sorted.length - 1) {
              const nextEl = sorted[currentIndex + 1];
              // Swap
              idToZ[id] = idToZ[nextEl.id];
              idToZ[nextEl.id] = currentZ;
          }
      } else if (type === 'backward') {
          if (currentIndex > 0) {
              const prevEl = sorted[currentIndex - 1];
              // Swap
              idToZ[id] = idToZ[prevEl.id];
              idToZ[prevEl.id] = currentZ;
          }
      }

      const updated = elements.map(el => ({
          ...el,
          style: {
              ...el.style,
              zIndex: idToZ[el.id] !== undefined ? idToZ[el.id] : el.style.zIndex
          }
      }));
      
      setElements(updated);
      saveToHistory(updated);
  };

  const alignToPage = (type: 'top' | 'middle' | 'bottom' | 'left' | 'center' | 'right') => {
      const updated = elements.map(el => {
          if (!selectedIds.includes(el.id)) return el;
          let newX = el.x;
          let newY = el.y;
          
          if (type === 'left') newX = 0;
          if (type === 'center') newX = (dims.width - el.width) / 2;
          if (type === 'right') newX = dims.width - el.width;
          if (type === 'top') newY = 0;
          if (type === 'middle') newY = (dims.height - el.height) / 2;
          if (type === 'bottom') newY = dims.height - el.height;
          
          return { ...el, x: newX, y: newY };
      });
      setElements(updated);
      saveToHistory(updated);
  };

  const flip = (dir: 'h' | 'v') => {
    const updated = elements.map(el => {
        if(!selectedIds.includes(el.id)) return el;
        return {
            ...el,
            scaleX: dir === 'h' ? (el.scaleX || 1) * -1 : (el.scaleX || 1),
            scaleY: dir === 'v' ? (el.scaleY || 1) * -1 : (el.scaleY || 1)
        };
    });
    setElements(updated);
    saveToHistory(updated);
  };

  // --- Adding Content ---

  const addElement = (type: 'text' | 'image' | 'cta' | 'shape', subType?: string) => {
    const id = `new-${type}-${Date.now()}`;
    const centerX = dims.width / 2;
    const centerY = dims.height / 2;
    
    // Calculate new Z index (highest + 10)
    const maxZ = elements.reduce((max, el) => Math.max(max, el.style.zIndex || 0), 0);
    
    let newElement: CanvasElement = {
        id,
        type: type,
        content: '',
        x: centerX - 100,
        y: centerY - 50,
        width: 200,
        height: 100,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        style: {
            zIndex: maxZ + 10,
            opacity: 1
        }
    };

    if (type === 'text') {
        newElement.content = subType === 'heading' ? 'Add a heading' : subType === 'subheading' ? 'Add a subheading' : 'Add a little bit of body text';
        newElement.style = {
            ...newElement.style,
            fontSize: subType === 'heading' ? 64 : subType === 'subheading' ? 42 : 24,
            fontWeight: subType === 'heading' ? 'bold' : 'normal',
            fontFamily: 'Inter',
            color: '#ffffff',
            textAlign: 'center'
        };
        newElement.width = 400;
        newElement.height = subType === 'heading' ? 80 : 40;
        newElement.x = centerX - 200;
    } 
    else if (type === 'cta') {
        newElement.content = subType || 'Learn More';
        newElement.style = {
            ...newElement.style,
            fontSize: 18,
            fontWeight: 'bold',
            fontFamily: 'Inter',
            color: '#ffffff',
            backgroundColor: '#8b5cf6', // Primary
            textAlign: 'center',
            borderRadius: 8,
            padding: 12,
        };
        newElement.width = 160;
        newElement.height = 50;
        newElement.x = centerX - 80;
    }
    else if (type === 'shape') {
        newElement.content = '#8b5cf6'; // Default Color
        newElement.style.backgroundColor = '#8b5cf6';
        if (subType === 'circle') {
             newElement.width = 200;
             newElement.height = 200;
             newElement.style.borderRadius = 9999;
        } else {
             newElement.width = 200;
             newElement.height = 200;
        }
        newElement.x = centerX - 100;
        newElement.y = centerY - 100;
    }

    const newElements = [...elements, newElement];
    setElements(newElements);
    setSelectedIds([id]);
    saveToHistory(newElements);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
             const id = `img-${Date.now()}`;
             const img = new Image();
             img.src = reader.result as string;
             img.onload = () => {
                 const imgAspect = img.width / img.height;
                 const baseWidth = 400;
                 const baseHeight = baseWidth / imgAspect;
                 const maxZ = elements.reduce((max, el) => Math.max(max, el.style.zIndex || 0), 0);

                 const newEl: CanvasElement = {
                     id,
                     type: 'image',
                     content: reader.result as string,
                     x: (dims.width - baseWidth) / 2,
                     y: (dims.height - baseHeight) / 2,
                     width: baseWidth,
                     height: baseHeight,
                     rotation: 0,
                     scaleX: 1,
                     scaleY: 1,
                     style: { zIndex: maxZ + 10, opacity: 1 }
                 };
                 const newElements = [...elements, newEl];
                 setElements(newElements);
                 setSelectedIds([id]);
                 saveToHistory(newElements);
             }
        };
        reader.readAsDataURL(file);
    }
  };

  // --- AI Handlers ---
  const handleGenerateBackground = async () => {
    if (!genPrompt.trim()) return;
    setIsGenerating(true);
    setLastGenPrompt(genPrompt);
    try {
        const newBg = await generateImage(genPrompt, aspectRatio);
        setBgValue(newBg);
        setBgType('image');
        // Reset transform when generating new
        setBgScale(1);
        setBgX(0);
        setBgY(0);
        saveToHistory(elements, newBg, 'image', 1, 1, 0, 0);
        setIsGenModalOpen(false);
        setGenPrompt('');
    } catch (error) {
        console.error("Failed to generate bg", error);
        alert("Failed to generate background. Please try a different prompt.");
    } finally {
        setIsGenerating(false);
    }
  };

  const handleMagicEdit = async () => {
    if (!editPrompt.trim()) return;
    setIsGenerating(true);
    try {
        let targetImage = '';
        const isBg = selectedIds.length === 0 && bgType === 'image';
        
        if (isBg) {
            targetImage = bgValue;
        } else if (selectedIds.length === 1) {
            const el = elements.find(e => e.id === selectedIds[0]);
            if (el && (el.type === 'image' || el.type === 'logo')) {
                targetImage = el.content;
            }
        }

        if (!targetImage) {
            setIsGenerating(false);
            return;
        }

        const newImage = await editImageWithGemini(targetImage, editPrompt);
        
        if (isBg) {
            setBgValue(newImage);
            setBgType('image');
            saveToHistory(elements, newImage, 'image');
        } else if (selectedIds.length === 1) {
             const updated = elements.map(e => e.id === selectedIds[0] ? { ...e, content: newImage } : e);
             setElements(updated);
             saveToHistory(updated);
        }

        setIsEditModalOpen(false);
        setEditPrompt('');

    } catch (e) {
        console.error(e);
        alert("Magic Edit failed. Try again.");
    } finally {
        setIsGenerating(false);
    }
  };

  // --- Background Interaction Handlers ---

  const handleBgMouseDown = (e: React.MouseEvent, type: 'drag' | 'resize') => {
      e.stopPropagation();
      if (bgType !== 'image') return;
      
      bgDragStart.current = {
          x: e.clientX,
          y: e.clientY,
          initialX: bgX,
          initialY: bgY,
          initialScale: bgScale
      };

      if (type === 'drag') setIsDraggingBg(true);
      if (type === 'resize') setIsResizingBg(true);
  };

  const handleCanvasWheel = (e: React.WheelEvent) => {
      if (selectedIds.length === 0 && bgType === 'image') {
          // e.preventDefault(); // React synthetic events can't be prevented easily for scroll, but we can stop propagation
          e.stopPropagation();
          const scaleDelta = -e.deltaY * 0.001;
          const newScale = Math.min(Math.max(0.5, bgScale + scaleDelta), 5);
          setBgScale(newScale);
      }
  };

  // --- Mouse Handlers (Elements) ---
  const handleMouseDown = (e: React.MouseEvent, id: string, action: 'drag' | 'resize' | 'rotate') => {
    e.stopPropagation();
    const el = elements.find(item => item.id === id);
    if (el?.locked) return;

    if (isEditingText && selectedIds.includes(id) && action === 'drag') return;

    let newSelectedIds = [...selectedIds];
    if (e.shiftKey) {
        if (newSelectedIds.includes(id)) newSelectedIds = newSelectedIds.filter(sid => sid !== id);
        else newSelectedIds.push(id);
    } else {
        if (!newSelectedIds.includes(id)) newSelectedIds = [id];
    }
    
    setSelectedIds(newSelectedIds);
    if (action === 'drag') setPotentialDrag(true);
    if (action === 'resize') setIsResizing(true);
    if (action === 'rotate') setIsRotating(true);

    dragStart.current = { x: e.clientX, y: e.clientY };
    const startStates: Record<string, Partial<CanvasElement>> = {};
    newSelectedIds.forEach(sid => {
        const item = elements.find(el => el.id === sid);
        if (item) startStates[sid] = { ...item, style: { ...item.style } };
    });
    elementsStart.current = startStates;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // 1. Background Interaction
    if (isDraggingBg) {
        const deltaX = (e.clientX - bgDragStart.current.x) / zoomLevel;
        const deltaY = (e.clientY - bgDragStart.current.y) / zoomLevel;
        setBgX(bgDragStart.current.initialX + deltaX);
        setBgY(bgDragStart.current.initialY + deltaY);
        return;
    }

    if (isResizingBg) {
        // Calculate resize based on distance from center for simplified uniform scaling
        // Or simple delta Y for ease of use
        const deltaY = (bgDragStart.current.y - e.clientY) * 0.01; 
        const newScale = Math.max(0.5, Math.min(5, bgDragStart.current.initialScale + deltaY));
        setBgScale(newScale);
        return;
    }

    // 2. Element Interaction
    if (selectedIds.length === 0) return;

    // Adjust delta based on zoom level
    const deltaX = (e.clientX - dragStart.current.x) / zoomLevel;
    const deltaY = (e.clientY - dragStart.current.y) / zoomLevel;
    
    if (potentialDrag && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
        setIsDragging(true);
        setPotentialDrag(false);
    }

    if (isDragging) {
        const updated = elements.map(el => {
            if (!selectedIds.includes(el.id)) return el;
            const start = elementsStart.current[el.id];
            if (!start) return el;

            let newX = (start.x || 0) + deltaX;
            let newY = (start.y || 0) + deltaY;

            // Simple Snap Center
            if (selectedIds.length === 1) {
                const centerX = dims.width / 2;
                const centerY = dims.height / 2;
                if (Math.abs((newX + el.width/2) - centerX) < SNAP_THRESHOLD) {
                    newX = centerX - el.width / 2;
                }
                if (Math.abs((newY + el.height/2) - centerY) < SNAP_THRESHOLD) {
                    newY = centerY - el.height / 2;
                }
            }
            return { ...el, x: newX, y: newY };
        });
        setElements(updated);
    }

    if (isResizing && selectedIds.length === 1) {
        const id = selectedIds[0];
        const el = elements.find(e => e.id === id);
        const start = elementsStart.current[id];
        if (el && start) {
            const newW = Math.max(20, (start.width || 0) + deltaX);
            const newH = Math.max(20, (start.height || 0) + deltaY);
            let newFontSize = start.style?.fontSize;
            if (el.type === 'text' || el.type === 'cta') {
                 const scaleRatio = newW / (start.width || 1);
                 newFontSize = Math.round((start.style?.fontSize || 16) * scaleRatio);
            }
            setElements(prev => prev.map(item => item.id === id ? { 
                ...item, width: newW, height: newH,
                style: { ...item.style, fontSize: newFontSize }
            } : item));
        }
    }

    if (isRotating && selectedIds.length === 1) {
        const id = selectedIds[0];
        const el = elements.find(e => e.id === id);
        if (el) {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
                // Adjust mouse coordinates relative to the zoomed canvas center
                const centerX = rect.left + (el.x * zoomLevel) + (el.width * zoomLevel) / 2;
                const centerY = rect.top + (el.y * zoomLevel) + (el.height * zoomLevel) / 2;
                const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
                let snapAngle = angle + 90; 
                if (Math.abs(snapAngle % 45) < 5) snapAngle = Math.round(snapAngle / 45) * 45;
                setElements(prev => prev.map(item => item.id === id ? { ...item, rotation: snapAngle } : item));
            }
        }
    }
  };

  const handleMouseUp = () => {
    if (potentialDrag && selectedIds.length === 1) {
        const el = elements.find(e => e.id === selectedIds[0]);
        if (el && (el.type === 'text' || el.type === 'cta') && !el.locked) {
            setIsEditingText(true);
        }
    } else if (isDragging || isResizing || isRotating) {
        saveToHistory(elements);
    }

    if (isDraggingBg || isResizingBg) {
        saveToHistory(elements, bgValue, bgType, bgOpacity, bgScale, bgX, bgY);
    }

    setIsDragging(false);
    setPotentialDrag(false);
    setIsResizing(false);
    setIsRotating(false);
    setIsDraggingBg(false);
    setIsResizingBg(false);
  };

  // --- Save Logic ---
  const generateCanvasData = async () => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = dims.width;
    exportCanvas.height = dims.height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return null;

    try {
        // Draw Background
        if (bgType === 'color') {
            ctx.fillStyle = bgValue;
            ctx.fillRect(0, 0, dims.width, dims.height);
        } else if (bgType === 'gradient') {
             const grd = ctx.createLinearGradient(0, 0, dims.width, dims.height);
             const colors = bgValue.match(/#[a-fA-F0-9]{6}/g) || ['#ffffff', '#000000'];
             grd.addColorStop(0, colors[0]);
             grd.addColorStop(1, colors.length > 1 ? colors[1] : colors[0]);
             ctx.fillStyle = grd;
             ctx.fillRect(0, 0, dims.width, dims.height);
        } else {
            const bgImg = new Image();
            bgImg.crossOrigin = "anonymous";
            bgImg.src = bgValue;
            await new Promise((resolve) => { bgImg.onload = resolve; bgImg.onerror = resolve; });
            
            ctx.save();
            // Background Transforms
            ctx.globalAlpha = bgOpacity;
            // 1. Center logic
            ctx.translate(dims.width / 2, dims.height / 2);
            // 2. Pan
            ctx.translate(bgX, bgY);
            // 3. Zoom
            ctx.scale(bgScale, bgScale);
            // 4. Move back to origin
            ctx.translate(-dims.width / 2, -dims.height / 2);

            // Draw image covering the area (standard logic)
            const scale = Math.max(dims.width / bgImg.width, dims.height / bgImg.height);
            const x = (dims.width / 2) - (bgImg.width / 2) * scale;
            const y = (dims.height / 2) - (bgImg.height / 2) * scale;
            
            ctx.drawImage(bgImg, x, y, bgImg.width * scale, bgImg.height * scale);
            ctx.restore();
        }
        ctx.globalAlpha = 1.0;

        // Draw Elements
        const sortedElements = [...elements].sort((a, b) => a.style.zIndex - b.style.zIndex);
        for (const el of sortedElements) {
            ctx.save();
            const centerX = el.x + el.width / 2;
            const centerY = el.y + el.height / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate((el.rotation * Math.PI) / 180);
            ctx.scale(el.scaleX || 1, el.scaleY || 1);
            ctx.translate(-centerX, -centerY);
            ctx.globalAlpha = el.style.opacity ?? 1;

            if (el.type === 'image' || el.type === 'logo') {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.src = el.content;
                await new Promise(r => { img.onload = r; img.onerror = r; });
                ctx.drawImage(img, el.x, el.y, el.width, el.height);
            } 
            else if (el.type === 'shape') {
                 ctx.fillStyle = el.style.backgroundColor || el.content;
                 if (el.style.borderRadius && el.style.borderRadius > 100) {
                     ctx.beginPath();
                     ctx.ellipse(el.x + el.width/2, el.y + el.height/2, el.width/2, el.height/2, 0, 0, 2 * Math.PI);
                     ctx.fill();
                 } else {
                     ctx.fillRect(el.x, el.y, el.width, el.height);
                 }
            }
            else if (el.type === 'text' || el.type === 'cta') {
                if (el.style.backgroundColor) {
                    ctx.fillStyle = el.style.backgroundColor;
                    const r = el.style.borderRadius || 0;
                     if (ctx.roundRect) {
                        ctx.beginPath();
                        ctx.roundRect(el.x, el.y, el.width, el.height, r);
                        ctx.fill();
                    } else {
                        ctx.fillRect(el.x, el.y, el.width, el.height);
                    }
                }

                // Gradient Text Handling
                if (el.style.gradient) {
                    const gradColors = el.style.gradient.match(/#[a-fA-F0-9]{6}/g) || ['#ffffff', '#ffffff'];
                    const gradient = ctx.createLinearGradient(el.x, el.y, el.x + el.width, el.y);
                    gradient.addColorStop(0, gradColors[0]);
                    gradient.addColorStop(1, gradColors[gradColors.length - 1]);
                    ctx.fillStyle = gradient;
                } else {
                    ctx.fillStyle = el.style.color || '#fff';
                }

                ctx.font = `${el.style.fontStyle || ''} ${el.style.fontWeight || 'normal'} ${el.style.fontSize || 16}px ${el.style.fontFamily || 'Inter'}`;
                ctx.textAlign = el.style.textAlign || 'left';
                ctx.textBaseline = 'middle';
                let textX = el.x;
                if (el.style.textAlign === 'center') textX = el.x + el.width / 2;
                if (el.style.textAlign === 'right') textX = el.x + el.width;
                ctx.fillText(el.content, textX, el.y + el.height / 2, el.width);
            }
            ctx.restore();
        }
        return exportCanvas.toDataURL('image/png');
    } catch (err) {
        console.error("Save failed", err);
        return null;
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const finalImage = await generateCanvasData();
    if (finalImage) {
        onSave(finalImage, elements, {
            type: bgType,
            value: bgValue,
            opacity: bgOpacity,
            scale: bgScale,
            x: bgX,
            y: bgY
        });
    }
    setIsSaving(false);
  };

  const activeElement = selectedIds.length === 1 ? elements.find(el => el.id === selectedIds[0]) : null;

  return (
    <div 
        className="fixed inset-0 z-[100] bg-[#0e0e0e] flex flex-row overflow-hidden font-sans text-white"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={() => { setIsColorPickerOpen(false); setIsBgColorPickerOpen(false); }}
    >
      
      {/* 1. Left Sidebar (Navigation) */}
      <div className="w-[72px] bg-[#18181b] border-r border-white/5 flex flex-col items-center py-4 gap-6 shrink-0 z-50">
           <button onClick={onClose} className="p-2 mb-2 hover:bg-white/10 rounded-lg transition-colors">
               <div className="w-8 h-8 rounded bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center font-bold text-white">S</div>
           </button>
           
           {[
               { id: 'design', label: 'Design', icon: LayoutTemplate },
               { id: 'elements', label: 'Elements', icon: BoxSelect },
               { id: 'text', label: 'Text', icon: Type },
               { id: 'uploads', label: 'Uploads', icon: Upload },
               { id: 'layers', label: 'Layers', icon: Layers }, // Added Layers
               { id: 'ai', label: 'Magic AI', icon: Sparkles }
           ].map(item => (
               <button 
                  key={item.id} 
                  onClick={() => setActiveSidebar(activeSidebar === item.id ? null : item.id as any)}
                  className={`flex flex-col items-center gap-1.5 w-full py-2 transition-all border-l-2 ${activeSidebar === item.id ? 'text-white border-primary bg-white/5' : 'text-muted hover:text-white border-transparent'}`}
                >
                   <item.icon className="w-5 h-5" />
                   <span className="text-[10px] font-medium">{item.label}</span>
               </button>
           ))}
      </div>

      {/* 2. Slide-out Drawer */}
      <div 
        className={`bg-[#18181b] border-r border-white/5 w-[320px] shrink-0 transition-all duration-300 ease-in-out flex flex-col overflow-hidden relative z-40 ${activeSidebar ? 'translate-x-0' : '-translate-x-[320px] -mr-[320px]'}`}
      >
           <div className="p-4 border-b border-white/5">
                <h3 className="font-bold text-lg capitalize">{activeSidebar === 'layers' ? 'Position' : activeSidebar}</h3>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                {/* Text Panel */}
                {activeSidebar === 'text' && (
                    <div className="space-y-4">
                        <div className="bg-[#27272a] rounded-lg p-2 flex items-center gap-2 border border-white/5">
                            <Search className="w-4 h-4 text-muted" />
                            <input type="text" placeholder="Search fonts" className="bg-transparent text-sm outline-none w-full" />
                        </div>
                        <button onClick={() => addElement('text', 'heading')} className="w-full h-14 bg-[#27272a] hover:bg-[#3f3f46] rounded-lg border border-white/5 flex items-center px-4 font-bold text-2xl transition-colors text-left">
                            Add a heading
                        </button>
                        <button onClick={() => addElement('text', 'subheading')} className="w-full h-12 bg-[#27272a] hover:bg-[#3f3f46] rounded-lg border border-white/5 flex items-center px-4 font-medium text-lg transition-colors text-left">
                            Add a subheading
                        </button>
                        <button onClick={() => addElement('text', 'body')} className="w-full h-10 bg-[#27272a] hover:bg-[#3f3f46] rounded-lg border border-white/5 flex items-center px-4 text-sm transition-colors text-left">
                            Add a little bit of body text
                        </button>
                        
                        <div className="pt-4 border-t border-white/5 mt-4">
                             <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Call to Action Buttons</h4>
                             <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => addElement('cta', 'Shop Now')} className="h-10 bg-primary/20 hover:bg-primary/30 border border-primary/50 rounded-lg font-bold text-white text-xs transition-colors">Shop Now</button>
                                <button onClick={() => addElement('cta', 'Learn More')} className="h-10 bg-primary/20 hover:bg-primary/30 border border-primary/50 rounded-lg font-bold text-white text-xs transition-colors">Learn More</button>
                                <button onClick={() => addElement('cta', 'Sign Up')} className="h-10 bg-primary/20 hover:bg-primary/30 border border-primary/50 rounded-lg font-bold text-white text-xs transition-colors">Sign Up</button>
                                <button onClick={() => addElement('cta', 'Click Here')} className="h-10 bg-primary/20 hover:bg-primary/30 border border-primary/50 rounded-lg font-bold text-white text-xs transition-colors">Click Here</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Elements Panel */}
                {activeSidebar === 'elements' && (
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-sm font-semibold mb-3 text-muted">Shapes</h4>
                            <div className="grid grid-cols-4 gap-3">
                                <button onClick={() => addElement('shape', 'square')} className="aspect-square bg-[#27272a] rounded hover:bg-[#3f3f46] flex items-center justify-center"><div className="w-8 h-8 bg-zinc-400"></div></button>
                                <button onClick={() => addElement('shape', 'circle')} className="aspect-square bg-[#27272a] rounded hover:bg-[#3f3f46] flex items-center justify-center"><div className="w-8 h-8 bg-zinc-400 rounded-full"></div></button>
                                <button onClick={() => addElement('shape', 'rounded')} className="aspect-square bg-[#27272a] rounded hover:bg-[#3f3f46] flex items-center justify-center"><div className="w-8 h-8 bg-zinc-400 rounded-lg"></div></button>
                                <button onClick={() => addElement('shape', 'square')} className="aspect-square bg-[#27272a] rounded hover:bg-[#3f3f46] flex items-center justify-center"><div className="w-8 h-8 border-2 border-zinc-400"></div></button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Uploads Panel */}
                {activeSidebar === 'uploads' && (
                    <div className="space-y-4">
                        <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-[#27272a] hover:bg-[#3f3f46] rounded-lg border border-white/5 font-medium transition-colors">
                            Upload files
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                        <div className="text-center text-muted text-xs mt-4">Images you upload will appear here.</div>
                    </div>
                )}

                 {/* Layers / Position Panel */}
                {activeSidebar === 'layers' && (
                   <div className="flex flex-col h-full">
                       {/* Tabs */}
                       <div className="flex p-1 bg-[#27272a] rounded-lg mb-6">
                           <button 
                                onClick={() => setActiveLayerTab('arrange')} 
                                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeLayerTab === 'arrange' ? 'bg-surface text-white shadow-sm' : 'text-muted hover:text-white'}`}
                           >
                               Arrange
                           </button>
                           <button 
                                onClick={() => setActiveLayerTab('layers')} 
                                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeLayerTab === 'layers' ? 'bg-surface text-white shadow-sm' : 'text-muted hover:text-white'}`}
                           >
                               Layers
                           </button>
                       </div>

                       {/* Content */}
                       {activeLayerTab === 'arrange' ? (
                           <div className="space-y-6">
                               {/* Layer Order */}
                               <div className="space-y-2">
                                   <label className="text-xs text-muted uppercase font-bold tracking-wider">Layer Order</label>
                                   <div className="grid grid-cols-4 gap-2">
                                       <button onClick={() => changeZIndex('forward')} disabled={!activeElement} className="flex flex-col items-center justify-center p-2 rounded bg-[#27272a] hover:bg-[#3f3f46] disabled:opacity-50">
                                            <ChevronsUp className="w-4 h-4 mb-1" />
                                            <span className="text-[10px]">Forward</span>
                                       </button>
                                       <button onClick={() => changeZIndex('backward')} disabled={!activeElement} className="flex flex-col items-center justify-center p-2 rounded bg-[#27272a] hover:bg-[#3f3f46] disabled:opacity-50">
                                            <ChevronsDown className="w-4 h-4 mb-1" />
                                            <span className="text-[10px]">Back</span>
                                       </button>
                                        <button onClick={() => changeZIndex('front')} disabled={!activeElement} className="flex flex-col items-center justify-center p-2 rounded bg-[#27272a] hover:bg-[#3f3f46] disabled:opacity-50">
                                            <BringToFront className="w-4 h-4 mb-1" />
                                            <span className="text-[10px]">Front</span>
                                       </button>
                                       <button onClick={() => changeZIndex('back')} disabled={!activeElement} className="flex flex-col items-center justify-center p-2 rounded bg-[#27272a] hover:bg-[#3f3f46] disabled:opacity-50">
                                            <SendToBack className="w-4 h-4 mb-1" />
                                            <span className="text-[10px]">Back</span>
                                       </button>
                                   </div>
                               </div>

                               {/* Align Page */}
                               <div className="space-y-2">
                                    <label className="text-xs text-muted uppercase font-bold tracking-wider">Align to page</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button onClick={() => alignToPage('left')} disabled={!activeElement} className="p-2 rounded bg-[#27272a] hover:bg-[#3f3f46] disabled:opacity-50 flex justify-center"><AlignHorizontalJustifyStart className="w-4 h-4" /></button>
                                        <button onClick={() => alignToPage('center')} disabled={!activeElement} className="p-2 rounded bg-[#27272a] hover:bg-[#3f3f46] disabled:opacity-50 flex justify-center"><AlignHorizontalJustifyCenter className="w-4 h-4" /></button>
                                        <button onClick={() => alignToPage('right')} disabled={!activeElement} className="p-2 rounded bg-[#27272a] hover:bg-[#3f3f46] disabled:opacity-50 flex justify-center"><AlignHorizontalJustifyEnd className="w-4 h-4" /></button>
                                        <button onClick={() => alignToPage('top')} disabled={!activeElement} className="p-2 rounded bg-[#27272a] hover:bg-[#3f3f46] disabled:opacity-50 flex justify-center"><AlignVerticalJustifyStart className="w-4 h-4" /></button>
                                        <button onClick={() => alignToPage('middle')} disabled={!activeElement} className="p-2 rounded bg-[#27272a] hover:bg-[#3f3f46] disabled:opacity-50 flex justify-center"><AlignVerticalJustifyCenter className="w-4 h-4" /></button>
                                        <button onClick={() => alignToPage('bottom')} disabled={!activeElement} className="p-2 rounded bg-[#27272a] hover:bg-[#3f3f46] disabled:opacity-50 flex justify-center"><AlignVerticalJustifyEnd className="w-4 h-4" /></button>
                                    </div>
                               </div>
                               
                               {/* Advanced - Now Interactive! */}
                               {activeElement && (
                                   <div className="space-y-3 pt-4 border-t border-white/5">
                                       <label className="text-xs text-muted uppercase font-bold tracking-wider">Advanced</label>
                                       <div className="grid grid-cols-2 gap-3">
                                            <div className="flex items-center justify-between bg-[#27272a] p-2 rounded text-xs group focus-within:ring-1 focus-within:ring-primary/50">
                                                <span className="text-muted">Width</span>
                                                <input 
                                                    type="number" 
                                                    value={Math.round(activeElement.width)} 
                                                    onChange={(e) => updateSelected({ width: Number(e.target.value) })}
                                                    className="w-16 bg-transparent text-right outline-none font-mono appearance-none"
                                                />
                                            </div>
                                            <div className="flex items-center justify-between bg-[#27272a] p-2 rounded text-xs group focus-within:ring-1 focus-within:ring-primary/50">
                                                <span className="text-muted">Height</span>
                                                <input 
                                                    type="number" 
                                                    value={Math.round(activeElement.height)} 
                                                    onChange={(e) => updateSelected({ height: Number(e.target.value) })}
                                                    className="w-16 bg-transparent text-right outline-none font-mono appearance-none"
                                                />
                                            </div>
                                             <div className="flex items-center justify-between bg-[#27272a] p-2 rounded text-xs group focus-within:ring-1 focus-within:ring-primary/50">
                                                <span className="text-muted">X</span>
                                                <input 
                                                    type="number" 
                                                    value={Math.round(activeElement.x)} 
                                                    onChange={(e) => updateSelected({ x: Number(e.target.value) })}
                                                    className="w-16 bg-transparent text-right outline-none font-mono appearance-none"
                                                />
                                            </div>
                                            <div className="flex items-center justify-between bg-[#27272a] p-2 rounded text-xs group focus-within:ring-1 focus-within:ring-primary/50">
                                                <span className="text-muted">Y</span>
                                                <input 
                                                    type="number" 
                                                    value={Math.round(activeElement.y)} 
                                                    onChange={(e) => updateSelected({ y: Number(e.target.value) })}
                                                    className="w-16 bg-transparent text-right outline-none font-mono appearance-none"
                                                />
                                            </div>
                                            <div className="flex items-center justify-between bg-[#27272a] p-2 rounded text-xs col-span-2 group focus-within:ring-1 focus-within:ring-primary/50">
                                                <span className="text-muted">Rotation (deg)</span>
                                                <input 
                                                    type="number" 
                                                    value={Math.round(activeElement.rotation)} 
                                                    onChange={(e) => updateSelected({ rotation: Number(e.target.value) })}
                                                    className="w-16 bg-transparent text-right outline-none font-mono appearance-none"
                                                />
                                            </div>
                                       </div>
                                   </div>
                               )}
                           </div>
                       ) : (
                           <div className="space-y-2">
                               {/* Layers List (Reverse Order so top is top) */}
                               {[...elements].sort((a,b) => b.style.zIndex - a.style.zIndex).map(el => (
                                   <div 
                                        key={el.id} 
                                        onClick={() => setSelectedIds([el.id])}
                                        className={`group flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedIds.includes(el.id) ? 'bg-primary/20 border-primary' : 'bg-[#27272a] border-transparent hover:border-white/10'}`}
                                    >
                                       <div className="w-8 h-8 rounded bg-black/20 flex items-center justify-center text-xs text-muted overflow-hidden">
                                            {el.type === 'text' || el.type === 'cta' ? 'T' : el.type === 'image' ? <img src={el.content} className="w-full h-full object-cover"/> : <div className="w-4 h-4 rounded-full" style={{background: el.content}}/>}
                                       </div>
                                       <div className="flex-1 min-w-0">
                                           <div className="text-xs font-medium truncate text-white">{el.type === 'text' || el.type === 'cta' ? el.content : el.type}</div>
                                           <div className="text-[10px] text-muted">{Math.round(el.width)} x {Math.round(el.height)}</div>
                                       </div>
                                       <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                           {el.locked && <Lock className="w-3 h-3 text-muted mr-2" />}
                                            <button onClick={(e) => { e.stopPropagation(); setSelectedIds([el.id]); deleteSelected(); }} className="hover:text-red-400 text-muted p-1"><Trash2 className="w-3 h-3" /></button>
                                       </div>
                                   </div>
                               ))}

                               {/* Background Layer (Pinned at bottom) */}
                               <div 
                                    onClick={() => setSelectedIds([])} 
                                    className={`flex flex-col p-3 rounded-lg border cursor-pointer transition-all gap-2 ${selectedIds.length === 0 ? 'bg-primary/20 border-primary' : 'bg-[#27272a] border-transparent hover:border-white/10'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-black/20 flex items-center justify-center overflow-hidden">
                                            {bgType === 'image' ? <img src={bgValue} className="w-full h-full object-cover"/> : <div className="w-full h-full" style={{background: bgValue}}/>}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-xs font-medium text-white">Background</div>
                                            <div className="text-[10px] text-muted">Canvas Base</div>
                                        </div>
                                    </div>
                                    
                                    {/* Quick Actions for Background */}
                                    {selectedIds.length === 0 && (
                                        <div className="pt-2 mt-1 border-t border-white/10 flex gap-2">
                                            <Button 
                                                size="sm" 
                                                onClick={(e) => { e.stopPropagation(); setActiveSidebar('ai'); setGenPrompt(''); }} 
                                                className="flex-1 h-7 text-[10px] flex items-center justify-center gap-1.5"
                                            >
                                                <Sparkles className="w-3 h-3" />
                                                Generate New
                                            </Button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setBgType('color'); setBgValue('#ffffff'); }} 
                                                className="h-7 w-7 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 text-muted"
                                                title="Reset to Color"
                                            >
                                                <Palette className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                               </div>
                           </div>
                       )}
                   </div>
                )}

                {/* AI Panel */}
                {activeSidebar === 'ai' && (
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 p-4 rounded-xl border border-white/10">
                            <h4 className="font-bold flex items-center gap-2 mb-2 text-white"><Wand2 className="w-4 h-4 text-primary" /> Magic Edit</h4>
                            <p className="text-xs text-muted mb-3">Select an image and describe what to change.</p>
                            <textarea 
                                value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)}
                                placeholder="Make it snowy, add fireworks..."
                                className="w-full bg-black/20 rounded-lg p-2 text-xs border border-white/10 mb-2 h-20 resize-none"
                            />
                            <Button size="sm" onClick={handleMagicEdit} disabled={!editPrompt} isLoading={isGenerating} className="w-full h-8 text-xs">Generate</Button>
                        </div>
                        
                        <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 p-4 rounded-xl border border-white/10">
                            <h4 className="font-bold flex items-center gap-2 mb-2 text-white"><Sparkles className="w-4 h-4 text-primary" /> Create Background</h4>
                            <p className="text-xs text-muted mb-3">Generate a unique background from text.</p>
                            <textarea 
                                value={genPrompt} onChange={(e) => setGenPrompt(e.target.value)}
                                placeholder="Abstract neon city..."
                                className="w-full bg-black/20 rounded-lg p-2 text-xs border border-white/10 mb-2 h-20 resize-none"
                            />
                             <Button size="sm" onClick={handleGenerateBackground} disabled={!genPrompt} isLoading={isGenerating} className="w-full h-8 text-xs">Generate</Button>

                             {/* Suggestions */}
                             <div className="mt-3">
                                 <p className="text-[10px] text-muted mb-2 font-bold uppercase tracking-wider">Try these:</p>
                                 <div className="flex flex-wrap gap-2">
                                     {SUGGESTED_BG_PROMPTS.map((p, i) => (
                                         <button 
                                            key={i} 
                                            onClick={() => setGenPrompt(p)}
                                            className="text-[10px] px-2 py-1 bg-white/5 hover:bg-white/10 rounded-md text-gray-300 transition-colors text-left"
                                        >
                                             {p}
                                         </button>
                                     ))}
                                 </div>
                             </div>
                        </div>
                    </div>
                )}
           </div>
           
           <button 
             onClick={() => setActiveSidebar(null)}
             className="absolute top-1/2 -right-3 w-6 h-12 bg-[#27272a] rounded-l-full flex items-center justify-center cursor-pointer border-l border-t border-b border-white/10 hover:bg-[#3f3f46]"
           >
               <ChevronDown className="w-4 h-4 rotate-90 text-muted" />
           </button>
      </div>

      {/* 3. Main Content (Workspace) */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0e0e0e]">
           
           {/* Top Header */}
           <div className="h-14 border-b border-white/5 bg-[#0e0e0e] flex items-center justify-between px-4 shrink-0 z-30">
               <div className="flex items-center gap-4">
                   <div className="flex items-center gap-1">
                       <button onClick={undo} disabled={historyIndex <= 0} className="p-2 hover:bg-white/5 rounded-lg text-muted disabled:opacity-30"><Undo2 className="w-4 h-4" /></button>
                       <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 hover:bg-white/5 rounded-lg text-muted disabled:opacity-30"><Redo2 className="w-4 h-4" /></button>
                   </div>
                   <div className="h-6 w-px bg-white/10"></div>
                   <div className="text-sm font-medium text-muted">Untitled Design - {aspectRatio}</div>
                   {isSaving && <div className="text-xs text-muted flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving...</div>}
               </div>
               
               <div className="flex items-center gap-3">
                   <Button variant="secondary" onClick={onClose} className="h-8 text-xs">Close</Button>
                   <Button onClick={handleSave} className="h-8 text-xs bg-white text-black hover:bg-gray-200">
                       <Share2 className="w-3 h-3 mr-2" /> Share / Download
                   </Button>
               </div>
           </div>

           {/* Context Toolbar Ribbon */}
           <div className="h-12 border-b border-white/5 bg-[#18181b] flex items-center px-4 gap-4 shrink-0 z-20 overflow-visible relative">
               
               {/* Position Button (Always Visible if something is selected or we want to access layers) */}
               <button 
                   onClick={() => setActiveSidebar('layers')}
                   className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeSidebar === 'layers' ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-muted hover:text-white'}`}
                >
                   <Layers className="w-3.5 h-3.5" /> Position
               </button>
               <div className="h-6 w-px bg-white/10"></div>

               {/* DEFAULT: BG Tools */}
               {selectedIds.length === 0 && (
                   <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
                       <button 
                            className="w-6 h-6 rounded border border-white/20 shadow-sm shrink-0" 
                            style={{ backgroundColor: bgType === 'color' ? bgValue : '#ffffff' }}
                            onClick={() => { setBgType('color'); setBgValue('#ffffff'); }}
                            title="Set Background Color"
                       />
                       <div className="h-6 w-px bg-white/10"></div>
                       <button onClick={() => setIsGenModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-md text-xs font-medium transition-colors whitespace-nowrap">
                           <Sparkles className="w-3.5 h-3.5 text-primary" /> Generate BG
                       </button>
                       <div className="h-6 w-px bg-white/10"></div>
                       
                       {/* Background Resize Controls */}
                       {bgType === 'image' && (
                           <>
                               <div className="flex items-center gap-2">
                                   <span className="text-xs text-muted">Scale</span>
                                   <input type="range" min="1" max="3" step="0.1" value={bgScale} onChange={(e) => setBgScale(parseFloat(e.target.value))} className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" />
                               </div>
                               <div className="flex items-center gap-2">
                                   <span className="text-xs text-muted">Pan X</span>
                                   <input type="range" min="-300" max="300" step="10" value={bgX} onChange={(e) => setBgX(parseInt(e.target.value))} className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" />
                               </div>
                               <div className="flex items-center gap-2">
                                   <span className="text-xs text-muted">Pan Y</span>
                                   <input type="range" min="-300" max="300" step="10" value={bgY} onChange={(e) => setBgY(parseInt(e.target.value))} className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" />
                               </div>
                               <div className="h-6 w-px bg-white/10"></div>
                           </>
                       )}

                       <div className="flex items-center gap-2 ml-2">
                           <span className="text-xs text-muted">Opacity</span>
                           <input type="range" min="0" max="1" step="0.1" value={bgOpacity} onChange={(e) => setBgOpacity(parseFloat(e.target.value))} className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" />
                       </div>
                   </div>
               )}

               {/* TEXT Tools */}
               {activeElement && (activeElement.type === 'text' || activeElement.type === 'cta') && (
                   <>
                       <select 
                            value={activeElement.style.fontFamily} 
                            onChange={(e) => updateSelected({ fontFamily: e.target.value })} 
                            className="bg-transparent text-sm w-32 outline-none cursor-pointer hover:bg-white/5 p-1 rounded"
                        >
                            {FONTS.map(f => <option key={f} value={f} className="bg-zinc-800">{f}</option>)}
                        </select>
                        <div className="h-6 w-px bg-white/10"></div>
                        <div className="flex items-center border border-white/10 rounded-md">
                            <button onClick={() => updateSelected({ fontSize: Math.max(8, (activeElement.style.fontSize || 16) - 2) })} className="p-1 hover:bg-white/5"><Minus className="w-3 h-3" /></button>
                            <input 
                                className="w-8 text-center bg-transparent text-xs outline-none appearance-none" 
                                value={activeElement.style.fontSize}
                                onChange={(e) => updateSelected({ fontSize: parseInt(e.target.value) || 16 })}
                            />
                            <button onClick={() => updateSelected({ fontSize: (activeElement.style.fontSize || 16) + 2 })} className="p-1 hover:bg-white/5"><Plus className="w-3 h-3" /></button>
                        </div>
                        <div className="h-6 w-px bg-white/10"></div>
                        
                        {/* New Color & Gradient Picker (TEXT COLOR) */}
                        <div className="relative">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setIsColorPickerOpen(!isColorPickerOpen); setIsBgColorPickerOpen(false); }}
                                className="w-6 h-6 rounded border border-white/20 overflow-hidden flex items-center justify-center bg-white/5"
                                title="Text Color"
                            >
                                <span className="text-xs font-bold" style={{ color: activeElement.style.color }}>A</span>
                            </button>
                            
                            {isColorPickerOpen && (
                                <div 
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute top-full mt-2 left-0 bg-[#18181b] border border-white/10 p-3 rounded-lg shadow-xl z-50 w-48"
                                >
                                    <div className="text-[10px] font-bold text-muted mb-2 uppercase tracking-wide">Text Color</div>
                                    <div className="flex gap-2 flex-wrap mb-4">
                                        <div className="w-6 h-6 rounded-full overflow-hidden border border-white/20 relative cursor-pointer" title="Custom Color">
                                            <div className="absolute inset-0 bg-gradient-to-br from-white to-black"></div>
                                            <input type="color" value={activeElement.style.color} onChange={(e) => updateSelected({ color: e.target.value, gradient: undefined })} className="absolute -inset-2 w-[200%] h-[200%] cursor-pointer opacity-0" />
                                        </div>
                                        {COLORS.map(c => (
                                            <button 
                                                key={c} 
                                                onClick={() => updateSelected({ color: c, gradient: undefined })} 
                                                className={`w-6 h-6 rounded-full border ${activeElement.style.color === c ? 'border-white' : 'border-white/10'}`} 
                                                style={{ background: c }} 
                                            />
                                        ))}
                                    </div>
                                    
                                    <div className="text-[10px] font-bold text-muted mb-2 uppercase tracking-wide">Gradients</div>
                                    <div className="flex gap-2 flex-wrap">
                                        {GRADIENTS.map((g, i) => (
                                            <button 
                                                key={i} 
                                                onClick={() => updateSelected({ gradient: g })} 
                                                className={`w-6 h-6 rounded-full border ${activeElement.style.gradient === g ? 'border-white' : 'border-white/10'}`} 
                                                style={{ background: g }} 
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                         {/* New Background Color Picker (BG COLOR) */}
                         <div className="relative ml-2">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setIsBgColorPickerOpen(!isBgColorPickerOpen); setIsColorPickerOpen(false); }}
                                className="w-6 h-6 rounded border border-white/20 overflow-hidden flex items-center justify-center bg-white/5"
                                title="Background Color"
                            >
                                <div className="w-3 h-3 rounded-sm border border-white/20" style={{ backgroundColor: activeElement.style.backgroundColor || 'transparent' }}></div>
                            </button>
                            
                            {isBgColorPickerOpen && (
                                <div 
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute top-full mt-2 left-0 bg-[#18181b] border border-white/10 p-3 rounded-lg shadow-xl z-50 w-48"
                                >
                                    <div className="text-[10px] font-bold text-muted mb-2 uppercase tracking-wide">Background Color</div>
                                    <div className="flex gap-2 flex-wrap mb-4">
                                        <button 
                                            onClick={() => updateSelected({ backgroundColor: undefined })} 
                                            className={`w-6 h-6 rounded-full border border-white/10 flex items-center justify-center overflow-hidden bg-transparent`} 
                                            title="No Background"
                                        >
                                            <div className="w-full h-px bg-red-500 rotate-45"></div>
                                        </button>
                                        <div className="w-6 h-6 rounded-full overflow-hidden border border-white/20 relative cursor-pointer" title="Custom Color">
                                            <div className="absolute inset-0 bg-gradient-to-br from-white to-black"></div>
                                            <input type="color" value={activeElement.style.backgroundColor || '#ffffff'} onChange={(e) => updateSelected({ backgroundColor: e.target.value })} className="absolute -inset-2 w-[200%] h-[200%] cursor-pointer opacity-0" />
                                        </div>
                                        {COLORS.map(c => (
                                            <button 
                                                key={c} 
                                                onClick={() => updateSelected({ backgroundColor: c })} 
                                                className={`w-6 h-6 rounded-full border ${activeElement.style.backgroundColor === c ? 'border-white' : 'border-white/10'}`} 
                                                style={{ background: c }} 
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-1 ml-2">
                             <button onClick={() => updateSelected({ fontWeight: activeElement.style.fontWeight === 'bold' ? 'normal' : 'bold' })} className={`p-1.5 rounded ${activeElement.style.fontWeight === 'bold' ? 'bg-white/10' : 'hover:bg-white/5'}`}><Bold className="w-4 h-4" /></button>
                             <button onClick={() => updateSelected({ fontStyle: activeElement.style.fontStyle === 'italic' ? 'normal' : 'italic' })} className={`p-1.5 rounded ${activeElement.style.fontStyle === 'italic' ? 'bg-white/10' : 'hover:bg-white/5'}`}><Italic className="w-4 h-4" /></button>
                             <button onClick={() => updateSelected({ textDecoration: activeElement.style.textDecoration === 'underline' ? 'none' : 'underline' })} className={`p-1.5 rounded ${activeElement.style.textDecoration === 'underline' ? 'bg-white/10' : 'hover:bg-white/5'}`}><Underline className="w-4 h-4" /></button>
                        </div>
                        <div className="h-6 w-px bg-white/10"></div>
                        <div className="flex items-center gap-1">
                             <button onClick={() => updateSelected({ textAlign: 'left' })} className={`p-1.5 rounded ${activeElement.style.textAlign === 'left' ? 'bg-white/10' : 'hover:bg-white/5'}`}><AlignLeft className="w-4 h-4" /></button>
                             <button onClick={() => updateSelected({ textAlign: 'center' })} className={`p-1.5 rounded ${activeElement.style.textAlign === 'center' ? 'bg-white/10' : 'hover:bg-white/5'}`}><AlignCenter className="w-4 h-4" /></button>
                             <button onClick={() => updateSelected({ textAlign: 'right' })} className={`p-1.5 rounded ${activeElement.style.textAlign === 'right' ? 'bg-white/10' : 'hover:bg-white/5'}`}><AlignRight className="w-4 h-4" /></button>
                        </div>
                   </>
               )}

               {/* IMAGE Tools */}
               {activeElement && (activeElement.type === 'image' || activeElement.type === 'logo') && (
                   <>
                       <button onClick={() => { setActiveSidebar('ai'); setEditPrompt(''); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-md text-xs font-medium transition-colors">
                           <Wand2 className="w-3.5 h-3.5 text-primary" /> Edit Image
                       </button>
                       <div className="h-6 w-px bg-white/10"></div>
                       <button onClick={() => flip('h')} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/5 rounded-md text-xs font-medium transition-colors">
                           <FlipHorizontal className="w-3.5 h-3.5" /> Flip
                       </button>
                       <div className="h-6 w-px bg-white/10"></div>
                       <button onClick={() => { setBgValue(activeElement.content); setBgType('image'); }} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/5 rounded-md text-xs font-medium transition-colors">
                           <Wallpaper className="w-3.5 h-3.5" /> Set as BG
                       </button>
                   </>
               )}
               
               {/* Common Tools */}
               {selectedIds.length > 0 && (
                   <>
                        <div className="h-6 w-px bg-white/10 ml-auto"></div>
                        <div className="flex items-center gap-2 ml-2">
                           <span className="text-xs text-muted">Transparency</span>
                           <input type="range" min="0" max="1" step="0.1" value={activeElement?.style.opacity ?? 1} onChange={(e) => updateSelected({ opacity: parseFloat(e.target.value) })} className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" />
                        </div>
                   </>
               )}
           </div>

           {/* Canvas Wrapper */}
           <div ref={workspaceRef} className="flex-1 overflow-auto flex items-center justify-center bg-[#0e0e0e] relative p-12 cursor-grab active:cursor-grabbing"
                onClick={(e) => {
                    if (e.target === e.currentTarget) setSelectedIds([]);
                }}
           >
                <div 
                    className="relative shadow-2xl transition-transform duration-200"
                    style={{ 
                        width: dims.width, 
                        height: dims.height, 
                        transform: `scale(${zoomLevel})` 
                    }}
                    ref={canvasRef}
                    onWheel={handleCanvasWheel}
                >
                    {/* Background */}
                    <div 
                        onMouseDown={(e) => handleBgMouseDown(e, 'drag')}
                        className={`absolute inset-0 z-0 overflow-hidden bg-white ${selectedIds.length === 0 && bgType === 'image' ? 'cursor-move' : 'pointer-events-none'}`}
                    >
                         {bgType === 'image' && bgValue && (
                             <img 
                                src={bgValue} 
                                className="w-full h-full object-cover transition-transform duration-75 origin-center" 
                                style={{ 
                                    opacity: bgOpacity,
                                    transform: `translate(${bgX}px, ${bgY}px) scale(${bgScale})` 
                                }} 
                                draggable={false}
                            />
                         )}
                         {bgType === 'color' && <div className="w-full h-full" style={{ backgroundColor: bgValue }}></div>}
                         {bgType === 'gradient' && <div className="w-full h-full" style={{ background: bgValue }}></div>}
                    </div>

                    {/* Background Selection Frame (Visible when Background is selected) */}
                    {selectedIds.length === 0 && bgType === 'image' && (
                        <div className="absolute inset-0 z-0 pointer-events-none">
                            <div 
                                className="absolute border-2 border-primary/50"
                                style={{
                                    left: '50%',
                                    top: '50%',
                                    width: `${dims.width * bgScale}px`,
                                    height: `${dims.height * bgScale}px`,
                                    transform: `translate(-50%, -50%) translate(${bgX}px, ${bgY}px)`
                                }}
                            >
                                {/* Resize Handles for Background */}
                                <div onMouseDown={(e) => handleBgMouseDown(e, 'resize')} className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-primary rounded-full cursor-nw-resize pointer-events-auto z-10"></div>
                                <div onMouseDown={(e) => handleBgMouseDown(e, 'resize')} className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-primary rounded-full cursor-ne-resize pointer-events-auto z-10"></div>
                                <div onMouseDown={(e) => handleBgMouseDown(e, 'resize')} className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-primary rounded-full cursor-sw-resize pointer-events-auto z-10"></div>
                                <div onMouseDown={(e) => handleBgMouseDown(e, 'resize')} className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-primary rounded-full cursor-se-resize pointer-events-auto z-10"></div>
                            </div>
                        </div>
                    )}

                    {/* Elements */}
                    {elements.map(el => {
                        const isSelected = selectedIds.includes(el.id);
                        const isGradient = !!el.style.gradient;
                        // Disable gradient rendering while editing to prevent caret issues
                        const showGradient = isGradient && !(isSelected && isEditingText);

                        return (
                            <div
                                key={el.id}
                                onMouseDown={(e) => handleMouseDown(e, el.id, 'drag')}
                                style={{
                                    position: 'absolute',
                                    left: el.x,
                                    top: el.y,
                                    width: el.width,
                                    height: el.type === 'text' || el.type === 'cta' ? 'auto' : el.height,
                                    transform: `rotate(${el.rotation}deg) scale(${el.scaleX||1}, ${el.scaleY||1})`,
                                    zIndex: el.style.zIndex,
                                    opacity: el.style.opacity ?? 1,
                                }}
                                className={`group ${isSelected && !el.locked ? 'cursor-move' : 'cursor-default'}`}
                            >
                                {/* Floating Action Menu (Pill) */}
                                {isSelected && (
                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[#18181b] rounded-lg shadow-xl border border-white/10 flex items-center p-1 gap-1 z-[99999] scale-invariant" 
                                         style={{ transform: `translateX(-50%) scale(${1/zoomLevel})` }}>
                                        <button onClick={(e) => { e.stopPropagation(); duplicateSelected(); }} className="p-1.5 hover:bg-white/10 rounded text-white" title="Duplicate"><Copy className="w-4 h-4" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); deleteSelected(); }} className="p-1.5 hover:bg-white/10 rounded text-white" title="Delete"><Trash2 className="w-4 h-4" /></button>
                                        <div className="w-px h-4 bg-white/10"></div>
                                        <button onClick={(e) => { e.stopPropagation(); toggleLock(); }} className={`p-1.5 hover:bg-white/10 rounded ${el.locked ? 'text-primary' : 'text-white'}`} title="Lock"><Lock className="w-4 h-4" /></button>
                                        <button className="p-1.5 hover:bg-white/10 rounded text-white"><MoreHorizontal className="w-4 h-4" /></button>
                                    </div>
                                )}

                                {/* Bounding Box */}
                                <div className={`relative w-full h-full ${isSelected ? 'outline outline-2 outline-primary' : 'hover:outline hover:outline-1 hover:outline-primary/50'}`}>
                                    {/* Content Render */}
                                    {el.type === 'image' || el.type === 'logo' ? (
                                        <img src={el.content} className="w-full h-full object-fill pointer-events-none" />
                                    ) : el.type === 'shape' ? (
                                        <div className="w-full h-full" style={{ 
                                            backgroundColor: el.style.backgroundColor, 
                                            borderRadius: el.style.borderRadius ? `${el.style.borderRadius}px` : 0 
                                        }}></div>
                                    ) : (
                                        <div 
                                            contentEditable={isSelected && isEditingText}
                                            suppressContentEditableWarning
                                            className={`w-full h-full outline-none p-1 ${isEditingText ? 'cursor-text' : 'cursor-inherit'}`}
                                            style={{
                                                fontSize: el.style.fontSize,
                                                fontFamily: el.style.fontFamily,
                                                fontWeight: el.style.fontWeight,
                                                fontStyle: el.style.fontStyle,
                                                textDecoration: el.style.textDecoration,
                                                textAlign: el.style.textAlign,
                                                backgroundColor: el.style.backgroundColor,
                                                borderRadius: el.style.borderRadius,
                                                
                                                // Text Gradient Logic
                                                backgroundImage: showGradient ? el.style.gradient : undefined,
                                                WebkitBackgroundClip: showGradient ? 'text' : undefined,
                                                WebkitTextFillColor: showGradient ? 'transparent' : undefined,
                                                backgroundClip: showGradient ? 'text' : undefined,
                                                color: showGradient ? 'transparent' : (el.style.color || '#ffffff'),
                                                
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: el.style.textAlign === 'center' ? 'center' : el.style.textAlign === 'right' ? 'flex-end' : 'flex-start'
                                            }}
                                            onBlur={(e) => { setIsEditingText(false); updateSelected({ content: e.currentTarget.textContent || '' }) }}
                                        >
                                            {el.content}
                                        </div>
                                    )}

                                    {/* Resize Handles */}
                                    {isSelected && !el.locked && (
                                        <>
                                            <div onMouseDown={(e) => handleMouseDown(e, el.id, 'resize')} className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-white border border-primary rounded-full cursor-se-resize z-50"></div>
                                            <div onMouseDown={(e) => handleMouseDown(e, el.id, 'resize')} className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-white border border-primary rounded-full cursor-nw-resize z-50"></div>
                                            <div onMouseDown={(e) => handleMouseDown(e, el.id, 'resize')} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white border border-primary rounded-full cursor-ne-resize z-50"></div>
                                            <div onMouseDown={(e) => handleMouseDown(e, el.id, 'resize')} className="absolute -bottom-1.5 -left-1.5 w-4 h-4 bg-white border border-primary rounded-full cursor-sw-resize z-50"></div>
                                            
                                            {/* Rotate Handle */}
                                            <div onMouseDown={(e) => handleMouseDown(e, el.id, 'rotate')} className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border border-primary rounded-full cursor-grab z-50 flex items-center justify-center hover:bg-gray-100">
                                                <RefreshCw className="w-3 h-3 text-primary" />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
           </div>

           {/* Footer Zoom Controls */}
           <div className="h-10 border-t border-white/5 bg-[#18181b] flex items-center justify-between px-4 shrink-0 z-30">
               <div className="text-xs text-muted">Page 1 of 1</div>
               <div className="flex items-center gap-4">
                   <button onClick={() => setZoomLevel(Math.max(0.1, zoomLevel - 0.1))} className="text-muted hover:text-white"><ZoomOut className="w-4 h-4" /></button>
                   <span className="text-xs font-mono w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
                   <button onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.1))} className="text-muted hover:text-white"><ZoomIn className="w-4 h-4" /></button>
                   <button onClick={() => setZoomLevel(0.6)} className="text-xs text-muted hover:text-white ml-2">Fit</button>
               </div>
           </div>
      </div>
    </div>
  );
};
