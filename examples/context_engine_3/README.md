# Context Engine 3 (alternate proto)

Alternate Kibana example-plugin prototype. **Does not modify** `examples/context_engine`, `examples/context_engine_2`, `ContextengineUI`, or `Contextengine2`.

| | Proto 1 | Proto 2 | Proto 3 (this) |
|---|---|---|---|
| Folder | `examples/context_engine` | `examples/context_engine_2` | `examples/context_engine_3` |
| Package | `@kbn/context-engine-example-plugin` | `@kbn/context-engine-2-example-plugin` | `@kbn/context-engine-3-example-plugin` |
| Plugin id | `contextEngineExample` | `contextEngineExampleTwo` | `contextEngineExampleThree` |
| App id | `contextEngineExample` | `contextEngineExample2` | `contextEngineExample3` |
| Nav title | Context | Context 2 | Context |
| Ports | `5602` → `5603` | `5604` → `5605` | `5606` → `5607` |
| Standalone folder | `ContextengineUI` | `Contextengine2` | `Contextengine3` |

## Run

From the Kibana repository root (`kibana-context-engine`). See [RESTART.md](./RESTART.md) for the saved Cursor terminal settings.

```sh
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm use --delete-prefix 24.17.0
yarn es snapshot
# Alongside proto 1 (5602→5603) and proto 2 (5604→5605), use 5606/5607:
yarn start --plugin-path=examples/context_engine_3 --port=5606 --dev.basePathProxyTarget=5607
```

Open:

```
http://localhost:5606/<basepath>/app/contextEngineExample3
```

**Port note:** Do not reuse `5602`–`5605` while other protos are running.
