/* eslint-disable @typescript-eslint/explicit-member-accessibility */

import express from "express";
import handler from "./function/dist/handler";

const app = express();

app.use(function addDefaultContentType(request, response, next) {
	// When no content-type is given, the body element is set to
	// nil, and has been a source of contention for new users.

	if (request.headers["content-type"] === undefined) {
		request.headers["content-type"] = "text/plain";
	}

	next();
});

app.use(express.text({ "type": "text/*" }));
app.use(express.json({ "limit": "100kb" }));
app.use(express.urlencoded({ "extended": true }));

export class FunctionEvent {
	constructor(request) {
		this.body = request.body;
		this.headers = request.headers;
		this.method = request.method;
		this.query = request.query;
		this.path = request.path;
	}
}

export class FunctionContext {
	constructor(callback) {
		this.statusCode = 200;
		this.callback = callback;
		this.headerValues = {};
		this.callbackCalled = 0;
	}

	status(statusCode) {
		if (statusCode === undefined) {
			return this.statusCode;
		}

		this.statusCode = statusCode;

		return this;
	}

	headers(value) {
		if (value === undefined) {
			return this.headerValues;
		}

		this.headerValues = value;

		return this;
	}

	succeed(value) {
		let error;
		this.callbackCalled += 1;
		this.callback(error, value);
	}

	fail(value) {
		let message;

		if (this.status() === 200) {
			this.status(500);
		}

		this.callbackCalled += 1;
		this.callback(value, message);
	}
}

app.all("/*", function(request, response) {
	function callback(error, functionResult) {
		if (error) {
			console.error(error);

			return response.status(functionContext.status())
				.send(error.toString ? error.toString() : error);
		}

		if (typeof functionResult === "object") {
			response.set(functionContext.headers())
				.status(functionContext.status()).send(JSON.stringify(functionResult));
		} else {
			response.set(functionContext.headers())
				.status(functionContext.status())
				.send(functionResult);
		}
	}

	const functionEvent = request; //new FunctionEvent(request);
	const functionContext = new FunctionContext(callback);

	Promise.resolve(handler(functionEvent, functionContext))
		.then(function(response) {
			if (!functionContext.callbackCalled) {
				functionContext.succeed(response);
			}
		})
		.catch(function(error) {
			callback(error);
		});
});

app.listen(3000, function() {
	console.log("> Listening on http://localhost:3000");
});
