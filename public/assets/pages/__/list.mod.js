var xTpl = require('common/xtpl@1.0');

setTimeout(function() {
	xTpl.render(require.resolve('./list-item'), {
		list: ['a', 'b', 'c', 'd']
	}).then(function(result) {
		document.getElementById('list').innerHTML = result;
	});
}, 2000);


require.async('//res.wx.qq.com/open/js/jweixin-1.0.0.js', function(wx) {
	alert('wx');
});