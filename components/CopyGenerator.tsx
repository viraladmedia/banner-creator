
import React, { useState, useRef } from 'react';
import { generateBannerPlan, generateImage, BannerPlan, AspectRatio } from '../services/geminiService';
import { Button } from './ui/Button';
import { 
  Wand2, Layers, Download, Image as ImageIcon, Sparkles, Upload, X, 
  Hash, Copy, Share2, Instagram, Linkedin, ChevronDown, MousePointer2, Facebook, Video, CheckCircle, Loader2, RefreshCcw
} from 'lucide-react';
import { CanvasEditor, CanvasElement, BackgroundState } from './CanvasEditor';

export const CopyGenerator: React.FC = () => {
  // --- Input State ---
  const [userPrompt, setUserPrompt] = useState('');
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [assetImage, setAssetImage] = useState<string | null>(null);
  
  // --- Config State ---
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');

  // --- Process State ---
  const [isPlanning, setIsPlanning] = useState(false);
  const [plan, setPlan] = useState<BannerPlan | null>(null);
  
  // --- Output State ---
  // generatedImages: The image to SHOW in the grid (might be edited)
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({});
  // rawBackgrounds: The clean background (AI or Upload) to use in Editor if no custom state exists
  const [rawBackgrounds, setRawBackgrounds] = useState<Record<string, string>>({});
  // savedLayers: Stores the text/elements so re-editing preserves state
  const [savedLayers, setSavedLayers] = useState<Record<string, CanvasElement[]>>({});
  // editorBackgrounds: Stores the specific background state (color, gradient, or image) from the editor
  const [editorBackgrounds, setEditorBackgrounds] = useState<Record<string, BackgroundState>>({});
  
  const [generatingStatus, setGeneratingStatus] = useState<Record<string, boolean>>({});
  const [generationErrors, setGenerationErrors] = useState<Record<string, boolean>>({});

  // --- Social State ---
  const [connectedSocials, setConnectedSocials] = useState<string[]>([]);
  const [postingStatus, setPostingStatus] = useState<Record<string, boolean>>({});
  const [postedSuccess, setPostedSuccess] = useState<Record<string, boolean>>({});

  // --- Editor State ---
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [activeEditorId, setActiveEditorId] = useState<string | null>(null);
  const [editorData, setEditorData] = useState<{
      background: string;
      elements: CanvasElement[];
      backgroundState?: BackgroundState;
  } | null>(null);

  // Refs
  const bgInputRef = useRef<HTMLInputElement>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string | null) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPrompt) return;

    setIsPlanning(true);
    setPlan(null);
    setGeneratedImages({});
    setRawBackgrounds({});
    setSavedLayers({});
    setEditorBackgrounds({});
    setGeneratingStatus({});
    setGenerationErrors({});
    setPostedSuccess({});

    try {
      const data = await generateBannerPlan({ 
        userPrompt,
        aspectRatio: aspectRatio,
        hasBackgroundImage: !!backgroundImage,
        hasAssetImage: !!assetImage
      });
      setPlan(data);
      setIsPlanning(false);

      const referenceImages: string[] = [];
      if (backgroundImage) referenceImages.push(backgroundImage);
      if (assetImage) referenceImages.push(assetImage);

      // --- LOGIC: Background Handling ---
      // If user provided a background, we use it directly for all banners to ensure consistency.
      if (backgroundImage) {
        setGeneratedImages(prev => ({ ...prev, 'main': backgroundImage }));
        setRawBackgrounds(prev => ({ ...prev, 'main': backgroundImage }));
        data.additional_banners.forEach((_, idx) => {
            setGeneratedImages(prev => ({ ...prev, [`slide-${idx}`]: backgroundImage }));
            setRawBackgrounds(prev => ({ ...prev, [`slide-${idx}`]: backgroundImage }));
        });
      } else {
        // Otherwise, generate new backgrounds using AI
        if (data.main_banner.image_prompt) {
            triggerImageGeneration('main', data.main_banner.image_prompt, aspectRatio, referenceImages);
        }
        
        data.additional_banners.forEach((slide, idx) => {
            if (slide.image_prompt) {
            triggerImageGeneration(`slide-${idx}`, slide.image_prompt, aspectRatio, referenceImages);
            }
        });
      }

    } catch (error) {
      console.error(error);
      alert('Failed to generate banner plan. Please try again.');
      setIsPlanning(false);
    }
  };

  const triggerImageGeneration = async (id: string, prompt: string, ratio: AspectRatio, refImages: string[]) => {
    setGeneratingStatus(prev => ({ ...prev, [id]: true }));
    setGenerationErrors(prev => ({ ...prev, [id]: false }));
    try {
      const imageUrl = await generateImage(prompt, ratio, refImages);
      setGeneratedImages(prev => ({ ...prev, [id]: imageUrl }));
      setRawBackgrounds(prev => ({ ...prev, [id]: imageUrl }));
    } catch (error) {
      console.error(`Failed to generate image for ${id}`, error);
      setGenerationErrors(prev => ({ ...prev, [id]: true }));
    } finally {
      setGeneratingStatus(prev => ({ ...prev, [id]: false }));
    }
  };

  // Prepares the Canvas with the intelligent layout
  const openEditor = (id: string, isMain: boolean) => {
    if (!plan) return;
    
    // Use raw background (clean) as default for editor
    const defaultBgImage = rawBackgrounds[id]; 
    if (!defaultBgImage) return;

    setActiveEditorId(id);

    // If we have saved layers from a previous edit session, use them!
    if (savedLayers[id]) {
        setEditorData({
            background: defaultBgImage,
            elements: savedLayers[id],
            backgroundState: editorBackgrounds[id]
        });
        setIsEditorOpen(true);
        return;
    }

    // Otherwise, generate default elements from Plan
    const baseHeight = 600;
    let canvasWidth = baseHeight;
    const canvasHeight = baseHeight;

    if (aspectRatio === '16:9') canvasWidth = baseHeight * (16/9);
    else if (aspectRatio === '9:16') canvasWidth = baseHeight * (9/16);
    else if (aspectRatio === '3:4') canvasWidth = baseHeight * (3/4);
    else if (aspectRatio === '4:5') canvasWidth = baseHeight * (4/5);
    
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const elements: CanvasElement[] = [];

    // Common Text Styles
    const headlineStyle = {
        fontSize: aspectRatio === '9:16' ? 36 : 48,
        fontFamily: 'Inter',
        fontWeight: 'bold',
        color: '#ffffff',
        textAlign: (aspectRatio === '16:9' ? 'left' : 'center') as 'left' | 'center',
        lineHeight: 1.1,
        letterSpacing: -1,
        zIndex: 20
    };

    const subheadStyle = {
        fontSize: aspectRatio === '9:16' ? 18 : 24,
        fontFamily: 'Inter',
        fontWeight: 'normal',
        color: '#e4e4e7', // zinc-200
        textAlign: (aspectRatio === '16:9' ? 'left' : 'center') as 'left' | 'center',
        lineHeight: 1.4,
        letterSpacing: 0,
        zIndex: 20
    };

    const ctaStyle = {
        fontSize: 18,
        fontFamily: 'Inter',
        fontWeight: 'bold',
        color: '#ffffff',
        backgroundColor: '#8b5cf6', // Primary violet
        textAlign: 'center' as 'center',
        borderRadius: 8,
        padding: 12,
        lineHeight: 1,
        letterSpacing: 1,
        zIndex: 30
    };

    // --- Asset Placement Logic ---
    if (assetImage) {
        elements.push({
            id: 'brand-asset',
            type: 'image',
            content: assetImage,
            x: aspectRatio === '16:9' ? canvasWidth - 150 : centerX - 50,
            y: aspectRatio === '16:9' ? centerY - 50 : 30,
            width: 100,
            height: 100,
            rotation: 0,
            style: { zIndex: 25, opacity: 1 }
        });
    }

    if (isMain) {
        // Headline
        elements.push({
            id: 'main-headline',
            type: 'text',
            content: plan.main_banner.headline,
            x: aspectRatio === '16:9' ? 50 : 20,
            y: aspectRatio === '16:9' ? centerY - 80 : (assetImage ? 150 : 80),
            width: canvasWidth - (aspectRatio === '16:9' ? 100 : 40),
            height: 100,
            rotation: 0,
            style: { ...headlineStyle, opacity: 1 }
        });
        
        // Subheadline
        elements.push({
            id: 'main-sub',
            type: 'text',
            content: plan.main_banner.subheadline,
            x: aspectRatio === '16:9' ? 50 : 20,
            y: aspectRatio === '16:9' ? centerY + 20 : (assetImage ? 260 : 190),
            width: canvasWidth - (aspectRatio === '16:9' ? 100 : 40),
            height: 80,
            rotation: 0,
            style: { ...subheadStyle, opacity: 1 }
        });

        // CTA
        elements.push({
            id: 'main-cta',
            type: 'cta',
            content: plan.main_banner.cta || 'Learn More',
            x: aspectRatio === '16:9' ? 50 : centerX - 80,
            y: aspectRatio === '16:9' ? centerY + 100 : canvasHeight - 120,
            width: 160,
            height: 50,
            rotation: 0,
            style: { ...ctaStyle, opacity: 1 }
        });

    } else {
        const slideIndex = parseInt(id.replace('slide-', ''));
        const slide = plan.additional_banners[slideIndex];
        
        if (slide) {
            // Slide Title
            elements.push({
                id: `slide-title-${slideIndex}`,
                type: 'text',
                content: slide.title,
                x: 20,
                y: assetImage ? 140 : 50,
                width: canvasWidth - 40,
                height: 60,
                rotation: 0,
                style: { ...headlineStyle, opacity: 1 }
            });

            // Slide Content
            elements.push({
                id: `slide-content-${slideIndex}`,
                type: 'text',
                content: slide.subtitle,
                x: 20,
                y: assetImage ? 220 : 130,
                width: canvasWidth - 40,
                height: 100,
                rotation: 0,
                style: { ...subheadStyle, opacity: 1 }
            });

             // CTA
             elements.push({
                id: `slide-cta-${slideIndex}`,
                type: 'cta',
                content: slide.cta || 'Try It Now',
                x: centerX - 80,
                y: canvasHeight - 120,
                width: 160,
                height: 50,
                rotation: 0,
                style: { ...ctaStyle, opacity: 1 }
            });
        }
    }

    setEditorData({
        background: defaultBgImage,
        elements: elements
    });
    setIsEditorOpen(true);
  };

  const handleSaveFromEditor = (finalImage: string, elements: CanvasElement[], bgState: BackgroundState) => {
      if (!activeEditorId) return;

      // 1. Update the visual grid with the new edited image
      setGeneratedImages(prev => ({ ...prev, [activeEditorId]: finalImage }));
      
      // 2. Save the layer state so user can re-edit later
      setSavedLayers(prev => ({ ...prev, [activeEditorId]: elements }));

      // 3. Save background state logic (if user changed BG in editor)
      setEditorBackgrounds(prev => ({ ...prev, [activeEditorId]: bgState }));

      // 4. Close Editor
      setIsEditorOpen(false);
      setActiveEditorId(null);
  };

  const handleDownload = (imageUrl: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `social-post-${Date.now()}.png`;
    link.click();
  };

  // --- Social Media Connect Logic ---
  const handleSocialAction = (platform: string) => {
    // If already connected, trigger "Post" logic
    if (connectedSocials.includes(platform)) {
        handlePostToSocial(platform);
        return;
    }

    // Connect Flow
    let url = '';
    switch(platform) {
        case 'facebook': url = 'https://www.facebook.com/login.php'; break;
        case 'tiktok': url = 'https://www.tiktok.com/login'; break;
        case 'instagram': url = 'https://www.instagram.com/accounts/login/'; break;
        case 'linkedin': url = 'https://www.linkedin.com/login'; break;
    }

    const width = 600, height = 700;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;
    
    // Simulate connection flow
    const popup = window.open(url, `Connect ${platform}`, `width=${width},height=${height},top=${top},left=${left}`);
    
    const checkClosed = setInterval(() => {
        if (popup?.closed) {
            clearInterval(checkClosed);
            setConnectedSocials(prev => [...prev, platform]);
        }
    }, 1000);
  };

  const handlePostToSocial = (platform: string) => {
      setPostingStatus(prev => ({ ...prev, [platform]: true }));
      
      // Simulate API latency
      setTimeout(() => {
          setPostingStatus(prev => ({ ...prev, [platform]: false }));
          setPostedSuccess(prev => ({ ...prev, [platform]: true }));
          
          // Reset success message after 3 seconds
          setTimeout(() => {
              setPostedSuccess(prev => ({ ...prev, [platform]: false }));
          }, 4000);
      }, 1500);
  };

  const getRetryProps = (id: string, prompt: string) => {
    const refs: string[] = [];
    if (backgroundImage) refs.push(backgroundImage);
    if (assetImage) refs.push(assetImage);
    return () => triggerImageGeneration(id, prompt, aspectRatio, refs);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      
      {/* --- Full Screen Editor Overlay --- */}
      {isEditorOpen && editorData && (
          <CanvasEditor 
            backgroundImage={editorData.background}
            initialElements={editorData.elements}
            initialBackgroundState={editorData.backgroundState}
            aspectRatio={aspectRatio}
            onClose={() => setIsEditorOpen(false)}
            onSave={handleSaveFromEditor}
          />
      )}

      {/* --- Left Column: Creative Studio (Form) --- */}
      <div className="w-full lg:w-[400px] flex-shrink-0 space-y-6">
        <div className="bg-surface/50 backdrop-blur-xl border border-white/5 p-6 rounded-2xl shadow-xl sticky top-24">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" /> Create New
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* User Prompt */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted uppercase tracking-wider">Describe your banner</label>
                        <textarea
                            value={userPrompt}
                            onChange={(e) => setUserPrompt(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted focus:ring-1 focus:ring-primary focus:border-primary/50 outline-none transition-all h-32 resize-none"
                            placeholder="e.g. A modern instagram post for a coffee shop sale, human feels, warm lighting... or Describe the scene, text and vibe you want."
                        />
                    </div>
                </div>

                {/* Configuration */}
                <div className="pt-4 border-t border-white/5 space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted uppercase tracking-wider">Format</label>
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { id: '1:1', label: 'Square', icon: '□' },
                                { id: '4:5', label: 'Portrait', icon: '▯' },
                                { id: '9:16', label: 'Story', icon: '▯' },
                                { id: '16:9', label: 'Land', icon: '▭' }
                            ].map((ratio) => (
                                <button
                                    key={ratio.id}
                                    type="button"
                                    onClick={() => setAspectRatio(ratio.id as AspectRatio)}
                                    className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                                        aspectRatio === ratio.id 
                                        ? 'bg-primary/20 border-primary text-primary' 
                                        : 'bg-black/20 border-white/5 text-muted hover:bg-white/5'
                                    }`}
                                >
                                    <span className="text-lg leading-none mb-1">{ratio.icon}</span>
                                    <span className="text-[10px]">{ratio.id}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Assets */}
                <div className="pt-4 border-t border-white/5 space-y-4">
                    <label className="text-xs font-semibold text-muted uppercase tracking-wider">Assets (Optional)</label>
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            type="button" 
                            onClick={() => bgInputRef.current?.click()}
                            className={`flex flex-col items-center justify-center p-4 rounded-xl border border-dashed transition-all relative group overflow-hidden ${backgroundImage ? 'border-primary bg-primary/10 p-0' : 'border-white/10 hover:bg-white/5'}`}
                        >
                             <input type="file" ref={bgInputRef} onChange={(e) => handleFileUpload(e, setBackgroundImage)} className="hidden" accept="image/*" />
                             {backgroundImage ? (
                                 <div className="relative w-full aspect-video rounded-lg overflow-hidden">
                                     <img src={backgroundImage} className="w-full h-full object-cover" />
                                     <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                         <span className="text-xs text-white">Change</span>
                                     </div>
                                     <div 
                                        onClick={(e) => { e.stopPropagation(); setBackgroundImage(null); }}
                                        className="absolute top-1 right-1 bg-black/50 hover:bg-red-500/80 rounded-full p-1 text-white transition-colors"
                                        title="Remove Background"
                                     >
                                         <X className="w-3 h-3" />
                                     </div>
                                 </div>
                             ) : (
                                <>
                                    <ImageIcon className="w-5 h-5 text-muted mb-2" />
                                    <span className="text-xs text-muted">Background</span>
                                </>
                             )}
                        </button>
                        
                        <button 
                            type="button" 
                            onClick={() => assetInputRef.current?.click()}
                            className={`flex flex-col items-center justify-center p-4 rounded-xl border border-dashed transition-all relative group overflow-hidden ${assetImage ? 'border-primary bg-primary/10 p-0' : 'border-white/10 hover:bg-white/5'}`}
                        >
                             <input type="file" ref={assetInputRef} onChange={(e) => handleFileUpload(e, setAssetImage)} className="hidden" accept="image/*" />
                             {assetImage ? (
                                 <div className="relative w-full aspect-video rounded-lg overflow-hidden">
                                     <img src={assetImage} className="w-full h-full object-contain" />
                                     <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                         <span className="text-xs text-white">Change</span>
                                     </div>
                                     <div 
                                        onClick={(e) => { e.stopPropagation(); setAssetImage(null); }}
                                        className="absolute top-1 right-1 bg-black/50 hover:bg-red-500/80 rounded-full p-1 text-white transition-colors"
                                        title="Remove Asset"
                                     >
                                         <X className="w-3 h-3" />
                                     </div>
                                 </div>
                             ) : (
                                <>
                                    <Upload className="w-5 h-5 text-muted mb-2" />
                                    <span className="text-xs text-muted">Logo / Asset</span>
                                </>
                             )}
                        </button>
                    </div>
                </div>

                <div className="pt-4">
                    <Button type="submit" isLoading={isPlanning} className="w-full py-4 text-lg shadow-xl shadow-primary/25">
                        <Wand2 className="w-5 h-5" /> Generate Campaign
                    </Button>
                </div>
            </form>
        </div>
      </div>

      {/* --- Right Column: Results Grid --- */}
      <div className="flex-1 min-w-0">
        {!plan && !isPlanning && (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 border border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
                <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 animate-pulse-slow">
                    <Sparkles className="w-10 h-10 text-primary opacity-50" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Ready to Create?</h3>
                <p className="text-muted max-w-md">Describe your banner (e.g., "Human feel, cozy coffee shop sale") to generate a social media campaign with copy and visuals.</p>
            </div>
        )}

        {isPlanning && (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center">
                <div className="w-16 h-16 border-t-2 border-b-2 border-primary rounded-full animate-spin mb-8"></div>
                <h3 className="text-xl font-bold text-white animate-pulse">Designing Campaign...</h3>
                <p className="text-muted mt-2">Writing copy, planning layout, and creating backgrounds</p>
            </div>
        )}

        {plan && (
            <div className="space-y-12 animate-slide-up">
                
                {/* 1. Preview Grid */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                         <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <ImageIcon className="w-5 h-5 text-primary" /> Visual Assets
                         </h3>
                         <span className="text-xs text-muted bg-white/5 px-3 py-1 rounded-full">Click any image to edit</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {/* Main Banner Card */}
                        <div 
                            className="group bg-surface border border-white/5 rounded-2xl overflow-hidden hover:border-primary/50 transition-all relative"
                        >
                            <div 
                                onClick={() => generatedImages['main'] ? openEditor('main', true) : null}
                                className={`w-full bg-black/20 flex items-center justify-center relative overflow-hidden cursor-pointer ${aspectRatio === '9:16' ? 'aspect-[9/16]' : aspectRatio === '16:9' ? 'aspect-video' : aspectRatio === '4:5' ? 'aspect-[4/5]' : 'aspect-square'}`}
                            >
                                {generatedImages['main'] ? (
                                    <div className="relative w-full h-full">
                                        <img src={generatedImages['main']} alt="Main Banner" className="w-full h-full object-cover" />
                                        {/* Show Overlay TEXT only if we haven't edited it yet (raw mode). If it's edited, text is baked in so we hide overlay to avoid dupes */}
                                        {!savedLayers['main'] && (
                                            <div className="absolute inset-0 p-4 flex flex-col items-center justify-center text-center pointer-events-none bg-black/30">
                                                <h2 className="text-white font-bold text-2xl mb-2 drop-shadow-md">{plan.main_banner.headline}</h2>
                                                <p className="text-zinc-200 text-sm drop-shadow-md">{plan.main_banner.subheadline}</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center p-6 flex flex-col items-center justify-center h-full">
                                        {generatingStatus['main'] ? (
                                            <div className="animate-pulse text-primary text-sm font-medium">Rendering Art...</div>
                                        ) : generationErrors['main'] ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="text-red-400 text-xs">Generation Failed</div>
                                                <Button 
                                                    variant="secondary" 
                                                    onClick={(e) => { e.stopPropagation(); getRetryProps('main', plan.main_banner.image_prompt)(); }} 
                                                    className="h-8 px-3 text-xs"
                                                >
                                                    <RefreshCcw className="w-3 h-3 mr-1" /> Retry
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="text-muted text-sm">Waiting for render...</div>
                                        )}
                                    </div>
                                )}
                                {/* Overlay on Hover */}
                                {generatedImages['main'] && (
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10 gap-2">
                                        <Button variant="secondary" className="scale-90 group-hover:scale-100 transition-transform">
                                            <MousePointer2 className="w-4 h-4 mr-2" /> Edit
                                        </Button>
                                    </div>
                                )}
                            </div>
                            <div className="p-4 border-t border-white/5 flex items-center justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Main Cover</span>
                                    </div>
                                    <h4 className="text-white font-medium text-sm line-clamp-1 leading-snug mb-1">{plan.main_banner.headline}</h4>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    onClick={() => handleDownload(generatedImages['main'])} 
                                    disabled={!generatedImages['main']}
                                    className="h-8 w-8 p-0" title="Download"
                                >
                                    <Download className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Additional Slides / Banners */}
                        {plan.additional_banners.map((slide, idx) => (
                            <div 
                                key={idx} 
                                className="group bg-surface border border-white/5 rounded-2xl overflow-hidden hover:border-primary/50 transition-all relative"
                            >
                                <div 
                                    onClick={() => generatedImages[`slide-${idx}`] ? openEditor(`slide-${idx}`, false) : null}
                                    className={`w-full bg-black/20 flex items-center justify-center relative overflow-hidden cursor-pointer ${aspectRatio === '9:16' ? 'aspect-[9/16]' : aspectRatio === '16:9' ? 'aspect-video' : aspectRatio === '4:5' ? 'aspect-[4/5]' : 'aspect-square'}`}
                                >
                                    {generatedImages[`slide-${idx}`] ? (
                                        <div className="relative w-full h-full">
                                            <img src={generatedImages[`slide-${idx}`]} alt={slide.title} className="w-full h-full object-cover" />
                                             {!savedLayers[`slide-${idx}`] && (
                                                <div className="absolute inset-0 p-4 flex flex-col items-center justify-center text-center pointer-events-none bg-black/30">
                                                    <h2 className="text-white font-bold text-xl mb-2 drop-shadow-md">{slide.title}</h2>
                                                    <p className="text-zinc-200 text-xs drop-shadow-md">{slide.subtitle}</p>
                                                </div>
                                             )}
                                        </div>
                                    ) : (
                                        <div className="text-center p-6 flex flex-col items-center justify-center h-full">
                                            {generatingStatus[`slide-${idx}`] ? (
                                                <div className="animate-pulse text-primary text-sm font-medium">Rendering Art...</div>
                                            ) : generationErrors[`slide-${idx}`] ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="text-red-400 text-xs">Generation Failed</div>
                                                    <Button 
                                                        variant="secondary" 
                                                        onClick={(e) => { e.stopPropagation(); getRetryProps(`slide-${idx}`, slide.image_prompt)(); }} 
                                                        className="h-8 px-3 text-xs"
                                                    >
                                                        <RefreshCcw className="w-3 h-3 mr-1" /> Retry
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="text-muted text-sm">Waiting for render...</div>
                                            )}
                                        </div>
                                    )}
                                     {/* Overlay on Hover */}
                                    {generatedImages[`slide-${idx}`] && (
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10 gap-2">
                                            <Button variant="secondary" className="scale-90 group-hover:scale-100 transition-transform">
                                                <MousePointer2 className="w-4 h-4 mr-2" /> Edit
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 border-t border-white/5 flex items-center justify-between">
                                    <div>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Slide {idx + 2}</span>
                                        </div>
                                        <h4 className="text-white font-medium text-sm line-clamp-1 mb-1">{slide.title}</h4>
                                    </div>
                                     <Button 
                                        variant="ghost" 
                                        onClick={() => handleDownload(generatedImages[`slide-${idx}`])} 
                                        disabled={!generatedImages[`slide-${idx}`]}
                                        className="h-8 w-8 p-0" title="Download"
                                    >
                                        <Download className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. SEO & Caption Output & SOCIALS */}
                <div className="bg-surface border border-white/5 rounded-2xl p-6 space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Hash className="w-5 h-5 text-primary" /> Generated Caption & SEO
                    </h3>
                    
                    <div className="bg-black/20 rounded-xl p-4 border border-white/5 space-y-4">
                        <div className="flex gap-2 flex-wrap">
                            {plan.seo.keywords.map((kw, i) => (
                                <span key={i} className="text-[10px] bg-white/10 text-white px-2 py-1 rounded-md">
                                    {kw}
                                </span>
                            ))}
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed font-mono whitespace-pre-wrap">
                            {plan.seo.caption}
                        </p>
                        <div className="pt-2 border-t border-white/10">
                            <p className="text-primary text-sm font-medium">
                                {plan.seo.hashtags.map(tag => `#${tag}`).join(' ')}
                            </p>
                        </div>
                    </div>
                    
                    {/* Share / Export Toolbar */}
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                         <Button variant="secondary" className="flex-1 w-full" onClick={() => navigator.clipboard.writeText(`${plan.seo.caption} ${plan.seo.hashtags.map(t=>`#${t}`).join(' ')}`)}>
                             <Copy className="w-4 h-4" /> Copy Caption
                         </Button>
                         
                         <div className="h-px w-full sm:h-8 sm:w-px bg-white/10"></div>
                         
                         {/* Social Connect & Post Buttons */}
                         <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
                            
                            {/* Instagram */}
                            <button 
                                onClick={() => handleSocialAction('instagram')}
                                disabled={postingStatus['instagram'] || postedSuccess['instagram']}
                                className={`p-2.5 rounded-lg transition-all relative group ${
                                    connectedSocials.includes('instagram') 
                                    ? 'bg-[#E1306C]/20 text-[#E1306C] border border-[#E1306C]/30' 
                                    : 'bg-white/5 text-muted hover:bg-white/10 hover:text-white'
                                }`}
                                title={connectedSocials.includes('instagram') ? "Post to Instagram" : "Connect Instagram"}
                            >
                                {postingStatus['instagram'] ? <Loader2 className="w-5 h-5 animate-spin" /> : 
                                 postedSuccess['instagram'] ? <CheckCircle className="w-5 h-5 text-green-500" /> :
                                 <Instagram className="w-5 h-5" />}
                                
                                {connectedSocials.includes('instagram') && !postingStatus['instagram'] && !postedSuccess['instagram'] && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-surface"></div>
                                )}
                            </button>

                            {/* Facebook */}
                            <button 
                                onClick={() => handleSocialAction('facebook')}
                                disabled={postingStatus['facebook'] || postedSuccess['facebook']}
                                className={`p-2.5 rounded-lg transition-all relative group ${
                                    connectedSocials.includes('facebook') 
                                    ? 'bg-[#1877F2]/20 text-[#1877F2] border border-[#1877F2]/30' 
                                    : 'bg-white/5 text-muted hover:bg-white/10 hover:text-white'
                                }`}
                                title={connectedSocials.includes('facebook') ? "Post to Facebook" : "Connect Facebook"}
                            >
                                {postingStatus['facebook'] ? <Loader2 className="w-5 h-5 animate-spin" /> :
                                 postedSuccess['facebook'] ? <CheckCircle className="w-5 h-5 text-green-500" /> :
                                 <Facebook className="w-5 h-5" />}

                                {connectedSocials.includes('facebook') && !postingStatus['facebook'] && !postedSuccess['facebook'] && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-surface"></div>
                                )}
                            </button>

                            {/* TikTok */}
                             <button 
                                onClick={() => handleSocialAction('tiktok')}
                                disabled={postingStatus['tiktok'] || postedSuccess['tiktok']}
                                className={`p-2.5 rounded-lg transition-all relative group ${
                                    connectedSocials.includes('tiktok') 
                                    ? 'bg-black/40 text-white border border-white/20' 
                                    : 'bg-white/5 text-muted hover:bg-white/10 hover:text-white'
                                }`}
                                title={connectedSocials.includes('tiktok') ? "Post to TikTok" : "Connect TikTok"}
                            >
                                {postingStatus['tiktok'] ? <Loader2 className="w-5 h-5 animate-spin" /> :
                                 postedSuccess['tiktok'] ? <CheckCircle className="w-5 h-5 text-green-500" /> :
                                 <Video className="w-5 h-5" />}

                                {connectedSocials.includes('tiktok') && !postingStatus['tiktok'] && !postedSuccess['tiktok'] && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-surface"></div>
                                )}
                            </button>

                            {/* LinkedIn */}
                            <button 
                                onClick={() => handleSocialAction('linkedin')}
                                disabled={postingStatus['linkedin'] || postedSuccess['linkedin']}
                                className={`p-2.5 rounded-lg transition-all relative group ${
                                    connectedSocials.includes('linkedin') 
                                    ? 'bg-[#0077B5]/20 text-[#0077B5] border border-[#0077B5]/30' 
                                    : 'bg-white/5 text-muted hover:bg-white/10 hover:text-white'
                                }`}
                                title={connectedSocials.includes('linkedin') ? "Post to LinkedIn" : "Connect LinkedIn"}
                            >
                                {postingStatus['linkedin'] ? <Loader2 className="w-5 h-5 animate-spin" /> :
                                 postedSuccess['linkedin'] ? <CheckCircle className="w-5 h-5 text-green-500" /> :
                                 <Linkedin className="w-5 h-5" />}

                                {connectedSocials.includes('linkedin') && !postingStatus['linkedin'] && !postedSuccess['linkedin'] && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-surface"></div>
                                )}
                            </button>

                            {/* Generic Share */}
                            <button className="p-2.5 rounded-lg bg-white/5 text-white hover:bg-white/10 transition-colors ml-2">
                                <Share2 className="w-5 h-5" />
                            </button>
                         </div>
                    </div>
                </div>

            </div>
        )}
      </div>
    </div>
  );
};
