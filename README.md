# SockCheck — Flask edition

A complete local Flask app for comparing **two separate sock photos**. Each input has its own preview and camera capture. You can optionally crop each photo by dragging a box (or tapping two corners). Without a crop, the full photo is compared.

## Start in VS Code on Windows

1. Extract the ZIP first. Open the extracted **SockCheck-Flask** folder in VS Code with **File → Open Folder**. Open the folder that directly contains `app.py`.
2. Choose **Terminal → New Terminal**. Use these commands in PowerShell, not inside the Python `>>>` prompt:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

These commands use the virtual environment directly; you do not need to activate it or change PowerShell execution policy.

3. Open **http://127.0.0.1:5000** in Chrome or Edge. Do not double-click the HTML files; Flask must render them. Log in with username `demo` and password `sockcheck`.
4. Choose one photo under **Sock A** and another under **Sock B**. Optionally crop to similar areas, then click **Compare socks**. The Perfect OK GIF appears when the conservative pair-match score is 90 or above.
5. Keep the terminal open. Press **Ctrl+C** to stop the server.

Use Python 3.11 or newer with compatible wheels for the listed dependencies. If `python` is not found but `py` works, use `py -m venv .venv` for the first command. Later commands stay the same.

## Run with the VS Code button

Install the recommended Microsoft Python and Python Debugger extensions if prompted. Press Ctrl+Shift+P → **Python: Select Interpreter** → select `.venv`. Then use **Run and Debug → Run SockCheck Flask** (F5). Create the environment and install dependencies first. Do not start a second server while one is already running.

## Camera and phone access

Camera capture requires browser permission and a secure context. `http://localhost:5000` and `http://127.0.0.1:5000` on the server computer support this in common browsers. If camera access fails, choose a saved photo instead.

For photo selection from another device on the same Wi-Fi:

```powershell
.\.venv\Scripts\python.exe app.py --host 0.0.0.0
ipconfig
```

Open `http://YOUR-PC-IP:5000` on your phone. Use your PC's Wi-Fi IPv4 address, not `0.0.0.0`. Permit Python on your private network if Windows Firewall prompts you. A phone's `localhost` points to the phone, not your PC. Live camera access normally requires HTTPS when accessed through a LAN IP; saved-photo selection still works.

This is Flask's development server for a local hackathon demo, not an internet production deployment. Debug mode is off by default.

## Files

- `app.py`: Flask page and `/compare` API, upload limits and error responses.
- `detector.py`: image decoding, orientation correction and comparison.
- `templates/index.html`: complete two-photo interface.
- `static/app.js`: previews, optional cropping, per-sock camera, API requests and results.
- `static/style.css`: responsive styling.
- `static/favicon.svg`: app icon.
- `requirements.txt`: Python dependencies.
- `.vscode/launch.json`: VS Code Run/Debug configuration.
- `.vscode/extensions.json`: Python extension recommendations.
- `tests/test_app.py`: backend checks.

## How comparison works

The browser sends the selected areas as two images to Flask. Pillow decodes them, fixes EXIF orientation and resizes them. NumPy compares a colour histogram, average RGB colour, grayscale variation and edges. The response is **Likely match**, **Likely different**, or **Uncertain**, with colour and texture similarity scores.

This is a heuristic computer-vision prototype, **not a trained AI or automatic sock detector**. It cannot prove that socks are an original pair, verify that a person is wearing them, or reject all non-sock images. Similar backgrounds can produce misleading matches. Different lighting, stretched fabric and similar-colour patterns can cause errors. Near-black or near-white photos are treated cautiously. Scores are similarity indices, not probabilities. Thresholds are provisional; real-photo accuracy has not been measured.

Use close-ups showing similar parts of the socks, with similar orientation and even lighting. Exclude skin, shoes, trousers and background from the selected regions. No photo is saved to disk; processing happens in server memory and no external AI service is called.

## Troubleshooting

- **No module named flask**: run the exact dependency command above, then the exact `.venv` Python command. This ensures both use the same environment.
- **Cannot find app.py**: open the project root, not `templates` or `static`.
- **Port already in use**: stop the old server with Ctrl+C, or run `app.py --port 5001` and open `http://127.0.0.1:5001`.
- **Camera denied**: allow camera access in the browser's site settings or use saved photos.
- **Unsupported image**: use JPG, PNG or WebP, not HEIC. Photos must be under 10 MB and 20 megapixels each.

## Run checks

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Tests verify the Flask two-upload flow, identical and different colours, matching stripes, conservative exposure handling, invalid uploads and size limits. They do not measure real-world accuracy or test physical cameras.
