/*!
 * Back2Front
 * 对特殊静态资源的响应做处理
 * (原理是生成另一个临时文件，然后修改req.url重定向到该文件)
 */

'use strict';

const fse = require('fs-extra');
const path = require('path');
const babel = require('babel-core');


module.exports = (staticPath) => {
	// 要进行特殊处理的资源
	const assetsHandlers = {
		// 模板转换为模块化的JS字符串
		'.xtpl.js': {
			toLocalPath: function(urlPath) {
				// 请求为*.xtpl.js，对应本地文件为*.xtpl
				return urlPath.replace(/(\.xtpl)\.js$/i, '$1');
			},
			getContent: function(fileContent, urlPath) {
				return 'define(' +
					JSON.stringify(urlPath.split('/').slice(2).join('/')) +
					', null, function(require, exports, module) {\n' +
						'module.exports = ' + JSON.stringify(fileContent) + ';' +
				'\n});';
			}
		},

		// 模块化JS增加define包装
		'.js': {
			toTempPath: function(urlPath) {
				// 请求为*.js（非*.raw.js且非*.xtpl.js），对应本地临时文件为*.defined.js
				return urlPath.replace(/(\.js)$/, '.defined$1');
			},
			getContent: function(fileContent, urlPath) {
				return 'define(function(require, exports, module) { "use strict";\n' +
					babel.transform(fileContent, {
						presets: [
							['env', { modules: false }],
							'stage-2'
						]
					}).code +
				'\n});'
			}
		}
	};

	return (req, res, next) => {
		let urlPath = req.originalUrl.replace(/\?.*$/, ''), extname;
		// 这里取扩展名不能用path.extname，因为有些路径有两段扩展名(*.xtpl.js)，要全部匹配出来
		if (/((?:\.\w+)+)$/.test(urlPath)) {
			extname = RegExp.$1;
		}

		let handler = assetsHandlers[extname];
		if (handler) {
			// 请求对应的本地文件路径
			let localPath = path.join(
				staticPath,
				handler.toLocalPath ? handler.toLocalPath(urlPath) : urlPath
			);

			// 文件不存在时返回404
			if (!fse.pathExistsSync(localPath)) {
				res.status(404).end('"' + urlPath + '" does not exist');
				return;
			}

			// 请求对应的临时文件路径
			let tempPath = handler.toTempPath ? handler.toTempPath(urlPath) : urlPath;
			tempPath = tempPath.split('/');
			for (let i = 0; i < tempPath.length; i++) {
				if (tempPath[i]) {
					tempPath[i] = '~' + tempPath[i];
					break;
				}
			}
			tempPath = tempPath.join('/');

			fse.outputFileSync(
				path.join(staticPath, tempPath),
				handler.getContent(fse.readFileSync(localPath, 'utf8'), urlPath)
			);

			req.url = tempPath;
		}

		next();
	};
};