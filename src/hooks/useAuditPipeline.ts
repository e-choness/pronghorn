// Hook for orchestrating the new audit pipeline
// Calls edge functions in sequence with simple JSON responses

import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PipelinePhase = 
  | "idle" 
  | "creating_nodes"
  | "extracting_d1" 
  | "extracting_d2" 
  | "merging_concepts" 
  | "building_graph"
  | "building_tesseract" 
  | "generating_venn" 
  | "completed" 
  | "error";

export interface PipelineProgress {
  phase: PipelinePhase;
  message: string;
  progress: number;
  d1ConceptCount?: number;
  d2ConceptCount?: number;
  mergedCount?: number;
  tesseractCurrent?: number;
  tesseractTotal?: number;
}

interface Concept {
  label: string;
  description: string;
  elementIds: string[];
}

interface MergedConcept {
  mergedLabel: string;
  mergedDescription: string;
  d1ConceptLabels: string[];
  d2ConceptLabels: string[];
  d1Ids: string[];
  d2Ids: string[];
}

interface Element {
  id: string;
  label: string;
  content: string;
  category?: string;
}

interface PipelineInput {
  sessionId: string;
  projectId: string;
  shareToken: string;
  d1Elements: Element[];
  d2Elements: Element[];
}

const BASE_URL = "https://obkzdksfayygnrzdqoam.supabase.co/functions/v1";

