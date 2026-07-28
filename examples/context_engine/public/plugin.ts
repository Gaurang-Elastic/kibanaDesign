/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { AppMountParameters, CoreSetup, CoreStart, Plugin } from '@kbn/core/public';

export class ContextEngineExamplePlugin implements Plugin {
  public setup(core: CoreSetup) {
    core.application.register({
      id: 'contextEngineExample',
      title: 'Context',
      euiIconType: 'sparkles',
      order: 4500,
      visibleIn: ['globalSearch', 'projectSideNav'],
      async mount({ element }: AppMountParameters) {
        const [coreStart] = await core.getStartServices();
        const { renderApp } = await import('./app');
        return renderApp(coreStart, element);
      },
    });
  }

  public start(_core: CoreStart) {}

  public stop() {}
}
