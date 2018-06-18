'use strict';


function prependTo(elt, target) {
	if (Array.isArray(target)) {
		target = target.slice();
	} else if (target) {
		target = [target];
	} else {
		target = [];
	}

	if (elt) { target.unshift(elt); }

	return target;
}


exports.prependTo = prependTo;

exports.basic = (callbacks) => {
	return prependTo((req, res) => {
		res.routeHelper.viewData('title', 'Back2Front');
	}, callbacks);
};