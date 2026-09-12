'use strict';
const $ = id => document.getElementById(id);
const state = Object.fromEntries(['a', 'b'].map(key => [key, {
  image: null, crop: null, start: null, corner: null, loadId: 0,
  canvas: $('canvas-' + key)
}]));
let busy = false, revision = 0, stream = null, cameraKey = null, cameraId = 0;
const notify = text => { $('message').textContent = text; };
function stopDifferentVideo() {
  const video = $('different-video-player');
  video.pause(); video.currentTime = 0;
  $('different-video').hidden = true;
  $('play-different-video').hidden = true;
}
async function playDifferentVideo() {
  const video = $('different-video-player');
  $('different-video').hidden = false;
  $('play-different-video').hidden = true;
  video.currentTime = 0;
  try { await video.play(); }
  catch { $('play-different-video').hidden = false; }
}
function changed() {
  revision++;
  $('result').hidden = true;
  $('perfect-match').hidden = true;
  stopDifferentVideo();
  $('compare').disabled = busy || !state.a.image || !state.b.image;
}
function draw(key, temporary) {
  const s = state[key], c = s.canvas, context = c.getContext('2d');
  if (!s.image) return;
  context.drawImage(s.image, 0, 0, c.width, c.height);
  const box = temporary || s.crop;
  if (box) {
    context.strokeStyle = '#294eff';
    context.lineWidth = Math.max(3, c.width / 200);
    context.strokeRect(box.x, box.y, box.w, box.h);
  }
}
function setImage(key, image) {
  const s = state[key];
  s.image = image; s.crop = s.start = s.corner = null;
  const scale = Math.min(1, 1000 / Math.max(image.width, image.height));
  s.canvas.width = Math.round(image.width * scale);
  s.canvas.height = Math.round(image.height * scale);
  s.canvas.hidden = false;
  $('placeholder-' + key).hidden = true;
  document.querySelector('[data-full="' + key + '"]').disabled = false;
  $('selection-' + key).textContent = 'Full photo selected · drag to crop closer';
  changed(); draw(key);
  notify(state.a.image && state.b.image ? 'Both photos are ready. Crop if needed, then compare.' : 'Now add a photo for the other sock.');
}
async function loadFile(key, file) {
  if (!file) return;
  const s = state[key], id = ++s.loadId;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    notify('Please choose a JPG, PNG or WebP image.'); return;
  }
  if (file.size > 10 * 1024 * 1024) { notify('Each image must be smaller than 10 MB.'); return; }
  const url = URL.createObjectURL(file), image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    if (id !== s.loadId) return;
    if (Math.min(image.width, image.height) < 32 || image.width * image.height > 20000000) {
      notify('Use an image at least 32 pixels wide and tall, and below 20 megapixels.'); return;
    }
    setImage(key, image);
  };
  image.onerror = () => { URL.revokeObjectURL(url); if (id === s.loadId) notify('Could not read that photo. Please choose another.'); };
  image.src = url;
}
function point(canvas, event) {
  const r = canvas.getBoundingClientRect();
  return {x: Math.max(0, Math.min(canvas.width, (event.clientX - r.left) * canvas.width / r.width)),
    y: Math.max(0, Math.min(canvas.height, (event.clientY - r.top) * canvas.height / r.height))};
}
const rectangle = (a, b) => ({x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x-b.x), h: Math.abs(a.y-b.y)});
for (const key of ['a', 'b']) {
  const s = state[key], c = s.canvas;
  $('file-' + key).addEventListener('change', event => { loadFile(key, event.target.files[0]); });
  c.onpointerdown = event => { s.start = point(c, event); c.setPointerCapture(event.pointerId); };
  c.onpointermove = event => { if (s.start) draw(key, rectangle(s.corner || s.start, point(c, event))); };
  c.onpointerup = event => {
    if (!s.start) return;
    const end = point(c, event); let box = rectangle(s.start, end);
    if (box.w < 5 && box.h < 5) {
      if (!s.corner) { s.corner = end; s.start = null; notify('Tap the opposite corner of the crop.'); return; }
      box = rectangle(s.corner, end);
    }
    s.start = s.corner = null;
    if (box.w < 20 || box.h < 20) { notify('Select a larger area of the sock.'); draw(key); return; }
    s.crop = box; changed(); draw(key);
    $('selection-' + key).textContent = 'Cropped area selected · drag again to adjust';
    notify('Crop updated. Select similar areas on both socks.');
  };
  c.onpointercancel = () => { s.start = s.corner = null; draw(key); };
  document.querySelector('[data-full="' + key + '"]').onclick = () => {
    s.crop = s.corner = null; draw(key); changed();
    $('selection-' + key).textContent = 'Full photo selected · drag to crop closer';
  };
}
function stopCamera() {
  cameraId++;
  if (stream) stream.getTracks().forEach(track => track.stop());
  stream = null; $('video').srcObject = null; $('capture').disabled = true;
}
for (const button of document.querySelectorAll('[data-camera]')) {
  button.onclick = async () => {
    stopCamera(); cameraKey = button.dataset.camera;
    const id = cameraId;
    $('camera-title').textContent = 'Take a photo of sock ' + cameraKey.toUpperCase();
    $('camera-message').textContent = 'Allow camera access, then frame one sock closely.';
    $('camera-dialog').showModal();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera unavailable');
      const next = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}}, audio: false});
      if (id !== cameraId) { next.getTracks().forEach(track => track.stop()); return; }
      stream = next; $('video').srcObject = stream;
      await $('video').play();
      if (id !== cameraId) return;
      $('capture').disabled = false;
      $('camera-message').textContent = 'Keep the sock in focus and take a photo.';
    } catch {
      if (id !== cameraId) return;
      stopCamera();
      $('camera-message').textContent = 'Camera unavailable or permission denied. Close this window and choose a saved photo. For camera access, open this app on localhost or HTTPS.';
    }
  };
}
$('capture').onclick = () => {
  const video = $('video');
  if (!video.videoWidth) return;
  const image = document.createElement('canvas');
  image.width = video.videoWidth; image.height = video.videoHeight;
  image.getContext('2d').drawImage(video, 0, 0);
  state[cameraKey].loadId++;
  $('file-' + cameraKey).value = '';
  setImage(cameraKey, image);
  $('camera-dialog').close(); stopCamera();
};
$('close-camera').onclick = () => { $('camera-dialog').close(); stopCamera(); };
$('camera-dialog').addEventListener('close', stopCamera);
$('camera-dialog').addEventListener('cancel', stopCamera);
window.addEventListener('pagehide', stopCamera);
function exportPatch(key) {
  const s = state[key];
  const b = s.crop || {x: 0, y: 0, w: s.canvas.width, h: s.canvas.height};
  const c = document.createElement('canvas');
  const scale = Math.min(1, 1000 / Math.max(b.w, b.h));
  c.width = Math.max(32, Math.round(b.w * scale)); c.height = Math.max(32, Math.round(b.h * scale));
  const context = c.getContext('2d');
  context.fillStyle = 'white'; context.fillRect(0, 0, c.width, c.height);
  context.drawImage(s.image, b.x*s.image.width/s.canvas.width, b.y*s.image.height/s.canvas.height,
    b.w*s.image.width/s.canvas.width, b.h*s.image.height/s.canvas.height, 0, 0, c.width, c.height);
  return new Promise((resolve, reject) => c.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare the photo.')), 'image/jpeg', .94));
}
$('comparison-form').onsubmit = async event => {
  event.preventDefault();
  if (busy || !state.a.image || !state.b.image) return;
  busy = true; const current = revision;
  $('compare').disabled = true; $('compare').textContent = 'Comparing…';
  $('result').hidden = true; notify('Comparing both photos on your Flask server…');
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
  try {
    // Start both exports synchronously so they capture the same revision.
    const patches = await Promise.all(['a', 'b'].map(exportPatch));
    const form = new FormData();
    form.append('sock_a', patches[0], 'sock-a.jpg'); form.append('sock_b', patches[1], 'sock-b.jpg');
    const response = await fetch('/compare', {method: 'POST', body: form, signal: controller.signal});
    const result = await response.json();
    if (current !== revision) return;
    if (!response.ok) throw new Error(result.error || 'Comparison failed.');
    $('result').className = result.status;
    $('verdict').textContent = result.label;
    $('explanation').textContent = result.explanation;
    $('match-score').textContent = result.match_score + '/100';
    $('colour').textContent = result.colour_score + '/100';
    $('texture').textContent = result.texture_score + '/100';
    $('perfect-match').hidden = !(result.status === 'match' && result.match_score >= 90);
    if (result.status === 'different') void playDifferentVideo();
    else stopDifferentVideo();
    $('result').hidden = false; notify('Comparison complete.');
  } catch (error) {
    if (current === revision) notify(error.name === 'AbortError' ? 'The server took too long. Check that Flask is running and try again.' : error instanceof TypeError ? 'Cannot reach Flask. Keep the terminal running and open http://127.0.0.1:5000.' : error.message);
  } finally {
    clearTimeout(timer); busy = false;
    $('compare').textContent = 'Compare socks ↗';
    $('compare').disabled = !state.a.image || !state.b.image;
  }
};
$('play-different-video').onclick = () => { void $('different-video-player').play(); $('play-different-video').hidden = true; };
$('reset').onclick = () => {
  for (const key of ['a', 'b']) {
    const s = state[key]; s.loadId++; s.image = s.crop = s.start = s.corner = null;
    s.canvas.hidden = true; $('placeholder-' + key).hidden = false; $('file-' + key).value = '';
    $('selection-' + key).textContent = 'No photo selected';
    document.querySelector('[data-full="' + key + '"]').disabled = true;
  }
  changed(); notify('Add both photos to begin.');
};
