!function(global) { 'use strict';

global.bowljs.config({
	basePath: '/assets/',
	debug: false,
	map: [
		function(url) {
			if ( /\.qq\.com$/.test(url.hostname) ) {
				return;
			}

			url.pathname = /\.xtpl(\.js)?$/.test(url.pathname)
				? url.pathname.replace(/(\.xtpl)$/, '$1.js')
				: url.pathname.replace(/(?:\.mod)?(\.js)$/, '.mod$1')
		}
	]
});

}(window);