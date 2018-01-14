/*!
 * Back2Front
 * XTemplate调用封装
 */

'use strict';

const path = require('path');
const fs = require('fs');
const XTemplate = require('xtemplate');
const appConfig = require('../config');
const util = require('./util');
const basicCommands = require('./xtpl-commands');
const assetConfig = require('../asset-config');


exports.express = function(app, config) {
	const tplConfig = {
		cache: appConfig.env !== 'development',
		catchError: appConfig.env !== 'production',
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


	// 带缓存的XTemplate实例创建
	const instanceCache = { };
	function getInstance(tplPath) {
		if (instanceCache[tplPath]) {
			return instanceCache[tplPath];
		}
		const instance = new XTemplate(
			fs.readFileSync(tplPath, tplConfig.encoding),
			{
				name: normalizePath(fixExtname(tplPath)),
				loader: loader,
				commands: xTplCommands,
				catchError: tplConfig.catchError
			}
		);
		if (tplConfig.cache) {
			instanceCache[tplPath] = instance;
		}
		return instance;
	}

	// 带缓存的模板函数编译
	const fnCache = { };
	const reDeps = /\{{2,3}\s*(?:extend|parse|include|includeOnce|css|js|modjs)\s*\([\W\w]+?\)\s*\}{2,3}/g;
	const reInlines = /\{{2}#(css|js|modjs)\s+[\W\w]+?\}{2}[\W\w]*?\{{2}\/\1\}{2}/g;
	function getTplFn(root, tplPath) {
		if (fnCache[tplPath]) {
			return fnCache[tplPath];
		}

		let temp = tplPath.split('?');
		let fileContent = fs.readFileSync(temp[0], tplConfig.encoding);

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
		if (tplConfig.cache) { fnCache[tplPath] = fn; }

		return fn;
	}


	// 用于加载extend、parse、include指令的模板
	loader = {
		load(tpl, callback) {
			if (tpl.originalName[0] !== '.') {
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
			// 分隔开本地路径、URL、行内代码三种类型
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

	// 根据资源根目录缩短URL
	function shortenPath(url, addDirname) {
		if (!util.isURL(url)) {
			url = path.relative(tplConfig.rootPath, url).replace(/\\/g, '/');
			if (addDirname === true) {
				url = '/' + tplConfig.rootDirname + '/' + url;
			}
		}
		return url;
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
				return '<link rel="stylesheet" href="' + shortenPath(href, true) + '" />';
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


	// 渲染模板主函数
	function render(tplPath, data, callback) {
		getInstance(tplPath).render(data, (err, result) => {
			if (!err) {
				result = result.replace(
					'<!-- Headjs Hook -->',
					data.headjsList ? writeJS(data.headjsList) : ''
				).replace(
					'<!-- CSS Hook -->',
					data.cssList ? writeCSS(data.cssList) : ''
				).replace(
					'<!-- JS Hook -->',
					data.jsList ? writeJS(data.jsList) : ''
				).replace(
					'<!-- Modjs Hook -->',
					data.modjsList ? writeModjs(data.modjsList) : ''
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
	let otherCommands;
	try {
		otherCommands = require(appConfig.xTplCommands);
	} catch (e) {

	}
	if (otherCommands) {
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
			render(this.path, data, callback);
		}
	}

	app.set('view', XTplView);
};