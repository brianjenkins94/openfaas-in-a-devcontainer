import { promises as fs, writeFileSync } from "fs";
import { spawn } from "child_process";
import * as crypto from "crypto";
import * as path from "path";
import busboy from "busboy";
import * as os from "os";

import type { FunctionContext } from "../template/typescript";
import type { IncomingMessage } from "http";

const TEMP_DIR = os.tmpdir();

export default function(event: IncomingMessage, context: FunctionContext) {
	const bb = busboy({
		"headers": event.headers,
		"limits": {
			"files": 1
		}
	});

	return new Promise<void>(function(resolve, reject) {
		let fileName;

		bb.on("file", function(name, file, info) {
			const chunks = [];

			file.on("data", function(chunk) {
				chunks.push(chunk);
			});

			file.once("end", function() {
				const buffer = Buffer.concat(chunks);

				const hash = crypto.createHash("md5").update(buffer).digest("hex");
				const extension = path.extname(name);

				fileName = hash + extension;

				writeFileSync(path.join(TEMP_DIR, fileName), buffer);
			});
		});

		bb.on("finish", function() {
			// [!] Never pass unsanitized user input to this function. Any input containing shell metacharacters may be used to trigger arbitrary command execution.
			const subprocess = spawn("file", [
				fileName
			], {
				"cwd": TEMP_DIR
			});

			const chunks = [];

			subprocess.stdout.on("data", function(chunk) {
				chunks.push(chunk);
			});

			subprocess.stdout.on("end", function() {
				const stdout = Buffer.concat(chunks).toString("utf8");

				context
					.status(200)
					.succeed({
						"stdout": stdout.trim()
					});

				resolve();
			});
		});

		event.pipe(bb);
	});
}
