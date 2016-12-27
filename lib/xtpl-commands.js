/*!
 * Back2Front
 * 引入静态资源的XTemplate指令
 */

'use strict';

var path = require('path'),
	escapeHTML = require('escape-html'),
	util = require('./util'),
	assetConfig = require('../asset-config');


// 解析路径
function resolvePath(rootPath, from, to, extname) {
	// a@b解析为a/b/a
	to = to.replace(
		/([^\\\/]+)@([^\\\/]+)/g,
		function(match, module, version) {
			return module + '/' + version + '/' + module;
		}
	);

	if (!path.extname(to) && extname) {
		to += '.' + extname;
	}

	// 对非绝对路径进行解析
	if ( !path.isAbsolute(to) && !util.isURL(to) ) {
		if (to[0] === '.') {
			to = path.join(path.dirname(from), to);
		} else {
			to = path.join(rootPath, to);
		}
	}

	return to;
}


// 找到最顶层的数据（即页面数据）
function findRootData(src) {
	var root = src;
	while (root.parent) { root = root.parent; }
	return root.scope.data;
}

// 解析静态资源路径，并放入对应的数组中
function createAssetImporter(rootPath, type, extname) {
	return function(scope, option, buffer) {
		var tplWrap = this,
			rootData = findRootData(tplWrap),
			assetList = rootData[type] = rootData[type] || [ ];

		var assetPaths = (option.params || [ ]).map(function(assetPath) {
			assetPath = resolvePath(rootPath, tplWrap.name, assetPath, extname);
			if (assetList.indexOf(assetPath) === -1) {
				assetList.push(assetPath);
			}
			return assetPath;
		});

		// 作为块级指令使用的情况
		if (option.fn) {
			var fakeBuffer = {
				data: '',
				write: function(data) {
					if (data !== null && data !== undefined) {
						if (data.isBuffer) { return data; }
						this.data += data;
					}
					return this;
				},
				writeEscaped: function(data) {
					if (typeof data === 'string') {
						data = escapeHTML(data);
					}
					return this.write(data);
				}
			};
			option.fn(scope, fakeBuffer);

			assetList = rootData[type] = rootData[type] || [ ];
			assetList.push({
				params: assetPaths,
				content: fakeBuffer.data.trim()
			});

			return buffer.write('');
		} else {
			return '';
		}
	};
}


module.exports = function(tplConfig) {
	var rootPath = tplConfig.rootPath,
		assetURLPrefix = assetConfig ? assetConfig.url_prefix : '/' + tplConfig.rootDirname;

	if (assetURLPrefix[assetURLPrefix.length - 1] !== '/') {
		assetURLPrefix += '/';
	}

	return {
		// 解析路径(主要用于引入静态资源)
		resolvePath: function(scope, option, buffer) {
			return assetURLPrefix + path.relative(
				rootPath, resolvePath(rootPath, this.name, option.params[0])
			).replace(/\\/g, '/');
		},

		// 引入CSS
		css: createAssetImporter(rootPath, 'cssList', 'css'),

		// 引入JS
		js: createAssetImporter(rootPath, 'jsList', 'js'),

		// 引入模块化JS
		modjs: createAssetImporter(rootPath, 'modjsList', 'mod.js')
	};
};