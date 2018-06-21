## 简介

**Back2Front** 是基于 [Express](https://github.com/expressjs/expressjs.com) 和 [XTemplate](https://github.com/xtemplate/xtemplate) 开发的**模块化**前后端**同构**框架，支持：

- 把HTML及其对应的JS、CSS封装成模块，便于整体调用；
- 对静态资源进行预处理；
- 前后端同构。

本框架主要应用于多页应用（Multi page application），并配备对应的构建工具 [Back2Front-CLI](https://github.com/heeroluo/back2front-cli) 。

兼容性：
- IE >= 6 。
- Node.js >= 6.5.0 。


## 模块化与渲染

### 模块

说起「模块化」这个词，很多人首先会想到Javascript的**AMD**或者**CMD**规范。然而，页面上的一个模块是由HTML、CSS和Javascript共同组成的，而不光是Javascript。

在本框架中，你可以把HTML和对应的资源引用写成一个模块。例如：

```
{{! components/tabs/1.0/tabs.xtpl }}
<div class="tabs">
    <ul class="tabs__nav">
        {{#each (tabNav)}}<li>{{ this }}</li>{{/each}}
    </ul>
    <div class="tabs__body">
        {{#each (tabBody)}}<div>{{ this }}</div>{{/each}}
    </div>
</div>
{{ css('./tabs') }}
{{ modjs('./tabs') }}
```

### 后端渲染

在页面模板中调用「tabs」模块，即可进行后端渲染：

```
{{! pages/a/a.page.xtpl }}
<!DOCTYPE html>
<html>
<head>
    {{ headjs('lib/bowljs/1.2/bowl') }}
    {{ headjs('lib/bowljs/1.2/bowl-config') }}
</head>
<body>
    {{ parse(
        'components/tabs/1.0/tabs'
        tabNav = ['Tab A', 'Tab B'],
        tabBody = ['Content A', 'Content B']
    ) }}
</body>
</html>
```

渲染结果为：

```
<!DOCTYPE html>
<html>
<head>
    <script src="/assets/lib/bowljs/1.2/bowl.raw.js"></script>
    <script src="/assets/lib/bowljs/1.2/bowl-config.raw.js"></script>
    <link href="/assets/components/tabs/1.0/tabs.css" />
</head>
<body>
    <div class="tabs">
        <ul class="tabs__nav">
            <li>Tab A</li>
            <li>Tab B</li>
        </ul>
        <div class="tabs__body">
            <div>Content A</div>
            <div>Content B</div>
        </div>
    </div>
    <script>require("components/tabs/1.0/tabs.js");</script>
</body>
</html>
```

### 前端渲染

前端渲染则需要在页面js文件中进行。例如：

```
// pages/b/b.js
const xTpl = require('xtpl/xtpl');
const $ = require('lib/jquery/1.9/jquery');

xTpl.render(
    _tpl('components/tabs/1.0/tabs.xtpl'), {
        tabNav: ['Tab A', 'Tab B'],
        tabBody: ['Content A', 'Content B']
    }
).then((html) => {
    $(html).appendTo('body');
    require('./tabs').init();
});
```

在页面中引入js文件：

```
{{! pages/b/b.page.xtpl }}
<!DOCTYPE html>
<html>
<head>
    {{ headjs('lib/bowljs/1.2/bowl') }}
    {{ headjs('lib/bowljs/1.2/bowl-config') }}
</head>
<body>
    {{ modjs('./b') }}
</body>
</html>
```

页面渲染结果为：

```
<!DOCTYPE html>
<html>
<head>
    <script src="/assets/lib/bowljs/1.2/bowl.raw.js"></script>
    <script src="/assets/lib/bowljs/1.2/bowl-config.raw.js"></script>
    <link href="/assets/components/tabs/1.0/tabs.css" />
</head>
<body>
    <script>require("pages/b/b");</script>
</body>
</html>
```

「b.js」执行时就会把HTML注入到body元素。