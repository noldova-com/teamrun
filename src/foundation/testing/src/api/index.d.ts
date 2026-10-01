/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { Exception, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

/**
 * Creates a decorator that adds a category name to a test class or method.
 * Method categories combine with the categories of their test class. A
 * category selects tests through a `category:name` filter; it does not change
 * execution order.
 *
 * @param name The category name; it must contain a non-whitespace character.
 * The decorator may be repeated to add several names.
 * @returns The decorator to apply to the test class or method.
 * @throws ArgumentException synchronously when the name is empty or whitespace
 * only.
 */
export declare function Category(name: string): (value: Function) => void;

/**
 * Marks a class as a test class. Discovery accepts only exported classes that
 * carry this mark and whose name ends in `Tests`.
 *
 * @param value The decorated class.
 */
export declare function TestClass(value: Function): void;

/**
 * Creates a decorator that adds one row of arguments to a test method. Each
 * row runs, is timed and is reported as its own test, in the order written.
 *
 * @param values The arguments passed to the test method for this row; at
 * least one, matching the method's parameters.
 * @returns The decorator to apply to the test method.
 */
export declare function TestData<TArguments extends unknown[]>(...values: TArguments): (value: (...testArguments: TArguments) => unknown) => void;

/**
 * Marks a public instance method of a test class as a test.
 *
 * @param value The decorated method.
 */
export declare function TestMethod(value: Function): void;

/**
 * Creates a decorator that skips a test class or method. The reason is
 * reported with each skipped result.
 *
 * @param reason Why the tests are skipped; it must contain a non-whitespace
 * character.
 * @returns The decorator to apply to the test class or method.
 * @throws ArgumentException synchronously when the reason is empty or
 * whitespace only.
 */
export declare function Skip(reason: string): (value: Function) => void;

/**
 * The exception thrown when an assertion fails. It carries the expected and
 * actual values beside the message.
 */
export declare class AssertFailedException extends TestingException {
  /**
   * The value the assertion expected, or `undefined` when it compares none.
   */
  public readonly expected: unknown;

  /**
   * The value the assertion observed, or `undefined` when it compares none.
   */
  public readonly actual: unknown;

  /**
   * Creates the exception.
   *
   * @param message What failed; the canonical assertion-failure text when
   * omitted.
   * @param expected The value the assertion expected.
   * @param actual The value the assertion observed.
   * @param options The preceding failure, if any.
   */
  public constructor(message?: string, expected?: unknown, actual?: unknown, options?: ExceptionOptions);
}

/**
 * The base exception of the testing package. It is thrown directly when
 * discovery or execution finds a violation of the testing contract.
 */
export declare class TestingException extends Exception {
  /**
   * Creates the exception.
   *
   * @param message The violation.
   * @param options The preceding failure, if any.
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception that fails a test which did not settle within its time
 * limit. A run that records it ends after reporting it.
 */
export declare class TestTimeoutException extends TestingException {
  /**
   * The time limit that elapsed, in milliseconds.
   */
  public readonly timeoutMilliseconds: number;

  /**
   * Creates the exception.
   *
   * @param timeoutMilliseconds The time limit that elapsed, in milliseconds;
   * a positive integer.
   * @param options The preceding failure, if any.
   * @throws ArgumentOutOfRangeException synchronously when the time limit is
   * not a positive integer.
   */
  public constructor(timeoutMilliseconds: number, options?: ExceptionOptions);
}

/**
 * The assertions tests use. Every failed assertion throws
 * `AssertFailedException`.
 */
export declare class Assert {
  /**
   * Requires a true condition.
   *
   * @param condition The condition to check; a passing call narrows it.
   * @param message The failure message; the assertion's canonical text
   * when omitted.
   * @throws AssertFailedException synchronously when the condition is false.
   */
  public static isTrue(condition: boolean, message?: string): asserts condition;

  /**
   * Requires a false condition.
   *
   * @param condition The condition to check; a passing call narrows it to
   * `false`.
   * @param message The failure message; the assertion's canonical text
   * when omitted.
   * @throws AssertFailedException synchronously when the condition is true.
   */
  public static isFalse(condition: boolean, message?: string): asserts condition is false;

  /**
   * Requires two values to be the same by SameValue comparison, so `NaN`
   * equals `NaN` and `0` differs from `-0`.
   *
   * @param expected The expected value.
   * @param actual The observed value.
   * @param message The failure message; the assertion's canonical text
   * when omitted.
   * @throws AssertFailedException synchronously when the values differ,
   * carrying both.
   */
  public static areEqual<T>(expected: T, actual: T, message?: string): void;

  /**
   * Requires two values to differ by SameValue comparison.
   *
   * @param notExpected The value the observed value must not be.
   * @param actual The observed value.
   * @param message The failure message; the assertion's canonical text
   * when omitted.
   * @throws AssertFailedException synchronously when the values are the same.
   */
  public static areNotEqual<T>(notExpected: T, actual: T, message?: string): void;

  /**
   * Requires `null`.
   *
   * @param value The value to check; a passing call narrows it to `null`.
   * @param message The failure message; the assertion's canonical text
   * when omitted.
   * @throws AssertFailedException synchronously for any other value.
   */
  public static isNull(value: unknown, message?: string): asserts value is null;

  /**
   * Requires a value other than `null`.
   *
   * @param value The value to check; a passing call removes `null` from its
   * type.
   * @param message The failure message; the assertion's canonical text
   * when omitted.
   * @throws AssertFailedException synchronously when the value is `null`.
   */
  public static isNotNull<T>(value: T, message?: string): asserts value is Exclude<T, null>;

  /**
   * Requires `undefined`.
   *
   * @param value The value to check; a passing call narrows it to
   * `undefined`.
   * @param message The failure message; the assertion's canonical text
   * when omitted.
   * @throws AssertFailedException synchronously for any other value.
   */
  public static isUndefined(value: unknown, message?: string): asserts value is undefined;

  /**
   * Requires a value other than `undefined`.
   *
   * @param value The value to check; a passing call removes `undefined` from
   * its type.
   * @param message The failure message; the assertion's canonical text
   * when omitted.
   * @throws AssertFailedException synchronously when the value is
   * `undefined`.
   */
  public static isDefined<T>(value: T, message?: string): asserts value is Exclude<T, undefined>;

  /**
   * Requires an instance of a type.
   *
   * @param value The value to check; a passing call narrows it to the type.
   * @param type The class the value must be an instance of.
   * @param message The failure message; the assertion's canonical text
   * when omitted.
   * @throws AssertFailedException synchronously when the value is not an
   * instance of the type.
   */
  public static isInstanceOf<T>(value: unknown, type: Function & { readonly prototype: T }, message?: string): asserts value is T;

  /**
   * Requires an action to throw an instance of an exception type.
   *
   * @param action The action to run once, synchronously.
   * @param exceptionType The class the thrown value must be an instance of.
   * @param message The failure message; the assertion's canonical text
   * when omitted.
   * @returns The thrown exception, for further assertions.
   * @throws AssertFailedException synchronously when the action throws
   * nothing or throws something else.
   */
  public static throws<TException extends Error>(
    action: () => void,
    exceptionType: Function & (abstract new (...arguments_: never[]) => TException),
    message?: string): TException;

  /**
   * Requires an asynchronous action to reject with an instance of an
   * exception type.
   *
   * @param action The action to run once and await.
   * @param exceptionType The class the rejection must be an instance of.
   * @param message The failure message; the assertion's canonical text
   * when omitted.
   * @returns A promise of the rejection, for further assertions.
   * @throws AssertFailedException as a rejection when the action resolves or
   * rejects with something else.
   */
  public static throwsAsync<TException extends Error>(
    action: () => Promise<unknown>,
    exceptionType: Function & (abstract new (...arguments_: never[]) => TException),
    message?: string): Promise<TException>;

  /**
   * Requires an action not to throw.
   *
   * @param action The action to run once, synchronously.
   * @param message The failure message; the assertion's canonical text
   * when omitted.
   * @throws AssertFailedException synchronously when the action throws,
   * carrying the thrown value as `actual`.
   */
  public static doesNotThrow(action: () => void, message?: string): void;

  /**
   * Fails unconditionally.
   *
   * @param message Why the test fails; the canonical assertion-failure
   * text when omitted.
   * @returns Never; it always throws.
   * @throws AssertFailedException synchronously, always.
   */
  public static fail(message?: string): never;
}

/**
 * The outcome of one test.
 */
export declare enum TestOutcome {
  /**
   * The test ran without a failure.
   */
  Passed = "Passed",

  /**
   * The test ran and failed, or exceeded its time limit.
   */
  Failed = "Failed",

  /**
   * The test did not run because it carries a skip reason.
   */
  Skipped = "Skipped",

  /**
   * The test did not run because an earlier test exceeded its time limit and
   * ended the run.
   */
  Unreached = "Unreached"
}

/**
 * The immutable result of one test. The constructor rejects contradictory
 * outcome, failure, skip and test-data states.
 */
export declare class TestMethodResult {
  /**
   * The package the test belongs to.
   */
  public readonly packageName: string;

  /**
   * The test class name.
   */
  public readonly className: string;

  /**
   * The test method name.
   */
  public readonly methodName: string;

  /**
   * The zero-based index of the test-data row, or `undefined` for a method
   * without test data.
   */
  public readonly testDataIndex: number | undefined;

  /**
   * The arguments of this row; empty for a method without test data.
   */
  public readonly testData: readonly unknown[];

  /**
   * The outcome.
   */
  public readonly outcome: TestOutcome;

  /**
   * How long the test ran, in milliseconds; zero for a test that did not run.
   */
  public readonly durationMilliseconds: number;

  /**
   * What the test threw when it failed; `undefined` for every other outcome.
   */
  public readonly failure: unknown;

  /**
   * The skip reason of a skipped test; `undefined` for every other outcome.
   */
  public readonly skipReason: string | undefined;

  /**
   * `ClassName.methodName`, followed by `[index]` for a test-data row.
   */
  public readonly displayName: string;

  /**
   * Creates the result.
   *
   * @param packageName The package the test belongs to; not whitespace only.
   * @param className The test class name; not whitespace only.
   * @param methodName The test method name; not whitespace only.
   * @param testDataIndex The test-data row index, a non-negative integer, or
   * `undefined` when the method has no test data.
   * @param testData The row's arguments: non-empty with an index, empty
   * without one. The result keeps its own copy.
   * @param outcome The outcome.
   * @param durationMilliseconds How long the test ran; a finite, non-negative
   * number of milliseconds.
   * @param failure What the test threw; only for a failed outcome.
   * @param skipReason The skip reason; required for a skipped outcome and
   * absent otherwise.
   * @throws ArgumentException synchronously for an empty name, a mismatched
   * index and data, a failure or skip reason the outcome cannot carry, or a
   * skipped outcome without a reason.
   * @throws ArgumentOutOfRangeException synchronously for a negative or
   * fractional index or an invalid duration.
   */
  public constructor(
    packageName: string,
    className: string,
    methodName: string,
    testDataIndex: number | undefined,
    testData: readonly unknown[],
    outcome: TestOutcome,
    durationMilliseconds: number,
    failure: unknown,
    skipReason: string | undefined);
}

/**
 * The immutable results of one test class.
 */
export declare class TestClassResult {
  /**
   * The package every contained result belongs to.
   */
  public readonly packageName: string;

  /**
   * The test class name.
   */
  public readonly className: string;

  /**
   * The compiled test file's path relative to its test project, with `/`
   * separators.
   */
  public readonly filePath: string;

  /**
   * The results of the class's tests, in execution order.
   */
  public readonly methodResults: readonly TestMethodResult[];

  /**
   * Creates the result.
   *
   * @param packageName The package; not whitespace only.
   * @param className The test class name; not whitespace only.
   * @param filePath The compiled test file's relative path; not whitespace
   * only.
   * @param methodResults The results of the class's tests; at least one, each
   * with this package and class. The result keeps its own copy.
   * @throws ArgumentException synchronously for an empty name or path, no
   * results, or a result of another package or class.
   */
  public constructor(packageName: string, className: string, filePath: string, methodResults: readonly TestMethodResult[]);
}

/**
 * The immutable result of a run, with totals that reconcile with the
 * selected tests.
 */
export declare class TestRunResult {
  /**
   * The class results, in execution order.
   */
  public readonly classResults: readonly TestClassResult[];

  /**
   * The summed duration of every test, in milliseconds.
   */
  public readonly durationMilliseconds: number;

  /**
   * How many tests passed.
   */
  public readonly passed: number;

  /**
   * How many tests failed, including one that exceeded its time limit.
   */
  public readonly failed: number;

  /**
   * How many tests were skipped.
   */
  public readonly skipped: number;

  /**
   * How many tests did not run because the run ended early.
   */
  public readonly unreached: number;

  /**
   * True when a test exceeded its time limit, so the run ended after it.
   */
  public readonly isInterrupted: boolean;

  /**
   * How many tests ran: passed plus failed.
   */
  public readonly executed: number;

  /**
   * Every selected test: executed, skipped and unreached.
   */
  public readonly total: number;

  /**
   * Creates the result and computes its totals.
   *
   * @param classResults The class results, in execution order. The result
   * keeps its own copy.
   */
  public constructor(classResults: readonly TestClassResult[]);
}

/**
 * One test discovered in a test class: a method, or one test-data row of it.
 */
export declare class DiscoveredTestMethod {
  /**
   * The marked instance method's name.
   */
  public readonly methodName: string;

  /**
   * The zero-based index of the test-data row, or `undefined` for a method
   * without test data.
   */
  public readonly testDataIndex: number | undefined;

  /**
   * The arguments of this row; empty for a method without test data.
   */
  public readonly testData: readonly unknown[];

  /**
   * The method's skip reason, or `undefined` when the method is not skipped.
   */
  public readonly skipReason: string | undefined;

  /**
   * The distinct category names of the method and its test class, in written
   * order.
   */
  public readonly categories: readonly string[];

  /**
   * The method name, followed by `[index]` for a test-data row.
   */
  public readonly displayName: string;

  /**
   * Creates the discovered test.
   *
   * @param methodName The method name; not whitespace only.
   * @param testDataIndex The test-data row index, a non-negative integer, or
   * `undefined` when the method has no test data.
   * @param testData The row's arguments: non-empty with an index, empty
   * without one.
   * @param skipReason The skip reason, not whitespace only, or `undefined`.
   * @param categories The category names, each not whitespace only; none by
   * default.
   * @throws ArgumentException synchronously for an empty name, reason or
   * category, or a mismatched index and data.
   * @throws ArgumentOutOfRangeException synchronously for a negative or
   * fractional index.
   */
  public constructor(
    methodName: string,
    testDataIndex: number | undefined,
    testData: readonly unknown[],
    skipReason: string | undefined,
    categories?: readonly string[]);
}

/**
 * One discovered test class, with the constructor that creates its
 * instances and its tests.
 */
export declare class DiscoveredTestClass {
  /**
   * The package the class belongs to.
   */
  public readonly packageName: string;

  /**
   * The exported class name.
   */
  public readonly className: string;

  /**
   * The compiled test file's path relative to its test project, with `/`
   * separators.
   */
  public readonly filePath: string;

  /**
   * The constructor that creates a fresh instance for each test.
   */
  public readonly testClassConstructor: new () => object;

  /**
   * The class's skip reason, or `undefined` when the class is not skipped.
   */
  public readonly skipReason: string | undefined;

  /**
   * The class's tests, in method and test-data order.
   */
  public readonly methods: readonly DiscoveredTestMethod[];

  /**
   * The distinct category names of the class, in written order.
   */
  public readonly categories: readonly string[];

  /**
   * Creates the discovered class.
   *
   * @param packageName The package; not whitespace only.
   * @param className The class name; not whitespace only.
   * @param filePath The compiled test file's relative path; not whitespace
   * only.
   * @param testClassConstructor The constructor that creates the class's
   * instances.
   * @param skipReason The skip reason, not whitespace only, or `undefined`.
   * @param methods The class's tests; at least one. The class keeps its own
   * copy.
   * @param categories The category names, each not whitespace only; none by
   * default.
   * @throws ArgumentException synchronously for an empty name, path, reason
   * or category, or no tests.
   */
  public constructor(
    packageName: string,
    className: string,
    filePath: string,
    testClassConstructor: new () => object,
    skipReason: string | undefined,
    methods: readonly DiscoveredTestMethod[],
    categories?: readonly string[]);
}

/**
 * A test project: a package name and the folder of its compiled tests.
 */
export declare class TestProject {
  /**
   * The package the project's tests belong to.
   */
  public readonly packageName: string;

  /**
   * The folder that holds the compiled tests.
   */
  public readonly rootDirectory: string;

  /**
   * Creates the project.
   *
   * @param packageName The package name; not whitespace only.
   * @param rootDirectory The compiled tests' folder; not whitespace only.
   * @throws ArgumentException synchronously when either is empty or
   * whitespace only.
   */
  public constructor(packageName: string, rootDirectory: string);
}

/**
 * Finds test classes in compiled tests, in an order that does not depend on
 * the locale or the file system.
 */
export declare class TestDiscovery {
  /**
   * Discovers the test classes of every project. Projects, `*.test.js` files,
   * exports and methods are each taken in ordinal order.
   *
   * @param testProjects The projects to search.
   * @returns A promise of the discovered classes, in that order.
   * @throws TestingException as a rejection when a test file breaks the
   * testing contract, such as a file without a test class or a marked class
   * whose name does not end in `Tests`.
   */
  public discoverAsync(testProjects: readonly TestProject[]): Promise<DiscoveredTestClass[]>;

  /**
   * Discovers the test classes of one loaded test file.
   *
   * @param moduleExports The loaded file's exports.
   * @param filePath The file's path relative to its project; not whitespace
   * only.
   * @param packageName The package the tests belong to; not whitespace only.
   * @returns The file's test classes, in ordinal export order.
   * @throws ArgumentException synchronously for an empty path or name.
   * @throws TestingException synchronously when the file breaks the testing
   * contract.
   */
  public discoverModuleExports(moduleExports: object, filePath: string, packageName: string): DiscoveredTestClass[];
}

/**
 * Receives progress while a run executes.
 */
export interface ITestProgressListener {
  /**
   * Called after each class completes, before the next one starts. A
   * failure it throws stops the run and reaches the run's caller.
   *
   * @param result The completed class's results.
   */
  onClassCompleted(result: TestClassResult): void;
}

/**
 * Runs discovered tests one at a time: a fresh instance per test, awaited
 * asynchronous work, a time limit per test and attribution of unhandled
 * rejections to the test that caused them. A test that exceeds its time
 * limit fails, and every test after it is recorded as unreached.
 */
export declare class TestExecutor {
  /**
   * Creates the executor.
   *
   * @param timeoutMilliseconds Each test's time limit in milliseconds; a
   * positive integer.
   * @throws ArgumentOutOfRangeException synchronously when the time limit is
   * not a positive integer.
   */
  public constructor(timeoutMilliseconds: number);

  /**
   * Runs every test of every class, in order.
   *
   * @param testClasses The classes to run, in execution order.
   * @param progress Notified after each class, before the next one starts.
   * @returns A promise of one result per class, in execution order. A test
   * whose method cannot be called fails with `TestingException`.
   */
  public executeAsync(testClasses: readonly DiscoveredTestClass[], progress?: ITestProgressListener): Promise<TestClassResult[]>;
}

/**
 * Discovers, selects and runs tests, and checks that the results account
 * for every selected test.
 */
export declare class TestRunner {
  /**
   * Creates the runner.
   *
   * @param discovery Finds the tests.
   * @param executor Runs them.
   */
  public constructor(discovery: TestDiscovery, executor: TestExecutor);

  /**
   * Runs the tests of the given projects.
   *
   * @param testProjects The projects to discover.
   * @param filters Selection filters, combined with OR: a substring of the
   * package name, file path, class name or `ClassName.methodName` with its
   * data index, or an exact `category:name`. None selects every test.
   * @param progress Notified after each class.
   * @returns A promise of the run's result.
   * @throws TestingException as a rejection when discovery fails or the
   * results do not account for every selected test.
   */
  public runAsync(testProjects: readonly TestProject[], filters?: readonly string[], progress?: ITestProgressListener): Promise<TestRunResult>;
}

/**
 * Writes a run's results to the console. The structured results remain the
 * authority; nothing parses this output.
 */
export declare class TestReportWriter implements ITestProgressListener {
  /**
   * Creates the writer.
   *
   * @param skipPassingDetails Whether progress output hides passed tests and
   * entirely passing classes; false by default. Failures, skips and
   * unreached tests stay visible.
   */
  public constructor(skipPassingDetails?: boolean);

  /**
   * Writes a completed class's heading and tests.
   *
   * @param result The completed class's results.
   */
  public onClassCompleted(result: TestClassResult): void;

  /**
   * Writes the run's totals without repeating the classes.
   *
   * @param result The run's result.
   */
  public writeSummary(result: TestRunResult): void;

  /**
   * Writes the whole report.
   *
   * @param result The run's result.
   * @param skipPassingDetails Whether to hide passed tests and entirely
   * passing classes.
   */
  public write(result: TestRunResult, skipPassingDetails: boolean): void;

  /**
   * Formats the whole report without writing it.
   *
   * @param result The run's result.
   * @param skipPassingDetails Whether to hide passed tests and entirely
   * passing classes.
   * @returns The class reports followed by the totals, with terminal color
   * sequences.
   */
  public formatLines(result: TestRunResult, skipPassingDetails: boolean): string[];
}

/**
 * Appends bounded Markdown summaries to a GitHub Actions step summary file,
 * keeping what the file already holds.
 */
export declare class GitHubSummaryWriter {
  /**
   * Creates the writer.
   *
   * @param path The step summary file; `undefined` or whitespace only turns
   * output off.
   */
  public constructor(path: string | undefined);

  /**
   * Appends the run's counts, its summed duration and bounded, escaped
   * details of failed, skipped and unreached tests.
   *
   * @param result The run's result.
   */
  public writeTests(result: TestRunResult): void;

  /**
   * Appends a failure of the run itself. A failure to write is reported on
   * the console and does not change the run's verdict.
   *
   * @param message What failed.
   */
  public writeFailure(message: string): void;
}
