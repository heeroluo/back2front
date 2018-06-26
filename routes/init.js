/*!
 * Back2Front
 * 路由初始化
 */

'use strict';

const util = require('../lib/util');
const routeHelpers = require('./route-helpers');
const requireDir = require('require-dir');
const routes = requireDir('./pages');
const appConfig = require('../config');


module.exports = function(express, app) {
	const env = appConfig.env;

	// 调用渲染的callback
	function render(req, res, next) {
		if (res.routeHelper) {
			if (res.routeHelper.rendered()) {
				res.end();
			} else {
				res.routeHelper.render(res);
			}
		} else {
			next();
		}
	}

	// 处理Promise实例
	function handlePromise(callback) {
		return function(req, res, next) {
			if (res.headersSent) {
				res.end();
				return;
			}
			const result = callback.apply(this, arguments);
			if (result && typeof result.then === 'function') {
				// 注意这里不能写成 result.then(next, next)
				// 因为next一旦有参数就会被判定为出现异常
				result.then(function() { next(); }, next);
			} else if (result !== true) {
				// 如果不需要next（例如进行了重定向），就return true
				next();
			}
		};
	}

	util.each(routes, function(subRoutes, mainPath) {
		/* eslint-disable */
		const router = express.Router();

		if (mainPath === '__') {
			mainPath = '/';
		} else {
			mainPath = '/' + mainPath;
		}

		util.each(subRoutes, function(subRoute, subPath) {
			if (typeof subRoute === 'function' || Array.isArray(subRoute)) {
				subRoute = { callbacks: subRoute };
			} else {
				subRoute = Object.assign({ }, subRoute);
			}
			if (!Array.isArray(subRoute.callbacks)) {
				subRoute.callbacks = [subRoute.callbacks];
			}
			// 增加对Promise实例的包装处理
			subRoute.callbacks = subRoute.callbacks.map(handlePromise);
			subRoute.callbacks.push(render);

			subRoute.path = subPath;

			let template, resType;
			if (!subRoute.resType || subRoute.resType === 'html') {
				resType = 'html';
				// 默认模板路径为 pages/路由主路径/路径子路径/路径子路径.page.xtpl
				let pageName = subRoute.path.replace(/\//g, '__');
				template = ('pages/' + (
					subRoute.template ||
					(mainPath + '/' + pageName + '/' + pageName)
				)).replace(/\/{2,}/, '/') + '.page.xtpl';
			} else {
				resType = subRoute.resType;
			}

			if (subRoute.path[0] !== '/') { subRoute.path = '/' + subRoute.path; }

			subRoute.callbacks.unshift(function(req, res, next) {
				let RouteHelper;
				if (resType === 'json') {
					RouteHelper = routeHelpers.JSONRouteHelper;
				} else {
					RouteHelper = routeHelpers.HTMLRouteHelper;
				}
				res.routeHelper = new RouteHelper(template);
				res.routeHelper.viewData({
					ENV: env,
					currentYear: (new Date).getFullYear()
				});

				next();
			});

			const verb = subRoute.verb || 'get';
			const pathPattern = subRoute.pathPattern || subRoute.path;
			subRoute.callbacks.forEach(function(callback) {
				router[verb](pathPattern, callback);
			});
		});

		app.use(mainPath, router);
	});

	// catch 404 and forward to error handler
	app.use(function(req, res, next) {
		console.error('Error: "' + req.originalUrl + '" does not exist');

		res.routeHelper = new routeHelpers.HTMLRouteHelper();

		const err = new Error('您访问的页面不存在');
		err.status = 404;
		next(err);
	});

	// 异常处理
	app.use(function(err, req, res) {
		if (typeof err === 'string') { err = new Error(err); }
		err.status = err.status || 500;

		if (err.status !== 404) { console.error('Error: ' + err.message); }

		res.status(err.status);

		try {
			res.routeHelper.viewData('title', '温馨提示');
			res.routeHelper.renderInfo(res, {
				status: 2,
				httpStatus: err.status,
				message: err.message || '',
				stack: appConfig.nodeEnv !== 'production' ? err.stack : ''
			});
		} catch (e) {
			res.end();
			throw e;
		}
	});
};