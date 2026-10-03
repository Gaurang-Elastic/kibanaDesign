# Context Engine UI prototype

Design prototype for the Elastic Context Engine.

**Current: v2.3, September 29 2026.**
Aligned to the engineering build: three-panel Create, Sources flyout, locked
Automations as a subdued panel, landing-card cleanup, created indexes persist
on the catalog, Learning is the get-started view, and header Create is
secondary on that page.

**Previous versions**
- `v2.2-sep2026` — bolt icon for automations empty and rows
- `v2.1-sep2026` — traces panel, next-step education, Create with AI Agent
- `v2.0-sep2026` — first v2 share (traces still treated as a source)
- `v1-wizard-proto` — wizard-based prototype (`git checkout v1-wizard-proto`)

Older proto snapshots stay on their branches: `contextengine7`,
`contextengine6`, `Contextengine5`. Those branches are not updated by this
release.

## Running locally

This is a Kibana example plugin, not a standalone npm app. From a local
[elastic/kibana](https://github.com/elastic/kibana) checkout (Node `24.17.0`):

```
# put this repo at examples/context_engine_10 (symlink or copy)
yarn es snapshot
yarn start --plugin-path=examples/context_engine_10 --port=5620 --dev.basePathProxyTarget=5621
```

Then open `http://localhost:5620/<basepath>/app/contextEngineExample10`.
Log in as **admin** on the mock IdP.

## Demo states

Use the "Demo state" switcher, bottom right, to move between the states this
prototype covers. **Learning** is the empty catalog (get started plus the
managed index). **Working** is the full catalog, including any indexes you
create in this browser.
