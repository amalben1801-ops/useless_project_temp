import unittest
from io import BytesIO
from PIL import Image, ImageDraw
from app import app


def photo(colour, stripes=False):
    image = Image.new('RGB', (160, 160), colour)
    if stripes:
        draw = ImageDraw.Draw(image)
        for y in range(0, 160, 24):
            draw.rectangle((0, y, 160, y + 11), fill=(220, 220, 220))
    result = BytesIO()
    image.save(result, format='PNG')
    result.seek(0)
    return result


class AppTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        with self.client.session_transaction() as session:
            session['logged_in'] = True
            session['username'] = 'demo'

    def compare(self, a, b):
        return self.client.post('/compare', data={'sock_a': (a, 'a.png'), 'sock_b': (b, 'b.png')})

    def test_login_and_assets(self):
        with app.test_client() as visitor:
            response = visitor.get('/')
            self.assertEqual(response.status_code, 200)
            self.assertIn(b'cinematic-login', response.data)
            login = visitor.post('/', data={'username': 'demo', 'password': 'sockcheck'})
            self.assertEqual(login.status_code, 302)
            self.assertTrue(login.headers['Location'].endswith('/detector'))
        response = self.client.get('/detector')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'name="sock_a"', response.data)
        self.assertIn(b'name="sock_b"', response.data)
        for path in ['/static/app.js', '/static/style.css', '/static/extras.css', '/static/favicon.svg', '/static/login-hero.jpg']:
            with self.client.get(path) as asset:
                self.assertEqual(asset.status_code, 200)

    def test_matching_photos(self):
        response = self.compare(photo((190, 40, 50)), photo((190, 40, 50)))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['status'], 'match')
        self.assertEqual(response.json['colour_score'], 100)
        self.assertEqual(response.json['match_score'], 100)

    def test_different_photos(self):
        response = self.compare(photo((200, 30, 40)), photo((30, 40, 200)))
        self.assertEqual(response.json['status'], 'different')

    def test_matching_stripes(self):
        response = self.compare(photo((190, 40, 50), True), photo((190, 40, 50), True))
        self.assertEqual(response.json['status'], 'match')

    def test_dark_photos(self):
        self.assertEqual(self.compare(photo((0, 0, 0)), photo((0, 0, 0))).json['status'], 'uncertain')

    def test_missing_photo(self):
        self.assertEqual(self.client.post('/compare', data={'sock_a': (photo('red'), 'a.png')}).status_code, 400)

    def test_compare_requires_login(self):
        with app.test_client() as visitor:
            self.assertEqual(visitor.post('/compare').status_code, 401)

    def test_invalid_image(self):
        response = self.compare(BytesIO(b'not an image'), photo('blue'))
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.json)

    def test_oversized_request(self):
        with self.client.post('/compare', data=b'x' * (23 * 1024 * 1024), content_type='application/octet-stream') as response:
            self.assertEqual(response.status_code, 413)
            self.assertIn('error', response.json)


if __name__ == '__main__':
    unittest.main()
