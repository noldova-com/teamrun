import path from "node:path";
const name = `${process.pid} ${path.basename(process.argv[1] ?? "node")}`;
const stamp = () => new Date().toISOString();
const write = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, ...rest) => {
  const text = String(chunk);
  if (text.includes("Coverage ignores") || text.includes("Coverage report") || text.includes("Test Files"))
    process.stderr.write(`PROBE ${stamp()} ${name} wrote: ${text.trim().slice(0, 80)}\n`);
  return write(chunk, ...rest);
};
const timer = setInterval(() => process.stderr.write(`PROBE ${stamp()} ${name} ${JSON.stringify(process.getActiveResourcesInfo())}\n`), 2000);
timer.unref();
process.on("exit", code => process.stderr.write(`PROBE ${stamp()} ${name} exit ${code}\n`));
