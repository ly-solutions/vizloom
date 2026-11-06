# Notices

vizloom is MIT-licensed. Parts of it are adapted from the projects below; each adapted file names
its source in a header comment.

## Taiga UI

- Project: https://github.com/taiga-family/taiga-ui
- Copyright 2024 Acpekt
- Licence: Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0

The tooltip placement algorithm (`src/core/positioning/placement.ts`: the 12 directions, priority
list, viewport clamp and beak offset) is adapted from Taiga UI
(`projects/core/portals/hint/hint-position.directive.ts`, `hint-anchored.directive.ts`).
No Taiga code is copied verbatim.

```
Copyright 2024 Acpekt

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

## Origin

The time-series model, viewport, tile source and canvas chart engine are a generalised rewrite of
an in-house analytics module donated by its authors under the MIT licence of this project.
