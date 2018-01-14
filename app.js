/*!
 * Back2Front
 * Express setup
 */

'use strict';

const path = require('path');
const express = require('express');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const appConfig = require('./config');

const app = express();
app.set('env', appConfig.env);

// 初始化XTemplate引擎
const xTpl = require('./lib/xtpl');
xTpl.express(app, {
	rootPath: path.join(__dirname, 'public', 'assets')
});

// uncomment after placing your favicon in /public
// app.use(favicon(path.join(__dirname, 'favicon.ico')));
// avoid 404
app.use('/favicon.ico', function(req, res) {
	res.end();
});

// Use for universal links
app.use('/apple-app-site-association', function(req, res) {
	res.sendFile(path.join(__dirname, 'apple-app-site-association.json'), {
		headers: {
			'Cache-Control': 'no-cache'
		}
	});
});

app.use(logger('dev'));

// 静态文件
const assetConfig = require('./asset-config');
// 以下情况都要在Express中处理静态资源:
//   assetConfig为null时，表示未构建（开发环境）
//   isStaticServer为true时，表示非开发环境下也使用Express作为静态资源服务器
if (assetConfig == null || appConfig.isStaticServer) {
	// 非开发环境用~public存放构建后的静态资源
	const staticPath = path.join(
		__dirname,
		assetConfig == null ? 'public' : '~public'
	);
	// 开发环境才需要处理特殊静态资源的中间件
	if (assetConfig == null) {
		app.use(require('./lib/assets-handler')(staticPath));
	}
	// 处理静态文件的中间件
	app.use(express.static(staticPath, appConfig.static));
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// 初始化路由
require('./routes/init')(express, app);

module.exports = app;