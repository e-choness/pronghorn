import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Image, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CompactDropZone } from "./CompactDropZone";

export interface ImageFile {
  id: string;
  file: File;
  preview: string;
  selected: boolean;
}

interface ArtifactImageGalleryProps {
  images: ImageFile[];
  onImagesChange: (images: ImageFile[]) => void;
}

export function ArtifactImageGallery({ images, onImagesChange }: ArtifactImageGalleryProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = () => {
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    addFiles(files);
  };

  const handleFileSelect = (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith("image/"));
    addFiles(imageFiles);
  };

  const addFiles = (files: File[]) => {
    const newImages: ImageFile[] = files.map(file => ({
      id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      preview: URL.createObjectURL(file),
      selected: true,
    }));
    onImagesChange([...images, ...newImages]);
  };

  const toggleSelection = (id: string) => {
    onImagesChange(
      images.map(img => 
        img.id === id ? { ...img, selected: !img.selected } : img
      )
    );
  };

  const removeImage = (id: string) => {
    const image = images.find(img => img.id === id);
    if (image) {
      URL.revokeObjectURL(image.preview);
    }
    onImagesChange(images.filter(img => img.id !== id));
  };

  const selectAll = () => {
    onImagesChange(images.map(img => ({ ...img, selected: true })));
  };

  const selectNone = () => {
    onImagesChange(images.map(img => ({ ...img, selected: false })));
  };

  const clearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.preview));
    onImagesChange([]);
  };

  const selectedCount = images.filter(i => i.selected).length;

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <CompactDropZone
        icon={Image}
        label="Drop images here or click to browse"
        buttonText="Select"
        acceptText="JPG, PNG, GIF, WebP"
        accept="image/*"
        onFilesSelected={handleFileSelect}
        isDragging={isDragging}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      />

      {images.length > 0 && (
        <>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={selectNone}>
              Select None
            </Button>
            <Button variant="outline" size="sm" onClick={clearAll}>
              Clear All
            </Button>
            <span className="text-sm text-muted-foreground ml-auto">
              {selectedCount} of {images.length} selected
            </span>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-1">
              {images.map(image => (
                <div
                  key={image.id}
                  className={cn(
                    "relative group rounded-lg overflow-hidden border-2 transition-colors",
                    image.selected ? "border-primary" : "border-transparent"
                  )}
                >
                  <img
                    src={image.preview}
                    alt={image.file.name}
                    className="w-full aspect-square object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute top-2 left-2">
                    <Checkbox
                      checked={image.selected}
                      onCheckedChange={() => toggleSelection(image.id)}
                      className="bg-background"
                    />
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeImage(image.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-xs text-white truncate">{image.file.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
