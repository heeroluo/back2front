#!/usr/bin/env node

'use strict';

const http = require('http');
const appConfig = require('../config');
const app = require('../app');


// Get port from environment and store in Express.
app.set('port', appConfig.port);

// Create HTTP server.
const server = http.createServer(app);

// Listen on provided port, on all network interfaces.
server.listen(appConfig.port);
server.on('error', (error) => {
	if (error.syscall !== 'listen') { throw error; }

	const bind = typeof appConfig.port === 'string' ?
		'Pipe ' + appConfig.port :
		'Port ' + appConfig.port;

	// handle specific listen errors with friendly messages
	switch (error.code) {
		case 'EACCES':
			console.error(bind + ' requires elevated privileges');
			process.exit(1);
			break;
		case 'EADDRINUSE':
			console.error(bind + ' is already in use');
			process.exit(1);
			break;
		default:
			throw error;
	}
});
server.on('listening', () => {
	const addr = server.address();
	const bind = typeof addr === 'string' ?
		'pipe ' + addr :
		'port ' + addr.port;

	console.info('Listening on ' + bind);
	console.info('BACK2FRONT_ENV: ' + appConfig.env);
	console.info('NODE_ENV: ' + appConfig.nodeEnv);
});

// Delete temporary folder on closing
if (appConfig.nodeEnv === 'development') {
	// Prevent the program from closing instantly
	process.stdin.resume();

	const fse = require('fs-extra');
	const path = require('path');

	process.on('SIGINT', () => {
		const basePath = path.join(__dirname, '../public');
		fse.readdirSync(basePath).forEach((p) => {
			if (p[0] === '~') {
				fse.removeSync(path.join(basePath, p));
			}
		});
		process.exit();
	});
}