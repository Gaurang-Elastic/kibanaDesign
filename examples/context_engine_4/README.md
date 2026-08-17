# Context Engine 4 (alternate proto)

Alternate Kibana example-plugin prototype. **Does not modify** `examples/context_engine`, `examples/context_engine_2`, `examples/context_engine_3`, `ContextengineUI`, `Contextengine2`, or `Contextengine3`.

| | Proto 1 | Proto 2 | Proto 3 | Proto 4 (this) |
|---|---|---|---|---|
| Folder | `examples/context_engine` | `examples/context_engine_2` | `examples/context_engine_3` | `examples/context_engine_4` |
| Package | `@kbn/context-engine-example-plugin` | `@kbn/context-engine-2-example-plugin` | `@kbn/context-engine-3-example-plugin` | `@kbn/context-engine-4-example-plugin` |
| Plugin id | `contextEngineExample` | `contextEngineExampleTwo` | `contextEngineExampleThree` | `contextEngineExampleFour` |
| App id | `contextEngineExample` | `contextEngineExample2` | `contextEngineExample3` | `contextEngineExample4` |
| Nav title | Context | Context 2 | Context | Context |
| Ports | `5602` → `5603` | `5604` → `5605` | `5606` → `5607` | `5608` → `5609` |
| Standalone folder | `ContextengineUI` | `Contextengine2` | `Contextengine3` | `Contextengine4` |

## Run

From the Kibana repository root (`kibana-context-engine`). See [RESTART.md](./RESTART.md) for the saved Cursor terminal settings.

```sh
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm use --delete-prefix 24.17.0
yarn es snapshot
# Alongside proto 1–3, use 5608/5609:
yarn start --plugin-path=examples/context_engine_4 --port=5608 --dev.basePathProxyTarget=5609
```

Open:

```
http://localhost:5608/<basepath>/app/contextEngineExample4
```

**Port note:** Do not reuse `5602`–`5607` while other protos are running.
