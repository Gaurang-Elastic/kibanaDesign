# Context Engine 2 (alternate proto)

Alternate Kibana example-plugin prototype. **Does not modify** `examples/context_engine` or the shared `ContextengineUI` repo.

| | Proto 1 (shared) | Proto 2 (this) |
|---|---|---|
| Folder | `examples/context_engine` | `examples/context_engine_2` |
| Package | `@kbn/context-engine-example-plugin` | `@kbn/context-engine-2-example-plugin` |
| App id | `contextEngineExample` | `contextEngineExample2` |
| Nav title | Context | Context 2 |
| Standalone folder | `ContextengineUI` | `Contextengine2` |

## Run

From the Kibana repository root (`kibana-context-engine`). See [RESTART.md](./RESTART.md) for the saved Cursor terminal settings.

```sh
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm use --delete-prefix 24.17.0
yarn es snapshot
# Alongside proto 1 (5602→5603), use 5604/5605:
yarn start --plugin-path=examples/context_engine_2 --port=5604 --dev.basePathProxyTarget=5605
```

Open:

```
http://localhost:5604/<basepath>/app/contextEngineExample2
```

**Port note:** Dev mode defaults `dev.basePathProxyTarget` to `5603`. If proto 1 is on `5602`, that target is already taken — do not use `--port=5603` alone.

To load both plugins in one Kibana:

```sh
yarn start \
  --plugin-path=examples/context_engine \
  --plugin-path=examples/context_engine_2 \
  --port=5602
```

Then open `/app/contextEngineExample` (v1) and `/app/contextEngineExample2` (v2).