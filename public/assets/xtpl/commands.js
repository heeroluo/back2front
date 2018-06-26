const util = require('../common/util/1.0/util');


// 浏览器端无需处理引入静态资源的逻辑，直接输出空白即可
exports.css =
exports.js =
exports.modjs = (scope, option, buffer) => {
	const empty = '';
	return option.fn ? buffer.write(empty) : empty;
};


// MD5资源映射表，通过外部js文件（md5-map）引入
let md5Map;
try {
	md5Map = window.md5Map;
} catch (e) {

}
md5Map = md5Map || {};

// 静态资源URL前缀，在root模板中输出为全局变量
let assetURLPrefix;
try {
	assetURLPrefix = util.toURL(window.ASSET_URL_PREFIX);
} catch (e) {

}
assetURLPrefix = assetURLPrefix || '/';
if (assetURLPrefix.charAt(assetURLPrefix.length - 1) !== '/') {
	assetURLPrefix += '/';
}

// 解析静态资源路径
exports.resolvePath = (function() {
	const reIsURL = /^(?:[a-z]+:)?\/\//;

	return function(scope, option) {
		const assetPath = option.params[0];
		let result;
		if (/^\./.test(assetPath)) {
			result = this.name.split('/');
			// 解析相对路径，先拿掉最后的文件名
			result.pop();
			assetPath.split('/').forEach(function(item) {
				switch (item) {
					case '.':
						// 当前目录，不用处理
						break;

					case '..':
						// 上级目录，拿掉一层文件夹
						result.pop();
						break;

					default:
						// 下级目录或文件名
						result.push(item);
				}
			});
		} else {
			result = assetPath;
		}

		result = result.join('/').replace(assetURLPrefix, '');

		if (reIsURL.test(result)) {
			return result;
		} else {
			result = result.replace(/^\//, '');
			return assetURLPrefix + result.replace(/\.\w+$/, function(match) {
				return md5Map[result] ? ('.' + md5Map[result] + match) : match;
			});
		}
	};
})();


// JSON序列化
exports.jsonEncode = (scope, option) => {
	return JSON.stringify(option.params[0]);
};

function toString(str) {
	return str == null ? '' : String(str);
}

// 换行符转为 <br />
exports.nl2br = (scope, option) => {
	return toString(option.params[0]).replace(/\r?\n/g, '<br />');
};

// 把空白替换成 &nbsp;
exports.space2nbsp = (scope, option) => {
	return toString(option.params[0]).replace(/\s{2,}/g, function(match) {
		return new Array(match.length + 1).join('&nbsp;');
	});
};