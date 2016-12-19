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
			.replace(/\/{2,}/g, '/')
			.replace(/\?.*$/, '');
	}

	// 增加扩展名
	function fixExtname(srcPath) {
		var extname = path.extname(srcPath);
		if (!extname || extname === '.page') {
			srcPath += tplConfig.defaultExtname;
		}
		return srcPath;
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
				name: tplPath,
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
	function getTplFn(root, tplPath) {
		if (fnCache[tplPath]) {
			return fnCache[tplPath];
		}
		var fn = root.compile(
			fs.readFileSync(tplPath, tplConfig.encoding),
			tplPath
		);
		if (tplConfig.cache) {
			fnCache[tplPath] = fn;
		}
		return fn;
	}


	// 用于加载extend、parse、include指令的模板
	var loader = {
		load: function(tpl, callback) {
			tpl.name = normalizePath(tpl.name);
			if (tpl.originalName[0] !== '.') {
				tpl.name = path.join(tplConfig.rootPath, tpl.name);
			}
			callback( null, getTplFn( tpl.root, fixExtname(tpl.name) ) );
		}
	};


	// 根据资源根目录缩短URL
	function shortenURL(url, addDirname) {
		if ( !util.isURL(url) ) {
			url = path.relative(tplConfig.rootPath, url);
			if (addDirname === true) {
				url = '/' + tplConfig.rootDirname + '/' + url;
			}
		}
		return url;
	}


	// 输出资源引用代码的控制逻辑
	// 主要是分隔开引用地址和行内代码(如<script src="..."></script>和<script>...</script>)
	function writeAssets(assets, cbForStrs, cbForObj) {
		var temp = [ ], outputs = '';

		assets.forEach(function(asset) {
			switch (typeof asset) {
				// 为字符串时，即URL
				case 'string':
					temp.push(asset);
					break;

				// 为对象时，是行内代码
				case 'object':
					if (temp.length) {
						outputs += '\n' + cbForStrs(temp);
						temp = [ ];
					}
					outputs += '\n' + cbForObj(asset);
					break;
			}
		});

		// assets的最后一个元素不为object时，temp会有字符串剩余
		if (temp.length) { outputs += '\n' + cbForStrs(temp); }

		return outputs.substr(1);
	}


	// 已构建和未构建的资源输出方式不一样
	var writeCSS, writeJS, writeModjs;
	if (assetConfig) {
		writeCSS = function(cssList) {
			return writeAssets(cssList, function(assets) {
				return '<script>document.write("<style>");\n' +
					assets.map(function(href) {
						return 'document.write(cssFiles[' +
							JSON.stringify( shortenURL(href) ) + ']' +
						');';
					}).join('\n') +
				'\ndocument.write("</style>");</script>';
			}, function(inlineAsset) {
				return '<style>' + inlineAsset.content + '</style>';
			});
		};

		writeJS = function(jsList) {
			return writeAssets(jsList, function(assets) {
				return '<script>' +
					assets.map(function(src) {
						return 'jsFiles[' +
							JSON.stringify( shortenURL(src) )
						+ '](window);';
					}).join('\n') +
				'</script>';
			}, function(inlineAsset) {
				return '<script>' + inlineAsset.content + '</script>';
			});
		};
	} else {
		writeCSS = function(cssList) {
			return writeAssets(cssList, function(assets) {
				return assets.map(function(href) {
					return '<link rel="stylesheet" href="' +
						shortenURL(href, true) + '" />';
				}).join('\n');
			}, function(inlineAsset, write) {
				return '<style>' + inlineAsset.content + '</style>';
			});
		};

		writeJS = function(jsList) {
			return writeAssets(jsList, function(assets, write) {
				return assets.map(function(src) {
					return '<script src="' +
						shortenURL(src, true) + '"></script>';
				}).join('\n');
			}, function(inlineAsset, write) {
				return '<script>' + inlineAsset.content + '</script>';
			});
		};
	}

	writeModjs = function(modjsList) {
		return writeAssets(modjsList, function(assets) {
			return '<script>require(' + JSON.stringify(
				assets.map(shortenURL)
			) + ');</script>';
		}, function(inlineAsset) {
			return '<script>require(' + JSON.stringify(
				inlineAsset.params.map(shortenURL)
			) + ', ' + inlineAsset.content + ');</script>';
		});
	};


	// 渲染模板主函数
	function render(tplPath, data, callback) {
		getInstance(tplPath).render(data, function(err, result) {
			if (!err) {
				if (data.cssList) {
					result = result.replace(
						'<!-- CSS Hook -->',
						writeCSS(data.cssList)
					);
				}
				if (data.jsList) {
					result = result.replace(
						'<!-- JS Hook -->',
						writeJS(data.jsList)
					);
				}
				if (data.modjsList) {
					result = result.replace(
						'<!-- Modjs Hook -->',
						writeModjs(data.modjsList)
					);
				}
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
	app.set('view', XTplView);
};