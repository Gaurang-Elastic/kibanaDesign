# Context Engine protos on this Kibana

These five plugins run together from `/Users/gaurang/Documents/CursorDesign/kibana-ce11` on Kibana 9.6.0. One Elasticsearch on port 9222 and one Kibana on ports 5622 and 5623 serve all of them, so they can be compared in the same Chrome Next header.

Proto 7 is `examples/context_engine_7`. Plugin id `contextEngineExampleSeven`, app id `contextEngineExample7`. It was copied from the August worktree and is the oldest of the set.

Proto 8 is `examples/context_engine_8`. Plugin id `contextEngineExampleEight`, app id `contextEngineExample8`. It was copied from the August worktree. It is the fork of proto 7.2 that stayed the last full demo there.

Proto 9 is `examples/context_engine_9`. Plugin id `contextEngineExampleNine`, app id `contextEngineExample9`. It was copied from the August worktree copy of the v2.4 UI (inline panel editing), not from the `v2.3-sep29` tag.

Proto 10 is `examples/context_engine_10`. Plugin id `contextEngineExampleTen`, app id `contextEngineExample10`. It is proto 9 plus explorations A to H. The same files are committed on the ContextengineUI branch `Contextengine10`.

Proto 11 is `examples/context_engine_11`. Plugin id `contextEngineExampleEleven`, app id `contextEngineExample11`. It is the v2.4 UI on this Kibana, without the proto 10 explorations. Its source branch is `Contextengine11`.

Restart with: restart the Context Engine 9.6 prototype terminals. Details are in `examples/context_engine_11/RESTART.md`.
