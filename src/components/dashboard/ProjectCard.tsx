import { Clock, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface ProjectCardProps {
  projectId: string;
  projectName: string;
  lastUpdated: Date;
  status: "DESIGN" | "AUDIT" | "BUILD";
  coverage?: number;
  onClick?: (projectId: string) => void;
}

const statusConfig = {
  DESIGN: {
    label: "Design",
    className: "bg-status-design/10 text-status-design hover:bg-status-design/20",
  },
  AUDIT: {
    label: "Audit",
    className: "bg-status-audit/10 text-status-audit hover:bg-status-audit/20",
  },
  BUILD: {
    label: "Build",
    className: "bg-status-build/10 text-status-build hover:bg-status-build/20",
  },
};

export function ProjectCard({
  projectId,
  projectName,
  lastUpdated,
  status,
  coverage,
  onClick,
}: ProjectCardProps) {
  const statusInfo = statusConfig[status];

  return (
    <Card
      className="card-hover cursor-pointer group"
      onClick={() => onClick?.(projectId)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg group-hover:text-primary transition-colors">
            {projectName}
          </CardTitle>
          <Badge variant="secondary" className={statusInfo.className}>
            {statusInfo.label}
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-1 text-xs">
          <Clock className="h-3 w-3" />
          Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {coverage !== undefined && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Coverage
              </span>
              <span className="font-semibold">{coverage}%</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                style={{ width: `${coverage}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
