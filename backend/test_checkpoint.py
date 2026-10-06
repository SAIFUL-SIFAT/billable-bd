import os
import django# type: ignore[assignment]

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
django.setup()

from apps.accounts.models import User
from apps.clients.models import Client, Project
from django.db import IntegrityError# type: ignore[assignment]
import traceback

def run():
    print("\n--- Day 2 Checkpoint Test ---")
    
    # 1. Setup a test user and client
    user, _ = User.objects.get_or_create(email='test@billable.local')
    client, _ = Client.objects.get_or_create(owner=user, name='Test Client', country='BD', default_currency='BDT')# type: ignore[assignment]
    
    # 2. Try to create an hourly project with NO hourly rate
    print("Attempting to create an hourly project with no hourly rate...")
    try:
        Project.objects.create(# type: ignore[assignment]
            owner=user,
            client=client,
            name='Invalid Hourly Project',
            billing_type='hourly',
            currency='BDT',
            hourly_rate=None,  # Intentionally missing!
            fixed_price=None
        )
        print("❌ FAIL: The project was created successfully. The constraint is NOT being enforced by MySQL.")
    except IntegrityError as e:
        print("✅ SUCCESS: Caught IntegrityError!")
        print(f"Error message from MySQL: {e}")
        print("\nWhich layer rejected it? -> MySQL rejected it (enforcing the CHECK constraint).")

if __name__ == '__main__':
    run()
