-- Create users table for simple authentication
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default admin user (password: admin123)
-- Note: In production, you should hash passwords!
INSERT INTO users (username, password)
VALUES ('admin', 'admin123')
ON CONFLICT (username) DO NOTHING;
