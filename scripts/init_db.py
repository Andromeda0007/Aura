import sys
sys.path.insert(0, ".")

from backend.app.core.database import init_db, engine
from backend.app.models import Base

def main():
    print("Initializing database...")
    
    Base.metadata.create_all(bind=engine)
    
    print("Database initialized successfully!")
    print("Tables created:")
    for table in Base.metadata.tables.keys():
        print(f"  - {table}")


if __name__ == "__main__":
    main()
