-- Create new lightweight function for agent list_files (no content)
CREATE OR REPLACE FUNCTION public.get_repo_file_paths_with_token(
  p_repo_id uuid,
  p_token uuid DEFAULT NULL,
  p_path_prefix text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  path text,
  is_binary boolean,
  is_staged boolean,
  operation_type text,
  size_bytes integer,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
BEGIN
  -- Get project_id from repo
  SELECT project_id INTO v_project_id FROM public.project_repos WHERE id = p_repo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repository not found';
  END IF;

  -- Validate access
  PERFORM public.require_role(v_project_id, p_token, 'viewer');

  RETURN QUERY
  WITH committed_files AS (
    SELECT 
      rf.id,
      rf.path,
      rf.is_binary,
      false AS is_staged,
      NULL::text AS operation_type,
      octet_length(rf.content) AS size_bytes,
      rf.updated_at
    FROM public.repo_files rf
    WHERE rf.repo_id = p_repo_id
      AND (p_path_prefix IS NULL OR rf.path LIKE p_path_prefix || '%')
  ),
  staged_files AS (
    SELECT 
      rs.id,
      rs.file_path AS path,
      rs.is_binary,
      true AS is_staged,
      rs.operation_type,
      COALESCE(octet_length(rs.new_content), 0) AS size_bytes,
      rs.created_at AS updated_at
    FROM public.repo_staging rs
    WHERE rs.repo_id = p_repo_id
      AND (p_path_prefix IS NULL OR rs.file_path LIKE p_path_prefix || '%')
  )
  -- Return committed files that aren't being deleted, plus all staged files
  SELECT cf.id, cf.path, cf.is_binary, cf.is_staged, cf.operation_type, cf.size_bytes, cf.updated_at
  FROM committed_files cf
  WHERE NOT EXISTS (
    SELECT 1 FROM staged_files sf 
    WHERE sf.path = cf.path AND sf.operation_type = 'delete'
  )
  UNION ALL
  SELECT sf.id, sf.path, sf.is_binary, sf.is_staged, sf.operation_type, sf.size_bytes, sf.updated_at
  FROM staged_files sf
  ORDER BY path;
END;
$function$;

-- Restore original get_repo_files_with_token WITH content (3-arg version with path_prefix)
DROP FUNCTION IF EXISTS public.get_repo_files_with_token(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.get_repo_files_with_token(
  p_repo_id uuid,
  p_token uuid DEFAULT NULL,
  p_path_prefix text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  path text,
  content text,
  is_binary boolean,
  last_commit_sha text,
  updated_at timestamptz,
  is_staged boolean,
  operation_type text,
  size_bytes integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id uuid;
BEGIN
  -- Get project_id from repo
  SELECT project_id INTO v_project_id FROM public.project_repos WHERE id = p_repo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repository not found';
  END IF;

  -- Validate access
  PERFORM public.require_role(v_project_id, p_token, 'viewer');

  RETURN QUERY
  WITH committed_files AS (
    SELECT 
      rf.id,
      rf.path,
      rf.content,
      rf.is_binary,
      rf.last_commit_sha,
      rf.updated_at,
      false AS is_staged,
      NULL::text AS operation_type,
      octet_length(rf.content) AS size_bytes
    FROM public.repo_files rf
    WHERE rf.repo_id = p_repo_id
      AND (p_path_prefix IS NULL OR rf.path LIKE p_path_prefix || '%')
  ),
  staged_files AS (
    SELECT 
      rs.id,
      rs.file_path AS path,
      COALESCE(rs.new_content, '') AS content,
      rs.is_binary,
      NULL::text AS last_commit_sha,
      rs.created_at AS updated_at,
      true AS is_staged,
      rs.operation_type,
      COALESCE(octet_length(rs.new_content), 0) AS size_bytes
    FROM public.repo_staging rs
    WHERE rs.repo_id = p_repo_id
      AND (p_path_prefix IS NULL OR rs.file_path LIKE p_path_prefix || '%')
  )
  SELECT cf.id, cf.path, cf.content, cf.is_binary, cf.last_commit_sha, cf.updated_at, cf.is_staged, cf.operation_type, cf.size_bytes
  FROM committed_files cf
  WHERE NOT EXISTS (
    SELECT 1 FROM staged_files sf 
    WHERE sf.path = cf.path AND sf.operation_type = 'delete'
  )
  UNION ALL
  SELECT sf.id, sf.path, sf.content, sf.is_binary, sf.last_commit_sha, sf.updated_at, sf.is_staged, sf.operation_type, sf.size_bytes
  FROM staged_files sf
  ORDER BY path;
END;
$function$;