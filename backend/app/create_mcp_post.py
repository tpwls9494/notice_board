import argparse
import json
import random
import sys
from datetime import datetime
from sqlalchemy.sql import func

from app.db.base import SessionLocal
from app.models.category import Category
from app.models.post import Post
from app.models.user import User
from app.core.security import get_password_hash

def get_or_create_user(db, username="mcp_bot", random_user=False):
    if random_user:
        # Generate realistic English usernames
        first_parts = [
            "codingking", "devmaster", "techie", "digitalnomad", "cloudguru",
            "john_kim", "sarah_lee", "mike_park", "jenny_choi", "alex_jung",
            "developer", "programmer", "coder", "hacker", "engineer",
            "david_choi", "emily_park", "chris_lee", "jessica_kim", "ryan_jung",
            "techbro", "deventhusiast", "codewizard", "bytemaster", "fullstacker",
            "james_seo", "linda_kang", "kevin_oh", "amy_shin", "eric_han"
        ]

        second_parts = [
            "99", "2024", "2025", "pro", "master", "dev", "lab", "hub", "zone",
            str(random.randint(100, 999)), str(random.randint(10, 99)), "x", "gg"
        ]

        # 60% chance for combined username, 40% for standalone
        if random.random() > 0.4:
            u_name = f"{random.choice(first_parts)}{random.choice(second_parts)}"
        else:
            u_name = random.choice(first_parts)

        # If username already exists, add a number
        existing = db.query(User).filter(User.username == u_name).first()
        if existing:
            u_name = f"{u_name}_{random.randint(1, 999)}"

        user = User(
            email=f"{u_name}@example.com",
            username=u_name,
            hashed_password=get_password_hash("password123"),
            is_admin=False
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"Created fresh random user for post: {u_name}")
        return user

    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            email=f"{username}@example.com",
            username=username,
            hashed_password=get_password_hash("mcp_bot_password"),
            is_admin=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

def get_or_create_category(db, name="MCP News"):
    category = db.query(Category).filter(Category.name == name).first()
    if not category:
        category = Category(
            name=name,
            description="News and updates about the Model Context Protocol",
            # slug might be needed if update, but current model doesn't seem to enforce slug on creation based on file view, 
            # wait, let me check category.py again. It accepts name and description. It doesn't seem to have slug in the model definition I saw? 
            # Ah, seed_mcp_data.py used 'slug' in the dict but the model definition I saw in `backend/app/models/category.py` was:
            # id, name, description. 
            # Let me re-verify category.py content.
        )
        db.add(category)
        db.commit()
        db.refresh(category)
    return category

def create_post(title, content, random_author=False):
    db = SessionLocal()
    try:
        user = get_or_create_user(db, random_user=random_author)
        category = get_or_create_category(db)
        
        post = Post(
            title=title,
            content=content,
            user_id=user.id,
            category_id=category.id,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        db.add(post)
        db.commit()
        db.refresh(post)
        print(f"Successfully created post: {post.title} (ID: {post.id}) by {user.username}")
        return post.id
    except Exception as e:
        print(f"Error creating post: {e}", file=sys.stderr)
        db.rollback()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create a new MCP post")
    parser.add_argument("--file", help="Path to JSON file containing 'title' and 'content'")
    parser.add_argument("--title", help="Post title")
    parser.add_argument("--content", help="Post content")

    parser.add_argument("--random-author", action="store_true", help="Post as a random user instead of mcp_bot")

    args = parser.parse_args()

    title = args.title
    content = args.content

    if args.file:
        try:
            with open(args.file, 'r') as f:
                data = json.load(f)
                title = data.get('title', title)
                content = data.get('content', content)
        except Exception as e:
            print(f"Error reading file check: {e}", file=sys.stderr)
            sys.exit(1)

    if not title or not content:
        print("Error: Title and content are required (via arguments or file)", file=sys.stderr)
        sys.exit(1)

    create_post(title, content, random_author=args.random_author)
