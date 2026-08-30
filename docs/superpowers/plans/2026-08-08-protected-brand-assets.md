# Protected Brand Assets Implementation Plan

> **HISTORICAL** — Plan de ejecución conservado. La autoridad vigente de identidad visual está en [brand/README.md](../../../brand/README.md).

**Clasificación:** `HISTORICAL`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved Clay brandbook and logo to a protected, hash-verifiable `brand/` directory and publish the change to `origin/main`.

**Architecture:** Keep the supplied HTML and SVG as immutable reference assets under `brand/`, with descriptive repository metadata next to them. Use a SHA-256 manifest for byte-level integrity and `.github/CODEOWNERS` to route future changes to the repository owner, without changing application code or runtime assets.

**Tech Stack:** Git, PowerShell, JSON, Markdown, SHA-256, existing Node/Vite verification scripts.

## Global Constraints

- Preserve the supplied brandbook and logo bytes exactly; only the SVG filename changes to `logo.svg`.
- Do not modify `src/`, `public/`, solver, workers, persistence, result contracts, dependencies, or package version `0.8.2`.
- Do not include secrets, credentials, private URLs, or tokens in repository files or reports.
- Use `npm.cmd` for Node commands in PowerShell.
- Push only the reviewed final commit to `origin/main`, as explicitly authorized by the user.

---

### Task 1: Add the canonical brand assets

**Files:**
- Create: `brand/brandbook-clay.html`
- Create: `brand/logo.svg`

**Interfaces:**
- Consumes: the two user-provided attachment paths.
- Produces: two repository assets whose SHA-256 values are `40D356E6EBC687C2C4F3A15F20434B6205FE616CE77EB852A8B49EA0306B5501` and `05B8C685F962780EE642D326CAC27FB40A50958B5C21D881B640BC705F691308`, respectively.

- [ ] **Step 1: Confirm the source files and target directory state**

Run:

```powershell
Get-Item -LiteralPath "C:\Users\crisd\.codex\codex-remote-attachments\019fe05d-df35-7213-86ae-a31964c63af7\0208A469-BF91-4D5F-A1B9-6D195E580ECE\1-brandbook-clay.html", "C:\Users\crisd\.codex\codex-remote-attachments\019fe05d-df35-7213-86ae-a31964c63af7\0208A469-BF91-4D5F-A1B9-6D195E580ECE\2-Untitled-design-1.svg"
Test-Path -LiteralPath "brand"
```

Expected: both sources exist and `brand` is absent.

- [ ] **Step 2: Copy the supplied files without editing their contents**

Run:

```powershell
New-Item -ItemType Directory -Force "brand" | Out-Null
Copy-Item -LiteralPath "C:\Users\crisd\.codex\codex-remote-attachments\019fe05d-df35-7213-86ae-a31964c63af7\0208A469-BF91-4D5F-A1B9-6D195E580ECE\1-brandbook-clay.html" -Destination "brand\brandbook-clay.html"
Copy-Item -LiteralPath "C:\Users\crisd\.codex\codex-remote-attachments\019fe05d-df35-7213-86ae-a31964c63af7\0208A469-BF91-4D5F-A1B9-6D195E580ECE\2-Untitled-design-1.svg" -Destination "brand\logo.svg"
```

- [ ] **Step 3: Verify the copied bytes before adding metadata**

Run:

```powershell
Get-FileHash -Algorithm SHA256 "brand\brandbook-clay.html", "brand\logo.svg"
```

Expected: the two hashes match the values in the Interfaces block exactly.

### Task 2: Add protection metadata and ownership

**Files:**
- Create: `brand/README.md`
- Create: `brand/manifest.json`
- Create: `.github/CODEOWNERS`

**Interfaces:**
- Consumes: the exact assets from Task 1.
- Produces: a human-readable asset policy, a JSON integrity manifest, and a Code Owners rule for `brand/**`.

