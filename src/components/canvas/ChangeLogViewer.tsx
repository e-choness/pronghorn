import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChangeLogEntry {
  iteration: number;
  agentId: string;
  agentLabel: string;
  timestamp: string;
  changes: string;
  reasoning: string;
}

interface ChangeLogViewerProps {
  logs: ChangeLogEntry[];
  onSaveAsArtifact: () => void;
  isSaving?: boolean;
}

export function ChangeLogViewer({ logs, onSaveAsArtifact, isSaving }: ChangeLogViewerProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Change Log</h3>
        <Button
          size="sm"
          onClick={onSaveAsArtifact}
          disabled={logs.length === 0 || isSaving}
        >
          <Download className="w-4 h-4 mr-2" />
          Save as Artifact
        </Button>
      </div>

      <ScrollArea className="h-[500px]">
        <div className="space-y-4">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No changes recorded yet. Start an iteration to see agent activity.
            </p>
          ) : (
            logs.map((log, index) => (
              <Card key={index} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Iteration {log.iteration}</Badge>
                    <span className="font-medium text-sm">{log.agentLabel}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div className="space-y-2">
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-1">Reasoning:</h4>
                    <div className="text-sm prose prose-sm max-w-none">
                      <ReactMarkdown>{log.reasoning}</ReactMarkdown>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-1">Changes:</h4>
                    <div className="text-sm prose prose-sm max-w-none">
                      <ReactMarkdown>{log.changes}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
