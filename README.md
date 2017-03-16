# Back2Front
基于Express和XTemplate的模块化开发框架


## 模块化

一说起「模块化」这个词，很多人首先会想到Javascript的**AMD/CMD**规范。然而，页面上的一个完整的模块是由HTML、CSS和Javascript共同组成的，而不光是Javascript。

在本框架中，你可以把HTML、CSS和Javascript都写在在模块文件（**\*.xtpl**）中，例如：

```
<header id="header" class="header"></header>
{{#css ()}}
.header {
	background: gray;
	height: 100px;
}
{{/css}}
{{#modjs('lib/dom@1.1)}}
function($) {
	$('#header').text('I am header');
}
{{/modjs}}

也可以通过外链的方式引用CSS、Javascript代码：

```
<header id="header" class="header"></header>
{{ css('./header') }}
{{ modjs('./header') }}