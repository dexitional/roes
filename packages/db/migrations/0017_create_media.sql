CREATE TABLE media (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  url VARCHAR(500) NOT NULL,
  filename VARCHAR(200) NOT NULL,
  mime VARCHAR(80) NOT NULL,
  size INT UNSIGNED NOT NULL,
  width INT NULL,
  height INT NULL,
  alt VARCHAR(200) NULL,
  uploaded_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_media_url (url),
  KEY ix_media_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
