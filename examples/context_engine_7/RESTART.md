# Restart notes — Context Engine 7 prototype

Saved 2026-08-26. Forked from proto 6; see `/Users/gaurang/Documents/CursorDesign/TERMINALS_SNAPSHOT.md` for shared ES notes.

Alternate proto. Do **not** confuse with proto 1 (`context_engine` / ContextengineUI), proto 2 (`context_engine_2` / Contextengine2), proto 3 (`context_engine_3` / Contextengine3), proto 4 (`context_engine_4` / Contextengine4), proto 5 (`context_engine_5` / Contextengine5), or proto 6 (`context_engine_6` / Contextengine6).

After restart, tell the agent: **restart the Context Engine 7 prototype terminals**  
(All protos: **restart all prototype terminals**)

Master overview: `/Users/gaurang/Documents/CursorDesign/RESTART.md`

---

## Worktree

| | |
|---|---|
| Path | `/Users/gaurang/Documents/CursorDesign/kibana-context-engine` |
| Branch | `contextengine7` |
| Node | `24.17.0` |
| Plugin | `examples/context_engine_7` (`@kbn/context-engine-7-example-plugin`) |
| Plugin id | `contextEngineExampleSeven` (digits not allowed in `plugin.id`) |
| App id | `contextEngineExample7` |
| Standalone copy | `/Users/gaurang/Documents/CursorDesign/Contextengine7` |

---

## Currently running

Saved **2026-08-26**. See also workspace `TERMINALS_SNAPSHOT.md`.

| # | Role | Command | Port / URL |
|---|---|---|---|
| 1 | Elasticsearch (shared) | `yarn es snapshot` | `9200` |
| 2 | Kibana + plugin | `yarn start --plugin-path=examples/context_engine_7 --port=5614 --dev.basePathProxyTarget=5615` | `5614` / `5615` |

- Last known URL: `http://localhost:5614/aeg/app/contextEngineExample7`
- Basepath is assigned on each fresh Kibana start (`aeg` at this save; do not reuse after restart)
- Active UI: Improvements tab with Signals + Open / Applied / Dismissed lifecycle
- GitHub: https://github.com/elastic/ContextengineUI (`main` = proto 7)
- Sidenav: **Context** (below Agents) / Search nav `contextEngineExample7` (`memory` icon)
- Agent Builder manage Context deep-links remain on proto 3 (`contextEngineExample3`) by design
- After Cursor update, say: **restart the Context Engine 7 prototype terminals**

## Ports

| Role | Port |
|---|---|
| Elasticsearch (shared) | `9200` |
| Proto 7 Kibana proxy | `5614` |
| Proto 7 Kibana server | `5615` |

Proto 1 uses `5602`/`5603`. Proto 2 uses `5604`/`5605`. Proto 3 uses `5606`/`5607`. Proto 4 uses `5608`/`5609`. Proto 5 uses `5610`/`5611`. Proto 6 uses `5612`/`5613`. Never reuse those for proto 7.

**Important:** basepath changes on every fresh Kibana start. After restart, use the URL from logs:  
`basepath proxy server running at http://localhost:5614/<code>`

```text
http://localhost:5614/<basepath>/app/contextEngineExample7
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

### Terminal 2 — Kibana + Context Engine 7

```sh
cd /Users/gaurang/Documents/CursorDesign/kibana-context-engine
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm use --delete-prefix 24.17.0 && yarn start --plugin-path=examples/context_engine_7 --port=5614 --dev.basePathProxyTarget=5615
```

Wait for: `Kibana is now available`.

Then open:

```text
http://localhost:5614/<basepath>/app/contextEngineExample7
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

---

## Isolation

This worktree stays on git branch **`contextengine7`**. Do not check out another branch here, and do not `git clean -fd` — that previously deleted this plugin.

Standalone backup (separate git repo): `/Users/gaurang/Documents/CursorDesign/Contextengine7`

If `examples/context_engine_7/public` disappears, restore from that backup:

```sh
rsync -a --exclude target --exclude .git \
  /Users/gaurang/Documents/CursorDesign/Contextengine7/ \
  /Users/gaurang/Documents/CursorDesign/kibana-context-engine/examples/context_engine_7/
```
