exports['/'] = function(req, res) {
	res.routeHelper.viewData('list', [
		'111',
		'222',
		'333',
		'444'
	]);
};