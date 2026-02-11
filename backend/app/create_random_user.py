import argparse
import sys
import random
import string
from datetime import datetime

from app.db.base import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

def generate_random_string(length=8):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def create_random_user(db):
    username = f"user_{generate_random_string()}"
    email = f"{username}@example.com"
    password = "password123"
    
    user = User(
        email=email,
        username=username,
        hashed_password=get_password_hash(password),
        is_admin=False
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"Created random user: {username} (ID: {user.id})")
    return user

def get_random_users(db, count=1):
    # Try to fetch existing non-admin users first
    users = db.query(User).filter(User.username != "mcp_bot").all()
    if len(users) < count:
        # Create more if not enough
        needed = count - len(users)
        for _ in range(needed):
            users.append(create_random_user(db))
    
    return random.sample(users, min(count, len(users)))

if __name__ == "__main__":
    db = SessionLocal()
    try:
        create_random_user(db)
    finally:
        db.close()
