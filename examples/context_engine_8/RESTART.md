# Restart notes — Context Engine 8 prototype

Saved 2026-09-01. Forked from proto 7.2; see `/Users/gaurang/Documents/CursorDesign/TERMINALS_SNAPSHOT.md` for the live pre-Cursor-restart snapshot.

Alternate proto. Do **not** confuse with proto 1–7. Proto 7 (`context_engine_7` / `Contextengine7` / ports `5614`/`5615`) stays frozen.

After restart, tell the agent: **restart the Context Engine 8 prototype terminals**  
(All protos: **restart all prototype terminals**)

Master overview: `/Users/gaurang/Documents/CursorDesign/RESTART.md`

---

## Worktree

| | |
|---|---|
| Path | `/Users/gaurang/Documents/CursorDesign/kibana-context-engine` |
| Branch | `contextengine7` (shared worktree; do not switch it) |
| Node | `24.17.0` |
| Plugin | `examples/context_engine_8` (`@kbn/context-engine-8-example-plugin`) |
| Plugin id | `contextEngineExampleEight` (digits not allowed in `plugin.id`) |
| App id | `contextEngineExample8` |
| Standalone copy | `/Users/gaurang/Documents/CursorDesign/Contextengine8` |

---

## Ports

| Role | Port |
|---|---|
| Elasticsearch (shared) | `9200` |
| Proto 8 Kibana proxy | `5616` |
| Proto 8 Kibana server | `5617` |

Proto 7 uses `5614`/`5615`. Never reuse those for proto 8.

**Important:** basepath changes on every fresh Kibana start. After restart, use the URL from logs:  
`basepath proxy server running at http://localhost:5616/<code>`

```text
http://localhost:5616/<basepath>/app/contextEngineExample8
```

Last known before 2026-09-01 Cursor restart: `http://localhost:5616/wat/app/contextEngineExample8` (do not reuse after a fresh Kibana start).

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

### Terminal 2 — Kibana + Context Engine 8

```sh
cd /Users/gaurang/Documents/CursorDesign/kibana-context-engine
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm use --delete-prefix 24.17.0 && yarn start --plugin-path=examples/context_engine_8 --port=5616 --dev.basePathProxyTarget=5617
```

Wait for: `Kibana is now available`.

Then open:

```text
http://localhost:5616/<basepath>/app/contextEngineExample8
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

This worktree stays on git branch **`contextengine7`**. Do not check out another branch here, and do not `git clean -fd`.

Standalone backup: `/Users/gaurang/Documents/CursorDesign/Contextengine8`

If `examples/context_engine_8/public` disappears, restore from that backup:

```sh
rsync -a --exclude target --exclude .git \
  /Users/gaurang/Documents/CursorDesign/Contextengine8/ \
  /Users/gaurang/Documents/CursorDesign/kibana-context-engine/examples/context_engine_8/
```

After editing proto 8, copy back (do not skip this):

```sh
rsync -a --exclude target --exclude .git \
  /Users/gaurang/Documents/CursorDesign/kibana-context-engine/examples/context_engine_8/ \
  /Users/gaurang/Documents/CursorDesign/Contextengine8/
```
