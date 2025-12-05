import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export function useShareToken(projectId?: string) {
  // Extract token from path params (new pattern: /project/:projectId/page/t/:token)
  const params = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [isTokenSet, setIsTokenSet] = useState(false);

  useEffect(() => {
    // Priority: path param > query param (for backwards compatibility)
    const tokenFromPath = params.token;
    const tokenFromQuery = searchParams.get("token");
    const tokenParam = tokenFromPath || tokenFromQuery;
    
    setToken(tokenParam);
    
    if (tokenParam && projectId) {
      // Set the share token in the Postgres session
      const setTokenInDb = async () => {
        const { error } = await supabase.rpc("set_share_token", { token: tokenParam });
        if (error) {
          console.error("Failed to set share token:", error);
        } else {
          setIsTokenSet(true);
        }
      };
      setTokenInDb();
    } else if (!tokenParam) {
      // No token needed, mark as ready
      setIsTokenSet(true);
    }
  }, [params.token, searchParams, projectId]);

  return { token, isTokenSet };
}
