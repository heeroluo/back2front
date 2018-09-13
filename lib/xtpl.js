/*!
 * Back2Front
 * XTemplate调用封装
 */

'use strict';

const path = require('path');
const fs = require('fs');
const XTemplate = require('xtemplate');
const appConfig = require('../config');
const assetConfig = require('../asset-config');
const util = require('./util');
const basicCommands = require('./xtpl-commands');


exports.express = function(app, config) {
	const tplConfig = {
		cache: appConfig.nodeEnv === 'production',
		catchError: appConfig.nodeEnv !== 'production',
		encoding: 'utf8',
		defaultExtname: '.xtpl'
	};


	// 存放所有XTemplate指令（在后面初始化）
	let xTplCommands;
	// 模板加载器（在后面初始化）
	let loader;


	// 标准化路径
	function normalizePath(srcPath) {
		return srcPath
			.replace(/\\/g, '/')
			.replace(/\/{2,}/g, '/');
	}

	// 增加默认扩展名（a => a.xtpl, a.page => a.page.xtpl）
	function fixExtname(srcPath) {
		srcPath = srcPath.split('?');
		const extname = path.extname(srcPath[0]);
		if (!extname || extname === '.page') {
			srcPath[0] += tplConfig.defaultExtname;
		}
		return srcPath.join('?');
	}

	// 转换为本地路径
	function toLocalPath(p, context) {
		return path.isAbsolute(p) ? p : (
			p[0] === '.' ?
				path.resolve(context, p) :
				path.join(tplConfig.rootPath, p)
		);
	}

	// 解析JS模块路径
	function parseModJSPath(p) {
		// mod@ver => mod/ver/mod
		p = p.replace(/([^\\\/]+)@([^\\\/]+)/g, (match, module, version) => {
			return module + '/' + version + '/' + module;
		});
		// 添加默认扩展名
		if (!/\.[^\\\/]+$/i.test(p)) { p += '.js'; }

		return p;
	}

	// 获取文件修改时间
	function getFileMTime(p) {
		return fs.statSync(p).mtime.toISOString();
	}

	// 根据资源根目录缩短路径
	function shortenPath(url, addDirname) {
		if (!util.isURL(url)) {
			url = path.relative(tplConfig.rootPath, url).replace(/\\/g, '/');
			if (addDirname === true) {
				url = '/' + tplConfig.rootDirname + '/' + url;
			}
		}
		return url;
	}


	// 记录模块化JS文件的所有依赖（发布后提高渲染效率用）
	const modJSDepsCache = {};
	// 记录模块化JS文件的直接依赖项（本地开发时提高渲染效率用）
	const modJSDirectDepsCache = {};
	// 分析模块化JS依赖
	function getModJSDeps(p, counter) {
		// 模板不需要分析依赖，模板引擎会处理其依赖
		if (path.extname(p).toLowerCase() !== '.js') { return null; }

		// 防止循环依赖导致无法结束
		counter = counter || 0;
		if (counter++ > 50) { return null; }

		p = normalizePath(p);

		if (modJSDepsCache.hasOwnProperty(p)) {
			return modJSDepsCache[p];
		}

		const directDepsCache = modJSDirectDepsCache[p];
		const mTime = getFileMTime(p);

		let result = [];
		function addToResult(p) {
			const subResult = getModJSDeps(p, counter);
			if (subResult) { result = result.concat(subResult); }
			result.push(p);
		}

		if (directDepsCache && directDepsCache.mTime === mTime) {
			directDepsCache.data.forEach(addToResult);
		} else {
			const fileContent = fs.readFileSync(p, 'utf-8')
				.replace(/^\s*\/\*[\s\S]*?\*\/\s*$/mg, '')
				.replace(/^\s*\/\/.*$/mg, '');

			const reRequire = /(?:^|[^.$])\b(?:require|_tpl)\s*\(\s*(["'])([^"'\s\)]+)\1\s*\)/g;
			const dirname = path.dirname(p);

			let match;
			const directDeps = [];

			while (!!(match = reRequire.exec(fileContent))) {
				match = toLocalPath(parseModJSPath(match[2]), dirname);
				if (!tplConfig.cache) { directDeps.push(match); }
				addToResult(match);
			}

			if (!tplConfig.cache) {
				modJSDirectDepsCache[p] = {
					data: directDeps,
					mTime
				};
			}
		}

		result = result.length ? result : null;
		if (tplConfig.cache) { modJSDepsCache[p] = result; }
		return result;
	}


	// 匹配modjs指令
	const reModjsList = /\{{2,3}\s*modjs\s*\(([\W\w]*?)\)/g;
	// 匹配指令参数
	const reAssetItem = /(["'])(.+?)\1/g;

	// 分析modjs的模块依赖，转换为csrOnly的include
	function fetchTplDeps(filePath, fileContent) {
		// 处理.xtpl文件
		const dirname = path.dirname(filePath);

		return fileContent.replace(reModjsList, (match, assets) => {
			const replacement = [];

			let subMatch, subDeps, assetPath, allDeps = [];
			while (!!(subMatch = reAssetItem.exec(assets))) {
				assetPath = subMatch[2];
				// 不处理外链资源
				if (!util.isURL(assetPath)) {
					subDeps = getModJSDeps(toLocalPath(parseModJSPath(assetPath), dirname));
					if (subDeps) {
						allDeps = allDeps.concat(subDeps);
					}
				}
			}

			[...new Set(allDeps)].forEach((dep) => {
				if (/\.xtpl$/.test(dep)) {
					replacement.push(
						'{{ include(' + JSON.stringify(shortenPath(dep) + '?csrOnly') + ') }}'
					);
				}
			});

			replacement.push(match);

			return replacement.join('\n');
		});
	}


	// 带缓存的XTemplate实例创建
	const instanceCache = {};
	function getInstance(tplPath) {
		const cache = instanceCache[tplPath];
		if (cache) { return cache; }

		const instance = new XTemplate(
			fetchTplDeps(
				tplPath,
				fs.readFileSync(tplPath, tplConfig.encoding)
			),
			{
				name: normalizePath(fixExtname(tplPath)),
				loader: loader,
				commands: xTplCommands,
				catchError: tplConfig.catchError
			}
		);

		if (tplConfig.cache) { instanceCache[tplPath] = instance; }
		return instance;
	}


	// 带缓存的模板函数编译
	const reDeps = /\{{2,3}\s*(?:extend|parse|include|includeOnce|css|js|modjs)\s*\([\W\w]+?\)\s*\}{2,3}/g;
	const reInlines = /\{{2}#(css|js|modjs)\s+[\W\w]+?\}{2}[\W\w]*?\{{2}\/\1\}{2}/g;
	const tplFnCache = {};
	function getTplFn(root, tplPath) {
		const cache = tplFnCache[tplPath];
		if (cache) { return cache; }

		let temp = tplPath.split('?');
		let fileContent = fetchTplDeps(
			temp[0],
			fs.readFileSync(temp[0], tplConfig.encoding)
		);

		if (/^csr(Only)?$/i.test(temp[1])) {
			// csrOnly的情况，把除了资源引入的代码都干掉
			if (RegExp.$1) {
				let match;
				let deps = [];

				reDeps.lastIndex = 0;
				while (!!(match = reDeps.exec(fileContent))) {
					deps.push(match[0]);
				}
				reInlines.lastIndex = 0;
				while (!!(match = reInlines.exec(fileContent))) {
					deps.push(match[0]);
				}

				fileContent = deps.join('\n');
			}

			if (!assetConfig) {
				fileContent = '{{ js(' +
					JSON.stringify('./' + path.basename(temp[0])) +
				') }}\n' + fileContent;
			}
		}

		const fn = root.compile(
			fileContent,
			normalizePath(fixExtname(tplPath))
		);

		if (tplConfig.cache) { tplFnCache[tplPath] = fn; }
		return fn;
	}


	// 用于加载extend、parse、include指令的模板
	loader = {
		load(tpl, callback) {
			if (tpl.originalName[0] !== '.' && !path.isAbsolute(tpl.originalName)) {
				tpl.name = normalizePath(
					path.join(tplConfig.rootPath, tpl.name)
				);
			}
			tpl.name = fixExtname(tpl.name);

			// 同步父模板的参数
			if (tpl.parent) {
				let name = tpl.name.split('?');
				let parentName = tpl.parent.name.split('?');
				if (parentName[1]) {
					name[1] = parentName[1];
					tpl.name = name.join('?');
				}
			}

			callback(null, getTplFn(tpl.root, tpl.name));
		}
	};


	// 输出资源引用代码的控制逻辑
	function writeAssets(assetList, cbForPath, cbForURL, cbForInline) {
		return assetList.map((asset) => {
			// 分开本地路径、URL、行内代码三种类型
			if (typeof asset === 'string') {
				if (util.isURL(asset)) {
					return (cbForURL || cbForPath)(asset);
				} else {
					return cbForPath(asset);
				}
			} else {
				return cbForInline(asset);
			}
		}).join('\n');
	}

	// 已构建和未构建的资源输出方式不一样
	let writeCSS, writeJS, writeModjs;
	if (assetConfig) {
		writeCSS = (cssList) => {
			return writeAssets(cssList, (href) => {
				return '<script>document.write("<style>" + cssFiles[' +
					JSON.stringify(shortenPath(href)) +
				'] + "</style>");</script>';
			}, (url) => {
				return '<link rel="stylesheet" href="' + url + '" />';
			}, (inline) => {
				return '<style>' + inline.content + '</style>';
			});
		};

		writeJS = (jsList) => {
			return writeAssets(jsList, (src) => {
				return '<script>jsFiles[' +
					JSON.stringify(shortenPath(src)) +
				'](window);</script>';
			}, (url) => {
				return '<script src=' + JSON.stringify(url) + '></script>';
			}, (inline) => {
				return '<script>' + inline.content + '</script>';
			});
		};
	} else {
		writeCSS = (cssList) => {
			return writeAssets(cssList, (href) => {
				return '<link rel="stylesheet" href=' + JSON.stringify(shortenPath(href, true)) + ' />';
			}, null, (inline) => {
				return '<style>' + inline.content + '</style>';
			});
		};

		writeJS = (jsList) => {
			return writeAssets(jsList, (src) => {
				return '<script src=' + JSON.stringify(shortenPath(src, true)) + '></script>';
			}, null, (inline) => {
				return '<script>' + inline.content + '</script>';
			});
		};
	}

	writeModjs = (modjsList) => {
		return writeAssets(modjsList, (src) => {
			return '<script>require(' + JSON.stringify(shortenPath(src)) + ');</script>';
		}, null, (inline) => {
			return '<script>require(' + JSON.stringify(
				inline.params.map(shortenPath)
			) + ', ' + inline.content + ');</script>';
		});
	};


	// 资源引用输出配置
	const assetTypes = [
		{
			type: 'headjs',
			tag: '</head>',
			write: writeJS
		},
		{
			type: 'css',
			tag: '</head>',
			write: writeCSS
		},
		{
			type: 'js',
			tag: '</body>',
			write: writeJS
		},
		{
			type: 'modjs',
			tag: '</body>',
			write: writeModjs
		}
	];

	// 渲染模板主函数
	function render(tplPath, data, callback) {
		getInstance(tplPath).render(data, (err, result) => {
			if (!err) {
				result = result.replace(
					'</head>',
					'<script>var jsFiles = {}, cssFiles = {};</script>\n</head>'
				);

				assetTypes.forEach((assetType) => {
					const appendedHTML = [];

					// 构建后的资源引入
					const files = data['__' + assetType.type + 'Files'];
					if (files) {
						files.forEach((url) => {
							appendedHTML.push(`<script src="${url}"></script>`);
						});
					}

					// 构建后为资源调用，构建前为资源引入和调用
					const invokeList = data['__' + assetType.type + 'List'];
					if (invokeList) {
						appendedHTML.push(assetType.write(invokeList));
					}

					if (appendedHTML.length) {
						appendedHTML.push(assetType.tag);
						result = result.replace(
							assetType.tag,
							appendedHTML.join('\n')
						);
					}
				});

				result = result.replace(
					'</body>',
					'<script>jsFiles = cssFiles = null;</script>\n</body>'
				);
			}

			callback(err, result);
		});
	}


	Object.assign(tplConfig, config);
	if (tplConfig.rootPath) {
		tplConfig.rootDirname = path.basename(tplConfig.rootPath);
	}

	xTplCommands = basicCommands(tplConfig);
	if (appConfig.xTplCommands) {
		const otherCommands = require(appConfig.xTplCommands);
		Object.keys(otherCommands).forEach((key) => {
			xTplCommands[key] = xTplCommands[key] || otherCommands[key];
		});
	}


	// 供Express调用的类
	class XTplView {
		constructor(name) {
			this.path = this.name = fixExtname(
				normalizePath(
					path.resolve(tplConfig.rootPath, name)
				)
			);
		}

		render(data, callback) {
			console.time('Render ' + this.path);
			render(this.path, data, (err, result) => {
				console.timeEnd('Render ' + this.path);
				callback(err, result);
			});
		}
	}

	app.set('view', XTplView);
};