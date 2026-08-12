# Restart notes — Context Engine 5 prototype

Saved 2026-08-03. Forked from proto 4; see `/Users/gaurang/Documents/CursorDesign/TERMINALS_SNAPSHOT.md` for shared ES notes.

Alternate proto. Do **not** confuse with proto 1 (`context_engine` / ContextengineUI), proto 2 (`context_engine_2` / Contextengine2), proto 3 (`context_engine_3` / Contextengine3), or proto 4 (`context_engine_4` / Contextengine4).

After restart, tell the agent: **restart the Context Engine 5 prototype terminals**  
(All protos: **restart all prototype terminals**)

Master overview: `/Users/gaurang/Documents/CursorDesign/RESTART.md`

---

## Worktree

| | |
|---|---|
| Path | `/Users/gaurang/Documents/CursorDesign/kibana-context-engine` |
| Branch | `cursor/context-engine-example` |
| Node | `24.17.0` |
| Plugin | `examples/context_engine_5` (`@kbn/context-engine-5-example-plugin`) |
| Plugin id | `contextEngineExampleFive` (digits not allowed in `plugin.id`) |
| App id | `contextEngineExample5` |
| Standalone copy | `/Users/gaurang/Documents/CursorDesign/Contextengine5` |

---

## Currently running

| # | Role | Command | Port / URL |
|---|---|---|---|
| 1 | Elasticsearch (shared) | `yarn es snapshot` | `9200` |
| 2 | Kibana + plugin | `yarn start --plugin-path=examples/context_engine_5 --port=5610 --dev.basePathProxyTarget=5611` | `5610` / `5611` |

- Last Kibana basepath: set after first start — changes every fresh start
- Sidenav: **Context** (below Agents) / Search nav `contextEngineExample5` (`memory` icon)
- Agent Builder manage Context deep-links remain on proto 3 (`contextEngineExample3`) by design

## Ports

| Role | Port |
|---|---|
| Elasticsearch (shared) | `9200` |
| Proto 5 Kibana proxy | `5610` |
| Proto 5 Kibana server | `5611` |

Proto 1 uses `5602`/`5603`. Proto 2 uses `5604`/`5605`. Proto 3 uses `5606`/`5607`. Proto 4 uses `5608`/`5609`. Never reuse those for proto 5.

**Important:** basepath changes on every fresh Kibana start. After restart, use the URL from logs:  
`basepath proxy server running at http://localhost:5610/<code>`

```text
http://localhost:5610/<basepath>/app/contextEngineExample5
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

### Terminal 2 — Kibana + Context Engine 5

```sh
cd /Users/gaurang/Documents/CursorDesign/kibana-context-engine
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm use --delete-prefix 24.17.0 && yarn start --plugin-path=examples/context_engine_5 --port=5610 --dev.basePathProxyTarget=5611
```

Wait for: `Kibana is now available`.

Then open:

```text
http://localhost:5610/<basepath>/app/contextEngineExample5
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
