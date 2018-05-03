/*!
 * Back2Front
 * 对特殊静态资源的响应做处理
 * (原理是生成另一个临时文件，然后修改req.url重定向到该文件)
 */

'use strict';

const fse = require('fs-extra');
const path = require('path');
const babel = require('babel-core');
const postcssrc = require('postcss-load-config');
const postcss = require('postcss');

// 记录文件修改时间，没修改过的不重新生成
const fileMTimes = { };


module.exports = (staticPath) => {
	// 要进行特殊处理的资源
	const assetsHandlers = {
		// 模板转换为模块化的JS字符串
		'.xtpl': {
			resType: 'js',
			compile(fileContent, urlPath) {
				// urlPath为「/assets/....」，取「/assets/」后的部分作为id
				let id = urlPath.split('/').slice(2).join('/');
				return 'define(' + JSON.stringify(id) + ', null, function(require, exports, module) {\n' +
					'module.exports = ' + JSON.stringify(fileContent) + ';' +
				'\n});';
			}
		},

		// CSS预处理
		'.scss': {
			resType: 'css',
			compile(fileContent, urlPath, fromPath, toPath) {
				// PreCSS不支持“//”注释符，将其替换为“/* */”
				fileContent = fileContent.replace(/^\s*\/{2}(.*)$/mg, (match, comment) => {
					return '/*' + comment.replace(
						/\//g, '\\/'
					) + '*/';
				});

				return postcssrc().then(({ plugins, options }) => {
					return postcss(plugins)
						.process(
							fileContent,
							Object.assign({
								from: fromPath,
								to: toPath
							}, options)
						)
						.then((result) => { return result.css; })
						.catch((e) => { return e.message; });
				});
			}
		},

		// 模块化JS增加define包装
		'.js': {
			getCompiledPath(urlPath) {
				// 请求为*.js（非*.raw.js），对应本地临时文件为*.defined.js
				return urlPath.replace(/(\.js)$/, '.defined$1');
			},
			compile(fileContent) {
				let code;
				try {
					code = babel.transform(fileContent, {
						presets: [
							['env', { modules: false }],
							'stage-2'
						]
					}).code;
				} catch (e) {
					code = 'throw new Error(' + JSON.stringify(
						e.message + ' at line ' + e.loc.line + ' column ' + e.loc.column
					) + ');';
				}

				return 'define(function(require, exports, module) { "use strict";\n' +
					code.replace(
						/\b_tpl\s*\(\s*((['"]).+?\1)\s*\)/g, 'require.resolve($1)'
					) +
				'\n});';
			}
		}
	};

	return (req, res, next) => {
		let urlPath = req.originalUrl.replace(/\?.*$/, '');
		let extname;
		// 这里取扩展名不能用path.extname，因为有些路径有两段扩展名（.raw.js），要全部匹配出来
		if (/((?:\.\w+)+)$/.test(urlPath)) {
			extname = RegExp.$1;
		}

		const handler = assetsHandlers[extname];
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

			// 输出为特定的资源类型
			if (handler.resType) { res.type(handler.resType); }

			// 请求对应的已编译文件路径
			let compiledPath = handler.getCompiledPath ?
				handler.getCompiledPath(urlPath) :
				urlPath;

			// 转到临时目录（/assets => /~assets）
			compiledPath = compiledPath.split('/');
			for (let i = 0; i < compiledPath.length; i++) {
				if (compiledPath[i]) {
					compiledPath[i] = '~' + compiledPath[i];
					break;
				}
			}
			req.url = compiledPath = compiledPath.join('/');

			// 获取文件修改时间（没有修改过的不重新生成）
			let mtime = fse.statSync(localPath).mtime.toISOString();
			if (fileMTimes[localPath] !== mtime) {
				let newPath = path.join(staticPath, compiledPath);
				let result = handler.compile(
					fse.readFileSync(localPath, 'utf8'),
					urlPath,
					localPath,
					newPath
				);

				if (typeof result.then === 'function') {
					result.then((content) => {
						fse.outputFileSync(newPath, content);
						next();
					}, next);
					return;
				} else {
					fse.outputFileSync(newPath, result);
				}

				// 记录修改时间
				fileMTimes[localPath] = mtime;
			}
		}

		next();
	};
};