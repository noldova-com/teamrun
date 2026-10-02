/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, DiscoveredTestClassOptions, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class DiscoveredTestClassOptionsTests {
  @TestMethod
  public leavesEveryOptionAbsentByDefault(): void {
    const options = new DiscoveredTestClassOptions();

    Assert.isUndefined(options.skipReason);
    Assert.areEqual(0, options.categories.length);
  }

  @TestMethod
  public carriesTheSkipReason(): void {
    Assert.areEqual<string | undefined>("pending", new DiscoveredTestClassOptions({ skipReason: "pending" }).skipReason);
  }

  @TestMethod
  public carriesDistinctCopiedCategories(): void {
    const categories = ["first", "second", "first"];
    const options = new DiscoveredTestClassOptions({ categories });
    categories[0] = "changed";

    Assert.areEqual(2, options.categories.length);
    Assert.areEqual<string | undefined>("first", options.categories[0]);
    Assert.areEqual<string | undefined>("second", options.categories[1]);
  }

  @TestMethod
  public rejectsAnEmptySkipReason(): void {
    Assert.throws(() => new DiscoveredTestClassOptions({ skipReason: " " }), ArgumentException);
  }

  @TestMethod
  public rejectsAnInvalidCategory(): void {
    Assert.throws(() => new DiscoveredTestClassOptions({ categories: [" "] }), ArgumentException);
  }
}
