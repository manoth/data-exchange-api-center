export const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS agents (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    agent_uid VARCHAR(100) NOT NULL,
    facility_code VARCHAR(20) NULL,
    facility_name VARCHAR(255) NULL,
    machine_name VARCHAR(255) NULL,
    app_version VARCHAR(50) NULL,
    frontend_version VARCHAR(50) NULL,
    db_status ENUM('unknown','ok','failed') NOT NULL DEFAULT 'unknown',
    status ENUM('online','offline') NOT NULL DEFAULT 'offline',
    api_key_status ENUM('none','active','revoked') NOT NULL DEFAULT 'none',
    api_key_prefix VARCHAR(20) NULL,
    api_key_last_used_at DATETIME NULL,
    is_primary_agent TINYINT(1) NOT NULL DEFAULT 0,
    last_seen_at DATETIME NULL,
    registered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_agents_agent_uid (agent_uid),
    KEY idx_agents_status (status),
    KEY idx_agents_api_key_status (api_key_status),
    KEY idx_agents_facility_code (facility_code),
    KEY idx_agents_last_seen_at (last_seen_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS agent_api_keys (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    agent_id BIGINT UNSIGNED NOT NULL,
    key_hash CHAR(64) NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,
    status ENUM('active','revoked') NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME NULL,
    last_used_at DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_agent_api_keys_hash (key_hash),
    KEY idx_agent_api_keys_agent_status (agent_id, status),
    CONSTRAINT fk_agent_api_keys_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS agent_heartbeats (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    agent_id BIGINT UNSIGNED NOT NULL,
    status ENUM('online','offline') NOT NULL DEFAULT 'online',
    db_status ENUM('unknown','ok','failed') NOT NULL DEFAULT 'unknown',
    app_version VARCHAR(50) NULL,
    frontend_version VARCHAR(50) NULL,
    payload JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_agent_heartbeats_agent_created (agent_id, created_at),
    CONSTRAINT fk_agent_heartbeats_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS agent_commands (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    agent_id BIGINT UNSIGNED NOT NULL,
    command_type VARCHAR(80) NOT NULL,
    payload JSON NULL,
    status ENUM('pending','running','success','failed','cancelled') NOT NULL DEFAULT 'pending',
    result JSON NULL,
    requested_by VARCHAR(100) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    picked_at DATETIME NULL,
    finished_at DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_agent_commands_agent_status (agent_id, status),
    KEY idx_agent_commands_created (created_at),
    CONSTRAINT fk_agent_commands_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS agent_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    agent_id BIGINT UNSIGNED NOT NULL,
    event_type VARCHAR(80) NOT NULL,
    severity ENUM('info','warning','error') NOT NULL DEFAULT 'info',
    message VARCHAR(500) NOT NULL,
    payload JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_agent_events_agent_created (agent_id, created_at),
    KEY idx_agent_events_severity (severity),
    CONSTRAINT fk_agent_events_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS agent_versions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    version VARCHAR(50) NOT NULL,
    release_channel VARCHAR(30) NOT NULL DEFAULT 'stable',
    manifest_url VARCHAR(500) NULL,
    notes TEXT NULL,
    is_latest TINYINT(1) NOT NULL DEFAULT 0,
    published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_agent_versions_version_channel (version, release_channel),
    KEY idx_agent_versions_latest (is_latest, release_channel)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS facilities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    facility_code VARCHAR(20) NOT NULL,
    facility_name VARCHAR(255) NOT NULL,
    province_code VARCHAR(10) NULL,
    district_code VARCHAR(10) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_facilities_code (facility_code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NULL,
    role ENUM('admin','operator') NOT NULL DEFAULT 'operator',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_username (username)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS death_persons (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    pid VARCHAR(30) NOT NULL,
    sex VARCHAR(10) NULL,
    age INT NULL,
    death_date DATE NULL,
    death_year INT NULL,
    death_cause_code VARCHAR(50) NULL,
    raw_data JSON NOT NULL,
    source_file VARCHAR(255) NULL,
    imported_by VARCHAR(100) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_death_persons_pid (pid),
    KEY idx_death_persons_death_year (death_year),
    KEY idx_death_persons_death_date (death_date),
    KEY idx_death_persons_updated_at (updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS death_person_imports (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    file_name VARCHAR(255) NOT NULL,
    total_rows INT NOT NULL DEFAULT 0,
    inserted_rows INT NOT NULL DEFAULT 0,
    updated_rows INT NOT NULL DEFAULT 0,
    skipped_rows INT NOT NULL DEFAULT 0,
    imported_by VARCHAR(100) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_death_person_imports_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];
