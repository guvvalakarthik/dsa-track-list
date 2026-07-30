from app.database import normalize_database_url


def test_normalizes_marketplace_postgres_urls_for_psycopg3():
    assert normalize_database_url("postgres://user:pass@host/db") == (
        "postgresql+psycopg://user:pass@host/db"
    )
    assert normalize_database_url("postgresql://user:pass@host/db?sslmode=require") == (
        "postgresql+psycopg://user:pass@host/db?sslmode=require"
    )
    assert normalize_database_url("postgresql+psycopg://user:pass@host/db") == (
        "postgresql+psycopg://user:pass@host/db"
    )
