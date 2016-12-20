/*!
 * Back2Front
 * 路由初始化
 */

'use strict';

var util = require('../lib/util'),
	routeHelpers = require('./route-helpers'),
	requireDir = require('require-dir'),
	routes = requireDir('./pages'),
	assetConfig = require('../asset-config');


// 从配置文件中获取静态资源路径
// 从配置文件中获取静态资源路径
var assetURLPrefix = assetConfig ? assetConfig.url_prefix : '';
// 保证路径末尾是/
if (assetURLPrefix[assetURLPrefix.length - 1] !== '/') {
	assetURLPrefix += '/';
}


module.exports = function(express, app) {
	var env = app.get('env');

	// 调用渲染的callback
	function render(req, res, next) {
		if (res.routeHelper) {
			if ( res.routeHelper.rendered() ) {
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
			var result = callback.apply(this, arguments);
			if (result && typeof result.then === 'function') {
				// 注意这里不能写成 result.then(next, next)
				// 因为next一旦有参数就会被判定为出现异常
				result.then(function() { next(); }, next);
			} else if (result !== true) {
				// 如果不需要next，就return true
				next();
			}
		};
	}

	util.each(routes, function(subRoutes, mainPath) {
		var router = express.Router();

		if (mainPath === '__') {
			mainPath = '/';
		} else {
			mainPath = '/' + mainPath;
		}

		util.each(subRoutes, function(subRoute, subPath) {
			if ( typeof subRoute === 'function' || Array.isArray(subRoute) ) {
				subRoute = { callbacks: subRoute };
			} else {
				subRoute = util.extend({ }, subRoute);
			}
			if ( !Array.isArray(subRoute.callbacks) ) {
				subRoute.callbacks = [subRoute.callbacks];
			}
			// 增加对Promise实例的包装处理
			subRoute.callbacks = subRoute.callbacks.map(handlePromise);
			subRoute.callbacks.push(render);

			subRoute.path = subPath;

			var template, resType;
			if (!subRoute.resType || subRoute.resType === 'html') {
				resType = 'html';
				// 默认模板路径为 pages/路由主路径/路径子路径/路径子路径.page
				var pageName = subRoute.path.replace(/\//g, '__');
				template = ( 'pages/' + (
					subRoute.template ||
					(mainPath + '/' + pageName + '/' + pageName)
				) ).replace(/\/{2,}/, '/') + '.page.xtpl';
			} else {
				resType = subRoute.resType;
			}

			if (subRoute.path[0] !== '/') { subRoute.path = '/' + subRoute.path; }

			subRoute.callbacks.unshift(function(req, res, next) {
				var RouteHelper;
				if (resType === 'json') {
					RouteHelper = routeHelpers.JSONRouteHelper;
				} else {
					RouteHelper = routeHelpers.HTMLRouteHelper;
				}
				res.routeHelper = new RouteHelper(template);
				res.routeHelper.viewData({
					ENV: env,
					assetURLPrefix: assetURLPrefix
				});

				// 把构建后得出的资源列表导进viewData
				if (assetConfig) {
					var assets = assetConfig.map[template];
					if (assets) {
						Object.keys(assets).forEach(function(assetType) {
							res.routeHelper.viewData(
								assetType + 'Files',
								assets[assetType].slice()
							);
						});
					}
				}

				next();
			});

			var verb = subRoute.verb || 'get',
				pathPattern = subRoute.pathPattern || subRoute.path;

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

		var err = new Error('您访问的页面不存在');
		err.status = 404;
		next(err);
	});

	// 异常处理
	var isDevEnv = env !== 'production';
	app.use(function(err, req, res, next) {
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
				stack: isDevEnv ? err.stack : ''
			});
		} catch (e) {
			res.end();
			throw e;
		}
	});
};