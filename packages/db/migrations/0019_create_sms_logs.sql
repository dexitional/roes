CREATE TABLE sms_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  recipient VARCHAR(20) NOT NULL,
  message VARCHAR(1000) NOT NULL,
  context VARCHAR(60) NULL,
  order_id INT UNSIGNED NULL,
  status ENUM('sent','failed','simulated') NOT NULL,
  provider_ref VARCHAR(100) NULL,
  error VARCHAR(300) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_sms_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
