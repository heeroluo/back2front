var Promise = require('lib/promise@1.0'),
	XTemplate = require('./xtemplate/index');


/**
 * 创建模板包装
 * @method createWrapper
 * @param {Object} options 选项
 *   @param {Function} options.loadTpl 加载模板的函数，返回Promise
 *   @param {Object} [options.commands] 模板指令
 * @return {Object} 带有render方法的模板包装
 */
exports.createWrapper = function(options) {
	var loadTpl = options.loadTpl, commands = options.commands;

	// 带缓存的模板函数编译
	var fnCache = { };
	function getTplFn(root, tplPath) {
		return new Promise(function(resolve, reject) {
			if (fnCache[tplPath]) {
				resolve(fnCache[tplPath]);
			} else {
				loadTpl(tplPath).then(function(tpl) {
					var fn = root.compile(tpl, tplPath);
					fnCache[tplPath] = fn;
					resolve(fn);
				});
			}
		});
	}

	// 用于加载extend、parse、include指令的模板
	var loader = {
		load: function(tpl, callback) {
			getTplFn(tpl.root, tpl.name).then(function(fn) {
				callback(null, fn);
			});
		}
	};

	// 带缓存的模板实例创建
	var instanceCache = { };
	function getInstance(tplPath) {
		return new Promise(function(resolve, reject) {
			if (instanceCache[tplPath]) {
				resolve(instanceCache[tplPath]);
			} else {
				loadTpl(tplPath).then(function(tpl) {
					instanceCache[tplPath] = new XTemplate(tpl, {
						name: tplPath,
						loader: loader,
						commands: commands
					});
					resolve(instanceCache[tplPath]);
				});
			}
		});
	}

	return {
		render: function(tplPath, context) {
			return getInstance(tplPath).then(function(instance) {
				return new Promise(function(resolve, reject) {
					instance.render(context, function(err, result) {
						if (err) {
							reject(err);
						} else {
							resolve(result);
						}
					});
				});
			});
		}
	};
};