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

		var fn = root.compile(fileContent, tplPath);
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
				result = result.replace(
					/(?:\r?\n)?<!-- CSS Hook -->(?:\r?\n)?/,
					data.cssList ? writeCSS(data.cssList) : ''
				).replace(
					/(?:\r?\n)?<!-- JS Hook -->(?:\r?\n)?/,
					data.jsList ? writeJS(data.jsList) : ''
				).replace(
					/(?:\r?\n)?<!-- Modjs Hook -->(?:\r?\n)?/,
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
		otherCommands = require('../public/assets/common/xtpl/1.0/commands.mod.js');
	} catch (e) {

	}
	if (otherCommands) {
		for (var i in otherCommands) {
			xTplCommands[i] = xTplCommands[i] || otherCommands[i];
		}
	}

	app.set('view', XTplView);
};