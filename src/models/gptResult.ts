import { KicsRealtime } from "./kicsRealtime";
import { AstResult } from "./results";

export class GptResult {
	filename = "";
	line = 0;
	severity = "";
	vulnerabilityName = "";

	constructor(astResult: AstResult, kicsResult: KicsRealtime) {
		if (kicsResult !== undefined) {
			this.filename = kicsResult.files[0].file_name.toString().replaceAll("../", "").replaceAll("path/", "");
			this.line = kicsResult.files[0].line;
			this.severity = kicsResult.severity;
			this.vulnerabilityName = kicsResult.query_name;
		}
		if (astResult !== undefined) {
			this.filename = astResult.kicsNode?.data.filename;
			this.line = astResult.kicsNode?.data.line;
			this.severity = astResult.severity;
			this.vulnerabilityName = astResult.label.replaceAll("_", " ");
		}
	}
}