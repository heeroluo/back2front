var XTpl = require('common/xtpl@1.0');

setTimeout(function() {
	XTpl.render(require.resolve('./list-item.xtpl'), {
		list: ['a', 'b', 'c', 'd']
	}).then(function(result) {
		document.getElementById('list').innerHTML = result;
	});
}, 2000);


require.async('//res.wx.qq.com/open/js/jweixin-1.0.0.js', function(wx) {
	console.dir(wx);
});