'use strict';

var pageType = require('../page-type');


exports['list-ssr'] = 
exports['list-ssr-and-csr'] = pageType.basic(function(req, res, next) {
	res.routeHelper.viewData('list', [
		'Item A',
		'Item B',
		'Item C',
		'Item D'
	]);
});

exports['list-csr'] = pageType.basic(function(req, res, next) { });