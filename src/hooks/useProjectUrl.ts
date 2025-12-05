import { useAuth } from "@/contexts/AuthContext";
import { useParams, useSearchParams } from "react-router-dom";
import type { To } from "react-router-dom";

/**
 * Hook to construct project URLs with share token when needed
 * Uses path-based token pattern: /project/{projectId}/page/t/{token}
 * 
 * Returns React Router's To type (object with pathname) for clean navigation
 */
export function useProjectUrl(projectId?: string) {
  const { user } = useAuth();
  // Extract token from path params (new pattern) or query params (legacy)
  const params = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const tokenFromPath = params.token;
  const tokenFromQuery = searchParams.get("token");
  const token = tokenFromPath || tokenFromQuery;

  /**
   * Build a URL for project navigation
   * Uses path-based token pattern: /project/{projectId}/page/t/{token}
   */
  const buildUrl = (path: string): To => {
    if (!projectId) return { pathname: path };
    
    // Base path without trailing slash
    const basePath = `/project/${projectId}${path}`;
    
    // Append token as path segment if present
    if (token) {
      return { pathname: `${basePath}/t/${token}` };
    }
    
    return { pathname: basePath };
  };

  /**
   * Get full URL string for external sharing (with domain)
   */
  const getShareUrl = (path: string, domain: string = "https://pronghorn.red"): string => {
    if (!projectId) return `${domain}${path}`;
    
    const basePath = `/project/${projectId}${path}`;
    
    if (token) {
      return `${domain}${basePath}/t/${token}`;
    }
    
    return `${domain}${basePath}`;
  };

  const getTokenParam = () => {
    if (user) return "";
    return token ? `/t/${token}` : "";
  };

  return { buildUrl, getShareUrl, token, getTokenParam };
}
