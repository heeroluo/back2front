/*!
 * Back2Front
 * XTemplate调用包装
 */

'use strict';

var fs = require('fs'),
	path = require('path'),
	XTemplate = require('xtemplate'),
	htmlMinifier = require('html-minifier'),
	appConfig = require('../config'),
	util = require('./util'),
	xTplCommands = require('./xtpl-commands'),
	assetConfig;


try {
	assetConfig = require('../assets');
} catch (e) {
	
}


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


	// 渲染模板主函数
	function render(tplPath, data, callback) {
		getInstance(tplPath).render(data, function(err, result) {
			if (!err) {
				if (data.cssList) {
					if (assetConfig) {
						result = result.replace(
							'<!-- CSS Hook -->',
							'<script>' +
							data.cssList.map(function(href) {
								return 'document.write("<style>" + ' +
									'cssFiles[' + JSON.stringify( shortenURL(href) ) + '] + ' +
								'"</style>");';
							}).join('\n') +
							'</script>'
						);
					} else {
						result = result.replace(
							'<!-- CSS Hook -->',
							data.cssList.map(function(href) {
								return '<link rel="stylesheet" href="' +
									shortenURL(href, true) + '" />';
							}).join('')
						);
					}
				}
				if (data.jsList) {
					if (assetConfig) {
						result = result.replace(
							'<!-- JS Hook -->',
							'<script>' +
							data.jsList.map(function(src) {
								return 'jsFiles[' +
									JSON.stringify( shortenURL(src) ) + '](window);';
							}).join('\n') +
							'</script>'
						);
					} else {
						result = result.replace(
							'<!-- JS Hook -->',
							data.jsList.map(function(src) {
								return '<script src="' + shortenURL(src, true) + '"></script>';
							}).join('')
						);
					}
				}
				if (data.modjsList) {
					result = result.replace(
						'<!-- Modjs Hook -->',
						'<script>require(' + JSON.stringify(
							data.modjsList.map(shortenURL)
						) + ');</script>'
					);
				}
				if (data.inlineModjsList) {
					result = result.replace(
						'<!-- InlineModjs Hook -->',
						data.inlineModjsList.map(function(inlineModJS) {
							return '<script>require(' + JSON.stringify(
								inlineModJS.deps.map(shortenURL)
							) + ', ' + inlineModJS.fn + ');</script>'
						}).join('')
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
		render(this.path, data, function(err, result) {
			if (!err && appConfig.env !== 'development') {
				// result = htmlMinifier.minify(result, {
				// 	collapseWhitespace: true,
				// 	removeComments: true
				// });
			}
			callback(err, result);
		});
	};

	util.extend(tplConfig, config);
	if (tplConfig.rootPath) {
		tplConfig.rootDirname = path.basename(tplConfig.rootPath);
	}
	xTplCommands = xTplCommands(tplConfig);
	app.set('view', XTplView);
};