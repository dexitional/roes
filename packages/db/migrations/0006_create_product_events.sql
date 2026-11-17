-- Raw storefront events behind the product analytics (views, carts, wishlists, purchases).
CREATE TABLE product_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  event ENUM('view','add_to_cart','wishlist','checkout','purchase') NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
  visitor_id CHAR(24) NULL,
  user_id INT UNSIGNED NULL,
  source VARCHAR(40) NULL,
  device ENUM('mobile','tablet','desktop') NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_product_events_product (product_id, event, created_at),
  KEY ix_product_events_event (event, created_at),
  CONSTRAINT fk_product_events_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
