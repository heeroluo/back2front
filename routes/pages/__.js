var pageType = require('../page-type');

exports['/'] = pageType.basic(function(req, res) {
	res.routeHelper.viewData('content', 'Hello world');
});