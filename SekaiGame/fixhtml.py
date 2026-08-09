import re

with open(r"D:\Sekai_two\memory-11\SekaiGame\src\main\resources\static\index.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. Replace branding
html = html.replace("Nightcord Duel Network", "Sekai Game")
html = html.replace("Nightcord Duel", "Sekai Game")
html = html.replace('brand-mark">25<', 'brand-mark">\u2726<')

# 2. Redirect if not authenticated (before page loads)
redirect_check = '<script>if(!localStorage.getItem("nightcord_auth")){location.href="/login"}</script>'
html = html.replace("<head>", "<head>\n" + redirect_check)

# 3. Auto-login script: if auth exists, simulate login flow
auto_login = '''
<script>
(function(){
    var auth = JSON.parse(localStorage.getItem("nightcord_auth")||"null");
    if(auth && auth.userId){
        // Hide auth screen immediately, show app shell
        var as = document.getElementById("auth-screen");
        var shell = document.getElementById("app-shell");
        if(as) as.style.display = "none";
        if(shell) shell.classList.remove("is-hidden");
    }
})();
</script>
'''
html = html.replace("<body>", "<body>\n" + auto_login)

with open(r"D:\Sekai_two\memory-11\SekaiGame\src\main\resources\static\index.html", "w", encoding="utf-8") as f:
    f.write(html)
print("Done!")
