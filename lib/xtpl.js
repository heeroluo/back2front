/*!
 * Back2Front
 * XTemplate调用封装
 */

'use strict';

var path = require('path'),
	fs = require('fs'),	
	XTemplate = require('xtemplate'),
	appConfig = require('../config'),
	util = require('./util'),
	xTplCommands = require('./xtpl-commands'),
	assetConfig = require('../asset-config');


exports.express = function(app, config) {
	var tplConfig = {
		cache: appConfig.env !== 'development',
		catchError: appConfig.env !== 'production',
		encoding: 'utf8',
		defaultExtname: '.xtpl'
	};


	// 标准化路径
	function normalizePath(srcPath) {
		return srcPath
			.replace(/\\/g, '/')
			.replace(/\/{2,}/g, '/');
	}

	// 增加扩展名
	function fixExtname(srcPath) {
		srcPath = srcPath.split('?');
		var extname = path.extname(srcPath[0]);
		if (!extname || extname === '.page') {
			srcPath[0] += tplConfig.defaultExtname;
		}
		return srcPath.join('?');
	}


	// 带缓存的XTemplate实例创建
	var instanceCache = { };
	function getInstance(tplPath) {
		if (instanceCache[tplPath]) {
			return instanceCache[tplPath];
		}
		var instance = new XTemplate(
			fs.readFileSync(tplPath, tplConfig.encoding),
			{
				name: normalizePath( fixExtname(tplPath) ),
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
	var fnCache = { };
	var re_deps = /\{{2,3}\s*(?:extend|parse|include|includeOnce|css|js|modjs)\s*\([\W\w]+?\)\s*\}{2,3}/g;
	var re_inlines = /\{{2}#(css|js|modjs)\s+[\W\w]+?\}{2}[\W\w]*?\{{2}\/\1\}{2}/g;
	function getTplFn(root, tplPath) {
		if (fnCache[tplPath]) {
			return fnCache[tplPath];
		}

		var temp = tplPath.split('?'),
			fileContent = fs.readFileSync(temp[0], tplConfig.encoding);

		if ( /^csr(Only)?$/i.test(temp[1]) ) {
			// csrOnly的情况，把除了资源引入的代码都干掉
			if (RegExp.$1) {
				var match, deps = [ ];

				re_deps.lastIndex = 0;
				while ( match = re_deps.exec(fileContent) ) {
					deps.push(match[0]);
				}
				re_inlines.lastIndex = 0;
				while ( match = re_inlines.exec(fileContent) ) {
					deps.push(match[0]);
				}

				fileContent = deps.join('\n');
			}

			if (!assetConfig) {
				fileContent = '{{ js(' +
					JSON.stringify( './' + path.basename(temp[0]) + '.js' ) +
				') }}\n' + fileContent;
			}
		}

		var fn = root.compile(
			fileContent,
			normalizePath( fixExtname(tplPath) )
		);
		if (tplConfig.cache) {
			fnCache[tplPath] = fn;
		}
		return fn;
	}


	// 用于加载extend、parse、include指令的模板
	var loader = {
		load: function(tpl, callback) {
			if (tpl.originalName[0] !== '.') {
				tpl.name = normalizePath(
					path.join(tplConfig.rootPath, tpl.name)
				);
			}
			tpl.name = fixExtname(tpl.name);

			// 同步父模板的参数
			if (tpl.parent) {
				var name = tpl.name.split('?'),
					parentName = tpl.parent.name.split('?');

				if (parentName[1]) {
					name[1] = parentName[1];
					tpl.name = name.join('?');
				}
			}

			callback( null, getTplFn(tpl.root, tpl.name) );
		}
	};


	// 输出资源引用代码的控制逻辑
	function writeAssets(assetList, cbForPath, cbForURL, cbForInline) {
		return assetList.map(function(asset) {
			// 分隔开本地路径、URL、行内代码三种类型
			if (typeof asset === 'string') {
				if ( util.isURL(asset) ) {
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
		if ( !util.isURL(url) ) {
			url = path.relative(tplConfig.rootPath, url).replace(/\\/g, '/');
			if (addDirname === true) {
				url = '/' + tplConfig.rootDirname + '/' + url;
			}
		}
		return url;
	}

	// 已构建和未构建的资源输出方式不一样
	var writeHeadjs, writeCSS, writeJS, writeModjs;
	if (assetConfig) {
		writeCSS = function(cssList) {
			return writeAssets(cssList, function(href) {
				return '<script>document.write("<style>" + cssFiles[' +
					JSON.stringify( shortenPath(href) ) +
				'] + "</style>");</script>';
			}, function(url) {
				return '<link rel="stylesheet" href="' + url + '" />';
			}, function(inline) {
				return '<style>' + inline.content + '</style>';
			});
		};

		writeJS = function(jsList) {
			return writeAssets(jsList, function(src) {
				return '<script>jsFiles[' +
					JSON.stringify( shortenPath(src) ) +
				'](window);</script>';
			}, function(url) {
				return '<script src=' + JSON.stringify(url) + '></script>';
			}, function(inline) {
				return '<script>' + inline.content + '</script>';
			});
		};
	} else {
		writeCSS = function(cssList) {
			return writeAssets(cssList, function(href) {
				return '<link rel="stylesheet" href="' + shortenPath(href, true) + '" />';
			}, null, function(inline) {
				return '<style>' + inline.content + '</style>';
			});
		};

		writeJS = function(jsList) {
			return writeAssets(jsList, function(src) {
				return '<script src=' + JSON.stringify( shortenPath(src, true) ) + '></script>';
			}, null, function(inline) {
				return '<script>' + inline.content + '</script>';
			})
		};
	}

	writeHeadjs = writeJS;

	writeModjs = function(modjsList) {
		return writeAssets(modjsList, function(src) {
			return '<script>require(' + JSON.stringify( shortenPath(src) ) + ');</script>';
		}, null, function(inline) {
			return '<script>require(' + JSON.stringify(
				inline.params.map(shortenPath)
			) + ', ' + inline.content + ');</script>';
		});
	};


	// 渲染模板主函数
	function render(tplPath, data, callback) {
		getInstance(tplPath).render(data, function(err, result) {
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


	// 供Express调用的类
	function XTplView(name, opts) {
		this.path = this.name = fixExtname(
			normalizePath(
				path.resolve(tplConfig.rootPath, name)
			)
		);
	}
	XTplView.prototype.render = function(data, callback) {
		render(this.path, data, callback);
	};

	util.extend(tplConfig, config);
	if (tplConfig.rootPath) {
		tplConfig.rootDirname = path.basename(tplConfig.rootPath);
	}

	xTplCommands = xTplCommands(tplConfig);
	var otherCommands;
	try {
		otherCommands = require('../public/assets/common/xtpl/1.0/commands');
	} catch (e) {
		
	}
	if (otherCommands) {
		for (var i in otherCommands) {
			xTplCommands[i] = xTplCommands[i] || otherCommands[i];
		}
	}

	app.set('view', XTplView);
};