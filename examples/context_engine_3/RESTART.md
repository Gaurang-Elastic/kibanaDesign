# Restart notes — Context Engine 3 prototype

Saved 2026-07-31 (pre Cursor update restart). Snapshot: `/Users/gaurang/Documents/CursorDesign/TERMINALS_SNAPSHOT.md`

Alternate proto. Do **not** confuse with proto 1 (`context_engine` / ContextengineUI) or proto 2 (`context_engine_2` / Contextengine2).

After restart, tell the agent: **restart the Context Engine 3 prototype terminals**  
(All protos: **restart all prototype terminals**)

Master overview: `/Users/gaurang/Documents/CursorDesign/RESTART.md`

---

## Worktree

| | |
|---|---|
| Path | `/Users/gaurang/Documents/CursorDesign/kibana-context-engine` |
| Branch | `cursor/context-engine-example` |
| Node | `24.17.0` |
| Plugin | `examples/context_engine_3` (`@kbn/context-engine-3-example-plugin`) |
| Plugin id | `contextEngineExampleThree` (digits not allowed in `plugin.id`) |
| App id | `contextEngineExample3` |
| Standalone copy | `/Users/gaurang/Documents/CursorDesign/Contextengine3` |

---

## Currently running

| # | Role | Command | Port / URL |
|---|---|---|---|
| 1 | Elasticsearch (shared) | `yarn es snapshot` | `9200` |
| 2 | Kibana + plugin | `yarn start --plugin-path=examples/context_engine_3 --port=5606 --dev.basePathProxyTarget=5607` | `5606` / `5607` |

- Last Kibana basepath: `/uvt` (2026-07-31 after Cursor restart) — changes every fresh start
- Sidenav: **Context** (below Agents) / Search nav `contextEngineExample3` (`memory` icon)
- Also in use: Agent Builder manage Context at `/app/agent_builder/manage/context`

## Ports

| Role | Port |
|---|---|
| Elasticsearch (shared) | `9200` |
| Proto 3 Kibana proxy | `5606` |
| Proto 3 Kibana server | `5607` |

Proto 1 uses `5602`/`5603`. Proto 2 uses `5604`/`5605`. Never reuse those for proto 3.

**Important:** basepath changes on every fresh Kibana start. After restart, use the URL from logs:  
`basepath proxy server running at http://localhost:5606/<code>`

Current (until next restart):

```text
http://localhost:5606/uvt/app/contextEngineExample3
```

---

## Restart procedure

Order: **ES first** (skip if already on `9200`), then Kibana.

### Terminal 1 — Elasticsearch

```sh
cd /Users/gaurang/Documents/CursorDesign/kibana-context-engine
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm use --delete-prefix 24.17.0 && yarn es snapshot
```

Wait for log: `publish_address {127.0.0.1:9200}`

### Terminal 2 — Kibana + Context Engine 3

```sh
cd /Users/gaurang/Documents/CursorDesign/kibana-context-engine
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm use --delete-prefix 24.17.0 && yarn start --plugin-path=examples/context_engine_3 --port=5606 --dev.basePathProxyTarget=5607
```

Wait for: `Kibana is now available`.

Then open:

```text
http://localhost:5606/<basepath>/app/contextEngineExample3
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
