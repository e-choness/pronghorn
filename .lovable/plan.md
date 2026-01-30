

## Plan: Fix Install Command Field Persistence

### Problem Summary

The "Install Command" field in the Deployment Configuration dialog:
1. Always shows "npm install" when editing an existing deployment, even if the user saved a blank value
2. **Root cause**: The `install_command` column does NOT exist in the database

The code attempts to read a non-existent field:
```typescript
installCommand: (deployment as any).install_command || "npm install"
```

Since `deployment.install_command` is always `undefined`, this always evaluates to `"npm install"`.

---

### Solution: Add `install_command` Column

To properly persist the Install Command, we need to:

1. **Add the database column** via migration
2. **Update the RPC functions** to accept and return `install_command`
3. **Fix the frontend** to use `??` instead of `||` for null-safe handling

---

### Implementation

#### 1. New Migration File

**File: `supabase/migrations/[timestamp]_add_install_command_column.sql`**

```sql
-- Add install_command column to project_deployments
ALTER TABLE public.project_deployments 
ADD COLUMN IF NOT EXISTS install_command text;

-- Update insert_deployment_with_token to accept install_command
DROP FUNCTION IF EXISTS public.insert_deployment_with_token(uuid, uuid, text, deployment_environment, deployment_platform, text, text, text, text, text, text, uuid, jsonb, boolean, text, text, integer);

CREATE OR REPLACE FUNCTION public.insert_deployment_with_token(
  p_project_id uuid,
  p_token uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_environment deployment_environment DEFAULT 'dev',
  p_platform deployment_platform DEFAULT 'pronghorn_cloud',
  p_project_type text DEFAULT 'node',
  p_run_folder text DEFAULT '/',
  p_build_folder text DEFAULT '/',
  p_run_command text DEFAULT 'npm start',
  p_build_command text DEFAULT 'npm install',
  p_branch text DEFAULT 'main',
  p_repo_id uuid DEFAULT NULL,
  p_env_vars jsonb DEFAULT '{}',
  p_disk_enabled boolean DEFAULT false,
  p_disk_name text DEFAULT NULL,
  p_disk_mount_path text DEFAULT '/data',
  p_disk_size_gb integer DEFAULT 1,
  p_install_command text DEFAULT NULL  -- NEW PARAMETER
)
RETURNS project_deployments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result public.project_deployments;
BEGIN
  PERFORM public.require_role(p_project_id, p_token, 'editor');

  INSERT INTO public.project_deployments (
    project_id, name, environment, platform, project_type,
    run_folder, build_folder, run_command, build_command, branch, 
    repo_id, env_vars, disk_enabled, disk_name, disk_mount_path, disk_size_gb,
    install_command, created_by
  )
  VALUES (
    p_project_id, p_name, p_environment, p_platform, p_project_type,
    p_run_folder, p_build_folder, p_run_command, p_build_command, p_branch,
    p_repo_id, p_env_vars, p_disk_enabled, p_disk_name, p_disk_mount_path, p_disk_size_gb,
    p_install_command, auth.uid()
  )
  RETURNING * INTO result;

  RETURN result;
END;
$function$;

-- Update update_deployment_with_token similarly
-- (include p_install_command parameter and update statement)
```

#### 2. Update Frontend

**File: `src/components/deploy/DeploymentDialog.tsx`**

**Line 153** - Change `||` to `??`:
```typescript
// Before
installCommand: (deployment as any).install_command || "npm install",

// After  
installCommand: deployment.install_command ?? "npm install",
```

Once the column exists, remove the `(deployment as any)` cast.

**Lines 346-365** - Add `p_install_command` to RPC call:
```typescript
const { data: newDeployment, error } = await supabase.rpc("insert_deployment_with_token", {
  // ... existing params
  p_install_command: form.installCommand || null,  // Use null for empty
});
```

**Lines 406-422** - Add to update RPC call similarly.

#### 3. Update Edge Function

**File: `supabase/functions/generate-local-package/index.ts`**

**Line 205** - Change `||` to `??`:
```typescript
// Before
const installCommand = isMonorepo ? 'npm run install:all' : (deployment.install_command || 'npm install');

// After
const installCommand = isMonorepo ? 'npm run install:all' : (deployment.install_command ?? 'npm install');
```

---

### Files to Modify

| File | Changes |
|------|---------|
| New migration file | Add `install_command` column, update RPC functions |
| `src/components/deploy/DeploymentDialog.tsx` | Use `??` on line 153, add `p_install_command` to RPC calls |
| `supabase/functions/generate-local-package/index.ts` | Use `??` on line 205 |
| `src/integrations/supabase/types.ts` | Will auto-update after migration |

---

### Expected Outcome

| Scenario | Before | After |
|----------|--------|-------|
| Edit deployment with blank install command | Shows "npm install" | Shows empty (as saved) |
| Save deployment with blank install command | Not persisted | Saved as `null` in DB |
| Local package generation | Always uses "npm install" fallback | Uses saved value or fallback |

