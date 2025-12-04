import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompactDropZoneProps {
  icon: LucideIcon;
  label: string;
  buttonText: string;
  acceptText: string;
  accept: string;
  onFilesSelected: (files: File[]) => void;
  isDragging?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  multiple?: boolean;
}

export function CompactDropZone({
  icon: Icon,
  label,
  buttonText,
  acceptText,
  accept,
  onFilesSelected,
  isDragging = false,
  onDragOver,
  onDragLeave,
  onDrop,
  multiple = true,
}: CompactDropZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleLocalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    onDragOver?.(e);
  };

  const handleLocalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDrop?.(e);
  };

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-3 flex items-center gap-4 transition-colors shrink-0",
        isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
      )}
      onDragOver={handleLocalDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleLocalDrop}
    >
      <Icon className="h-8 w-8 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{acceptText}</p>
      </div>
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        className="shrink-0"
      >
        <Upload className="h-3.5 w-3.5 mr-1.5" />
        {buttonText}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
