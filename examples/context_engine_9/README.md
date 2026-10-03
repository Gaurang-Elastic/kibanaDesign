# Context Engine 9 (alternate proto)

Forked from proto 8 so that proto 8 can stay as the last full demo. **Does not modify** `examples/context_engine` … `context_engine_8`, `ContextengineUI`, or `Contextengine2`–`8`.

| | Proto 8 | Proto 9 (this) |
|---|---|---|
| Folder | `examples/context_engine_8` | `examples/context_engine_9` |
| Package | `@kbn/context-engine-8-example-plugin` | `@kbn/context-engine-9-example-plugin` |
| Plugin id | `contextEngineExampleEight` | `contextEngineExampleNine` |
| App id | `contextEngineExample8` | `contextEngineExample9` |
| Nav title | Context | Context |
| Ports | `5616` → `5617` | `5618` → `5619` |
| Standalone folder | `Contextengine8` | `Contextengine9` |

## Run

From the Kibana repository root (`kibana-context-engine`). See [RESTART.md](./RESTART.md) for the saved Cursor terminal settings.

```sh
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm use --delete-prefix 24.17.0
yarn es snapshot
# Alongside proto 1–8, use 5618/5619:
yarn start --plugin-path=examples/context_engine_9 --port=5618 --dev.basePathProxyTarget=5619
```

Open:

```
http://localhost:5618/<basepath>/app/contextEngineExample9
```

**Port note:** Do not reuse `5602`–`5617` while other protos are running. Proto 8 stays on `5616`/`5617`. Proto 7 stays on `5614`/`5615`.
