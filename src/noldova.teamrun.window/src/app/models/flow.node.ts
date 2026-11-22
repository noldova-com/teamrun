/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { FlowBox } from "./flow-box";
import type { FlowPoint } from "./flow-point";

export class FlowNode {
  public readonly key: string;
  public readonly parentKey: string | null;
  public readonly box: FlowBox;
  public readonly uplink: readonly FlowPoint[];

  public constructor(key: string, parentKey: string | null, box: FlowBox, uplink: readonly FlowPoint[]) {
    this.key = key;
    this.parentKey = parentKey;
    this.box = box;
    this.uplink = uplink;
  }
}
