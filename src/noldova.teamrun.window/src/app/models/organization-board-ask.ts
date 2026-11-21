/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Teammate } from "@noldova/teamrun.protocol";

import { TeammateStatus } from "../enums/teammate-status";

export class OrganizationBoardAsk {
  private static readonly order: Readonly<Record<TeammateStatus, number>> = {
    [TeammateStatus.WaitingForYou]: 0,
    [TeammateStatus.Stopped]: 1,
    [TeammateStatus.UsageLimit]: 2,
    [TeammateStatus.Working]: 3,
    [TeammateStatus.Idle]: 4
  };

  public readonly teammate: Teammate;
  public readonly department: string;
  public readonly status: TeammateStatus;

  public constructor(teammate: Teammate, department: string, status: TeammateStatus) {
    this.teammate = teammate;
    this.department = department;
    this.status = status;
  }

  public get isAnswer(): boolean {
    return this.status === TeammateStatus.WaitingForYou;
  }

  public static needsYou(status: TeammateStatus): boolean {
    return OrganizationBoardAsk.order[status] < OrganizationBoardAsk.order[TeammateStatus.Working];
  }

  public static byStatus<T>(items: readonly T[], statusOf: (item: T) => TeammateStatus): readonly T[] {
    return [...items].sort((a, b) => OrganizationBoardAsk.order[statusOf(a)] - OrganizationBoardAsk.order[statusOf(b)]);
  }
}
