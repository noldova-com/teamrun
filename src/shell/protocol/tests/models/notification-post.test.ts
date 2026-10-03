/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CommandRun, NotificationAction, NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/teamrun-shell-protocol";

@TestClass
export class NotificationPostTests {
  private static readonly KIND: QualifiedName = QualifiedName.parse("clock.alarm");
  private static readonly TICK: CommandRun = new CommandRun(QualifiedName.parse("clock.tick"), null);

  @TestMethod
  public pinsItsWireFormWithEveryField(): void {
    const text = "{\"kind\":\"clock.alarm\",\"key\":\"morning\",\"title\":\"Alarm\",\"text\":\"It is time.\",\"severity\":\"Warning\","
      + "\"open\":{\"name\":\"clock.tick\",\"arguments\":null},\"actions\":[{\"title\":\"Snooze\",\"command\":{\"name\":\"clock.tick\",\"arguments\":5}}],"
      + "\"progress\":0.5}";

    const post = NotificationPost.fromJson(JSON.parse(text));

    Assert.areEqual(["clock.alarm", "morning", "Alarm", "It is time.", NotificationSeverity.Warning, "clock.tick", 1, 0.5].join("|"),
      [post.kind.text, post.key, post.title, post.text, post.severity, post.open?.name.text, post.actions.length, post.progress].join("|"));
    Assert.areEqual(text, JSON.stringify(post.toJson()));
  }

  @TestMethod
  public leavesOutWhatIsNotSetAndReadsIndeterminateProgress(): void {
    const post = new NotificationPost(NotificationPostTests.KIND, null, "Alarm", null, NotificationSeverity.Info, null, [], NotificationPost.indeterminate);

    Assert.areEqual("{\"kind\":\"clock.alarm\",\"title\":\"Alarm\",\"severity\":\"Info\",\"actions\":[],\"progress\":\"indeterminate\"}", JSON.stringify(post.toJson()));
    Assert.areEqual(String(NotificationPost.indeterminate), String(NotificationPost.fromJson(post.toJson()).progress));
    Assert.isNull(NotificationPost.fromJson({ kind: "clock.alarm", title: "Alarm", severity: "Info", actions: [] }).progress);
    Assert.areEqual(2, NotificationPost.maximumActions);
  }

  @TestMethod
  public refusesBlankTextsTooManyActionsAndProgressOutsideItsRange(): void {
    const create = (key: string | null, title: string, text: string | null, actions: number, progress: number | null): NotificationPost => new NotificationPost(
      NotificationPostTests.KIND, key, title, text, NotificationSeverity.Error, null,
      Array.from({ length: actions }, () => new NotificationAction("Run", NotificationPostTests.TICK)), progress);

    Assert.areEqual(
      ["key", "title", "text", "actions", "progress", "progress", "progress"].join(","),
      [
        () => create(" ", "Alarm", null, 0, null),
        () => create(null, "", null, 0, null),
        () => create(null, "Alarm", " ", 0, null),
        () => create(null, "Alarm", null, 3, null),
        () => create(null, "Alarm", null, 0, -0.1),
        () => create(null, "Alarm", null, 0, 1.5),
        () => create(null, "Alarm", null, 0, Number.NaN)
      ].map(t => Assert.throws(t, ArgumentException).parameterName).join(","));
    Assert.areEqual(1, create(null, "Alarm", null, 2, 1).progress);
  }

  @TestMethod
  public refusesUnknownFieldsUnknownSeveritiesAndOtherProgressText(): void {
    const valid = { kind: "clock.alarm", title: "Alarm", severity: "Info", actions: [] };

    Assert.areEqual("$.extra", Assert.throws(() => NotificationPost.fromJson({ ...valid, extra: 1 }), JsonException).path);
    Assert.areEqual("$.severity", Assert.throws(() => NotificationPost.fromJson({ ...valid, severity: "Fatal" }), JsonException).path);
    Assert.areEqual("$.progress", Assert.throws(() => NotificationPost.fromJson({ ...valid, progress: "half" }), JsonException).path);
    Assert.areEqual("$.actions.0.title", Assert.throws(() => NotificationPost.fromJson({ ...valid, actions: [{ command: { name: "clock.tick", arguments: null } }] }), JsonException).path);
    Assert.areEqual("$.open.arguments", Assert.throws(() => NotificationPost.fromJson({ ...valid, open: { name: "clock.tick" } }), JsonException).path);
  }
}
