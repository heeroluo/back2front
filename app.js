/*!
 * Back2Front
 * Express setup
 */

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
app.use( bodyParser.json() );
app.use( bodyParser.urlencoded({ extended: false }) );
app.use( cookieParser() );

// 静态文件处理
var staticPath = path.join(__dirname, 'public');
var assertHandler = require('./lib/assert-handler');
app.use( assertHandler(staticPath) );
app.use( express.static(staticPath, appConfig.static) );

// 初始化路由
require('./routes/init')(express, app);

module.exports = app;