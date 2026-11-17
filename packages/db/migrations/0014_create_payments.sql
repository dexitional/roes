-- Paystack attempts. MoMo-to-number orders are confirmed by hand on the order itself.
CREATE TABLE payments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference VARCHAR(40) NOT NULL,
  order_id INT UNSIGNED NOT NULL,
  provider ENUM('paystack') NOT NULL DEFAULT 'paystack',
  amount DECIMAL(12,2) NOT NULL,
  status ENUM('pending','success','failed') NOT NULL DEFAULT 'pending',
  channel VARCHAR(30) NULL,
  paid_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_reference (reference),
  KEY ix_payments_order (order_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
