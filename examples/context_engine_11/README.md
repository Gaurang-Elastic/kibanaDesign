# Context Engine 11

Forked from proto 9 (v2.3) onto current Kibana main so the 9.6 visual system is in effect. Does not modify protos 7 to 10.

| | Proto 11 (this) |
|---|---|
| Kibana worktree | `/Users/gaurang/Documents/CursorDesign/kibana-ce11` |
| Branch | `ce11` |
| Folder | `examples/context_engine_11` |
| Package | `@kbn/context-engine-11-example-plugin` |
| Plugin id | `contextEngineExampleEleven` |
| App id | `contextEngineExample11` |
| Nav title | Context |
| Elasticsearch | `9222` |
| Kibana server | `5622` |
| Base path proxy | `5623` |
| Source branch | `ContextengineUI-11` (`Contextengine11`) |
| Node | `24.21.0` |

## Run

From `kibana-ce11`. See [RESTART.md](./RESTART.md).

```sh
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm use --delete-prefix 24.21.0
node scripts/es snapshot --license trial -E http.port=9222 -E transport.port=9322 -E discovery.type=single-node -E cluster.name=kibana-ce11
node scripts/kibana --dev --plugin-path=examples/context_engine_11 --port=5623 --dev.basePathProxyTarget=5622
```

Open:

```
http://localhost:5623/<basepath>/app/contextEngineExample11
```

Do not reuse `9200` or `5614` to `5621` while the older protos are running.
