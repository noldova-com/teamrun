/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CoreException, GuidFormatException, Resources } from "@noldova/teamrun.core";

@TestClass
export class GuidFormatExceptionTests {
  @TestMethod
  public carriesItsNameAndSaysWhichFormAGuidTakes(): void {
    const exception = new GuidFormatException();

    Assert.isInstanceOf(exception, CoreException);
    Assert.areEqual("GuidFormatException", exception.name);
    Assert.areEqual("The text is not a Guid in the hyphenated form of thirty-two hexadecimal digits.", exception.message);
    Assert.areEqual("GuidFormatException", Resources.formatFailureKind(exception));
  }
}
