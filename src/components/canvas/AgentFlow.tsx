import { useCallback, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Background,
  Controls,
  Connection,
  NodeTypes,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card } from '@/components/ui/card';

// Agent node types
const agentNodeTypes = [
  { id: 'architect', label: 'Architect', color: 'bg-blue-500', description: 'Reviews requirements and updates canvas architecture' },
  { id: 'cyber', label: 'Cyber Security', color: 'bg-red-500', description: 'Validates security standards and adds security components' },
  { id: 'compliance', label: 'Compliance', color: 'bg-purple-500', description: 'Checks compliance with standards' },
  { id: 'qa', label: 'QA', color: 'bg-green-500', description: 'Reviews quality and testing requirements' },
  { id: 'uat', label: 'UAT', color: 'bg-yellow-500', description: 'Validates pages and components against requirements' },
  { id: 'developer', label: 'Developer', color: 'bg-orange-500', description: 'Reviews implementation feasibility' },
  { id: 'dba', label: 'DBA', color: 'bg-indigo-500', description: 'Designs database schemas and tables' },
  { id: 'cloudops', label: 'Cloud Ops', color: 'bg-teal-500', description: 'Adds cloud infrastructure and security components' },
];

// Custom agent node component
function AgentNode({ data }: { data: any }) {
  const agentType = agentNodeTypes.find(t => t.id === data.type);
  
  return (
    <Card className={`${agentType?.color} text-white p-4 rounded-lg shadow-lg min-w-[180px]`}>
      <div className="font-semibold text-sm">{agentType?.label || data.type}</div>
      <div className="text-xs opacity-90 mt-1">{data.label}</div>
    </Card>
  );
}

const nodeTypes: NodeTypes = {
  agent: AgentNode,
};

interface AgentFlowProps {
  onFlowChange?: (nodes: Node[], edges: Edge[]) => void;
}

export function AgentFlow({ onFlowChange }: AgentFlowProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, animated: true, type: 'smoothstep' }, eds));
      if (onFlowChange) {
        onFlowChange(nodes, edges);
      }
    },
    [nodes, edges, onFlowChange]
  );

  const onNodeDragStop = useCallback(() => {
    if (onFlowChange) {
      onFlowChange(nodes, edges);
    }
  }, [nodes, edges, onFlowChange]);

  const addAgentNode = useCallback((agentType: string) => {
    const newNode: Node = {
      id: `${agentType}-${Date.now()}`,
      type: 'agent',
      position: { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 },
      data: { 
        type: agentType,
        label: agentNodeTypes.find(t => t.id === agentType)?.label || agentType,
      },
    };
    setNodes((nds) => [...nds, newNode]);
    if (onFlowChange) {
      onFlowChange([...nodes, newNode], edges);
    }
  }, [nodes, edges, onFlowChange, setNodes]);

  return (
    <div className="flex gap-4 h-full">
      {/* Agent Palette */}
      <div className="w-64 space-y-2 overflow-y-auto">
        <h3 className="font-semibold text-sm mb-3">Agent Types</h3>
        {agentNodeTypes.map((agent) => (
          <Card
            key={agent.id}
            className="p-3 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => addAgentNode(agent.id)}
          >
            <div className={`w-3 h-3 rounded-full ${agent.color} inline-block mr-2`} />
            <span className="font-medium text-sm">{agent.label}</span>
            <p className="text-xs text-muted-foreground mt-1">{agent.description}</p>
          </Card>
        ))}
      </div>

      {/* React Flow Canvas */}
      <div className="flex-1 border rounded-lg bg-background">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
