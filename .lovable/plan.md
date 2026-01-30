

## Plan: Fix Empty Build Command Being Replaced with Default

### Problem

When deploying a static web app, the user deletes the build command (sets it to `""`) but it keeps getting replaced with `"npm run build"`. This causes deployment failures.

**Root Cause**: In `supabase/functions/render-service/index.ts`, the code uses the `||` operator:

```typescript
buildCommand: deployment.build_command || 'npm run build'
```

In JavaScript, an empty string `""` is falsy, so `"" || 'npm run build'` evaluates to `'npm run build'`. The user's intentional blank value is being overwritten.

---

### Solution

Replace the `||` operator with a nullish coalescing operator (`??`) or explicit check for `null`/`undefined`. This preserves empty strings as valid values.

**Change**: `deployment.build_command || 'default'` → `deployment.build_command ?? 'default'`

The `??` operator only uses the fallback when the value is `null` or `undefined`, NOT when it's an empty string.

---

### Implementation

**File: `supabase/functions/render-service/index.ts`**

| Line | Current | Fixed |
|------|---------|-------|
| 231 | `buildCommand: deployment.build_command \|\| 'npm run build'` | `buildCommand: deployment.build_command ?? 'npm run build'` |
| 232 | `publishPath: deployment.build_folder \|\| 'dist'` | `publishPath: deployment.build_folder ?? 'dist'` |
| 239 | `buildCommand: deployment.build_command \|\| 'npm install'` | `buildCommand: deployment.build_command ?? 'npm install'` |
| 240 | `startCommand: deployment.run_command \|\| 'npm start'` | `startCommand: deployment.run_command ?? 'npm start'` |
| 926 | `buildCommand: deployment.build_command \|\| 'npm run build'` | `buildCommand: deployment.build_command ?? 'npm run build'` |
| 927 | `publishPath: deployment.build_folder \|\| 'dist'` | `publishPath: deployment.build_folder ?? 'dist'` |
| 932 | `buildCommand: deployment.build_command \|\| 'npm install'` | `buildCommand: deployment.build_command ?? 'npm install'` |
| 933 | `startCommand: deployment.run_command \|\| 'npm start'` | `startCommand: deployment.run_command ?? 'npm start'` |

---

### Technical Details

| Scenario | Before (`\|\|`) | After (`??`) |
|----------|-----------------|--------------|
| `build_command = null` | Uses default | Uses default |
| `build_command = undefined` | Uses default | Uses default |
| `build_command = ""` (empty) | **Uses default (BUG)** | **Keeps empty (FIXED)** |
| `build_command = "npm run build"` | Uses value | Uses value |

---

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/render-service/index.ts` | Replace 8 occurrences of `\|\|` with `??` for build/run commands and paths |

---

### Expected Outcome

- Static web apps with blank build commands will deploy correctly
- User-specified empty values will be preserved
- Explicit defaults only apply when no value was set (null/undefined)

