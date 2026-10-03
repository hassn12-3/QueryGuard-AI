"""
db/seed_mock_data.py – Realistic SaaS / e-commerce database seeder.

Creates analytics.db with four interconnected tables:
  - customers        : 500 realistic customer records
  - orders           : ~3,000 orders across 2 years
  - subscriptions    : SaaS subscription plans with MRR data
  - support_tickets  : Customer support history

Run directly: python -m app.db.seed_mock_data
Called automatically by run.py on startup if the database doesn't exist.
"""

from __future__ import annotations

import os
import random
import sqlite3
import hashlib
from datetime import date, timedelta, datetime
from typing import Any

from app.config import settings

# ── Seed for reproducibility ──────────────────────────────────────────────────
random.seed(42)

# ── Reference data ────────────────────────────────────────────────────────────

FIRST_NAMES = [
    "Emma", "Liam", "Olivia", "Noah", "Ava", "Elijah", "Sophia", "Oliver",
    "Isabella", "James", "Mia", "Benjamin", "Charlotte", "Lucas", "Amelia",
    "Mason", "Harper", "Ethan", "Evelyn", "Daniel", "Abigail", "Henry",
    "Emily", "Alexander", "Elizabeth", "Michael", "Sofia", "William",
    "Avery", "Sebastian", "Ella", "Jack", "Scarlett", "Owen", "Victoria",
    "Theodore", "Madison", "Aiden", "Luna", "Samuel", "Grace", "Matthew",
    "Chloe", "Joseph", "Penelope", "Logan", "Layla", "Jackson", "Riley",
    "Luke", "Zoey", "David", "Nora", "John", "Lily", "Ryan", "Eleanor",
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
    "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
    "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark",
    "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King",
    "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green",
    "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
    "Carter", "Roberts",
]

EMAIL_DOMAINS = [
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
    "company.io", "techcorp.com", "startup.co", "enterprise.net",
    "business.org", "acme.com",
]

COUNTRIES = [
    "United States", "United Kingdom", "Canada", "Australia", "Germany",
    "France", "Netherlands", "Sweden", "Norway", "Denmark", "Singapore",
    "Japan", "South Korea", "Brazil", "India", "Ireland", "Spain", "Italy",
]

COUNTRY_WEIGHTS = [
    30, 12, 10, 8, 7, 6, 4, 3, 2, 2, 3, 3, 2, 3, 4, 2, 2, 2
]

SEGMENTS = ["SMB", "Mid-Market", "Enterprise", "Startup", "Agency"]
SEGMENT_WEIGHTS = [35, 30, 15, 15, 5]

PRODUCT_CATEGORIES = [
    "Analytics", "Automation", "CRM", "DevTools", "E-Commerce",
    "Finance", "HR", "Marketing", "Security", "Support",
]

PRODUCT_NAMES = {
    "Analytics": ["DataViz Pro", "InsightBoard", "MetricsHub"],
    "Automation": ["FlowBot", "AutoPilot", "TaskMaster"],
    "CRM": ["LeadTrack", "ClientSuite", "RelateIQ"],
    "DevTools": ["CodeBase", "DevPipeline", "BuildKit"],
    "E-Commerce": ["ShopEngine", "CartPro", "StoreBuilder"],
    "Finance": ["FinanceFlow", "BudgetSense", "CashTrack"],
    "HR": ["PeopleOps", "HireBase", "TeamSync"],
    "Marketing": ["CampaignIQ", "LeadGen Pro", "AdMatrix"],
    "Security": ["SecureVault", "GuardianAI", "ShieldOps"],
    "Support": ["HelpDesk Pro", "TicketFlow", "SupportBase"],
}

SUBSCRIPTION_PLANS = ["Starter", "Professional", "Business", "Enterprise"]
PLAN_PRICES = {
    "Starter": 29.0,
    "Professional": 99.0,
    "Business": 299.0,
    "Enterprise": 999.0,
}
PLAN_WEIGHTS = [35, 30, 25, 10]

