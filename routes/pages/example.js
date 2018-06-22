'use strict';

const pageType = require('../page-type');


exports['tabs-ssr'] =
exports['tabs-ssr-and-csr'] = pageType.basic((req, res) => {
	res.routeHelper.viewData({
		tabsNav: ['Tab A', 'Tab B', 'Tab C', 'Tab D'],
		tabsBody: ['I am A', 'I am B', 'I am C', 'I am D']
	});
});

exports['tabs-csr'] = pageType.basic();