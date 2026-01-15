import { useState, useMemo } from "react";
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  Home,
  FolderPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Artifact, buildArtifactHierarchy } from "@/hooks/useRealtimeArtifacts";
import { cn } from "@/lib/utils";

interface ArtifactFolderSidebarProps {
  artifacts: Artifact[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
  onDropArtifact?: (artifactId: string, targetFolderId: string | null) => void;
}

interface FolderNodeProps {
  folder: Artifact;
  level: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
  onDropArtifact?: (artifactId: string, targetFolderId: string | null) => void;
}

function FolderNode({ 
  folder, 
  level, 
  selectedId, 
  onSelect, 
  onCreateFolder,
  onDropArtifact 
}: FolderNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const hasChildren = folder.children?.some(c => c.is_folder) || false;
  const isSelected = selectedId === folder.id;
  const folderChildren = folder.children?.filter(c => c.is_folder) || [];
  
  // Count non-folder items in this folder
  const itemCount = folder.children?.filter(c => !c.is_folder).length || 0;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const artifactId = e.dataTransfer.getData("artifactId");
    if (artifactId && artifactId !== folder.id && onDropArtifact) {
      onDropArtifact(artifactId, folder.id);
    }
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 py-1 px-1.5 rounded-md cursor-pointer transition-colors text-xs",
          isSelected && "bg-primary text-primary-foreground",
          !isSelected && "hover:bg-muted",
          isDragOver && "bg-primary/20 ring-2 ring-primary"
        )}
        style={{ paddingLeft: `${level * 12 + 4}px` }}
        onClick={() => onSelect(folder.id)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-0.5 hover:bg-muted rounded flex-shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <div className="w-4 flex-shrink-0" />
        )}
        {isExpanded ? (
          <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
        ) : (
          <Folder className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
        )}
        <span className="truncate flex-1 min-w-0">
          {folder.ai_title || "Untitled"}
        </span>
        {itemCount > 0 && (
          <span className="text-[10px] text-muted-foreground flex-shrink-0">
            {itemCount}
          </span>
        )}
      </div>
      {isExpanded && folderChildren.length > 0 && (
        <div>
          {folderChildren.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onCreateFolder={onCreateFolder}
              onDropArtifact={onDropArtifact}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ArtifactFolderSidebar({
  artifacts,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onDropArtifact,
}: ArtifactFolderSidebarProps) {
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);
  
  // Build folder tree
  const folderTree = useMemo(() => {
    return buildArtifactHierarchy(artifacts.filter(a => a.is_folder));
  }, [artifacts]);

  // Count root-level non-folder items
  const rootItemCount = artifacts.filter(a => !a.is_folder && !a.parent_id).length;

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverRoot(true);
  };

  const handleRootDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverRoot(false);
  };

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverRoot(false);
    
    const artifactId = e.dataTransfer.getData("artifactId");
    if (artifactId && onDropArtifact) {
      onDropArtifact(artifactId, null);
    }
  };

  return (
    <div className="w-48 flex-shrink-0 border-r bg-muted/30 flex flex-col">
      <div className="p-2 border-b flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Folders
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onCreateFolder(null)}
          title="Create Folder"
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-1">
          {/* Root option */}
          <div
            className={cn(
              "flex items-center gap-1.5 py-1 px-1.5 rounded-md cursor-pointer transition-colors text-xs",
              selectedFolderId === null && "bg-primary text-primary-foreground",
              selectedFolderId !== null && "hover:bg-muted",
              isDragOverRoot && "bg-primary/20 ring-2 ring-primary"
            )}
            onClick={() => onSelectFolder(null)}
            onDragOver={handleRootDragOver}
            onDragLeave={handleRootDragLeave}
            onDrop={handleRootDrop}
          >
            <Home className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate flex-1">All Artifacts</span>
            {rootItemCount > 0 && (
              <span className="text-[10px] text-muted-foreground flex-shrink-0">
                {rootItemCount}
              </span>
            )}
          </div>
          
          {/* Folder tree */}
          {folderTree.map((folder) => (
            <FolderNode
              key={folder.id}
              folder={folder}
              level={0}
              selectedId={selectedFolderId}
              onSelect={onSelectFolder}
              onCreateFolder={onCreateFolder}
              onDropArtifact={onDropArtifact}
            />
          ))}
          
          {folderTree.length === 0 && (
            <p className="text-[10px] text-muted-foreground py-2 px-2 text-center">
              No folders yet
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
