"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { MarkdownPreview } from "@/components/markdown-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Menu, X, KeySquare, Image as ImageIcon, FileText, CheckCircle, HelpCircle, ArrowLeftRight, Upload } from "lucide-react";
import { saveTemplateImage, getTemplateImage } from "@/lib/db";
import { generateArticleContent, generateBanneri2i } from "@/lib/gemini";
import { createSubnanoDraft, patchSubnanoPost, publishSubnanoPost, uploadSubnanoImage } from "@/lib/subnano";

type ViewType = 'login' | 'banner' | 'editor' | 'published' | 'faq' | 'swap';

export default function Home() {
  const [currentView, setCurrentView] = useState<ViewType>('editor');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  const [subnanoApiKey, setSubnanoApiKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [templateImage, setTemplateImage] = useState<string | null>(null);
  
  const [sourceMaterial, setSourceMaterial] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [postTitle, setPostTitle] = useState("");
  const [postDescription, setPostDescription] = useState("");
  const [postContent, setPostContent] = useState("");
  
  const [generatedBanner, setGeneratedBanner] = useState<string | null>(null);
  const [isGeneratingBanner, setIsGeneratingBanner] = useState(false);

  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    const savedSubnanoKey = localStorage.getItem("subnano_api_key");
    const savedGeminiKey = localStorage.getItem("gemini_api_key");
    if (savedSubnanoKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSubnanoApiKey(savedSubnanoKey);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentView('login');
    }
    if (savedGeminiKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGeminiApiKey(savedGeminiKey);
    }

    getTemplateImage().then((img) => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (img) setTemplateImage(img);
    });
  }, []);

  if (!hasMounted) return null;

  const handleSaveSettings = async () => {
    localStorage.setItem("subnano_api_key", subnanoApiKey);
    localStorage.setItem("gemini_api_key", geminiApiKey);
    toast.success("API Keys saved successfully.");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error("Please upload a valid image file");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setTemplateImage(base64);
        saveTemplateImage(base64);
        toast.success("Template image updated");
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSourceMaterialUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setSourceMaterial(prev => prev + (prev ? '\n\n' : '') + (evt.target?.result as string));
        toast.success("File content appended to source material.");
      };
      reader.readAsText(file);
    }
  };

  const handleGenerateContent = async () => {
    if (!sourceMaterial) {
      toast.error("Please provide source material to generate content.");
      return;
    }
    setIsGenerating(true);
    try {
      const data = await generateArticleContent(sourceMaterial, geminiApiKey);
      if (data) {
        setPostTitle(data.title || "");
        setPostDescription(data.description || "");
        setPostContent(data.markdownContent || "");
        toast.success("Article drafted successfully!");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to generate content");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateBanner = async () => {
    if (!sourceMaterial) {
      toast.error("Please specify source material to inform the banner generation.");
      return;
    }
    if (!templateImage) {
      toast.error("Please upload a default template image first.");
      return;
    }
    
    setIsGeneratingBanner(true);
    try {
      const result = await generateBanneri2i(sourceMaterial, templateImage, geminiApiKey);
      setGeneratedBanner(result);
      toast.success("Banner generated successfully!");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate banner image");
    } finally {
      setIsGeneratingBanner(false);
    }
  };

  const handlePublish = async () => {
    if (!subnanoApiKey) {
      setCurrentView('login');
      toast.error("Subnano API Key is required to publish.");
      return;
    }
    if (!postTitle || !postContent) {
      toast.error("Post title and content are required.");
      return;
    }

    setIsPublishing(true);
    try {
      let finalMarkdown = postContent;
      
      toast.info("Creating draft...");
      const draft = await createSubnanoDraft(subnanoApiKey, {
        title: postTitle,
        description: postDescription || "An automated post",
        paidContentMarkdown: finalMarkdown,
        enablePaywall: false,
        primaryCategoryId: 4, 
        language: "en",
        commentsEnabled: true
      });
      
      const postId = draft.id || draft.data?.id || draft.uuid || draft.data?.uuid;
      if (!postId) {
        throw new Error("Could not retrieve Post ID from creation response");
      }

      if (generatedBanner) {
        toast.info("Uploading banner image...");
        const imageRes = await uploadSubnanoImage(subnanoApiKey, postId, generatedBanner, 'content');
        const imageUrl = imageRes.url || imageRes.data?.url || "https://example.com/uploaded";
        
        finalMarkdown = `![Banner Image](${imageUrl})\n\n` + finalMarkdown;
        await patchSubnanoPost(subnanoApiKey, postId, {
          paidContentMarkdown: finalMarkdown,
        });
      }

      toast.info("Publishing post...");
      await publishSubnanoPost(subnanoApiKey, postId, uuidv4());      
      toast.success("Post published successfully!");
      setCurrentView('published');
    } catch (e: any) {
      toast.error(e.message || "Failed to publish post.");
    } finally {
      setIsPublishing(false);
    }
  };

  const menuItems = [
    { id: 'login', icon: <KeySquare size={16} />, label: 'Login & Setup' },
    { id: 'banner', icon: <ImageIcon size={16} />, label: 'Banner Generation' },
    { id: 'editor', icon: <FileText size={16} />, label: 'Content Generator' },
    { id: 'published', icon: <CheckCircle size={16} />, label: 'Published Works' },
    { id: 'swap', icon: <ArrowLeftRight size={16} />, label: 'Swap Nano' },
    { id: 'faq', icon: <HelpCircle size={16} />, label: 'FAQ & Docs' },
  ] as const;

  return (
    <div className="h-screen w-full bg-black text-zinc-200 font-sans flex flex-col overflow-hidden dark">
      {/* Header */}
      <header className="h-16 border-b border-pink-900/30 bg-zinc-950/50 backdrop-blur-md flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white"
            onClick={() => setIsDrawerOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="w-8 h-8 bg-pink-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-pink-600/20">S</div>
          <h1 className="text-lg font-semibold tracking-tight">Subnano<span className="text-pink-400">Composer</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 rounded-full border border-pink-900/20 hidden sm:flex">
            <div className={`w-2 h-2 rounded-full ${subnanoApiKey ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.6)]"}`}></div>
            <span className="text-xs text-zinc-300 font-medium italic">{subnanoApiKey ? "API Connected" : "API Required"}</span>
          </div>
          <Button onClick={handlePublish} disabled={isPublishing || !postTitle || !postContent || !subnanoApiKey} className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white text-sm font-semibold rounded-lg transition-colors h-auto border-0">
            {isPublishing ? "Publishing..." : "Publish to Subnano.me"}
          </Button>
        </div>
      </header>

      {/* Drawer Overlay */}
      {isDrawerOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Drawer */}
      <div className={`fixed inset-y-0 left-0 w-64 bg-zinc-950 border-r border-pink-900/30 z-50 transform transition-transform duration-300 ease-in-out ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b border-pink-900/30">
          <span className="font-bold text-sm tracking-widest uppercase text-pink-500">Navigation</span>
          <button onClick={() => setIsDrawerOpen(false)} className="text-zinc-400 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>
        <nav className="p-4 flex flex-col gap-2">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentView(item.id);
                setIsDrawerOpen(false);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                currentView === item.id 
                  ? 'bg-pink-600/10 text-pink-400 border border-pink-500/20' 
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Workspace */}
      <main className="flex-1 overflow-auto relative">
        <div className="max-w-6xl mx-auto p-4 sm:p-8 h-full">
          
          {currentView === 'login' && (
            <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-2 text-center">
                <h2 className="text-2xl font-bold text-white">Connect to Subnano & Gemini</h2>
                <p className="text-zinc-400">Enter your personal Subnano Publishing API key and Gemini API key to start creating and publishing right from this application.</p>
              </div>

              <div className="p-6 bg-zinc-900/50 border border-pink-900/30 rounded-xl space-y-6 shadow-xl shadow-black">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-zinc-300 block">Subnano API Key</Label>
                    <Input 
                      type="password" 
                      value={subnanoApiKey} 
                      onChange={(e) => setSubnanoApiKey(e.target.value)} 
                      className="bg-black border-zinc-800 text-pink-300 font-mono focus-visible:ring-pink-500"
                      placeholder="snpk_..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-zinc-300 block">Gemini API Key</Label>
                    <Input 
                      type="password" 
                      value={geminiApiKey} 
                      onChange={(e) => setGeminiApiKey(e.target.value)} 
                      className="bg-black border-zinc-800 text-pink-300 font-mono focus-visible:ring-pink-500"
                      placeholder="AIzaSy..."
                    />
                    <p className="text-xs text-zinc-500">Required to generate articles and variant banners. Get one at <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-pink-500 hover:underline">Google AI Studio</a>.</p>
                  </div>
                </div>
                <Button onClick={handleSaveSettings} className="w-full bg-pink-600 hover:bg-pink-500 text-white font-semibold">
                  Save Credentials
                </Button>
              </div>

              <div className="p-6 border border-zinc-800 rounded-xl bg-zinc-950/50 space-y-4">
                <h3 className="font-semibold text-pink-400">How to get your API Key</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-400 leading-relaxed">
                  <li>Log into your account at <a href="https://subnano.me" target="_blank" className="text-pink-500 hover:underline">subnano.me</a></li>
                  <li>Navigate to your Dashboard or Settings area.</li>
                  <li>Look for the Developer or API Keys section.</li>
                  <li>Generate a new Publishing API key.</li>
                  <li>Copy the key (it should start with <code className="bg-black px-1.5 py-0.5 rounded text-pink-300 font-mono">snpk_</code>) and paste it above.</li>
                </ol>
              </div>
            </div>
          )}

          {currentView === 'banner' && (
            <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">Banner Generation (i2i)</h2>
                <p className="text-zinc-400">Set a default template and use conceptual variance to generate a unique hero banner based on your source material.</p>
              </div>

              <div className="p-6 bg-zinc-900/50 border border-pink-900/30 rounded-xl space-y-6">
                <div>
                  <Label className="font-medium text-zinc-300 block mb-2">Default Base Template</Label>
                  <p className="text-xs text-zinc-500 mb-4">Upload an image. This image will serve as the structural and stylistic foundation for all banners generated using the Image-to-Image (i2i) conceptional variant generator.</p>
                  
                  <div className="flex items-center gap-4">
                    <label className="flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg cursor-pointer transition-colors border border-zinc-700 text-sm font-medium">
                      <Upload size={16} />
                      Upload Template Image
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  </div>
                  
                  {templateImage && (
                    <div className="mt-6">
                      <p className="text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wide">Current Template</p>
                      <div className="rounded-lg overflow-hidden border border-zinc-800 max-w-sm">
                        <img src={templateImage} alt="template" className="w-full auto object-cover" referrerPolicy="no-referrer" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border border-zinc-800 rounded-xl space-y-4">
                <h3 className="font-semibold text-white">Test Generation</h3>
                <Label className="text-xs text-zinc-400 block">Provide generic source material or paste your article context to see what variant is created from the template:</Label>
                <textarea 
                  className="w-full h-32 bg-black text-zinc-300 font-mono text-xs leading-relaxed outline-none resize-none p-4 rounded-lg border border-zinc-800 focus-visible:border-pink-500 transition-colors" 
                  spellCheck="false"
                  placeholder="Paste context here..."
                  value={sourceMaterial}
                  onChange={e => setSourceMaterial(e.target.value)}
                />
                <Button 
                  onClick={handleGenerateBanner} 
                  disabled={isGeneratingBanner || !sourceMaterial || !templateImage} 
                  className="w-full bg-pink-600 hover:bg-pink-500 text-white"
                >
                  {isGeneratingBanner ? "Generating Variant..." : "Generate Variant Banner"}
                </Button>

                {generatedBanner && (
                  <div className="mt-8 rounded-xl overflow-hidden border border-pink-900/50 shadow-[0_0_15px_rgba(219,39,119,0.1)]">
                    <div className="bg-zinc-900 px-3 py-2 border-b border-pink-900/30 flex items-center justify-between">
                      <span className="text-[10px] text-pink-500 uppercase tracking-widest font-bold">Generated Asset</span>
                    </div>
                    <img src={generatedBanner} alt="Generated Banner" className="w-full h-auto object-cover" referrerPolicy="no-referrer" />
                  </div>
                )}
              </div>
            </div>
          )}

          {currentView === 'editor' && (
            <div className="flex flex-col lg:flex-row gap-6 h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Left Column: Generation & Editor */}
              <div className="w-full lg:w-1/2 flex flex-col gap-6">
                
                {/* Generation Card */}
                <div className="p-5 bg-zinc-900/30 border border-zinc-800 rounded-xl shrink-0">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Source Input</h3>
                  </div>
                  
                  <textarea 
                    className="w-full h-40 bg-black text-zinc-300 font-mono text-xs leading-relaxed outline-none resize-none p-3 rounded-lg border border-zinc-800 focus:border-pink-500/50 transition-colors" 
                    spellCheck="false"
                    placeholder="Paste a large block of text or file content here to base the article and banner on..."
                    value={sourceMaterial}
                    onChange={e => setSourceMaterial(e.target.value)}
                  />
                  
                  <div className="flex items-center gap-3 mt-3">
                    <label className="flex items-center justify-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs font-medium cursor-pointer transition-colors border border-zinc-700">
                      <FileText size={14} />
                      Append Text File
                      <input type="file" accept=".txt,.md,.csv" onChange={handleSourceMaterialUpload} className="hidden" />
                    </label>
                    <div className="flex-1 flex gap-2">
                      <Button onClick={handleGenerateContent} disabled={isGenerating || !sourceMaterial} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 h-8 text-xs font-medium">
                        {isGenerating ? "Drafting..." : "Draft Full Article"}
                      </Button>
                      <Button onClick={handleGenerateBanner} disabled={isGeneratingBanner || !sourceMaterial || !templateImage} className="flex-1 bg-pink-600/20 hover:bg-pink-600/30 text-pink-400 border border-pink-500/30 h-8 text-xs font-medium">
                        {isGeneratingBanner ? "Generating..." : "Generate Banner Variant"}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Editor Card */}
                <div className="flex-1 flex flex-col min-h-[400px] border border-pink-900/20 rounded-xl bg-black overflow-hidden shadow-[0_0_30px_rgba(219,39,119,0.03)]">
                  <div className="px-4 h-10 border-b border-pink-900/30 flex items-center bg-zinc-950/80">
                      <span className="text-xs font-semibold text-pink-500 tracking-wide">RAW MARKDOWN</span>
                  </div>
                  <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
                    <input 
                      type="text" 
                      className="bg-transparent text-xl font-bold text-white placeholder-zinc-700 outline-none w-full" 
                      value={postTitle}
                      onChange={e => setPostTitle(e.target.value)}
                      placeholder="Post Title..."
                    />
                    <input 
                      type="text" 
                      className="bg-transparent text-sm text-zinc-400 placeholder-zinc-700 outline-none w-full border-b border-zinc-800 pb-2" 
                      value={postDescription}
                      onChange={e => setPostDescription(e.target.value)}
                      placeholder="Brief post description..."
                    />
                    <textarea 
                      className="flex-1 bg-transparent text-zinc-300 font-mono text-[13px] leading-relaxed outline-none resize-none placeholder-zinc-700 w-full" 
                      spellCheck="false"
                      placeholder="Start typing your post in markdown..."
                      value={postContent}
                      onChange={e => setPostContent(e.target.value)}
                    />
                  </div>
                </div>

              </div>

              {/* Right Column: Preview */}
              <div className="w-full lg:w-1/2 flex flex-col border border-zinc-800 rounded-xl bg-zinc-950 overflow-hidden shadow-lg shadow-black min-h-[600px]">
                <div className="px-4 h-10 border-b border-zinc-800 flex items-center bg-zinc-900/50 justify-between">
                  <span className="text-xs font-semibold text-zinc-400 tracking-wide uppercase">Live Render</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-700"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-700"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-700"></div>
                  </div>
                </div>
                
                <div className="p-6 flex-1 overflow-y-auto">
                  {generatedBanner ? (
                    <div className="w-full aspect-[16/9] rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 mb-8 relative group">
                      <img src={generatedBanner} alt="Banner" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                         <span className="text-xs text-pink-400 font-medium">Concept Variant Banner</span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full aspect-[21/9] rounded-xl border border-zinc-800/50 bg-zinc-900/20 mb-8 flex items-center justify-center">
                       <span className="text-xs text-zinc-600 uppercase tracking-widest font-semibold flex items-center gap-2">
                         <ImageIcon size={14} /> No Banner Asset
                       </span>
                    </div>
                  )}

                  {postTitle || postContent ? (
                    <div className="prose prose-invert prose-zinc max-w-none break-words">
                      {postTitle && <h1 className="mb-3 text-3xl tracking-tight leading-tight">{postTitle}</h1>}
                      {postDescription && <p className="text-zinc-400 text-lg leading-relaxed mb-8">{postDescription}</p>}
                      <MarkdownPreview content={postContent} />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 mt-12 text-zinc-600">
                      <FileText size={32} className="mb-4 opacity-50 text-zinc-500" />
                      <p className="text-sm font-medium">The preview is empty.</p>
                      <p className="text-xs mt-1">Start typing or generate content to see it rendered here.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentView === 'published' && (
            <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">Published Works</h2>
                <p className="text-zinc-400">Posts you have pushed to Subnano.me via this API integration.</p>
              </div>
              <div className="p-12 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20 flex flex-col items-center text-center">
                <CheckCircle size={48} className="text-emerald-500/50 mb-4" />
                <h3 className="font-medium text-white mb-2">History logs incoming</h3>
                <p className="text-sm text-zinc-500 max-w-md">Currently, you can view all successfully published works directly on your Subnano profile.</p>
                <Button className="mt-6 bg-zinc-800 text-white hover:bg-zinc-700" onClick={() => window.open('https://subnano.me', '_blank')}>
                  Go to Subnano.me
                </Button>
              </div>
            </div>
          )}

          {currentView === 'faq' && (
            <div className="max-w-3xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-white tracking-tight">FAQ & Documentation</h2>
                <p className="text-zinc-400">Everything you need to know about the network.</p>
              </div>

              <div className="space-y-8">
                <div className="space-y-3 relative before:absolute before:inset-y-0 before:-left-4 before:w-1 before:bg-pink-600 before:rounded-r">
                  <h3 className="text-lg font-bold text-pink-400">What is Nano? (XNO)</h3>
                  <p className="text-zinc-300 text-sm leading-relaxed">
                    Nano is digital money for the modern world. It is a lightweight cryptocurrency designed to provide secure, practically instant payments without fees. Built on a unique block-lattice data structure, it is ecologically sustainable and immensely efficient compared to traditional proof-of-work currencies.
                  </p>
                </div>

                <div className="space-y-3 relative before:absolute before:inset-y-0 before:-left-4 before:w-1 before:bg-indigo-500 before:rounded-r">
                  <h3 className="text-lg font-bold text-indigo-400">What is Subnano?</h3>
                  <p className="text-zinc-300 text-sm leading-relaxed">
                    Subnano is a modern publishing platform utilizing alternative value rails. Through its Publishing API, creators and agents can seamlessly integrate their content workflows, generate drafts, attach structured metadata, and monetize their creativity frictionlessly.
                  </p>
                </div>

                <div className="space-y-3 border-t border-zinc-800 pt-8">
                  <h3 className="text-lg font-bold text-white">How does Image-to-Image (i2i) conceptual variation work here?</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    When you upload a &quot;Default Base Template&quot;, the system saves it locally. When generating a banner, the AI agent is instructed to act as a &apos;Conceptual Variation Generator&apos;. It analyzes the composition and palette of your template, and merges it with the structural context of the &apos;Source Material&apos; provided. This ensures that every banner is unique yet adheres strictly to the mood of the base aesthetic.
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentView === 'swap' && (
            <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="space-y-2 text-center">
                <h2 className="text-2xl font-bold text-white">Swap Nano</h2>
                <p className="text-zinc-400">Exchange Nano (XNO) seamlessly.</p>
              </div>
              <div className="p-2 border border-zinc-800 rounded-[34px] bg-black shadow-2xl shadow-pink-900/10">
                <iframe 
                  src="https://nanswap.com/iframe-swap/swap?defaultFrom=XNO&defaultTo=BAN&mode=swap&invitationId=75500079727" 
                  style={{ width: "100%", height: "500px", background: "transparent", border: "none", borderRadius: "32px", display: "block" }}
                  title="Nanswap Widget"
                ></iframe>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
