import re

with open(r"D:\Sekai_two\memory-11\SekaiGame\src\main\resources\static\js\main.js", "r", encoding="utf-8") as f:
    content = f.read()

# Null-guard authScreen and authForm
content = content.replace(
    'const authScreen = document.getElementById("auth-screen");',
    'const authScreen = null;'
)
content = content.replace(
    'const authForm = document.getElementById("auth-form");',
    'const authForm = null;'
)

# Guard all method calls on potentially null elements
content = content.replace('authScreen.classList.', 'authScreen && authScreen.classList.')
content = content.replace('authForm.addEventListener', 'authForm && authForm.addEventListener')
content = content.replace('authForm.querySelector', 'authForm && authForm.querySelector')
content = content.replace('authForm.reset()', 'authForm && authForm.reset()')

# Auto-init if already authenticated
content = content.replace(
    'authTabs.forEach((tab) => {',
    'if (loadAuth()) { initApp(loadAuth()); }\nauthTabs.forEach((tab) => {'
)

with open(r"D:\Sekai_two\memory-11\SekaiGame\src\main\resources\static\js\main.js", "w", encoding="utf-8") as f:
    f.write(content)

print("Patched main.js successfully")
