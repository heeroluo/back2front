/*!
 * Back2Front
 * 对特殊静态资源的响应做处理
 * (原理是生成另一个临时文件，然后修改req.url重定向到该文件)
 */

'use strict';

const path = require('path');
const fse = require('fs-extra');
const babel = require('babel-core');
const postcssrc = require('postcss-load-config');
const postcss = require('postcss');


module.exports = (staticPath) => {
	// 要进行特殊处理的资源
	const assetsHandlers = {
		// 模板转换为模块化的JS字符串
		'.xtpl': {
			resType: 'js',
			compile(fileContent, reqPath) {
				// reqPath为「/assets/....」，取「/assets/」后的部分作为id
				const id = reqPath.split('/').slice(2).join('/');

				return Promise.resolve(
					'define(' + JSON.stringify(id) + ', null, function(require, exports, module) {\n' +
						'module.exports = ' + JSON.stringify(fileContent) + ';' +
					'\n});'
				);
			}
		},

		// CSS预处理
		'.scss': {
			resType: 'css',
			compile(fileContent, reqPath, fromPath, toPath) {
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

		// 模块化JS增加define包装和es6编译
		// 模板引用替换成require.resolve
		'.js': {
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

				return Promise.resolve(
					'define(function(require, exports, module) { "use strict";\n' +
						code.replace(
							/\b_tpl\s*\(\s*((['"]).+?\1)\s*\)/g, 'require.resolve($1)'
						) +
					'\n});'
				);
			}
		}
	};


	// 记录文件修改时间，没修改过的不重新生成
	const fileMTimes = { };


	return (req, res, next) => {
		const reqPath = req.originalUrl.replace(/\?.*$/, '');
		let extname;
		// 这里取扩展名不能用path.extname，因为有些路径有两段扩展名（.raw.js），要全部匹配出来
		if (/((?:\.\w+)+)$/.test(reqPath)) {
			extname = RegExp.$1;
		}

		const handler = assetsHandlers[extname];
		if (handler) {
			// 当前请求对应的本地文件路径
			const localPath = path.join(staticPath, reqPath);
			// 文件不存在时返回404
			if (!fse.pathExistsSync(localPath)) {
				res.status(404).end('"' + reqPath + '" does not exist');
				return;
			}

			// 输出为特定的资源类型
			if (handler.resType) { res.type(handler.resType); }

			// 当前请求对应的已编译文件路径（/assets -> /~assets）
			const compiledPath = req.url = reqPath.replace('/', '/~');

			// 获取文件修改时间（没有修改过的不重新生成）
			const mtime = fse.statSync(localPath).mtime.toISOString();
			if (fileMTimes[localPath] !== mtime) {
				const newPath = path.join(staticPath, compiledPath);
				handler.compile(
					fse.readFileSync(localPath, 'utf8'),
					reqPath,
					localPath,
					newPath
				).then((content) => {
					// 输出文件
					fse.outputFileSync(newPath, content);
					// 记录修改时间
					fileMTimes[localPath] = mtime;

					next();
				}, next);

				return;
			}
		}

		next();
	};
};