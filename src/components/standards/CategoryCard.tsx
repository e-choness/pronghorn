import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StandardsTreeManager } from "./StandardsTreeManager";
import { Standard } from "./StandardsTree";
import { Edit, Trash2, Check, X } from "lucide-react";
import { useAdmin } from "@/contexts/AdminContext";

interface CategoryCardProps {
  category: any;
  standards: Standard[];
  onDelete: (categoryId: string) => void;
  onUpdate: (categoryId: string, name: string, description: string) => void;
  onRefresh: () => void;
}

export function CategoryCard({ category, standards, onDelete, onUpdate, onRefresh }: CategoryCardProps) {
  const { isAdmin } = useAdmin();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description || "");

  const handleSave = () => {
    onUpdate(category.id, name, description);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setName(category.name);
    setDescription(category.description || "");
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader>
        {isEditing ? (
          <div className="space-y-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
              className="text-xl font-semibold"
            />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Category description"
              rows={2}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>
                <Check className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <CardTitle>{category.name}</CardTitle>
              {isAdmin && (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(category.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            {category.description && <CardDescription>{category.description}</CardDescription>}
          </>
        )}
      </CardHeader>
      <CardContent>
        <StandardsTreeManager
          standards={standards}
          categoryId={category.id}
          onRefresh={onRefresh}
        />
      </CardContent>
    </Card>
  );
}
