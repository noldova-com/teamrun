/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { OrganizationFlow } from "./organization-flow";
import type { FlowRoute } from "./flow-route";

export class FlowDrawing {
  public readonly flow: OrganizationFlow;
  public readonly route: FlowRoute;

  public constructor(flow: OrganizationFlow, route: FlowRoute) {
    this.flow = flow;
    this.route = route;
  }

  public get offsetPath(): string {
    return `path("${this.route.path}")`;
  }

  public get key(): string {
    const box = this.route.target;
    const at = Object.isNull(box) ? "" : ` ${box.left} ${box.top} ${box.width} ${box.height}`;
    return `${this.flow.id} ${this.flow.stage} ${this.route.path}${at}`;
  }

  public static sameAll(drawings: readonly FlowDrawing[], others: readonly FlowDrawing[]): boolean {
    return drawings.map(t => t.key).join(" | ") === others.map(t => t.key).join(" | ");
  }
}
