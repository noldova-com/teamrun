/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { BuildIdentity } from "@noldova/teamrun-shell-protocol";
import { BuildComparer, BuildRelation } from "@noldova/teamrun-shell-runtime";

@TestClass
export class BuildComparerTests {
  @TestMethod
  public comparesVersionsPartByPartAsNumbers(): void {
    Assert.areEqual(BuildRelation.Newer, BuildComparer.compare(BuildComparerTests.create("1.10.0"), BuildComparerTests.create("1.9.0")));
    Assert.areEqual(BuildRelation.Older, BuildComparer.compare(BuildComparerTests.create("1.9.9"), BuildComparerTests.create("1.10.0")));
    Assert.areEqual(BuildRelation.Older, BuildComparer.compare(BuildComparerTests.create("0.0.0"), BuildComparerTests.create("999999999.0.0")));
    Assert.areEqual(BuildRelation.Newer, BuildComparer.compare(BuildComparerTests.create("2.0.0"), BuildComparerTests.create("1.999.999")));
  }

  @TestMethod
  public theSameVersionIsTheSameWhateverTheFingerprint(): void {
    Assert.areEqual(BuildRelation.SameVersion, BuildComparer.compare(BuildComparerTests.create("1.2.3", "a"), BuildComparerTests.create("1.2.3", "b")));
  }

  @TestMethod
  public rejectsAVersionThatIsNotMajorMinorPatch(): void {
    for (const version of ["1.2", "1.2.3.4", "01.2.3", "1.2.3-beta", "1000000000.0.0", "__VERSION__"]) {
      const exception = Assert.throws(() => BuildComparer.compare(BuildComparerTests.create("1.0.0"), BuildComparerTests.create(version)), ArgumentException, version);
      Assert.areEqual(`"${version}" is not a product version of the form major.minor.patch. (Parameter 'productVersion')`, exception.message);
    }
    Assert.throws(() => BuildComparer.compare(BuildComparerTests.create("1.0"), BuildComparerTests.create("1.0.0")), ArgumentException);
  }

  private static create(productVersion: string, fingerprint: string = "fingerprint"): BuildIdentity {
    return new BuildIdentity(productVersion, BuildIdentity.supportedProtocolVersion, fingerprint);
  }
}
