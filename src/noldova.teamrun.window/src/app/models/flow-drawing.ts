/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

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
}
