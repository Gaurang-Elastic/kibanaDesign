# Restart notes — Context Engine 9 prototype

Saved 2026-09-09. Forked from proto 8; see `/Users/gaurang/Documents/CursorDesign/TERMINALS_SNAPSHOT.md` for the live pre-Cursor-restart snapshot.

Alternate proto. Do **not** confuse with proto 1–8. Proto 8 (`context_engine_8` / `Contextengine8` / ports `5616`/`5617`) stays as the last full demo. Proto 7 stays frozen.

After restart, tell the agent: **restart the Context Engine 9 prototype terminals**  
(All protos: **restart all prototype terminals**)

Master overview: `/Users/gaurang/Documents/CursorDesign/RESTART.md`

---

## Worktree

| | |
|---|---|
| Path | `/Users/gaurang/Documents/CursorDesign/kibana-context-engine` |
| Branch | `contextengine7` (shared worktree; do not switch it) |
| Node | `24.17.0` |
| Plugin | `examples/context_engine_9` (`@kbn/context-engine-9-example-plugin`) |
| Plugin id | `contextEngineExampleNine` (digits not allowed in `plugin.id`) |
| App id | `contextEngineExample9` |
| Standalone copy | `/Users/gaurang/Documents/CursorDesign/Contextengine9` |

---

## Ports

| Role | Port |
|---|---|
| Elasticsearch (shared) | `9200` |
| Proto 9 Kibana proxy | `5618` |
| Proto 9 Kibana server | `5619` |

Proto 8 uses `5616`/`5617`. Proto 7 uses `5614`/`5615`. Never reuse those for proto 9.

**Important:** basepath changes on every fresh Kibana start. After restart, use the URL from logs:  
`basepath proxy server running at http://localhost:5618/<code>`

```text
http://localhost:5618/<basepath>/app/contextEngineExample9
```

Last known before 2026-09-09 Cursor restart: `http://localhost:5618/lve/app/contextEngineExample9` (do not reuse after a fresh Kibana start).

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

### Terminal 2 — Kibana + Context Engine 9

```sh
cd /Users/gaurang/Documents/CursorDesign/kibana-context-engine
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm use --delete-prefix 24.17.0 && yarn start --plugin-path=examples/context_engine_9 --port=5618 --dev.basePathProxyTarget=5619
```

Wait for: `Kibana is now available`.

Then open:

```text
http://localhost:5618/<basepath>/app/contextEngineExample9
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

Standalone backup: `/Users/gaurang/Documents/CursorDesign/Contextengine9`

If `examples/context_engine_9/public` disappears, restore from that backup:

```sh
rsync -a --exclude target --exclude .git \
  /Users/gaurang/Documents/CursorDesign/Contextengine9/ \
  /Users/gaurang/Documents/CursorDesign/kibana-context-engine/examples/context_engine_9/
```

After editing proto 9, copy back (do not skip this):

```sh
rsync -a --exclude target --exclude .git \
  /Users/gaurang/Documents/CursorDesign/kibana-context-engine/examples/context_engine_9/ \
  /Users/gaurang/Documents/CursorDesign/Contextengine9/
```
