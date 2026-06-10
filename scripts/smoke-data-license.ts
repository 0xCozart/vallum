import { formatDataLicenseDemoResult, runDataLicenseDemo } from "../examples/data-license/data-license-demo.js";

const result = await runDataLicenseDemo();
console.log(formatDataLicenseDemoResult(result));
