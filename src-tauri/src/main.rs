#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

fn main() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "initial_schema",
            sql: r#"
            CREATE TABLE companion (
                id          INTEGER PRIMARY KEY CHECK (id = 1),
                name        TEXT    NOT NULL,
                emoji       TEXT    NOT NULL,
                voice       TEXT    NOT NULL,
                persona     TEXT    NOT NULL,
                created_at  INTEGER NOT NULL
            );

            CREATE TABLE memory (
                id         INTEGER PRIMARY KEY CHECK (id = 1),
                name       TEXT,
                interests  TEXT    NOT NULL DEFAULT '[]',
                notes      TEXT    NOT NULL DEFAULT '[]'
            );

            CREATE TABLE conversations (
                id           TEXT    PRIMARY KEY,
                topic        TEXT,
                started_at   INTEGER NOT NULL,
                ended_at     INTEGER,
                duration_ms  INTEGER NOT NULL DEFAULT 0,
                summary_json TEXT
            );
            CREATE INDEX idx_conv_started ON conversations(started_at DESC);

            CREATE TABLE turns (
                id              TEXT    PRIMARY KEY,
                conversation_id TEXT    NOT NULL,
                role            TEXT    NOT NULL CHECK (role IN ('user','assistant')),
                text            TEXT    NOT NULL,
                audio_path      TEXT,
                hint_json       TEXT,
                review_json     TEXT,
                duration_ms     INTEGER,
                created_at      INTEGER NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            );
            CREATE INDEX idx_turns_conv ON turns(conversation_id, created_at);

            CREATE TABLE stats (
                date          TEXT    PRIMARY KEY,
                minutes       INTEGER NOT NULL DEFAULT 0,
                confidence    INTEGER NOT NULL DEFAULT 0,
                listening     INTEGER NOT NULL DEFAULT 0,
                conversations INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "companion_avatar_field",
            sql: r#"
            ALTER TABLE companion ADD COLUMN avatar TEXT NOT NULL DEFAULT 'preset:cat';
            UPDATE companion SET avatar = 'preset:cat' WHERE avatar IS NULL OR avatar = '';
        "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "turn_ui_state",
            sql: r#"
            ALTER TABLE turns ADD COLUMN expanded         INTEGER NOT NULL DEFAULT 0;
            ALTER TABLE turns ADD COLUMN transcript_shown INTEGER NOT NULL DEFAULT 0;
        "#,
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:echowise.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("error while running EchoWise");
}
