/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { OrganizationFlowStage } from "../enums/organization-flow-stage";

export class OrganizationFlow {
  public readonly id: string;
  public readonly fromKey: string;
  public readonly toKey: string;
  public readonly stage: OrganizationFlowStage;

  public constructor(id: string, fromKey: string, toKey: string, stage: OrganizationFlowStage) {
    this.id = id;
    this.fromKey = fromKey;
    this.toKey = toKey;
    this.stage = stage;
  }

  public get isMoving(): boolean {
    return this.stage === OrganizationFlowStage.Writing || this.stage === OrganizationFlowStage.Sent;
  }

  public withStage(stage: OrganizationFlowStage): OrganizationFlow {
    return new OrganizationFlow(this.id, this.fromKey, this.toKey, stage);
  }
}
