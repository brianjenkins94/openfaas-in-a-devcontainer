import * as os from "os";

import type { FunctionContext } from "../template/typescript";
import type { IncomingMessage } from "http";

const TEMP_DIR = os.tmpdir();

import redis from "redis";

export default function(event: IncomingMessage, context: FunctionContext) {
	const client = redis.createClient(6379, process.env["redis"]);
	client.set("mytime", new Date().toString(), () => {
		client.quit();
		context.succeed({ "status": "set done" });
	});
}
