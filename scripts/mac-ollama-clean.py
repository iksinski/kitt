#!/opt/homebrew/bin/python3
"""Locked-down Ollama cleanup proxy — deployed to the Mac as ~/.kitt-ollama-clean.py and
pinned as the forced command for kitt's SSH key (command="...",restrict). kitt can run
ONLY this: it reads a JSON batch [{"id","text"}] on stdin, brings Ollama up if it's down,
cleans each article's text, tears Ollama down if it started it, and prints [{"id","cleaned"}].
No shell, no filesystem, no other commands are reachable through this key."""
import sys, json, subprocess, time, urllib.request

OLLAMA = "/opt/homebrew/bin/ollama"
API = "http://localhost:11434"
MODEL = "qwen3:14b"
PROMPT = (
    "Below is text scraped from a web page. Return ONLY the clean article prose, with "
    "navigation, menus, cookie notices, ads, share links and boilerplate removed. Do not "
    "summarize, shorten, translate, or add any commentary. Output the article text only.\n\nTEXT:\n"
)

def api_up():
    try:
        urllib.request.urlopen(API + "/api/version", timeout=2)
        return True
    except Exception:
        return False

def generate(text):
    body = json.dumps({"model": MODEL, "think": False, "stream": False, "prompt": PROMPT + text[:8000]}).encode()
    req = urllib.request.Request(API + "/api/generate", data=body, headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=180)).get("response", "").strip()

def main():
    try:
        items = json.load(sys.stdin)
        assert isinstance(items, list)
    except Exception:
        print("[]"); return

    proc, started = None, False
    if not api_up():
        proc = subprocess.Popen([OLLAMA, "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        started = True
        for _ in range(30):
            if api_up(): break
            time.sleep(1)

    out = []
    for it in items:
        try:
            out.append({"id": it.get("id"), "cleaned": generate(it.get("text") or "")})
        except Exception:
            out.append({"id": it.get("id"), "cleaned": None})  # caller falls back to raw text

    if started:
        try: subprocess.run([OLLAMA, "stop", MODEL], timeout=15, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception: pass
        if proc:
            proc.terminate()
            try: proc.wait(timeout=10)
            except Exception: proc.kill()

    print(json.dumps(out))

main()