export function useAuditPipeline() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<PipelineProgress>({ phase: "idle", message: "", progress: 0 });
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const runPipeline = useCallback(async (input: PipelineInput) => {
    setIsRunning(true);
    setError(null);
    abortRef.current = false;

    const { sessionId, projectId, shareToken, d1Elements, d2Elements } = input;

    let d1Concepts: Concept[] = [];
    let d2Concepts: Concept[] = [];
    let mergedConcepts: MergedConcept[] = [];
    let unmergedD1Concepts: Concept[] = [];
    let unmergedD2Concepts: Concept[] = [];

    try {
      // ========================================
      // PHASE 0: Create D1 and D2 nodes immediately
      // ========================================
      setProgress({ 
        phase: "creating_nodes", 
        message: `Creating ${d1Elements.length} D1 and ${d2Elements.length} D2 nodes...`, 
        progress: 5 
      });

      console.log(`[Pipeline] Creating ${d1Elements.length} D1 nodes...`);
      
      // Create all D1 nodes
      for (const element of d1Elements) {
        const { error: nodeError } = await supabase.rpc("upsert_audit_graph_node_with_token", {
          p_session_id: sessionId,
          p_token: shareToken,
          p_label: element.label,
          p_description: (element.content || "").slice(0, 500),
          p_node_type: "d1_element",
          p_source_dataset: "dataset1",
          p_source_element_ids: [element.id],
          p_created_by_agent: "pipeline",
          p_color: "#3b82f6", // Blue for D1
          p_size: 15,
          p_metadata: { category: element.category || "unknown" },
        });
        if (nodeError) {
          console.error(`[Pipeline] Error creating D1 node:`, nodeError);
        }
      }

      console.log(`[Pipeline] Creating ${d2Elements.length} D2 nodes...`);
      
      // Create all D2 nodes
      for (const element of d2Elements) {
        const { error: nodeError } = await supabase.rpc("upsert_audit_graph_node_with_token", {
          p_session_id: sessionId,
          p_token: shareToken,
          p_label: element.label,
          p_description: (element.content || "").slice(0, 500),
          p_node_type: "d2_element",
          p_source_dataset: "dataset2",
          p_source_element_ids: [element.id],
          p_created_by_agent: "pipeline",
          p_color: "#22c55e", // Green for D2
          p_size: 15,
          p_metadata: { category: element.category || "unknown" },
        });
        if (nodeError) {
          console.error(`[Pipeline] Error creating D2 node:`, nodeError);
        }
      }

      // Update session status
      await supabase.rpc("update_audit_session_with_token", {
        p_session_id: sessionId,
        p_token: shareToken,
        p_status: "running",
        p_phase: "extracting_concepts",
      });

      if (abortRef.current) throw new Error("Aborted");

      // ========================================
      // PHASE 1: Extract D1 and D2 concepts in parallel
      // ========================================
      setProgress({ 
        phase: "extracting_d1", 
        message: `Extracting concepts from ${d1Elements.length} D1 and ${d2Elements.length} D2 elements...`, 
        progress: 15 
      });

      console.log(`[Pipeline] Calling concept extraction for D1 and D2...`);

      const [d1Response, d2Response] = await Promise.all([
        fetch(`${BASE_URL}/audit-extract-concepts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, projectId, shareToken, dataset: "d1", elements: d1Elements }),
        }),
        fetch(`${BASE_URL}/audit-extract-concepts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, projectId, shareToken, dataset: "d2", elements: d2Elements }),
        }),
      ]);

      // Parse D1 results
      if (!d1Response.ok) {
        const errText = await d1Response.text();
        console.error(`[Pipeline] D1 extraction failed:`, errText);
        throw new Error(`D1 concept extraction failed: ${d1Response.status}`);
      }
      const d1Result = await d1Response.json();
      if (!d1Result.success) {
        throw new Error(`D1 extraction error: ${d1Result.error}`);
      }
      d1Concepts = d1Result.concepts || [];
      console.log(`[Pipeline] D1 returned ${d1Concepts.length} concepts`);

      // Parse D2 results
      if (!d2Response.ok) {
        const errText = await d2Response.text();
        console.error(`[Pipeline] D2 extraction failed:`, errText);
        throw new Error(`D2 concept extraction failed: ${d2Response.status}`);
      }
      const d2Result = await d2Response.json();
      if (!d2Result.success) {
        throw new Error(`D2 extraction error: ${d2Result.error}`);
      }
      d2Concepts = d2Result.concepts || [];
      console.log(`[Pipeline] D2 returned ${d2Concepts.length} concepts`);

      setProgress({ 
        phase: "merging_concepts", 
        message: `Merging ${d1Concepts.length} D1 and ${d2Concepts.length} D2 concepts...`, 
        progress: 35,
        d1ConceptCount: d1Concepts.length,
        d2ConceptCount: d2Concepts.length
      });

      if (abortRef.current) throw new Error("Aborted");

      // ========================================
      // PHASE 2: Merge concepts
      // ========================================
      const d1ForMerge = d1Concepts.map(c => ({ label: c.label, description: c.description, d1Ids: c.elementIds }));
      const d2ForMerge = d2Concepts.map(c => ({ label: c.label, description: c.description, d2Ids: c.elementIds }));

      console.log(`[Pipeline] Calling merge-concepts...`);
      
      const mergeResponse = await fetch(`${BASE_URL}/audit-merge-concepts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, projectId, shareToken, d1Concepts: d1ForMerge, d2Concepts: d2ForMerge }),
      });

      if (!mergeResponse.ok) {
        const errText = await mergeResponse.text();
        console.error(`[Pipeline] Merge failed:`, errText);
        throw new Error(`Merge concepts failed: ${mergeResponse.status}`);
      }
      
      const mergeResult = await mergeResponse.json();
      if (!mergeResult.success) {
        throw new Error(`Merge error: ${mergeResult.error}`);
      }
      
      mergedConcepts = mergeResult.mergedConcepts || [];
      unmergedD1Concepts = (mergeResult.unmergedD1Concepts || []).map((c: any) => ({
        label: c.label,
        description: c.description,
        elementIds: c.d1Ids || [],
      }));
      unmergedD2Concepts = (mergeResult.unmergedD2Concepts || []).map((c: any) => ({
        label: c.label,
        description: c.description,
        elementIds: c.d2Ids || [],
      }));

      console.log(`[Pipeline] Merge returned ${mergedConcepts.length} merged, ${unmergedD1Concepts.length} unmerged D1, ${unmergedD2Concepts.length} unmerged D2`);

      setProgress({ 
        phase: "building_graph", 
        message: `Creating ${mergedConcepts.length} merged concept nodes and edges...`, 
        progress: 50,
        mergedCount: mergedConcepts.length
      });

      if (abortRef.current) throw new Error("Aborted");

      // ========================================
      // PHASE 2.5: Build graph nodes for concepts and create edges
      // ========================================
      
      // First, get all existing nodes so we can link to them
      const { data: allNodes } = await supabase.rpc("get_audit_graph_nodes_with_token", {
        p_session_id: sessionId,
        p_token: shareToken,
      });

      // Create merged concept nodes and edges
      for (const concept of mergedConcepts) {
        const { data: conceptNode } = await supabase.rpc("upsert_audit_graph_node_with_token", {
          p_session_id: sessionId,
          p_token: shareToken,
          p_label: concept.mergedLabel,
          p_description: concept.mergedDescription,
          p_node_type: "concept",
          p_source_dataset: "both",
          p_source_element_ids: [...concept.d1Ids, ...concept.d2Ids],
          p_created_by_agent: "pipeline",
          p_color: "#a855f7", // Purple for merged concepts
          p_size: 25,
          p_metadata: { merged: true, d1Count: concept.d1Ids.length, d2Count: concept.d2Ids.length },
        });

        if (conceptNode?.id) {
          // Create edges from D1 elements to concept
          for (const d1Id of concept.d1Ids) {
            const d1Node = allNodes?.find((n: any) => n.source_element_ids?.includes(d1Id));
            if (d1Node) {
              await supabase.rpc("insert_audit_graph_edge_with_token", {
                p_session_id: sessionId,
                p_token: shareToken,
                p_source_node_id: d1Node.id,
                p_target_node_id: conceptNode.id,
                p_edge_type: "defines",
                p_label: "defines",
                p_weight: 1.0,
                p_created_by_agent: "pipeline",
                p_metadata: {},
              });
            }
          }

          // Create edges from D2 elements to concept
          for (const d2Id of concept.d2Ids) {
            const d2Node = allNodes?.find((n: any) => n.source_element_ids?.includes(d2Id));
            if (d2Node) {
              await supabase.rpc("insert_audit_graph_edge_with_token", {
                p_session_id: sessionId,
                p_token: shareToken,
                p_source_node_id: d2Node.id,
                p_target_node_id: conceptNode.id,
                p_edge_type: "implements",
                p_label: "implements",
                p_weight: 1.0,
                p_created_by_agent: "pipeline",
                p_metadata: {},
              });
            }
          }
        }
      }

      // Create nodes for unmerged D1 concepts (gaps - requirements not met)
      for (const concept of unmergedD1Concepts) {
        const { data: gapNode } = await supabase.rpc("upsert_audit_graph_node_with_token", {
          p_session_id: sessionId,
          p_token: shareToken,
          p_label: concept.label,
          p_description: concept.description,
          p_node_type: "concept",
          p_source_dataset: "dataset1",
          p_source_element_ids: concept.elementIds,
          p_created_by_agent: "pipeline",
          p_color: "#ef4444", // Red for gaps
          p_size: 22,
          p_metadata: { gap: true, unmerged: true },
        });

        // Create edges from D1 elements to gap concept
        if (gapNode?.id) {
          for (const d1Id of concept.elementIds) {
            const d1Node = allNodes?.find((n: any) => n.source_element_ids?.includes(d1Id));
            if (d1Node) {
              await supabase.rpc("insert_audit_graph_edge_with_token", {
                p_session_id: sessionId,
                p_token: shareToken,
                p_source_node_id: d1Node.id,
                p_target_node_id: gapNode.id,
                p_edge_type: "defines",
                p_label: "defines",
                p_weight: 1.0,
                p_created_by_agent: "pipeline",
                p_metadata: {},
              });
            }
          }
        }
      }

      // Create nodes for unmerged D2 concepts (orphans - impl without requirements)
      for (const concept of unmergedD2Concepts) {
        const { data: orphanNode } = await supabase.rpc("upsert_audit_graph_node_with_token", {
          p_session_id: sessionId,
          p_token: shareToken,
          p_label: concept.label,
          p_description: concept.description,
          p_node_type: "concept",
          p_source_dataset: "dataset2",
          p_source_element_ids: concept.elementIds,
          p_created_by_agent: "pipeline",
          p_color: "#f59e0b", // Orange for orphans
          p_size: 22,
          p_metadata: { orphan: true, unmerged: true },
        });

        // Create edges from D2 elements to orphan concept
        if (orphanNode?.id) {
          for (const d2Id of concept.elementIds) {
            const d2Node = allNodes?.find((n: any) => n.source_element_ids?.includes(d2Id));
            if (d2Node) {
              await supabase.rpc("insert_audit_graph_edge_with_token", {
                p_session_id: sessionId,
                p_token: shareToken,
                p_source_node_id: d2Node.id,
                p_target_node_id: orphanNode.id,
                p_edge_type: "implements",
                p_label: "implements",
                p_weight: 1.0,
                p_created_by_agent: "pipeline",
                p_metadata: {},
              });
            }
          }
        }
      }

      setProgress({ 
        phase: "building_tesseract", 
        message: `Analyzing ${mergedConcepts.length} merged concepts for alignment...`, 
        progress: 65,
        tesseractTotal: mergedConcepts.length
      });

      if (abortRef.current) throw new Error("Aborted");

      // ========================================
      // PHASE 3: Build tesseract
      // ========================================
      console.log(`[Pipeline] Calling build-tesseract...`);
      
      const tesseractResponse = await fetch(`${BASE_URL}/audit-build-tesseract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sessionId, projectId, shareToken, 
          mergedConcepts, 
          d1Elements, 
          d2Elements 
        }),
      });

      let tesseractCells: any[] = [];
      if (tesseractResponse.ok) {
        const tesseractResult = await tesseractResponse.json();
        tesseractCells = tesseractResult?.cells || [];
        console.log(`[Pipeline] Tesseract returned ${tesseractCells.length} cells`);
      } else {
        console.error(`[Pipeline] Tesseract failed, continuing...`);
      }

      setProgress({ 
        phase: "generating_venn", 
        message: "Generating final Venn analysis...", 
        progress: 85 
      });

      if (abortRef.current) throw new Error("Aborted");

      // ========================================
      // PHASE 4: Generate Venn
      // ========================================
      console.log(`[Pipeline] Calling generate-venn...`);
      
      await fetch(`${BASE_URL}/audit-generate-venn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sessionId, projectId, shareToken,
          mergedConcepts,
          unmergedD1Concepts: unmergedD1Concepts.map(c => ({ ...c, d1Ids: c.elementIds })),
          unmergedD2Concepts: unmergedD2Concepts.map(c => ({ ...c, d2Ids: c.elementIds })),
          tesseractCells,
          d1Count: d1Elements.length,
          d2Count: d2Elements.length
        }),
      });

      // Update session to completed
      await supabase.rpc("update_audit_session_with_token", {
        p_session_id: sessionId,
        p_token: shareToken,
        p_status: "completed",
        p_phase: "completed",
      });

      setProgress({ phase: "completed", message: "Audit pipeline complete!", progress: 100 });
      console.log(`[Pipeline] Complete!`);

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Pipeline] Error:`, errMsg);
      setError(errMsg);
      setProgress({ phase: "error", message: errMsg, progress: 0 });
      
      // Update session with error status
      await supabase.rpc("update_audit_session_with_token", {
        p_session_id: sessionId,
        p_token: shareToken,
        p_status: "failed",
      });
    } finally {
      setIsRunning(false);
    }
  }, []);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { runPipeline, isRunning, progress, error, abort };
}
