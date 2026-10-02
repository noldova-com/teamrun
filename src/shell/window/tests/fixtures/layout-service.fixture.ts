/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import type { Layout } from "../../src/app/models/layout/layout";
import type { ViewRegistry } from "../../src/app/models/layout/view-registry";
import { LayoutStoreService } from "../../src/app/services/layout-store.service";
import { LayoutService } from "../../src/app/services/layout.service";

export class LayoutServiceFixture {
  public static async prepareAsync(registry: ViewRegistry, layout: Layout, width: number = 120, height: number = 60): Promise<LayoutService> {
    const service = TestBed.inject(LayoutService);
    service.setRegistry(registry);
    await TestBed.inject(LayoutStoreService).writeAsync(layout.toJson());
    await service.loadAsync();
    service.setViewport(width, height);
    return service;
  }
}
