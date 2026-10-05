CREATE DATABASE IF NOT EXISTS test_billable CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON test_billable.* TO 'billable_user'@'%';
FLUSH PRIVILEGES;