TICKET_CATEGORIES = [
    "Billing", "Technical", "Feature Request", "Account", "Integration",
    "Performance", "Security", "Data Export", "Onboarding", "Other",
]
TICKET_PRIORITIES = ["Low", "Medium", "High", "Critical"]
TICKET_PRIORITY_WEIGHTS = [30, 40, 22, 8]
TICKET_STATUSES = ["Open", "In Progress", "Resolved", "Closed", "Escalated"]
TICKET_STATUS_WEIGHTS = [15, 20, 40, 20, 5]

CHURN_REASONS = [
    "Too expensive", "Missing features", "Poor performance",
    "Switched to competitor", "Business closed", "Project ended",
    None, None, None,  # Weighted towards not churned
]


# ── Helper functions ───────────────────────────────────────────────────────────

def _random_date(start: date, end: date) -> date:
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, delta))


def _random_datetime(start: date, end: date) -> datetime:
    d = _random_date(start, end)
    hour = random.randint(0, 23)
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    return datetime(d.year, d.month, d.day, hour, minute, second)


def _weighted_choice(choices: list, weights: list) -> Any:
    return random.choices(choices, weights=weights, k=1)[0]


def _generate_email(first: str, last: str, used: set) -> str:
    domain = random.choice(EMAIL_DOMAINS)
    base = f"{first.lower()}.{last.lower()}"
    email = f"{base}@{domain}"
    counter = 1
    while email in used:
        email = f"{base}{counter}@{domain}"
        counter += 1
    used.add(email)
    return email


