# Command line

**Scope:** The `teamrun` command line, `src/shell/cli`, under the [architecture's command-line rules](../../../docs/ARCHITECTURE.md#command-line).

## 1. Purpose

The command line reports on the data directory's runtime and runs the runtime's commands from a terminal or a script. It shares the runtime and the data directory with the desktop.

## 2. Commands

| Command | What it does |
|---|---|
| `teamrun status` | Reports the runtime's build, the data directory, the modules and where each stands, and the work in progress. Never starts a runtime. |
| `teamrun commands` | Lists the runtime's commands, with each one's name, title and module. The window's commands are not reachable from the command line. |
| `teamrun run <command> [<json> \| --args-file <path> \| -]` | Runs one of the runtime's commands and prints its result; a command that is not enabled now is refused. Its arguments are JSON, given inline, read from a file, or read from standard input with `-`. Pressing Ctrl+C cancels the command. |
| `teamrun open` | Starts TeamRun with the same data directory, or brings its window forward when it already runs. |
| `teamrun help` | Prints the usage. |

`commands` and `run` start a runtime when none is running. The runtime then stays up under its idle policy, so later calls attach to it.

## 3. Options

| Option | Meaning |
|---|---|
| `--data-dir <path>` | The data directory. Without it, the command line uses the same one the desktop would. |
| `--json` | Prints exactly one JSON value on standard output, and an error as `{"code","message","details"}` on standard error. |
| `--no-start` | `commands` and `run` fail with exit code 3 instead of starting a runtime. |
| `--take-over` | `commands` and `run` take over another build's runtime when this build is newer and that runtime is idle. |
| `--timeout <seconds>` | How long `run`'s command may take, from 1 to 3600 seconds. |

The command line never asks a question; it reports and exits.

## 4. Exit codes

The exit codes are stable; scripts may rely on them.

| Code | Meaning |
|---|---|
| 0 | Success. |
| 1 | The command, or the method it called, failed, or a runtime could not start. |
| 2 | The command line, or a command's arguments, are not valid. |
| 3 | No runtime is running, and the command does not start one. |
| 4 | Another build's runtime owns the data directory: an older one without `--take-over`, a newer one, or one with work in progress. The error names the running build and its program. |
| 5 | The data directory cannot be used: it holds data from before the shell, another program's runtime owns it, or it is not a writable folder. Data from before the shell is reported and never moved. |
| 6 | The command timed out or was cancelled. |

A failure from the runtime keeps the protocol's code in the JSON error. When the connection to the runtime ends during a command, the code is `Disconnected`, as in the desktop, and the exit code is 1.

## 5. Development

In a checkout, `npm run teamrun -- <command> [options]` runs the command line on the development app, with the checkout's own data directory unless `--data-dir` or `TEAMRUN_DATA_DIR` names another. A relative `--data-dir` is resolved from the folder `npm` was started in.
