# Context Engine 7 (alternate proto)

Alternate Kibana example-plugin prototype, forked from proto 6. **Does not modify** `examples/context_engine`, `examples/context_engine_2`, `examples/context_engine_3`, `examples/context_engine_4`, `examples/context_engine_5`, `examples/context_engine_6`, `ContextengineUI`, `Contextengine2`, `Contextengine3`, `Contextengine4`, `Contextengine5`, or `Contextengine6`.

| | Proto 1 | Proto 2 | Proto 3 | Proto 4 | Proto 5 | Proto 6 | Proto 7 (this) |
|---|---|---|---|---|---|---|---|
| Folder | `examples/context_engine` | `examples/context_engine_2` | `examples/context_engine_3` | `examples/context_engine_4` | `examples/context_engine_5` | `examples/context_engine_6` | `examples/context_engine_7` |
| Package | `@kbn/context-engine-example-plugin` | `@kbn/context-engine-2-example-plugin` | `@kbn/context-engine-3-example-plugin` | `@kbn/context-engine-4-example-plugin` | `@kbn/context-engine-5-example-plugin` | `@kbn/context-engine-6-example-plugin` | `@kbn/context-engine-7-example-plugin` |
| Plugin id | `contextEngineExample` | `contextEngineExampleTwo` | `contextEngineExampleThree` | `contextEngineExampleFour` | `contextEngineExampleFive` | `contextEngineExampleSix` | `contextEngineExampleSeven` |
| App id | `contextEngineExample` | `contextEngineExample2` | `contextEngineExample3` | `contextEngineExample4` | `contextEngineExample5` | `contextEngineExample6` | `contextEngineExample7` |
| Nav title | Context | Context 2 | Context | Context | Context | Context | Context |
| Ports | `5602` → `5603` | `5604` → `5605` | `5606` → `5607` | `5608` → `5609` | `5610` → `5611` | `5612` → `5613` | `5614` → `5615` |
| Standalone folder | `ContextengineUI` | `Contextengine2` | `Contextengine3` | `Contextengine4` | `Contextengine5` | `Contextengine6` | `Contextengine7` |

## Run

From the Kibana repository root (`kibana-context-engine`). See [RESTART.md](./RESTART.md) for the saved Cursor terminal settings.

```sh
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm use --delete-prefix 24.17.0
yarn es snapshot
# Alongside proto 1–6, use 5614/5615:
yarn start --plugin-path=examples/context_engine_7 --port=5614 --dev.basePathProxyTarget=5615
```

Open:

```
http://localhost:5614/<basepath>/app/contextEngineExample7
```

**Port note:** Do not reuse `5602`–`5613` while other protos are running.
