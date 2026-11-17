/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ConfirmRequest } from "../../../src/app/models/confirm-request";

describe("ConfirmRequest", () => {
  it("keeps the question's title, text and the label of its confirm button", () => {
    const request = new ConfirmRequest("Forget project", "\"repo\" is removed from TeamRun.", "Forget");

    expect([request.title, request.text, request.confirmLabel]).toEqual(["Forget project", "\"repo\" is removed from TeamRun.", "Forget"]);
  });

  it("is in the danger look only when it says it is destructive", () => {
    const plain = new ConfirmRequest("Move chat", "Its 2 files are copied.", "Move", "Move to a folder…");
    const destructive = new ConfirmRequest("Delete chat", "\"First\" is removed.", "Delete", null, true);

    expect([plain.danger, destructive.danger, destructive.otherLabel]).toEqual([false, true, null]);
  });
});
