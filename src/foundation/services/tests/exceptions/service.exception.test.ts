/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, Exception, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { ServiceException, ServiceResponseInfo } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class ServiceExceptionTests {
  @TestMethod
  public carriesItsInfoAndTheCause(): void {
    const cause = new Error("root");
    const exception = new ServiceException("notFound", "The project \"p\" does not exist.", ["p"], new ExceptionOptions(cause));

    Assert.isInstanceOf(exception, Exception);
    Assert.isInstanceOf(exception.info, ServiceResponseInfo);
    Assert.areEqual("notFound", exception.info.name);
    Assert.areEqual("The project \"p\" does not exist.", exception.message);
    Assert.areEqual("p", exception.info.arguments.join(","));
    Assert.areEqual(cause, exception.cause);
    Assert.areEqual(0, new ServiceException("internal", "Something failed.").info.arguments.length);
  }

  @TestMethod
  public rejectsABlankName(): void {
    Assert.throws(() => new ServiceException(" ", "text"), ArgumentException);
  }
}
