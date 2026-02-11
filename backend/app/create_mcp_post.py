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
        # Always create a new random user for variety as requested by user
        import string
        def generate_random_string(length=8):
            return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))
        
        u_name = f"user_{generate_random_string()}"
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
