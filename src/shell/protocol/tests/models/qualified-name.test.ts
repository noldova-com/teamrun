/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { QualifiedName } from "@noldova/teamrun-shell-protocol";

@TestClass
export class QualifiedNameTests {
  @TestMethod
  @TestData("shell.handshake", "shell", "handshake", true)
  @TestData("checkpoints.capture", "checkpoints", "capture", false)
  @TestData("work-items.listOpen2", "work-items", "listOpen2", false)
  public parsesAValidName(text: string, owner: string, member: string, isShell: boolean): void {
    const name = QualifiedName.parse(text);

    Assert.areEqual(owner, name.owner);
    Assert.areEqual(member, name.member);
    Assert.areEqual(text, name.text);
    Assert.areEqual(text, name.toString());
    Assert.areEqual(isShell, name.isShell);
  }

  @TestMethod
  @TestData("shell")
  @TestData(".handshake")
  @TestData("shell.")
  @TestData("Shell.handshake")
  @TestData("shell.Handshake")
  @TestData("shell.hand-shake")
  @TestData("shell.handshake.extra")
  @TestData("1st.handshake")
  @TestData("work--items.list")
  @TestData("work-items-.list")
  @TestData("shell.hand shake")
  public rejectsAnInvalidName(text: string): void {
    const failure = Assert.throws(() => QualifiedName.parse(text, "method"), ArgumentException);

    Assert.areEqual("method", failure.parameterName);
  }

  @TestMethod
  public reportsTheNameParameterByDefault(): void {
    Assert.areEqual("name", Assert.throws(() => new QualifiedName("shell", "Bad"), ArgumentException).parameterName);
    Assert.areEqual("text", Assert.throws(() => QualifiedName.parse("bad"), ArgumentException).parameterName);
  }

  @TestMethod
  public comparesByText(): void {
    Assert.isTrue(new QualifiedName("shell", "handshake").equals(QualifiedName.parse("shell.handshake")));
    Assert.isFalse(new QualifiedName("shell", "handshake").equals(QualifiedName.parse("shell.cancel")));
  }
}
