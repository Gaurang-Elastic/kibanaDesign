# Context Engine 8 (alternate proto)

Forked from proto 7.2 so that proto 7 can stay frozen. **Does not modify** `examples/context_engine` … `context_engine_7`, `ContextengineUI`, or `Contextengine2`–`7`.

| | Proto 7 (frozen) | Proto 8 (this) |
|---|---|---|
| Folder | `examples/context_engine_7` | `examples/context_engine_8` |
| Package | `@kbn/context-engine-7-example-plugin` | `@kbn/context-engine-8-example-plugin` |
| Plugin id | `contextEngineExampleSeven` | `contextEngineExampleEight` |
| App id | `contextEngineExample7` | `contextEngineExample8` |
| Nav title | Context | Context |
| Ports | `5614` → `5615` | `5616` → `5617` |
| Standalone folder | `Contextengine7` | `Contextengine8` |

## Run

From the Kibana repository root (`kibana-context-engine`). See [RESTART.md](./RESTART.md) for the saved Cursor terminal settings.

```sh
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm use --delete-prefix 24.17.0
yarn es snapshot
# Alongside proto 1–7, use 5616/5617:
yarn start --plugin-path=examples/context_engine_8 --port=5616 --dev.basePathProxyTarget=5617
```

Open:

```
http://localhost:5616/<basepath>/app/contextEngineExample8
```

**Port note:** Do not reuse `5602`–`5615` while other protos are running. Proto 7 stays on `5614`/`5615`.
