import { formatPaidMcpToolDemoResult, runPaidMcpToolDemo } from "../examples/paid-mcp-tool/paid-mcp-tool-demo.js";

const result = await runPaidMcpToolDemo();
console.log(formatPaidMcpToolDemoResult(result));
