# SuccessViews Dashboard — Design & Architecture Notes

## Hard constraints (do not change without explicit request)

- The app always boots into the **Employee** view. There is no public role picker.
- Admin/Manager access is reached only through a password-gated modal
  (`handleAdminLogin` in `src/App.jsx`, default password `Admin@123`,
  stored under the `svd_admin_pwd` key and editable from
  Settings → Admin Security).
- The sidebar is a fixed **232px** column (`.sv-sidebar` in
  `src/styles/dashboard.css`) used identically by both the Admin/Manager
  and Employee views: logo at top, identity block, nav list, footer with
  theme toggle / sign-out / admin-login-or-exit-admin button.

## Project structure

```
successviews-app/
├── .github/workflows/deploy.yml   # CI/CD — build + SSH/rsync deploy
├── src/
│   ├── App.jsx                    # orchestrator: state, handlers, tab routing
│   ├── main.jsx                   # React root + CSS import
│   ├── assets/successviews-logo.png
│   ├── styles/dashboard.css       # design tokens + sv-* component classes
│   ├── utils/
│   │   ├── constants.js           # brand colors, lists, defaults, chart presets
│   │   ├── helpers.js             # pure formatting/CSV/date utilities
│   │   └── storage.js             # persistence (window.storage or in-memory)
│   └── components/
│       ├── ui/                    # KPI, Avatar, ClickCard, DetailModal, ViewModal
│       ├── admin/                 # DeptCard, SalaryModule, ManagerAssignModule
│       └── employee/              # EmployeeLogin, EmployeeDashboard, FormLabel
```

Every component is single-purpose and documented with a header comment
explaining its role and props, so design or behavior changes can be made
in one file without touching the orchestrator.

## Styling approach

All structural/layout styling now comes from the `sv-*` class taxonomy
defined in `src/styles/dashboard.css` (cards, buttons, inputs, badges,
modals, grid/flex utilities, sidebar/nav). Design tokens (`--navy`,
`--teal`, `--green`, `--orange`, `--purple`, `--amber`, `--red`, spacing,
radii, shadows) live in `:root` — change a token there to restyle the
whole app consistently.

Genuinely dynamic/data-driven values (per-series chart colors, computed
percentages, per-record values) remain as inline `style={{}}` overrides
layered on top of the `sv-*` classes — they can't be expressed as static
CSS classes since they depend on data at render time.

## Branding

- The company logo (`src/assets/successviews-logo.png`) is the default
  value of the `logo` state in `App.jsx`.
- Admins can override it any time from Settings → Company Branding; the
  override is persisted to `svd_logo` via `storageSet` and takes
  precedence over the bundled default on reload.
- The same `logo` state feeds both the employee login screen and the
  sidebar logo slot in both Admin and Employee views, so a single
  upload updates branding everywhere.

## Data model

State is currently held in React state + a thin persistence shim
(`storageGet`/`storageSet`), preferring a host-provided `window.storage`
API and falling back to an in-memory store. To move to a real backend,
replace the bodies of those two functions with API calls — no other
file needs to change, since every read/write in `App.jsx` already goes
through them.

## Deployment

See `.github/workflows/deploy.yml`. Default target is a generic Linux
server reached over SSH + rsync. Required GitHub Secrets:

| Secret            | Purpose                                   |
|-------------------|--------------------------------------------|
| `SSH_HOST`        | Server hostname or IP                      |
| `SSH_USERNAME`    | SSH login user                             |
| `SSH_PRIVATE_KEY` | Private key authorized on the server       |
| `SSH_TARGET_DIR`  | Absolute path to deploy `dist/` into        |
| `SSH_PORT`        | Optional, defaults to 22                    |

No credentials are committed to the repo — everything sensitive comes
from GitHub Secrets at run time. The workflow file includes comments on
swapping in Vercel, Netlify, S3/CloudFront, or a container registry
instead.

## Build verification

```
cd successviews-app
npm install
npm run build
```

Last verified: builds cleanly with Vite 5 (847 modules transformed,
single ~632 kB JS bundle — gzip ~175 kB). The bundle-size warning is
expected for a single-page dashboard with recharts; code-splitting can
be added later via dynamic `import()` if needed.
