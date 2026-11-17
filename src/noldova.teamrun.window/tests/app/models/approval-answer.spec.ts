/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PermissionStatus } from "@noldova/ui.components.angular";

import { ApprovalAnswer } from "../../../src/app/models/approval-answer";

describe("ApprovalAnswer", () => {
  it("is sending when chosen and keeps its option and time when it fails", () => {
    const answeredAt = new Date("2026-09-10T08:00:00.000Z");
    const sending = ApprovalAnswer.sending("yes", answeredAt);
    answeredAt.setUTCHours(9);

    const failed = sending.failed();

    expect([sending.optionId, sending.status, sending.answeredAt.toISOString()]).toEqual(["yes", PermissionStatus.Sending, "2026-09-10T08:00:00.000Z"]);
    expect([failed.optionId, failed.status, failed.answeredAt.toISOString()]).toEqual(["yes", PermissionStatus.SendFailed, "2026-09-10T08:00:00.000Z"]);
  });
});
