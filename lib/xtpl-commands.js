/*!
 * Back2Front
 * 引入静态资源的XTemplate指令
 */

'use strict';

var path = require('path'),
	util = require('./util');


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
			// a@b解析为a/b/a
			assetPath = assetPath.replace(
				/([^\\\/]+)@([^\\\/]+)/g,
				function(match, module, version) {
					return module + '/' + version + '/' + module;
				}
			);

			if (!path.extname(assetPath) && extname) {
				assetPath += '.' + extname;
			}
		
			// 对非绝对路径进行解析
			if ( !path.isAbsolute(assetPath) && !util.isURL(assetPath) ) {
				if (assetPath[0] === '.') {
					assetPath = path.join(path.dirname(tplWrap.name), assetPath);
				} else {
					assetPath = path.join(rootPath, assetPath);
				}
			}

			if (assetList.indexOf(assetPath) === -1) {
				assetList.push(assetPath);
			}

			return assetPath;
		});

		// 作为块级指令使用的情况
		if (option.fn) {
			var fakeBuffer = { data: '' };
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
	var rootPath = tplConfig.rootPath;

	return {
		// 引入CSS
		css: createAssetImporter(rootPath, 'cssList', 'css'),

		// 引入JS
		js: createAssetImporter(rootPath, 'jsList', 'js'),

		// 引入模块化JS
		modjs: createAssetImporter(rootPath, 'modjsList', 'mod.js')
	};
};