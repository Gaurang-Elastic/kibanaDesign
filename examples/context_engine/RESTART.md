# Restart notes — Context Engine prototype (proto 1)

Saved before Cursor restart (2026-07-27).

After restart, tell the agent: **restart the prototype terminals**  
(For proto 2: **restart the Context Engine 2 prototype terminals**)

---

## Worktree

| | |
|---|---|
| Path | `/Users/gaurang/Documents/CursorDesign/kibana-context-engine` |
| Branch | `cursor/context-engine-example` |
| Node | `24.17.0` |
| Plugin | `examples/context_engine` (`@kbn/context-engine-example-plugin`) |
| App id | `contextEngineExample` |
| Standalone copy | `/Users/gaurang/Documents/CursorDesign/ContextengineUI` |
| Package map | ok (must include `@kbn/context-engine-example-plugin`) |

---

## Currently running (before this Cursor restart)

| # | Role | Command | Port / URL |
|---|---|---|---|
| 1 | Elasticsearch | `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use --delete-prefix 24.17.0 && yarn es snapshot` | `9200` |
| 2 | Kibana + plugin | `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use --delete-prefix 24.17.0 && yarn start --plugin-path=examples/context_engine --port=5602` | `5602` |

- Last Kibana basepath: `/wcp` (2026-07-27) — changes every fresh start
- Sidenav: **Agents → Context** (sparkles icon)
- Proto 2 (if also running): `5604` / `5605` — see `examples/context_engine_2/RESTART.md`
- Optimizer should report **218 bundles** when the plugin is loaded

**Important:** basepath changes on every fresh Kibana start. After restart, use the URL from logs:  
`basepath proxy server running at http://localhost:5602/<code>`

---

## Restart procedure

Order: **ES first**, then Kibana.

### Terminal 1 — Elasticsearch

```sh
cd /Users/gaurang/Documents/CursorDesign/kibana-context-engine
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm use --delete-prefix 24.17.0 && yarn es snapshot
```

Wait for log: `publish_address {127.0.0.1:9200}`

### Terminal 2 — Kibana + Context Engine

```sh
cd /Users/gaurang/Documents/CursorDesign/kibana-context-engine
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm use --delete-prefix 24.17.0 && yarn start --plugin-path=examples/context_engine --port=5602
```

Wait for: `Kibana is now available` and `218 bundles`.

Then open:

```text
http://localhost:5602/<basepath>/app/contextEngineExample
```

---

## If Application not found

Regenerate package map, then restart Kibana only:

```sh
cd /Users/gaurang/Documents/CursorDesign/kibana-context-engine
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use --delete-prefix 24.17.0
node -e "const {getRepoRelsSync}=require('./src/platform/packages/private/kbn-repo-packages/modern/get_repo_rels'); const {updatePackageMap}=require('./src/platform/packages/private/kbn-repo-packages/modern/get_packages'); console.log('updated', updatePackageMap(process.cwd(), Array.from(getRepoRelsSync(process.cwd(), ['**/kibana.jsonc']))));"
```

Do **not** add a legacy `kibana.json` next to `kibana.jsonc` while using `--plugin-path` — that double-registers and crashes startup.
