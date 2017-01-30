/*!
 * Back2Front
 * 对特殊静态资源的请求做处理
 * (原理是生成另一个临时文件，然后修改req.url重定向到该文件)
 */

'use strict';

var fs = require('fs'),
	fse = require('fs-extra'),
	path = require('path');


module.exports = function(staticPath) {
	// 要进行特殊处理的资源
	var assertHandlers = {
		// 模板转换为模块化的JS字符串
		'.xtpl.js': {
			toLocalPath: function(urlPath) {
				// 请求为*.xtpl.js，对应本地文件为*.xtpl
				return urlPath.replace(/(\.xtpl)\.js$/i, '$1');
			},
			getContent: function(fileContent, urlPath) {
				return 'define(' +
					JSON.stringify( urlPath.split('/').slice(2).join('/') ) +
					', null, function(require, exports, module) {\n' +
						'module.exports = ' + JSON.stringify(fileContent) + ';' +
				'\n});';
			}
		},

		// 模块化JS增加define包装
		'.mod.js': {
			toTempPath: function(urlPath) {
				// 请求为*.mod.js，对应本地临时文件为*.mod.defined.js
				return urlPath.replace(/(\.mod)(\.js)$/, '$1.defined$2');
			},
			getContent: function(fileContent, urlPath) {
				return 'define(function(require, exports, module) { "use strict";\n' +
					fileContent +
				'\n});'
			}
		}
	};

	return function(req, res, next) {
		var urlPath = req.originalUrl.replace(/\?.*$/, ''), extname;
		// 这里取扩展名不能用path.extname，因为有些路径有两段扩展名(*.xtpl.js)，要全部匹配出来
		if ( /((?:\.\w+)+)$/.test(urlPath) ) { extname = RegExp.$1; }

		var handler = assertHandlers[extname];
		if (handler) {
			// 请求对应的本地文件路径
			var localPath = path.join(
				staticPath,
				handler.toLocalPath ? handler.toLocalPath(urlPath) : urlPath
			);

			// 文件不存在时返回404
			if ( !fs.existsSync(localPath) ) {
				res.status(404).end('"' + urlPath + '" does not exist');
				return;
			}

			// 请求对应的临时文件路径
			var tempPath = handler.toTempPath ? handler.toTempPath(urlPath) : urlPath;
			tempPath = tempPath.split('/');
			for (var i = 0; i < tempPath.length; i++) {
				if (tempPath[i]) {
					tempPath[i] = '~' + tempPath[i];
					break;
				}
			}
			tempPath = tempPath.join('/');

			fse.outputFileSync(
				path.join(staticPath, tempPath),
				handler.getContent(fs.readFileSync(localPath, 'utf8'), urlPath)
			);

			req.url = tempPath;
		}

		next();
	};
};