"""SockCheck: local Flask server. Run with python app.py."""
import argparse
import os
from functools import wraps
from flask import Flask, jsonify, redirect, render_template, request, session, url_for
from werkzeug.exceptions import RequestEntityTooLarge
from detector import compare_uploads

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 22 * 1024 * 1024
app.secret_key = os.environ.get('SOCKCHECK_SECRET_KEY', 'sockcheck-local-demo-secret')


def login_required(view):
    @wraps(view)
    def protected(*args, **kwargs):
        if not session.get('logged_in'):
            if request.path == '/compare':
                return jsonify(error='Your session ended. Log in again.'), 401
            return redirect(url_for('login'))
        return view(*args, **kwargs)
    return protected


@app.route('/', methods=['GET', 'POST'])
def login():
    if session.get('logged_in'):
        return redirect(url_for('detector'))
    error = None
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        if username == 'demo' and password == 'sockcheck':
            session.clear()
            session['logged_in'] = True
            session['username'] = username
            return redirect(url_for('detector'))
        error = 'Use the demo username and password shown below.'
    return render_template('login.html', error=error)


@app.get('/detector')
@login_required
def detector():
    return render_template('index.html')


@app.get('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


@app.post('/compare')
@login_required
def compare():
    first = request.files.get('sock_a')
    second = request.files.get('sock_b')
    if not first or not second:
        return jsonify(error='Please choose one image for sock A and one for sock B.'), 400
    try:
        result = compare_uploads(first.stream, second.stream)
    except ValueError as error:
        return jsonify(error=str(error)), 400
    return jsonify(result)

@app.errorhandler(RequestEntityTooLarge)
def too_large(_error):
    return jsonify(error='Images are too large. Choose images under 10 MB each.'), 413

@app.after_request
def headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    if request.path == '/compare':
        response.headers['Cache-Control'] = 'no-store'
    return response

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Run the SockCheck development server')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=5000)
    args = parser.parse_args()
    app.run(host=args.host, port=args.port, debug=False)
