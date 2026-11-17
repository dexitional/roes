-- CMS content: static pages (About, Shipping...) and journal posts.
CREATE TABLE pages (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  kind ENUM('page','post') NOT NULL DEFAULT 'page',
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL,
  excerpt VARCHAR(400) NULL,
  cover_url VARCHAR(500) NULL,
  body MEDIUMTEXT NULL,
  seo_title VARCHAR(120) NULL,
  seo_description VARCHAR(300) NULL,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  show_in_footer TINYINT(1) NOT NULL DEFAULT 0,
  author_id INT UNSIGNED NULL,
  published_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pages_kind_slug (kind, slug),
  KEY ix_pages_status (kind, status, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
