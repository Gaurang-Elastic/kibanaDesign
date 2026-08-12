# Context Engine 5 (alternate proto)

Alternate Kibana example-plugin prototype, forked from proto 4. **Does not modify** `examples/context_engine`, `examples/context_engine_2`, `examples/context_engine_3`, `examples/context_engine_4`, `ContextengineUI`, `Contextengine2`, `Contextengine3`, or `Contextengine4`.

| | Proto 1 | Proto 2 | Proto 3 | Proto 4 | Proto 5 (this) |
|---|---|---|---|---|---|
| Folder | `examples/context_engine` | `examples/context_engine_2` | `examples/context_engine_3` | `examples/context_engine_4` | `examples/context_engine_5` |
| Package | `@kbn/context-engine-example-plugin` | `@kbn/context-engine-2-example-plugin` | `@kbn/context-engine-3-example-plugin` | `@kbn/context-engine-4-example-plugin` | `@kbn/context-engine-5-example-plugin` |
| Plugin id | `contextEngineExample` | `contextEngineExampleTwo` | `contextEngineExampleThree` | `contextEngineExampleFour` | `contextEngineExampleFive` |
| App id | `contextEngineExample` | `contextEngineExample2` | `contextEngineExample3` | `contextEngineExample4` | `contextEngineExample5` |
| Nav title | Context | Context 2 | Context | Context | Context |
| Ports | `5602` → `5603` | `5604` → `5605` | `5606` → `5607` | `5608` → `5609` | `5610` → `5611` |
| Standalone folder | `ContextengineUI` | `Contextengine2` | `Contextengine3` | `Contextengine4` | `Contextengine5` |

## Run

From the Kibana repository root (`kibana-context-engine`). See [RESTART.md](./RESTART.md) for the saved Cursor terminal settings.

```sh
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm use --delete-prefix 24.17.0
yarn es snapshot
# Alongside proto 1–4, use 5610/5611:
yarn start --plugin-path=examples/context_engine_5 --port=5610 --dev.basePathProxyTarget=5611
```

Open:

```
http://localhost:5610/<basepath>/app/contextEngineExample5
```

**Port note:** Do not reuse `5602`–`5609` while other protos are running.
