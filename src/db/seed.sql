-- Seed an admin user (password: admin123)
-- Hash generated with PBKDF2-SHA256, this is a placeholder that will be replaced at runtime
INSERT OR IGNORE INTO users (id, email, password_hash, full_name, role) 
VALUES ('admin-001', 'admin@bank.com', 'SEED_ADMIN', 'Bank Administrator', 'admin');
