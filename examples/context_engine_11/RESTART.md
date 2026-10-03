# Restart notes: Context Engine protos on Kibana 9.6

Saved 2026-10-02. Protos 7, 8, 9, 10, and 11 run together from this worktree on current Kibana main. The August worktree stays frozen.

After restart, tell the agent: **restart the Context Engine 9.6 prototype terminals**

Proto 11 alone used to use **restart the Context Engine 11 prototype terminals**. Use the 9.6 phrase above. It starts the same Elasticsearch and the same Kibana, with all five plugins.

---

## Worktree

| | |
|---|---|
| Path | `/Users/gaurang/Documents/CursorDesign/kibana-ce11` |
| Branch | `ce11` (tracks `elastic/kibana` `main` via the fork remote `origin`) |
| Node | `24.21.0` (from `.nvmrc`) |
| Package manager | pnpm `12.4.2` via corepack |
| Plugins | `examples/context_engine_7` through `examples/context_engine_11` |
| Proto 11 source | `/Users/gaurang/Documents/CursorDesign/ContextengineUI-11` (git branch `Contextengine11`) |

Which proto is which: `examples/CONTEXT_ENGINE_PROTOS.md`.

Do not use `/Users/gaurang/Documents/CursorDesign/kibana-context-engine` for these protos. That worktree stays on `contextengine7`.

---

## Ports

| Role | Port |
|---|---|
| Elasticsearch (this worktree only) | `9222` |
| Kibana server | `5622` (`dev.basePathProxyTarget`) |
| Base path proxy (browser) | `5623` (`server.port`) |
| Elasticsearch transport | `9322` |

Kibana dev mode binds the browser to `server.port` and moves the Kibana process to `dev.basePathProxyTarget`. The open URL is the proxy.

Never use `9200`, `9300`, or `5614` to `5621`. Those belong to the older August processes.

**Important:** basepath changes on every fresh Kibana start. After restart, use the URL from logs:
`basepath proxy server running at http://localhost:5623/<code>`

```text
http://localhost:5623/<basepath>/app/contextEngineExample7
http://localhost:5623/<basepath>/app/contextEngineExample8
http://localhost:5623/<basepath>/app/contextEngineExample9
http://localhost:5623/<basepath>/app/contextEngineExample10
http://localhost:5623/<basepath>/app/contextEngineExample11
```

---

## Restart procedure

Order: Elasticsearch first (skip if already on `9222`), then Kibana once.

### Terminal 1: Elasticsearch

```sh
cd /Users/gaurang/Documents/CursorDesign/kibana-ce11
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm use --delete-prefix 24.21.0
node scripts/es snapshot --license trial -E http.port=9222 -E transport.port=9322 -E discovery.type=single-node -E cluster.name=kibana-ce11
```

`discovery.type=single-node`, `transport.port=9322`, and `cluster.name=kibana-ce11` keep this node off the Elasticsearch already listening on `9300`.

Wait for log: `publish_address {127.0.0.1:9222}`

### Terminal 2: Kibana with protos 7 to 11

`config/kibana.dev.yml` sets `server.port: 5623`, `dev.basePathProxyTarget: 5622`, and `elasticsearch.hosts: ["http://localhost:9222"]`.

```sh
cd /Users/gaurang/Documents/CursorDesign/kibana-ce11
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm use --delete-prefix 24.21.0
node scripts/kibana --dev \
  --plugin-path=examples/context_engine_7 \
  --plugin-path=examples/context_engine_8 \
  --plugin-path=examples/context_engine_9 \
  --plugin-path=examples/context_engine_10 \
  --plugin-path=examples/context_engine_11 \
  --port=5623 --dev.basePathProxyTarget=5622
```

Wait for: `Kibana is now available`.

---

## If Application not found

Regenerate the package map, then restart Kibana only:

```sh
cd /Users/gaurang/Documents/CursorDesign/kibana-ce11
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use --delete-prefix 24.21.0
node -e "const {getRepoRelsSync}=require('./src/platform/packages/private/kbn-repo-packages/modern/get_repo_rels'); const {updatePackageMap}=require('./src/platform/packages/private/kbn-repo-packages/modern/get_packages'); console.log('updated', updatePackageMap(process.cwd(), Array.from(getRepoRelsSync(process.cwd(), ['**/kibana.jsonc']))));"
```

Do not add a legacy `kibana.json` next to `kibana.jsonc` while using `--plugin-path`. That double-registers and crashes startup.

---

## Proto 11 source copy

After editing proto 11, copy back to the source branch (do not skip this):

```sh
rsync -a --exclude target --exclude node_modules --exclude .git \
  /Users/gaurang/Documents/CursorDesign/kibana-ce11/examples/context_engine_11/ \
  /Users/gaurang/Documents/CursorDesign/ContextengineUI-11/
```

Protos 7, 8, and 9 are not copied back to ContextengineUI. They live on the `ce11` branch only. Proto 10's source of record for the explorations is the `Contextengine10` branch.