# ── DDL ────────────────────────────────────────────────────────────────────────

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS customers (
    customer_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name      TEXT    NOT NULL,
    last_name       TEXT    NOT NULL,
    email           TEXT    NOT NULL UNIQUE,
    country         TEXT    NOT NULL,
    segment         TEXT    NOT NULL,
    signup_date     TEXT    NOT NULL,
    is_active       INTEGER NOT NULL DEFAULT 1,
    lifetime_value  REAL    NOT NULL DEFAULT 0.0,
    created_at      TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
    subscription_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id     INTEGER NOT NULL REFERENCES customers(customer_id),
    plan_name       TEXT    NOT NULL,
    monthly_price   REAL    NOT NULL,
    status          TEXT    NOT NULL,
    started_at      TEXT    NOT NULL,
    cancelled_at    TEXT,
    churn_reason    TEXT,
    billing_cycle   TEXT    NOT NULL DEFAULT 'monthly',
    created_at      TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
    order_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id     INTEGER NOT NULL REFERENCES customers(customer_id),
    product_name    TEXT    NOT NULL,
    category        TEXT    NOT NULL,
    amount          REAL    NOT NULL,
    quantity        INTEGER NOT NULL DEFAULT 1,
    status          TEXT    NOT NULL,
    order_date      TEXT    NOT NULL,
    shipped_date    TEXT,
    created_at      TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS support_tickets (
    ticket_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id     INTEGER NOT NULL REFERENCES customers(customer_id),
    subject         TEXT    NOT NULL,
    category        TEXT    NOT NULL,
    priority        TEXT    NOT NULL,
    status          TEXT    NOT NULL,
    created_at      TEXT    NOT NULL,
    resolved_at     TEXT,
    satisfaction_score INTEGER,
    resolution_time_hours REAL
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id     ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_date      ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_category        ON orders(category);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status   ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_tickets_customer_id    ON support_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status         ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_customers_signup_date  ON customers(signup_date);
"""


# ── Seed functions ─────────────────────────────────────────────────────────────

def _seed_customers(conn: sqlite3.Connection, n: int = 500) -> list[int]:
    """Inserts n realistic customer records. Returns list of customer IDs."""
    today = date.today()
    start = today - timedelta(days=730)  # 2 years ago

    used_emails: set[str] = set()
    customer_ids: list[int] = []
    rows = []

    for i in range(n):
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        email = _generate_email(first, last, used_emails)
        country = _weighted_choice(COUNTRIES, COUNTRY_WEIGHTS)
        segment = _weighted_choice(SEGMENTS, SEGMENT_WEIGHTS)
        signup = _random_date(start, today)
        is_active = 1 if random.random() > 0.15 else 0
        created_at = datetime(signup.year, signup.month, signup.day, 9, 0, 0)

        rows.append((
            first, last, email, country, segment,
            signup.isoformat(), is_active, 0.0,
            created_at.isoformat(),
        ))

    conn.executemany(
        """INSERT INTO customers
           (first_name, last_name, email, country, segment,
            signup_date, is_active, lifetime_value, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        rows,
    )
    conn.commit()

    cursor = conn.execute("SELECT customer_id FROM customers ORDER BY customer_id;")
    customer_ids = [row[0] for row in cursor.fetchall()]
    return customer_ids


def _seed_subscriptions(conn: sqlite3.Connection, customer_ids: list[int]) -> None:
    """Inserts subscription records — one active + possibly one historical per customer."""
    today = date.today()
    rows = []

    for cid in customer_ids:
        # Current subscription
        plan = _weighted_choice(SUBSCRIPTION_PLANS, PLAN_WEIGHTS)
        price = PLAN_PRICES[plan]
        started = _random_date(today - timedelta(days=600), today - timedelta(days=30))

        is_churned = random.random() < 0.18
        if is_churned:
            cancel_date = _random_date(started + timedelta(days=30), today)
            churn_reason = random.choice([r for r in CHURN_REASONS if r])
            status = "Cancelled"
            cancelled_at = cancel_date.isoformat()
        else:
            status = "Active"
            cancelled_at = None
            churn_reason = None

        created_dt = datetime(started.year, started.month, started.day)

        rows.append((
            cid, plan, price, status, started.isoformat(),
            cancelled_at, churn_reason,
            random.choice(["monthly", "annual"]),
            created_dt.isoformat(),
        ))

        # Some customers had a previous subscription (upgrades/downgrades)
        if random.random() < 0.30:
            prev_start = _random_date(today - timedelta(days=730), started)
            prev_plan = _weighted_choice(SUBSCRIPTION_PLANS, PLAN_WEIGHTS)
            prev_price = PLAN_PRICES[prev_plan]
            prev_end = started - timedelta(days=random.randint(1, 15))
            prev_created = datetime(prev_start.year, prev_start.month, prev_start.day)

            rows.append((
                cid, prev_plan, prev_price, "Cancelled",
                prev_start.isoformat(), prev_end.isoformat(),
                "Upgraded to higher plan",
                "monthly",
                prev_created.isoformat(),
            ))

    conn.executemany(
        """INSERT INTO subscriptions
           (customer_id, plan_name, monthly_price, status,
            started_at, cancelled_at, churn_reason, billing_cycle, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        rows,
    )
    conn.commit()


def _seed_orders(conn: sqlite3.Connection, customer_ids: list[int]) -> None:
    """Inserts realistic order records (avg ~6 orders per customer)."""
    today = date.today()
    start = today - timedelta(days=730)

    ORDER_STATUSES = ["Completed", "Completed", "Completed", "Processing", "Cancelled", "Refunded"]
    rows = []

    for cid in customer_ids:
        num_orders = random.randint(1, 15)
        for _ in range(num_orders):
            category = random.choice(PRODUCT_CATEGORIES)
            product = random.choice(PRODUCT_NAMES[category])
            quantity = random.choices([1, 2, 3, 5], weights=[60, 25, 10, 5])[0]

            # Pricing with category-based multipliers
            base_price = random.uniform(49, 999)
            if category in ("Enterprise", "Security"):
                base_price *= random.uniform(2, 5)
            amount = round(base_price * quantity, 2)

            status = random.choice(ORDER_STATUSES)
            order_dt = _random_datetime(start, today)
            order_date = order_dt.date().isoformat()

            shipped_date = None
            if status == "Completed":
                ship_days = random.randint(1, 7)
                shipped = order_dt.date() + timedelta(days=ship_days)
                if shipped <= today:
                    shipped_date = shipped.isoformat()

            rows.append((
                cid, product, category, amount, quantity,
                status, order_date, shipped_date,
                order_dt.isoformat(),
            ))

    conn.executemany(
        """INSERT INTO orders
           (customer_id, product_name, category, amount, quantity,
            status, order_date, shipped_date, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        rows,
    )
    conn.commit()

    # Update customer lifetime_value
    conn.execute("""
        UPDATE customers
        SET lifetime_value = (
            SELECT COALESCE(SUM(amount), 0)
            FROM orders
            WHERE orders.customer_id = customers.customer_id
              AND orders.status = 'Completed'
        )
    """)
    conn.commit()


def _seed_support_tickets(conn: sqlite3.Connection, customer_ids: list[int]) -> None:
    """Inserts support ticket records (avg ~2 per customer)."""
    today = date.today()
    start = today - timedelta(days=700)

    SUBJECTS = [
        "Unable to login to my account",
        "Billing charge I don't recognise",
        "Feature request: bulk export",
        "Dashboard not loading correctly",
        "API integration not working",
        "Performance degradation noticed",
        "Need help with onboarding",
        "Data export failing",
        "Upgrade plan question",
        "Report generation errors",
        "Two-factor authentication issue",
        "Invoice not received",
        "How to connect to Salesforce?",
        "Webhook events not firing",
        "Incorrect data displayed in reports",
    ]

    rows = []
    for cid in customer_ids:
        num_tickets = random.choices([0, 1, 2, 3, 5], weights=[20, 30, 25, 15, 10])[0]
        for _ in range(num_tickets):
            category = random.choice(TICKET_CATEGORIES)
            priority = _weighted_choice(TICKET_PRIORITIES, TICKET_PRIORITY_WEIGHTS)
            status = _weighted_choice(TICKET_STATUSES, TICKET_STATUS_WEIGHTS)
            subject = random.choice(SUBJECTS)
            created = _random_datetime(start, today)

            resolved_at = None
            resolution_time = None
            satisfaction = None

            if status in ("Resolved", "Closed"):
                # Resolution time in hours based on priority
                base_hours = {"Low": 48, "Medium": 24, "High": 8, "Critical": 2}
                hours = base_hours[priority] * random.uniform(0.5, 3.0)
                resolution_time = round(hours, 2)
                resolved_dt = created + timedelta(hours=hours)
                if resolved_dt.date() <= today:
                    resolved_at = resolved_dt.isoformat()
                satisfaction = random.choices(
                    [1, 2, 3, 4, 5], weights=[5, 8, 15, 35, 37]
                )[0]

            rows.append((
                cid, subject, category, priority, status,
                created.isoformat(), resolved_at, satisfaction, resolution_time,
            ))

    conn.executemany(
        """INSERT INTO support_tickets
           (customer_id, subject, category, priority, status,
            created_at, resolved_at, satisfaction_score, resolution_time_hours)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        rows,
    )
    conn.commit()


# ── Public entry point ─────────────────────────────────────────────────────────

def seed_database(force: bool = False) -> None:
    """
    Creates and seeds analytics.db.

    Args:
        force: If True, drops and recreates all tables even if they exist.
               Default False: skips seeding if tables already contain data.
    """
    db_path = settings.DATABASE_PATH

    if os.path.exists(db_path) and not force:
        # Check if already seeded
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
            table_count = cursor.fetchone()[0]
            conn.close()
            if table_count >= 4:
                print(f"[seed] Database '{db_path}' already seeded ({table_count} tables). Skipping.")
                return
        except sqlite3.Error:
            pass  # Fall through to create/seed

    print(f"[seed] Initialising database at '{db_path}'...")

    conn = sqlite3.connect(db_path)
    if force:
        conn.executescript("""
            DROP TABLE IF EXISTS support_tickets;
            DROP TABLE IF EXISTS orders;
            DROP TABLE IF EXISTS subscriptions;
            DROP TABLE IF EXISTS customers;
        """)
    conn.executescript(SCHEMA_SQL)
    conn.commit()

    print("[seed] Seeding customers (500 records)...")
    customer_ids = _seed_customers(conn, n=500)

    print(f"[seed] Seeding subscriptions ({len(customer_ids)} customers)...")
    _seed_subscriptions(conn, customer_ids)

    print("[seed] Seeding orders (~6,000 records)...")
    _seed_orders(conn, customer_ids)

    print("[seed] Seeding support tickets (~2,000 records)...")
    _seed_support_tickets(conn, customer_ids)

    # Verify counts
    for table in ("customers", "subscriptions", "orders", "support_tickets"):
        cursor = conn.execute(f"SELECT COUNT(*) FROM {table};")
        count = cursor.fetchone()[0]
        print(f"[seed]   [OK] {table}: {count:,} rows")

    conn.close()
    print(f"[seed] [OK] Database seeded successfully: {db_path}")


# ── CLI ────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    force = "--force" in sys.argv
    seed_database(force=force)
