import type mysql from 'mysql2/promise';

export const name = '019_user_activity_records';

export async function up(db: mysql.Pool): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS book_comments (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      book_url VARCHAR(500) NOT NULL,
      content TEXT NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_book_comments_user_id (user_id),
      INDEX idx_book_comments_book_url (book_url),
      INDEX idx_book_comments_created_at (created_at),
      CONSTRAINT fk_book_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_likes (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      target_type VARCHAR(50) NOT NULL DEFAULT 'book',
      book_url VARCHAR(500) DEFAULT '',
      target_id VARCHAR(100) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_user_like_target (user_id, target_type, target_id),
      INDEX idx_user_likes_user_id (user_id),
      INDEX idx_user_likes_book_url (book_url),
      INDEX idx_user_likes_created_at (created_at),
      CONSTRAINT fk_user_likes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_checkins (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      checkin_date DATE NOT NULL,
      points INT NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_user_checkin_date (user_id, checkin_date),
      INDEX idx_user_checkins_user_id (user_id),
      INDEX idx_user_checkins_date (checkin_date),
      CONSTRAINT fk_user_checkins_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_search_records (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED DEFAULT NULL,
      keyword VARCHAR(200) NOT NULL,
      result_count INT NOT NULL DEFAULT 0,
      ip_address VARCHAR(100) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_search_records_user_id (user_id),
      INDEX idx_user_search_records_keyword (keyword),
      INDEX idx_user_search_records_created_at (created_at),
      CONSTRAINT fk_user_search_records_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}
