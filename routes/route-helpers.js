/*!
 * Back2Front
 * Route helper
 *   为了避免把过多的属性和方法挂载到Express的res对象，
 *   把这些属性和方法放到RouteHelper类，
 *   这样就可以只挂载一个RouteHelper对象到res对象了。
 */

'use strict';

var util = require('../lib/util');
var assetConfig = require('../asset-config');


/**
 * 路由辅助器基类
 * @class BasicRouteHelper
 * @constructor
 * @param {String} template 页面模板路径
 */
var BasicRouteHelper = util.createClass(function(template) {
	this._viewData = { };
	this.setTemplate(template);
	this._type = 'basic';
}, {
	/**
	 * 获取路由辅助器类型
	 * @method type
	 * @for BasicRouteHelper
	 * @return {String} 路由辅助器类型
	 */
	type: function() { return this._type; },

	/**
	 * 设置页面模板
	 * @method setTemplate
	 * @for BasicRouteHelper
	 * @param {String} template 模板路径
	 */
	setTemplate: function(template) { this._template = template; },

	/**
	 * 获取视图数据
	 * @method viewData
	 * @for BasicRouteHelper
	 * @param {String} key 键
	 * @return {Any} 值
	 */
	/**
	 * 设置视图数据
	 * @method viewData
	 * @for BasicRouteHelper
	 * @param {String} key 键
	 * @param {Any} value 值
	 */
	/**
	 * 设置视图数据
	 * @method viewData
	 * @for BasicRouteHelper
	 * @param {Object} map 键值对
	 */
	viewData: function(key, value) {
		var viewData = this._viewData;
		if (arguments.length === 1 && typeof key === 'string') {
			return viewData[key];
		} else {
			if (typeof key === 'object') {
				util.extend(viewData, key);
			} else {
				viewData[key] = value;
			}
		}
	},

	/**
	 * 映射数据到viewData
	 * @method mapToViewData
	 * @for BasicRouteHelper
	 * @param {Array} dataSource 源数据
	 * @param {String|Function} mapWay 映射方式：为字符串时，即为映射的key；为函数时，返回map
	 */
	mapToViewData: function(dataSource, config) {
		var t = this;

		config.forEach(function(mapWay, i) {
			switch (typeof mapWay) {
				case 'string':
					t.viewData(mapWay, dataSource[i]);
					break;

				case 'function':
					var map = mapWay(dataSource[i]);
					if (typeof map === 'object') {
						util.each(map, function(key, value) {
							t.viewData(key, value);
						});
					}
					break;
			}
		});
	},

	/**
	 * 渲染视图
	 * @method render
	 * @for BasicRouteHelper
	 * @param {Object} res Response对象
	 */
	render: function(res) {
		this._rendered = true;
		res.end();
	},

	/**
	 * 渲染提示信息
	 * @method renderInfo
	 * @for BasicRouteHelper
	 * @param {Object} res Response对象
	 * @param {Object} info 提示信息
	 */
	renderInfo: function(res, info) { this.render(res); },

	/**
	 * 获取是否已渲染视图
	 * @method rendered
	 * @for BasicRouteHelper
	 * @return {Boolean} 是否已渲染视图
	 */
	rendered: function() { return !!this._rendered; }
});


/**
 * HTML路由辅助器
 * @class HTMLRouteHelper
 * @constructor
 * @extends BasicRouteHelper
 * @param {String} template 页面模板路径
 */
exports.HTMLRouteHelper = util.createClass(function(template) {
	this._type = 'html';
}, {
	render: function(res) {
		var t = this;
		if (assetConfig) {
			// 把构建后得出的资源列表导进viewData
			var assets = assetConfig.map[t._template];
			if (assets) {
				Object.keys(assets).forEach(function(assetType) {
					t.viewData(
						assetType + 'Files',
						assets[assetType].slice()
					);
				});
			}
		}
		res.render(t._template, t._viewData);
		t._rendered = true;
	},

	renderInfo: function(res, info) {
		info = util.extend({
			backURL: res.req.get('Referer'),
			status: 1
		}, info);
		this.viewData('info', info);
		this.setTemplate('pages/_info/_info.page.xtpl');
		this.render(res);
	}
}, BasicRouteHelper);


/**
 * JSON路由辅助器
 * @class JSONRouteHelper
 * @constructor
 * @extends BasicRouteHelper
 */
exports.JSONRouteHelper = util.createClass(function() {
	this._viewDataWrap = { status: 1 };
	this._type = 'json';
}, {
	render: function(res) {
		var viewDataWrap = this._viewDataWrap;
		viewDataWrap.data = this._viewData;
		res.json(viewDataWrap);
		this._rendered = true;
	},

	renderInfo: function(res, info) {
		util.extend(this._viewDataWrap, info);
		this._viewData = null;
		this.render(res);
	}
}, BasicRouteHelper);