/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { BuildIdentity, FrameReader, QualifiedName } from "@noldova/teamrun-shell-protocol";

@TestClass
export class ResourcesTests {
  @TestMethod
  public stampsTheRootManifestsProtocolVersion(): void {
    Assert.areEqual(1, BuildIdentity.supportedProtocolVersion);
  }

  @TestMethod
  public usesTheCanonicalNameMessage(): void {
    const failure = Assert.throws(() => QualifiedName.parse("shell"), ArgumentException);

    Assert.areEqual(
      "A name must be an owner, a dot and a member, such as \"shell.handshake\": the owner is \"shell\" or a module id in lowercase kebab-case, and the member starts with a lowercase letter followed by letters and digits. (Parameter 'text')",
      failure.message);
  }

  @TestMethod
  public usesTheCanonicalFrameMessage(): void {
    const failure = Assert.throws(() => new FrameReader(4).read("12345"), Error);

    Assert.areEqual("A frame exceeds the maximum length of 4 characters.", failure.message);
  }
}
