/*!
 * Back2Front
 * Express setup
 */

'use strict';

var path = require('path');
var express = require('express');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var appConfig = require('./config');

var app = express();
app.set('env', appConfig.env);

// 初始化XTemplate引擎
var xTpl = require('./lib/xtpl');
xTpl.express(app, {
	rootPath: path.join(__dirname, 'public', 'assets')
});

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
// avoid 404
app.use('/favicon.ico', function(req, res) {
	res.end();
});

app.use( logger('dev') );

// 静态文件
var assetConfig = require('./asset-config');
// 以下情况都要在Express中处理静态资源:
//   assetConfig为null时，表示未构建（开发环境）
//   isStaticServer为true时，表示非开发环境下也使用Express作为静态资源服务器
if (assetConfig == null || appConfig.isStaticServer) {
	// 非开发环境用~public存放构建后的静态资源
	var staticPath = path.join(
		__dirname,
		assetConfig == null ? 'public' : '~public'
	);
	// 开发环境才需要处理特殊静态资源的中间件
	if (assetConfig == null) {
		app.use( require('./lib/assert-handler')(staticPath) );
	}
	// 处理静态文件的中间件
	app.use( express.static(staticPath, appConfig.static) );
}

app.use( bodyParser.json() );
app.use( bodyParser.urlencoded({ extended: false }) );
app.use( cookieParser() );

// 初始化路由
require('./routes/init')(express, app);

module.exports = app;