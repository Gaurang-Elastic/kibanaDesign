/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

// Kibana aliases `@elastic/eui` to `optimize/es`. Register against that
// module so EuiIcon and the side nav share this cache.
// @ts-expect-error no declarations for this internal module
import { appendIconComponentCache } from '@elastic/eui/optimize/es/components/icon/icon';
// @ts-expect-error no declarations for this internal module
import { typeToPathMap } from '@elastic/eui/optimize/es/components/icon/icon_map';

import { icon as tableSparkles } from './assets/table_sparkles';

export const TABLE_SPARKLES_TYPE = 'tableSparkles';

// Local registration of tableSparkles (EUI PR #9987, merged 2026-09-03).
// Remove this once the EUI version bump lands; the icon is then built in.

appendIconComponentCache({
  tableSparkles,
});

// EuiIcon only consults the component cache for names already in typeToPathMap.
// This Kibana EUI predates tableSparkles, so add the name here too.
const iconMap = typeToPathMap as Record<
  string,
  () => Promise<{ icon: typeof tableSparkles }>
>;
if (!iconMap[TABLE_SPARKLES_TYPE]) {
  iconMap[TABLE_SPARKLES_TYPE] = () => Promise.resolve({ icon: tableSparkles });
}
