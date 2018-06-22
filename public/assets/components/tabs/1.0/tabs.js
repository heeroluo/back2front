const $ = require('lib/dom/1.1/dom');

exports.init = ($elt) => {
	const $navBodys = $elt.find('.js-body-item');

	$elt.find('.js-nav-item').click(function() {
		const $self = $(this);
		$self.addClass('nav-item--current')
			.siblings().removeClass('nav-item--current');

		const i = $self.index();
		$navBodys.removeClass('body-item--current')
			.eq(i).addClass('body-item--current');
	}).eq(0).click();
};