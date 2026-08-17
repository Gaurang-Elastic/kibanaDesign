# Restart notes — Context Engine 2 prototype

Saved before Cursor restart (2026-07-29).

Alternate proto. Do **not** confuse with proto 1 (`context_engine` / ContextengineUI).

After restart, tell the agent: **restart the Context Engine 2 prototype terminals**  
(All protos: **restart all prototype terminals**)

Master overview: `/Users/gaurang/Documents/CursorDesign/RESTART.md`

---

## Worktree

| | |
|---|---|
| Path | `/Users/gaurang/Documents/CursorDesign/kibana-context-engine` |
| Branch | `cursor/context-engine-example` |
| Node | `24.17.0` |
| Plugin | `examples/context_engine_2` (`@kbn/context-engine-2-example-plugin`) |
| Plugin id | `contextEngineExampleTwo` (digits not allowed in `plugin.id`) |
| App id | `contextEngineExample2` |
| Standalone copy | `/Users/gaurang/Documents/CursorDesign/Contextengine2` |

---

## Currently running (before this Cursor restart)

| # | Role | Command | Port / URL |
|---|---|---|---|
| 1 | Elasticsearch (shared) | `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use --delete-prefix 24.17.0 && yarn es snapshot` | `9200` |
| 2 | Kibana + plugin | `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use --delete-prefix 24.17.0 && yarn start --plugin-path=examples/context_engine_2 --port=5604 --dev.basePathProxyTarget=5605` | `5604` (proxy) / `5605` (server) |

- Last Kibana basepath: `/kcy` (2026-07-29) — changes every fresh start
- Sidenav: **Context 2** / Search nav `contextEngineExample2` (`memory` icon)
- Proto 1 (if also running): `5602` proxy → default target `5603`

**Why not 5603?** Dev mode defaults `dev.basePathProxyTarget` to `5603`. Proto 1 on `5602` already owns that port, so proto 2 must use a different proxy + target pair (`5604` / `5605`).

**Important:** basepath changes on every fresh Kibana start. After restart, use the URL from logs:  
`basepath proxy server running at http://localhost:5604/<code>`

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

### Terminal 2 — Kibana + Context Engine 2

```sh
cd /Users/gaurang/Documents/CursorDesign/kibana-context-engine
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm use --delete-prefix 24.17.0 && yarn start --plugin-path=examples/context_engine_2 --port=5604 --dev.basePathProxyTarget=5605
```

Wait for: `Kibana is now available`.

Then open:

```text
http://localhost:5604/<basepath>/app/contextEngineExample2
```

Current (until next restart):

```text
http://localhost:5604/kcy/app/contextEngineExample2
```
