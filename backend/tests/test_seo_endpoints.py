def test_robots_txt_endpoint(client):
    response = client.get("/robots.txt")
    assert response.status_code == 200
    assert "User-agent: *" in response.text
    assert "Sitemap:" in response.text
    assert "Disallow: /review" in response.text


def test_sitemap_xml_endpoint(client):
    response = client.get("/sitemap.xml")
    assert response.status_code == 200
    assert response.text.startswith('<?xml version="1.0" encoding="UTF-8"?>')
    assert "<urlset" in response.text


def test_blog_sitemap_xml_endpoint(client):
    response = client.get("/blog-sitemap.xml")
    assert response.status_code == 200
    assert response.text.startswith('<?xml version="1.0" encoding="UTF-8"?>')
    assert "<urlset" in response.text
