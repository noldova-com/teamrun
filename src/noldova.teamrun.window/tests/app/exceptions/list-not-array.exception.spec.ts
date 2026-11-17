/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ListNotArrayException } from "../../../src/app/exceptions/list-not-array.exception";
import { Resources } from "../../../src/resources";

describe("ListNotArrayException", () => {
  it("carries its name, the kind of value it got and a message naming the kind", () => {
    const exception = new ListNotArrayException("string");

    expect(exception.name).toBe("ListNotArrayException");
    expect(exception.kind).toBe("string");
    expect(exception.message).toBe("The runtime part answered a list with a value of kind string, which isn't a list.");
  });

  it("names a null answer by its own kind rather than object", () => {
    expect([Resources.formatValueKind(null), Resources.formatValueKind({}), Resources.formatValueKind(3)]).toEqual(["null", "object", "number"]);
  });
});
