import re
with open(r'D:\Sekai_two\memory-11\SekaiGame\src\main\resources\static\index.html','r',encoding='utf-8') as f:
    html=f.read()
html=re.sub(r'<script>\s*\(function\(\)\{.*?\}\}\)\(\);\s*</script>','',html,flags=re.DOTALL)
html=re.sub(r'<script>if\(!localStorage\.getItem\(\"nightcord_auth\"\)\)\{location\.href=.+?</script>','',html)
redirect='\n<script>if(!localStorage.getItem(\"nightcord_auth\")){location.href=\"/login\"}</script>\n'
html=html.replace('</head>',redirect+'</head>')
with open(r'D:\Sekai_two\memory-11\SekaiGame\src\main\resources\static\index.html','w',encoding='utf-8') as f:
    f.write(html)
print(f'Size: {len(html)}')
print(f'auth-screen: {\"auth-screen\" in html}')
print(f'app-shell: {\"app-shell\" in html}')