- [ ] **Step 1: Write the asset policy and manifest**

Create `brand/README.md` explaining that the directory is the canonical source for the supplied brand assets, that assets require explicit authorization before modification, and that `manifest.json` must be updated only with an approved replacement.

Create `brand/manifest.json` with this exact structure:

```json
{
  "schemaVersion": 1,
  "purpose": "Official structureCo Clay brand assets",
  "assets": [
    {
      "path": "brandbook-clay.html",
      "sourceName": "1-brandbook-clay.html",
      "bytes": 223329,
      "sha256": "40D356E6EBC687C2C4F3A15F20434B6205FE616CE77EB852A8B49EA0306B5501"
    },
    {
      "path": "logo.svg",
      "sourceName": "2-Untitled-design-1.svg",
      "bytes": 2554,
      "sha256": "05B8C685F962780EE642D326CAC27FB40A50958B5C21D881B640BC705F691308"
    }
  ]
}
```

- [ ] **Step 2: Add the Code Owners rule**

Create `.github/CODEOWNERS` with:

```text
# Official brand assets require repository-owner review.
/brand/** @klkmoraa
```

- [ ] **Step 3: Validate metadata syntax and scope**

Run:

```powershell
Get-Content -Raw "brand\manifest.json" | ConvertFrom-Json | Out-Null
Get-Content -Raw "brand\README.md"
Get-Content -Raw ".github\CODEOWNERS"
```

Expected: the manifest parses successfully, the policy names `brand/manifest.json`, and CODEOWNERS contains exactly the `/brand/** @klkmoraa` ownership rule.

### Task 3: Validate, report, commit, and publish

**Files:**
- Create: `reports/2026-08-08-0207-brand-assets.md`
- Include: `docs/superpowers/specs/2026-08-08-brand-assets-design.md`
- Include: `docs/superpowers/plans/2026-08-08-protected-brand-assets.md`

**Interfaces:**
- Consumes: all files from Tasks 1 and 2 plus the approved design specification.
- Produces: fresh verification evidence and a commit published at `origin/main`.

- [ ] **Step 1: Verify hashes, sizes, secret patterns, and intended diff**

Run:

```powershell
Get-FileHash -Algorithm SHA256 "brand\brandbook-clay.html", "brand\logo.svg"
Get-Item "brand\brandbook-clay.html", "brand\logo.svg" | Select-Object Name,Length
rg -n -i "api[_-]?key\s*[:=]|secret\s*[:=]|password\s*[:=]|BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}" brand reports
git diff --check
git status --short
```

Expected: hashes and sizes match the manifest, the secret scan returns no matches, `git diff --check` is clean, and only the approved paths are untracked or modified.

- [ ] **Step 2: Run the related project verification**

Run:

```powershell
npm.cmd run verify:protected
npm.cmd run lint
npm.cmd run build
```

Expected: all three commands exit with code 0. No application source files should appear in the diff.

- [ ] **Step 3: Write the final Spanish change report**

Use the required report template in `reports/2026-08-08-0207-brand-assets.md` with the timestamp `2026-08-08 02:07`, branch, files, verification commands, commit intent, and the remaining limitation that Code Owners enforcement depends on the GitHub branch rule.

- [ ] **Step 4: Review the complete diff and create one implementation commit**

Run:

```powershell
git diff --check
git diff --stat
git status --short
git add -- brand .github/CODEOWNERS reports docs/superpowers/plans/2026-08-08-protected-brand-assets.md
git commit -m "feat: add protected brand assets" -m "Reporte: reports/2026-08-08-0207-brand-assets.md"
```

Expected: the commit contains only the approved asset, metadata, governance, plan, and report files.

- [ ] **Step 5: Push and verify the remote commit**

Run:

```powershell
git push origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main
git status --short --branch
```

Expected: push exits 0, the local HEAD SHA equals the remote `main` SHA, and the worktree is clean and synchronized.
