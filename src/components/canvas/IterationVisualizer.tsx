import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingDown } from 'lucide-react';

interface ChangeMetric {
  iteration: number;
  agentId: string;
  agentLabel: string;
  nodesAdded: number;
  nodesEdited: number;
  nodesDeleted: number;
  edgesAdded: number;
  edgesEdited: number;
  edgesDeleted: number;
  timestamp: string;
}

interface IterationVisualizerProps {
  metrics: ChangeMetric[];
  currentIteration: number;
  totalIterations: number;
}

export function IterationVisualizer({ metrics, currentIteration, totalIterations }: IterationVisualizerProps) {
  const getTotalChanges = (metric: ChangeMetric) => {
    return metric.nodesAdded + metric.nodesEdited + metric.nodesDeleted + 
           metric.edgesAdded + metric.edgesEdited + metric.edgesDeleted;
  };

  const maxChanges = Math.max(...metrics.map(getTotalChanges), 1);

  const getStabilizationTrend = () => {
    if (metrics.length < 2) return null;
    
    const recentChanges = metrics.slice(-5).reduce((sum, m) => sum + getTotalChanges(m), 0);
    const earlierChanges = metrics.slice(0, 5).reduce((sum, m) => sum + getTotalChanges(m), 0);
    
    if (earlierChanges === 0) return null;
    const changeRate = ((earlierChanges - recentChanges) / earlierChanges) * 100;
    
    return changeRate > 0 ? `Stabilizing (${changeRate.toFixed(0)}% reduction)` : 'Still adapting';
  };

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            <span className="font-semibold">Iteration Progress</span>
          </div>
          <Badge variant="outline">
            {currentIteration} / {totalIterations}
          </Badge>
        </div>
        
        {getStabilizationTrend() && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingDown className="w-4 h-4" />
            <span>{getStabilizationTrend()}</span>
          </div>
        )}
      </Card>

      {/* Change Metrics */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-3">Change History</h3>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {metrics.map((metric, index) => {
            const totalChanges = getTotalChanges(metric);
            const barWidth = (totalChanges / maxChanges) * 100;
            
            return (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">
                    Iteration {metric.iteration} - {metric.agentLabel}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {totalChanges} changes
                  </Badge>
                </div>
                
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span>+{metric.nodesAdded} nodes</span>
                  <span>~{metric.nodesEdited}</span>
                  <span>-{metric.nodesDeleted}</span>
                  <span>|</span>
                  <span>+{metric.edgesAdded} edges</span>
                  <span>~{metric.edgesEdited}</span>
                  <span>-{metric.edgesDeleted}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
