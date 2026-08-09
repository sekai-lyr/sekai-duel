import urllib.request, json
r = urllib.request.urlopen('http://localhost:8091/')
html = r.read().decode('utf-8')
print('HTML:', len(html))
print('auth-screen:', 'auth-screen' in html)
print('app-shell:', 'app-shell' in html)
r = urllib.request.urlopen('http://localhost:8091/css/style.css')
print('CSS:', r.status, len(r.read()))
for f in ['main.js','app.js','api.js','auth.js']:
    r = urllib.request.urlopen('http://localhost:8091/js/'+f)
    print(f, r.status, len(r.read()))
for ep in ['/api/cards','/api/users/1','/api/collection/1','/api/duels/user/1']:
    r = urllib.request.urlopen('http://localhost:8091'+ep)
    d = json.loads(r.read().decode('utf-8'))
    print(ep, 'OK' if d['success'] else 'FAIL')
