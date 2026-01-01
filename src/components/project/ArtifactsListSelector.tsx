import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, List, LayoutGrid, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Artifact {
  id: string;
  ai_title: string | null;
  content: string;
  created_at: string;
  image_url: string | null;
}

interface ArtifactsListSelectorProps {
  projectId: string;
  shareToken: string | null;
  selectedArtifacts: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
}

const formatSize = (chars: number): string => {
  if (chars >= 1000000) return `${(chars / 1000000).toFixed(1)}M`;
  if (chars >= 1000) return `${(chars / 1000).toFixed(1)}K`;
  return `${chars}`;
};

const getSizeClass = (chars: number): { class: string; warning: boolean } => {
  if (chars >= 200000) return { class: "bg-destructive text-destructive-foreground", warning: true };
  if (chars >= 100000) return { class: "bg-orange-500 text-white", warning: true };
  if (chars >= 50000) return { class: "bg-yellow-500 text-black", warning: false };
  return { class: "bg-muted text-muted-foreground", warning: false };
};

export function ArtifactsListSelector({
  projectId,
  shareToken,
  selectedArtifacts,
  onSelectionChange
}: ArtifactsListSelectorProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  useEffect(() => {
    loadArtifacts();
  }, [projectId]);

  const loadArtifacts = async () => {
    try {
      const { data } = await supabase.rpc("get_artifacts_with_token", {
        p_project_id: projectId,
        p_token: shareToken
      });

      if (data) {
        // Sort by size descending so largest are at top
        const sorted = [...data].sort((a, b) => 
          (b.content?.length || 0) - (a.content?.length || 0)
        );
        setArtifacts(sorted);
      }
    } catch (error) {
      console.error("Error loading artifacts:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleArtifact = (id: string) => {
    const newSelected = new Set(selectedArtifacts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    onSelectionChange(newSelected);
  };

  const handleSelectAll = () => {
    onSelectionChange(new Set(artifacts.map(a => a.id)));
  };

  const handleSelectNone = () => {
    onSelectionChange(new Set());
  };

  // Select only items under 100K chars
  const handleSelectSmall = () => {
    const smallItems = artifacts.filter(a => (a.content?.length || 0) < 100000);
    onSelectionChange(new Set(smallItems.map(a => a.id)));
  };

  const totalSelectedChars = artifacts
    .filter(a => selectedArtifacts.has(a.id))
    .reduce((sum, a) => sum + (a.content?.length || 0), 0);

  const largeItemCount = artifacts.filter(a => (a.content?.length || 0) >= 100000).length;
  const imageArtifactCount = artifacts.filter(a => a.image_url).length;

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading artifacts...</div>;
  }

  if (artifacts.length === 0) {
    return <div className="text-sm text-muted-foreground">No artifacts in this project.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Button variant="outline" size="sm" onClick={handleSelectAll}>
          Select All
        </Button>
        <Button variant="outline" size="sm" onClick={handleSelectNone}>
          Select None
        </Button>
        {largeItemCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleSelectSmall}>
            Select &lt;100K only
          </Button>
        )}
        
        {/* View mode toggle - only show if there are image artifacts */}
        {imageArtifactCount > 0 && (
          <div className="flex border rounded-md ml-2">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("list")}
              title="List view"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("grid")}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        <span className="text-xs text-muted-foreground ml-auto">
          Selected: {formatSize(totalSelectedChars)} chars
        </span>
      </div>
      
      {largeItemCount > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-orange-500/10 border border-orange-500/20 text-sm">
          <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
          <span className="text-orange-600 dark:text-orange-400">
            {largeItemCount} large artifact{largeItemCount > 1 ? 's' : ''} detected. Items over 100K chars may cause timeouts.
          </span>
        </div>
      )}

      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {artifacts.map((artifact) => {
            const charCount = artifact.content?.length || 0;
            const sizeInfo = getSizeClass(charCount);
            const isSelected = selectedArtifacts.has(artifact.id);
            
            return (
              <div
                key={artifact.id}
                className={cn(
                  "relative rounded-lg border overflow-hidden cursor-pointer transition-all",
                  isSelected && "ring-2 ring-primary",
                  sizeInfo.warning && "border-orange-500/30"
                )}
                onClick={() => toggleArtifact(artifact.id)}
              >
                {artifact.image_url ? (
                  <img 
                    src={artifact.image_url} 
                    alt={artifact.ai_title || "Artifact"}
                    className="w-full aspect-square object-cover"
                  />
                ) : (
                  <div className="w-full aspect-square bg-muted flex items-center justify-center">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleArtifact(artifact.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="border-white data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <span className="text-white text-xs truncate flex-1">
                      {artifact.ai_title || "Untitled"}
                    </span>
                    <Badge variant="secondary" className={cn("text-[10px] px-1 py-0", sizeInfo.class)}>
                      {formatSize(charCount)}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {artifacts.map((artifact) => {
            const charCount = artifact.content?.length || 0;
            const sizeInfo = getSizeClass(charCount);
            
            return (
              <div
                key={artifact.id}
                className={cn(
                  "flex items-start gap-2 p-2 hover:bg-muted/50 rounded border",
                  sizeInfo.warning && "border-orange-500/30"
                )}
              >
                <Checkbox
                  id={`artifact-${artifact.id}`}
                  checked={selectedArtifacts.has(artifact.id)}
                  onCheckedChange={() => toggleArtifact(artifact.id)}
                  className="mt-1"
                />
                
                {/* Image thumbnail */}
                {artifact.image_url && (
                  <div className="w-12 h-12 rounded overflow-hidden bg-muted shrink-0">
                    <img 
                      src={artifact.image_url} 
                      alt={artifact.ai_title || "Artifact image"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <Label
                  htmlFor={`artifact-${artifact.id}`}
                  className="text-sm cursor-pointer flex-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {artifact.ai_title || "Untitled Artifact"}
                    </span>
                    <Badge variant="secondary" className={cn("text-xs", sizeInfo.class)}>
                      {formatSize(charCount)}
                    </Badge>
                    {sizeInfo.warning && (
                      <AlertTriangle className="h-3 w-3 text-orange-500" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {artifact.content.substring(0, 150)}...
                  </div>
                </Label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
