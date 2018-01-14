/*!
 * Back2Front
 * 引入静态资源的XTemplate指令
 */

'use strict';

const path = require('path');
const escapeHTML = require('escape-html');
const util = require('./util');
const md5Map = require('../md5-map');
const assetConfig = require('../asset-config');


// 解析路径
function resolvePath(rootPath, from, to, extname) {
	// a@b解析为a/b/a
	to = to.replace(
		/([^\\\/]+)@([^\\\/]+)/g,
		(match, module, version) => {
			return module + '/' + version + '/' + module;
		}
	);

	if (!path.extname(to) && extname) {
		to += '.' + extname;
	}

	// 对非绝对路径进行解析
	if (!path.isAbsolute(to) && !util.isURL(to)) {
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
	let root = src;
	while (root.parent) { root = root.parent; }
	return root.scope.data;
}

// 解析静态资源路径，并放入对应的数组中
function createAssetImporter(rootPath, type, extname) {
	return function(scope, option, buffer) {
		const tplWrap = this;
		const rootData = findRootData(tplWrap);
		let assetList = rootData[type] = rootData[type] || [];

		const assetPaths = (option.params || []).map((assetPath) => {
			assetPath = resolvePath(rootPath, tplWrap.name, assetPath, extname);
			if (assetList.indexOf(assetPath) === -1) {
				assetList.push(assetPath);
			}
			return assetPath;
		});

		// 作为块级指令使用的情况
		if (option.fn) {
			const fakeBuffer = {
				data: '',
				write(data) {
					if (data !== null && data !== undefined) {
						if (data.isBuffer) { return data; }
						this.data += data;
					}
					return this;
				},
				writeEscaped(data) {
					if (typeof data === 'string') {
						data = escapeHTML(data);
					}
					return this.write(data);
				},
				error(e) {
					if (!(e instanceof Error)) {
						e = new Error(e);
					}
					throw e;
				}
			};
			option.fn(scope, fakeBuffer);

			assetList = rootData[type] = rootData[type] || [];
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


module.exports = (tplConfig) => {
	const rootPath = tplConfig.rootPath;

	let assetURLPrefix = assetConfig ? assetConfig.url_prefix : '/' + tplConfig.rootDirname;
	if (assetURLPrefix[assetURLPrefix.length - 1] !== '/') {
		assetURLPrefix += '/';
	}

	return {
		// 静态资源基础路径（要提供给前端解析路径）
		assetURLPrefix() { return assetURLPrefix; },

		// 解析静态资源路径
		resolvePath(scope, option) {
			let assetPath = path.relative(
				rootPath, resolvePath(rootPath, this.name, option.params[0])
			).replace(/\\/g, '/');
			return assetURLPrefix + (md5Map ? md5Map[assetPath] : assetPath);
		},

		// 引入CSS
		css: createAssetImporter(rootPath, 'cssList', 'css'),

		// 引入初始化所需的JS
		headjs: createAssetImporter(rootPath, 'headjsList', 'raw.js'),

		// 引入常规JS
		js: createAssetImporter(rootPath, 'jsList', 'raw.js'),

		// 引入模块化JS
		modjs: createAssetImporter(rootPath, 'modjsList', 'js')
	};
};