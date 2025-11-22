import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export function useShareToken(projectId?: string) {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [isTokenSet, setIsTokenSet] = useState(false);

  useEffect(() => {
    const tokenParam = searchParams.get("token");
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
  }, [searchParams, projectId]);

  return { token, isTokenSet };
}
