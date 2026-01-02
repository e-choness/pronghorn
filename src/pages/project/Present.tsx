import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { ProjectSidebar } from "@/components/layout/ProjectSidebar";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";
import { AccessLevelBanner } from "@/components/project/AccessLevelBanner";
import { TokenRecoveryMessage } from "@/components/project/TokenRecoveryMessage";
import { useShareToken } from "@/hooks/useShareToken";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Play, Trash2, Download, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

interface Presentation {
  id: string;
  project_id: string;
  name: string;
  initial_prompt: string | null;
  mode: string;
  target_slides: number | null;
  status: string;
  slides: Json;
  blackboard: Json;
  cover_image_url: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  version: number;
}

interface BlackboardEntry {
  id: string;
  timestamp: string;
  source: string;
  category: string;
  content: string;
  data?: any;
}

export default function Present() {
  const { projectId } = useParams<{ projectId: string }>();
  const { token: shareToken, isTokenSet, tokenMissing } = useShareToken(projectId || "");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [selectedPresentation, setSelectedPresentation] = useState<Presentation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [liveBlackboard, setLiveBlackboard] = useState<BlackboardEntry[]>([]);
  const [generationStatus, setGenerationStatus] = useState<string>("");
  
  // Create dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("New Presentation");
  const [newMode, setNewMode] = useState<"concise" | "detailed">("concise");
  const [newTargetSlides, setNewTargetSlides] = useState(15);
  const [newPrompt, setNewPrompt] = useState("");

  // Load presentations
  useEffect(() => {
    const loadPresentations = async () => {
      if (!projectId || !isTokenSet) return;
      setIsLoading(true);
      
      try {
        const { data, error } = await supabase.rpc("get_project_presentations_with_token", {
          p_project_id: projectId,
          p_token: shareToken,
        });
        
        if (error) throw error;
        setPresentations((data || []) as Presentation[]);
      } catch (err: any) {
        console.error("Error loading presentations:", err);
        toast.error("Failed to load presentations");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadPresentations();
  }, [projectId, shareToken, isTokenSet]);

  // Create and generate presentation
  const handleCreatePresentation = async () => {
    if (!projectId || !shareToken) return;
    
    try {
      // Create the presentation record
      const { data: presentation, error } = await supabase.rpc("insert_presentation_with_token", {
        p_project_id: projectId,
        p_token: shareToken,
        p_name: newName,
        p_initial_prompt: newPrompt || null,
        p_mode: newMode,
        p_target_slides: newTargetSlides,
      });
      
      if (error) throw error;
      
      const newPresentation = presentation as Presentation;
      setIsCreateOpen(false);
      setPresentations(prev => [newPresentation, ...prev]);
      setSelectedPresentation(newPresentation);
      
      // Start generation
      await generatePresentation(newPresentation);
      
    } catch (err: any) {
      console.error("Error creating presentation:", err);
      toast.error("Failed to create presentation");
    }
  };

  // Generate presentation via edge function with SSE
  const generatePresentation = async (presentation: Presentation) => {
    if (!projectId || !shareToken) return;
    
    setIsGenerating(true);
    setLiveBlackboard([]);
    setGenerationStatus("Starting...");
    
    try {
      const response = await fetch(
        `https://obkzdksfayygnrzdqoam.supabase.co/functions/v1/presentation-agent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ""}`,
          },
          body: JSON.stringify({
            projectId,
            presentationId: presentation.id,
            shareToken,
            mode: presentation.mode,
            targetSlides: presentation.target_slides,
            initialPrompt: presentation.initial_prompt,
          }),
        }
      );

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response stream");

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            const event = line.slice(7);
            const dataLine = lines[lines.indexOf(line) + 1];
            if (dataLine?.startsWith("data: ")) {
              try {
                const data = JSON.parse(dataLine.slice(6));
                
                if (event === "status") {
                  setGenerationStatus(data.message);
                } else if (event === "blackboard") {
                  setLiveBlackboard(prev => [...prev, data]);
                } else if (event === "slide") {
                  // Handle slide generation
                } else if (event === "complete") {
                  toast.success(`Generated ${data.slideCount} slides`);
                } else if (event === "error") {
                  toast.error(data.message);
                }
              } catch (e) {
                // Parse error, skip
              }
            }
          }
        }
      }

      // Reload presentation
      const { data: updated } = await supabase.rpc("get_project_presentations_with_token", {
        p_project_id: projectId,
        p_token: shareToken,
      });
      
      if (updated) {
        const updatedPresentations = updated as Presentation[];
        setPresentations(updatedPresentations);
        const current = updatedPresentations.find(p => p.id === presentation.id);
        if (current) setSelectedPresentation(current);
      }
      
    } catch (err: any) {
      console.error("Generation error:", err);
      toast.error("Failed to generate presentation");
    } finally {
      setIsGenerating(false);
      setGenerationStatus("");
    }
  };

  // Delete presentation
  const handleDelete = async (id: string) => {
    if (!shareToken) return;
    
    try {
      await supabase.rpc("delete_presentation_with_token", {
        p_presentation_id: id,
        p_token: shareToken,
      });
      
      setPresentations(prev => prev.filter(p => p.id !== id));
      if (selectedPresentation?.id === id) setSelectedPresentation(null);
      toast.success("Presentation deleted");
    } catch (err: any) {
      toast.error("Failed to delete");
    }
  };

  // Export as JSON
  const handleExportJSON = () => {
    if (!selectedPresentation) return;
    const blob = new Blob([JSON.stringify(selectedPresentation, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedPresentation.name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper to safely get slides array
  const getSlides = (p: Presentation): any[] => {
    if (Array.isArray(p.slides)) return p.slides;
    return [];
  };

  // Helper to safely get blackboard array
  const getBlackboard = (p: Presentation): BlackboardEntry[] => {
    if (Array.isArray(p.blackboard)) return p.blackboard as unknown as BlackboardEntry[];
    return [];
  };

  if (tokenMissing) {
    return (
      <div className="flex h-screen bg-background">
        <ProjectSidebar projectId={projectId || ""} isOpen={isSidebarOpen} onOpenChange={setIsSidebarOpen} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 md:p-6">
            <ProjectPageHeader title="Present" onMenuClick={() => setIsSidebarOpen(true)} />
            <TokenRecoveryMessage />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <ProjectSidebar projectId={projectId || ""} isOpen={isSidebarOpen} onOpenChange={setIsSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 md:p-6 flex-1 overflow-auto">
          <ProjectPageHeader title="Present" onMenuClick={() => setIsSidebarOpen(true)} />
          <AccessLevelBanner projectId={projectId || ""} shareToken={shareToken} />
          
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold font-raleway">Presentations</h2>
                <p className="text-muted-foreground">Generate AI-powered project presentations</p>
              </div>
              
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Presentation
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Presentation</DialogTitle>
                    <DialogDescription>
                      Configure and generate an AI-powered project presentation
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={newName} onChange={e => setNewName(e.target.value)} />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Mode</Label>
                      <Select value={newMode} onValueChange={(v: "concise" | "detailed") => setNewMode(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="concise">Concise (10-15 slides)</SelectItem>
                          <SelectItem value="detailed">Detailed (20-30 slides)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Target Slides</Label>
                      <Input 
                        type="number" 
                        value={newTargetSlides} 
                        onChange={e => setNewTargetSlides(parseInt(e.target.value) || 15)} 
                        min={5} 
                        max={50}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Custom Focus (optional)</Label>
                      <Textarea 
                        value={newPrompt} 
                        onChange={e => setNewPrompt(e.target.value)}
                        placeholder="Any specific areas you want to emphasize..."
                      />
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreatePresentation}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Presentations List */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Saved Presentations</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : presentations.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No presentations yet</p>
                    ) : (
                      <div className="space-y-2">
                        {presentations.map(p => (
                          <div 
                            key={p.id}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedPresentation?.id === p.id ? "bg-muted border-primary" : "hover:bg-muted/50"}`}
                            onClick={() => setSelectedPresentation(p)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium truncate">{p.name}</span>
                              <Badge variant={p.status === "completed" ? "default" : "secondary"}>
                                {p.status}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {p.mode} • {getSlides(p).length} slides
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Main Content */}
              <Card className="lg:col-span-2">
                {isGenerating ? (
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="font-medium">{generationStatus}</span>
                    </div>
                    
                    <Tabs defaultValue="blackboard">
                      <TabsList>
                        <TabsTrigger value="blackboard">Blackboard ({liveBlackboard.length})</TabsTrigger>
                      </TabsList>
                      <TabsContent value="blackboard">
                        <ScrollArea className="h-[450px] border rounded-lg p-4">
                          {liveBlackboard.map((entry, i) => (
                            <div key={entry.id || i} className="mb-3 p-3 bg-muted rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">{entry.source}</Badge>
                                <Badge variant="secondary" className="text-xs">{entry.category}</Badge>
                              </div>
                              <p className="text-sm">{entry.content}</p>
                            </div>
                          ))}
                        </ScrollArea>
                      </TabsContent>
                    </Tabs>
                  </div>
                ) : selectedPresentation ? (
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold">{selectedPresentation.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {getSlides(selectedPresentation).length} slides • {selectedPresentation.mode}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportJSON}>
                          <Download className="h-4 w-4 mr-1" />
                          Export
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => generatePresentation(selectedPresentation)}>
                          <Play className="h-4 w-4 mr-1" />
                          Regenerate
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(selectedPresentation.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <Tabs defaultValue="slides">
                      <TabsList>
                        <TabsTrigger value="slides">Slides ({getSlides(selectedPresentation).length})</TabsTrigger>
                        <TabsTrigger value="blackboard">Blackboard ({getBlackboard(selectedPresentation).length})</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="slides">
                        <ScrollArea className="h-[450px]">
                          <div className="space-y-3">
                            {getSlides(selectedPresentation).map((slide: any, i: number) => (
                              <div key={slide.id || i} className="p-4 border rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{slide.layoutId}</span>
                                  <span className="text-sm text-muted-foreground">Slide {slide.order || i + 1}</span>
                                </div>
                                <h4 className="font-semibold">{slide.title}</h4>
                                {slide.subtitle && <p className="text-sm text-muted-foreground">{slide.subtitle}</p>}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </TabsContent>
                      
                      <TabsContent value="blackboard">
                        <ScrollArea className="h-[450px]">
                          <div className="space-y-2">
                            {getBlackboard(selectedPresentation).map((entry, i) => (
                              <div key={entry.id || i} className="p-3 bg-muted rounded-lg">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs">{entry.source}</Badge>
                                  <Badge variant="secondary" className="text-xs">{entry.category}</Badge>
                                </div>
                                <p className="text-sm">{entry.content}</p>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </TabsContent>
                    </Tabs>
                  </div>
                ) : (
                  <div className="p-6 flex flex-col items-center justify-center h-[500px] text-center">
                    <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Presentation Selected</h3>
                    <p className="text-muted-foreground mb-4">
                      Select an existing presentation or create a new one
                    </p>
                    <Button onClick={() => setIsCreateOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Presentation
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
