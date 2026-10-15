-- Least-privilege application user setup for Billable BD (Day 13 hardening)
-- In production, the runtime web app only requires DML and basic schema index access,
-- never administrative server-level superpowers (such as GRANT OPTION, SHUTDOWN, PROCESS, SUPER, RELOAD).

-- 1. Create dedicated least-privilege runtime user (example: 'billable_app')
CREATE USER IF NOT EXISTS 'billable_app'@'%' IDENTIFIED BY 'billable_app_strong_password';

-- 2. Grant exact DML and required operational permissions on the application database:
-- SELECT, INSERT, UPDATE, DELETE (standard CRUD operations)
-- CREATE, ALTER, INDEX, DROP (required for automated Django migrations/indexes)
-- REFERENCES (for foreign keys)
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES 
ON billable.* TO 'billable_app'@'%';

-- 3. Flush privileges to apply
FLUSH PRIVILEGES;

-- Verification:
-- SHOW GRANTS FOR 'billable_app'@'%';
