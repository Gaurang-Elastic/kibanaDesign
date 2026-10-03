# Restart notes — Context Engine 10 prototype

Saved 2026-10-02. Forked from proto 9.

Alternate proto. Do **not** confuse with proto 1–9. Proto 9 stays on `examples/context_engine_9`, backup `Contextengine9`, ports `5618`/`5619`. Proto 8 stays as the last full demo. Proto 7 stays frozen.

After restart, tell the agent: **restart the Context Engine 10 prototype terminals**  
(All protos: **restart all prototype terminals**)

Master overview: `/Users/gaurang/Documents/CursorDesign/RESTART.md`

---

## Worktree

| | |
|---|---|
| Path | `/Users/gaurang/Documents/CursorDesign/kibana-context-engine` |
| Branch | `contextengine7` (shared worktree; do not switch it) |
| Node | `24.17.0` |
| Plugin | `examples/context_engine_10` (`@kbn/context-engine-10-example-plugin`) |
| Plugin id | `contextEngineExampleTen` (digits not allowed in `plugin.id`) |
| App id | `contextEngineExample10` |
| Standalone copy | `/Users/gaurang/Documents/CursorDesign/Contextengine10` |

---

## Ports

| Role | Port |
|---|---|
| Elasticsearch (shared) | `9200` |
| Proto 10 Kibana proxy | `5620` |
| Proto 10 Kibana server | `5621` |

Proto 9 uses `5618`/`5619`. Proto 8 uses `5616`/`5617`. Never reuse those for proto 10.

**Important:** basepath changes on every fresh Kibana start. After restart, use the URL from logs:  
`basepath proxy server running at http://localhost:5620/<code>`

```text
http://localhost:5620/<basepath>/app/contextEngineExample10
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

### Terminal 2 — Kibana + Context Engine 10

```sh
cd /Users/gaurang/Documents/CursorDesign/kibana-context-engine
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm use --delete-prefix 24.17.0 && yarn start --plugin-path=examples/context_engine_10 --port=5620 --dev.basePathProxyTarget=5621
```

Wait for: `Kibana is now available`.

Then open:

```text
http://localhost:5620/<basepath>/app/contextEngineExample10
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

Standalone backup: `/Users/gaurang/Documents/CursorDesign/Contextengine10`

If `examples/context_engine_10/public` disappears, restore from that backup:

```sh
rsync -a --exclude target --exclude .git \
  /Users/gaurang/Documents/CursorDesign/Contextengine10/ \
  /Users/gaurang/Documents/CursorDesign/kibana-context-engine/examples/context_engine_10/
```

After editing proto 10, copy back (do not skip this):

```sh
rsync -a --exclude target --exclude .git \
  /Users/gaurang/Documents/CursorDesign/kibana-context-engine/examples/context_engine_10/ \
  /Users/gaurang/Documents/CursorDesign/Contextengine10/
```
