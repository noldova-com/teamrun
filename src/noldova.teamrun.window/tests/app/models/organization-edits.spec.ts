/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { OrganizationEdits } from "../../../src/app/models/organization-edits";

describe("OrganizationEdits", () => {
  const renamed = async (typed: string, isAccepted: boolean): Promise<[string, readonly string[]]> => {
    const field = document.createElement("input");
    const asked: string[] = [];
    field.value = typed;
    const event = new Event("change");
    Object.defineProperty(event, "target", { value: field });
    await OrganizationEdits.renameAsync(event, "Ops", async name => {
      asked.push(name);
      return isAccepted;
    });
    return [field.value, asked];
  };

  it("renames to the trimmed name and keeps it once the rename is accepted", async () => {
    expect(await renamed("  Build  ", true)).toEqual(["  Build  ", ["Build"]]);
  });

  it("puts the stored name back on an emptied or refused rename", async () => {
    expect([await renamed("   ", true), await renamed("Build", false)]).toEqual([["Ops", []], ["Ops", ["Build"]]]);
  });

  it("asks nothing for the stored name or for another element's event", async () => {
    const asked: string[] = [];
    const event = new Event("change");
    Object.defineProperty(event, "target", { value: document.createElement("div") });
    await OrganizationEdits.renameAsync(event, "Ops", async name => {
      asked.push(name);
      return true;
    });

    expect([await renamed(" Ops ", true), asked]).toEqual([[" Ops ", []], []]);
  });
});
