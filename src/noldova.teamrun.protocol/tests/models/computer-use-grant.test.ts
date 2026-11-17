/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ComputerUseGrant } from "@noldova/teamrun.protocol";

@TestClass
export class ComputerUseGrantTests {
  private static readonly json: object = {
    id: "grant-1", chatId: "conv-1", chatTitle: "Release notes", teammateName: "Reviewer", app: "com.example.notes",
    appName: "Notes", appIcon: "iVBORw0KGgo=", grantedAt: "2026-10-29T10:00:00.000Z"
  };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ComputerUseGrant.fromJson(ComputerUseGrantTests.json);

    Assert.areEqual(JSON.stringify(ComputerUseGrantTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public roundTripsTheScreensGrantWithoutChatTitleOrTeammate(): void {
    const json = { ...ComputerUseGrantTests.json, chatTitle: null, teammateName: null, app: null, appName: null, appIcon: null };

    Assert.areEqual(JSON.stringify(json), JSON.stringify(ComputerUseGrant.fromJson(json).toJson()));
  }

  @TestMethod
  public rejectsBlankArguments(): void {
    const at = "2026-10-29T10:00:00.000Z";

    Assert.throws(() => new ComputerUseGrant(String.empty, "conv-1", null, null, "com.example.notes", null, null, at), ArgumentException);
    Assert.throws(() => new ComputerUseGrant("grant-1", " ", null, null, "com.example.notes", null, null, at), ArgumentException);
    Assert.throws(() => new ComputerUseGrant("grant-1", "conv-1", null, null, " ", null, null, at), ArgumentException);
    Assert.throws(() => new ComputerUseGrant("grant-1", "conv-1", null, null, "com.example.notes", " ", null, at), ArgumentException);
    Assert.throws(() => new ComputerUseGrant("grant-1", "conv-1", null, null, "com.example.notes", null, String.empty, at), ArgumentException);
    Assert.throws(() => new ComputerUseGrant("grant-1", "conv-1", null, null, "com.example.notes", null, null, String.empty), ArgumentException);
  }

  @TestMethod
  public keepsAnAppWhoseNameAndIconCouldNotBeRead(): void {
    const grant = new ComputerUseGrant("grant-1", "conv-1", null, null, "com.example.notes", null, null, "2026-10-29T10:00:00.000Z");

    Assert.isNull(grant.appName);
    Assert.isNull(grant.appIcon);
  }

  @TestMethod
  public rejectsTheScreensGrantWithAnAppNameOrIcon(): void {
    const at = "2026-10-29T10:00:00.000Z";

    const named = Assert.throws(() => new ComputerUseGrant("grant-1", "conv-1", null, null, null, "Notes", null, at), ArgumentException);
    Assert.throws(() => new ComputerUseGrant("grant-1", "conv-1", null, null, null, null, "iVBORw0KGgo=", at), ArgumentException);

    Assert.areEqual("app", named.parameterName);
    Assert.isTrue(named.message.startsWith("The screen's grant names no app, so it has no app name or icon."), named.message);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => ComputerUseGrant.fromJson({ ...ComputerUseGrantTests.json, app: 3 }), JsonException);
    const icon = Assert.throws(() => ComputerUseGrant.fromJson({ ...ComputerUseGrantTests.json, appIcon: 3 }), JsonException);

    Assert.areEqual("$.app", exception.path);
    Assert.areEqual("$.appIcon", icon.path);
  }
}
