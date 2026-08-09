import re, os, urllib.request

# Check all files imported by main.js and whether they load via HTTP
files_to_check = [
    'catalog.js', 'app.js', 'ui.js', 'controller.js', 'engine.js',
    'model.js', 'storage.js', 'profile.js', 'collection.js',
    'rewards.js', 'auth.js', 'api.js', 'decks.js', 'rng.js'
]
base_url = 'http://localhost:8091/js/'
for f in files_to_check:
    try:
        r = urllib.request.urlopen(base_url + f)
        print(f'OK: {f} ({r.status}, {len(r.read())} bytes)')
    except Exception as e:
        print(f'FAIL: {f} - {e}')
