import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import express from "express";
import helmet from "helmet";
import logger from "morgan";
import { createProxyMiddleware } from "http-proxy-middleware";

import { __root } from "./config";

const BASE_URL = "http://localhost:8000";

export const server = express();

server.use(helmet({
	"contentSecurityPolicy": {
		"directives": {
			...helmet.contentSecurityPolicy.getDefaultDirectives(),
			"script-src": ["'self'", "https:", "'unsafe-inline'"],
			"script-src-elem": ["'self'", "https:", "'unsafe-inline'"]
		}
	}
}));

server.set("json spaces", 4);

server.set("views", path.join(__root, "views"));

server.set("view engine", "ejs");

server.use(logger("dev"));

async function bindRoutes(routesDirectory) {
	const files = [];

	(function recurse(directory) {
		for (const file of fs.readdirSync(directory)) {
			if (fs.statSync(path.join(directory, file)).isDirectory()) {
				recurse(path.join(directory, file));
			} else if (path.extname(file).toLowerCase() === ".ts") {
				files.push(path.join(directory, file));
			}
		}
	})(routesDirectory);

	for (const file of files) {
		const route = await import(url.pathToFileURL(file).toString());

		const middlewares = route["middlewares"] ?? [];

		for (const routeHandler of Object.keys(route)) {
			let [method] = /^(?:all|connect|del(?:ete)?|get|head|options|patch|post|put|trace)/u.exec(routeHandler) || [];

			if (method === undefined) {
				continue;
			}

			if (routeHandler === "del") {
				method = "delete";
			}

			const parsedPath = path.parse(file.substring(routesDirectory.length));
			let pathName = parsedPath.dir;

			if (parsedPath.name !== "index") {
				pathName = path.join(pathName, parsedPath.name);
			}

			pathName = pathName.replace(/\\/gu, "/");

			if (route[routeHandler].length === 2) {
				console.log("Binding " + method.toUpperCase() + " " + pathName);

				server[method](pathName, ...middlewares, route[routeHandler]);
			} else {
				const { path = pathName, middleware = [], callback } = route[routeHandler](pathName);

				console.log("Binding " + method.toUpperCase() + " " + path);

				server[method](path, ...middleware, callback);
			}
		}
	}

	server.get("*", function(request, response, next) {
		const basePath = path.join(__root, "public");
		const fullPath = path.join(basePath, request.path);

		if (path.resolve(fullPath).startsWith(basePath)) {
			if (fs.existsSync(fullPath)) {
				if (fs.statSync(fullPath).isFile()) {
					response.sendFile(fullPath);

					return;
				}
			}
		}

		response.status(404);

		next();
	});
}

server.all("/api/function/*", createProxyMiddleware({
	"pathRewrite": {
		"^/api/function": "/function"
	},
	"target": "http://127.0.0.1:8080",
	"changeOrigin": true,
	"logLevel": "debug"
}));

server.all("/api/async-function/*", createProxyMiddleware({
	"pathRewrite": {
		"^/api/async-function": "/async-function"
	},
	"target": "http://127.0.0.1:8080",
	"changeOrigin": true
}));

await bindRoutes(path.join(__root, "routes"));

server.listen(new URL(BASE_URL).port, function() {
	console.log("> Ready on " + BASE_URL);
});
