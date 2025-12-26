// Audit Pipeline Phase 1: Extract concepts from dataset elements
// Called twice in parallel - once for D1, once for D2
// Returns concepts with linked element IDs

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DatasetElement {
  id: string;
  label: string;
  content: string;
  category?: string;
}

interface ExtractedConcept {
  label: string;
  description: string;
  elementIds: string[];
}

interface ExtractRequest {
  sessionId: string;
  projectId: string;
  shareToken: string;
  dataset: "d1" | "d2";
  elements: DatasetElement[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const geminiKey = Deno.env.get("GEMINI_API_KEY")!;

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: authHeader ? { Authorization: authHeader } : {} },
    });

    const { sessionId, projectId, shareToken, dataset, elements }: ExtractRequest = await req.json();
    
    console.log(`[${dataset}] Starting concept extraction for ${elements.length} elements`);
    
    const datasetLabel = dataset === "d1" ? "D1 (requirements)" : "D2 (implementation)";
    const datasetContext = dataset === "d1" 
      ? "requirements, specifications, or source of truth items"
      : "implementation artifacts like code files, configurations, or deliverables";
    
    // Build compact element list - only include id, label, and truncated content
    const elementsText = elements.map((e, i) => {
      const truncatedContent = (e.content || "").slice(0, 300);
      return `[${i + 1}] ID: ${e.id}\nLabel: ${e.label}\nCategory: ${e.category || "unknown"}\nContent: ${truncatedContent}${e.content && e.content.length > 300 ? "..." : ""}`;
    }).join("\n\n");

    const prompt = `Extract common CONCEPTS from these ${datasetLabel} elements.

## Elements (${elements.length} total)
These are ${datasetContext}.

${elementsText}

## Task
Identify 5-15 high-level concepts that group these elements by theme/function.
Each element MUST be linked to at least one concept via its UUID.

## Required JSON Output
{
  "concepts": [
    {
      "label": "Concept Name",
      "description": "2-3 sentence explanation of what this concept covers",
      "elementIds": ["uuid1", "uuid2"]
    }
  ]
}

CRITICAL: 
- Every element UUID must appear in at least one concept
- Return ONLY valid JSON, no markdown or extra text`;

    console.log(`[${dataset}] Calling Gemini API...`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${dataset}] Gemini API error:`, response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    console.log(`[${dataset}] Got response, length: ${rawText.length}`);

    // Parse JSON
    let parsed: { concepts: ExtractedConcept[] };
    try {
      parsed = JSON.parse(rawText);
    } catch (parseErr) {
      console.error(`[${dataset}] JSON parse failed:`, parseErr);
      console.log(`[${dataset}] Raw text:`, rawText.slice(0, 1000));
      
      // Try extracting JSON from text
      const firstBrace = rawText.indexOf("{");
      const lastBrace = rawText.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        parsed = JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
      } else {
        throw new Error(`Failed to parse JSON from LLM response`);
      }
    }

    const concepts = parsed.concepts || [];
    console.log(`[${dataset}] Extracted ${concepts.length} concepts`);

    // Log to blackboard
    await supabase.rpc("insert_audit_blackboard_with_token", {
      p_session_id: sessionId,
      p_token: shareToken,
      p_agent_role: `${dataset}_extractor`,
      p_entry_type: `${dataset}_concepts`,
      p_content: `Extracted ${concepts.length} concepts from ${elements.length} elements:\n${concepts.map(c => `- ${c.label}: ${c.elementIds.length} elements`).join("\n")}`,
      p_iteration: 1,
      p_confidence: 0.9,
      p_evidence: null,
      p_target_agent: null,
    });

    // Log activity
    await supabase.rpc("insert_audit_activity_with_token", {
      p_session_id: sessionId,
      p_token: shareToken,
      p_agent_role: `${dataset}_extractor`,
      p_activity_type: "concept_extraction",
      p_title: `${datasetLabel} Concept Extraction Complete`,
      p_content: `Extracted ${concepts.length} concepts from ${elements.length} elements`,
      p_metadata: { conceptCount: concepts.length, elementCount: elements.length, dataset },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        concepts, 
        dataset, 
        elementCount: elements.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Concept extraction error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
