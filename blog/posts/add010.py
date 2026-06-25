#!/usr/bin/env python3
content = open('/Users/pro2015/danshu-de-go/blog/index.html').read()
new_entry = '{file:"posts/010.html",title:"断酒、例会、みんな行けるようになるといいね。GPS現在地表示・かもちゃん決定木チャット完成",date:"2026-06-25",tags:["GPS","チャット","決定木","かもちゃん","UX"]},'
content = content.replace('const POSTS=[', 'const POSTS=[\n' + new_entry)
open('/Users/pro2015/danshu-de-go/blog/index.html', 'w').write(content)
print('done')
