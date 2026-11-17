CREATE TABLE search_queries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  term VARCHAR(120) NOT NULL,
  results INT NOT NULL DEFAULT 0,
  visitor_id CHAR(24) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_search_queries_created (created_at),
  KEY ix_search_queries_term (term)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
