/*!
 * Back2Front
 * 对特殊静态资源的请求做处理
 * (原理是生成另一个临时文件，然后修改req.url重定向到该文件)
 */

'use strict';

var fs = require('fs'), path = require('path');


module.exports = function(staticPath) {
	// 要进行特殊处理的资源
	var assertHandlers = {
		// 模板转换为模块化的JS字符串
		'.xtpl.js': {
			getLocalPath: function(staticPath, urlPath) {
				// 请求为*.xtpl.js，对应本地临时文件为*.xtpl
				return path.join(
					staticPath, urlPath.replace(/(\.xtpl)\.js/i, '$1')
				);
			},
			handle: function(fileContent, urlPath) {
				var modId = urlPath.split('/').slice(2).join('/') ;

				// 本地临时文件为*.xtpl.js，跟请求一致
				fs.writeFileSync(
					path.join(staticPath, urlPath),
					'define(' +
						JSON.stringify(modId) +
						', null, function(require, exports, module) {\n' +
							'module.exports = ' + JSON.stringify(fileContent) + ';' +
					'\n});'
				);
				return urlPath;
			}
		},

		// 模块化JS增加define包装
		'.mod.js': {
			handle: function(fileContent, urlPath) {
				// 请求为*.mod.js，对应本地临时文件为*.mod.defined.js
				urlPath = urlPath.replace(/(\.mod)(\.js)$/, '$1.defined$2');
				fs.writeFileSync(
					path.join(staticPath, urlPath),
					'define(function(require, exports, module) { "use strict";\n' +
						fileContent +
					'\n});'
				);
				return urlPath;
			}
		}
	};

	return function(req, res, next) {
		var urlPath = req.originalUrl.replace(/\?.*$/, ''), extname;
		// 这里取扩展名不能用path.extname，因为有些路径有两段扩展名(*.xtpl.js)，要全部匹配出来
		if ( /((?:\.\w+)+)$/.test(urlPath) ) { extname = RegExp.$1; }

		var handler = assertHandlers[extname];
		if (handler) {
			var localPath = handler.getLocalPath
				? handler.getLocalPath(staticPath, urlPath)
				: path.join(staticPath, urlPath);

			// 文件不存在时返回404
			if ( !fs.existsSync(localPath) ) {
				res.status(404).end('"' + urlPath + '" does not exist');
				return;
			}

			req.url = handler.handle(
				fs.readFileSync(localPath, 'utf8'), urlPath
			) || req.url;
		}

		next();
	};
};