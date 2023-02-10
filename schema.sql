DROP TABLE IF EXISTS documents;
CREATE TABLE documents (created_at INT, body TEXT);
INSERT INTO documents (created_at, body) VALUES (1, '<xml>');