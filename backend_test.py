import requests
import sys
from datetime import datetime
import json
import os

class SuruAhaiAPITester:
    def __init__(self, base_url="http://127.0.0.1:8001"):
        self.base_url = base_url
        self.token = None
        self.admin_token = None
        self.mitra_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, use_token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if use_token:
            headers['Authorization'] = f'Bearer {use_token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Response: {error_data}")
                except:
                    print(f"   Response: {response.text}")
                self.failed_tests.append(f"{name}: Expected {expected_status}, got {response.status_code}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append(f"{name}: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health endpoint"""
        return self.run_test("Health Check", "GET", "api/health", 200)

    def test_seed_data(self):
        """Test seed data creation"""
        return self.run_test("Seed Data", "POST", "api/seed", 200)

    def test_get_categories(self):
        """Test getting service categories"""
        return self.run_test("Get Categories", "GET", "api/services/categories/list", 200)

    def test_get_services(self):
        """Test getting services"""
        return self.run_test("Get Services", "GET", "api/services", 200)

    def test_user_registration(self):
        """Test user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        user_data = {
            "name": f"Test User {timestamp}",
            "email": f"testuser{timestamp}@test.com",
            "phone": f"081234{timestamp}",
            "password": "testpass123",
            "role": "USER"
        }
        success, response = self.run_test("User Registration", "POST", "api/auth/register", 200, user_data)
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            return True, response
        return success, response

    def test_mitra_registration(self):
        """Test mitra registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        mitra_data = {
            "name": f"Test Mitra {timestamp}",
            "email": f"testmitra{timestamp}@test.com",
            "phone": f"081234{timestamp}",
            "password": "testpass123",
            "role": "MITRA"
        }
        success, response = self.run_test("Mitra Registration", "POST", "api/auth/register", 200, mitra_data)
        if success and 'token' in response:
            self.mitra_token = response['token']
            self.mitra_id = response['user']['id']
            return True, response
        return success, response

    def test_admin_login(self):
        """Test admin login"""
        admin_data = {
            "email": "admin@suruahai.com",
            "password": "admin123"
        }
        success, response = self.run_test("Admin Login", "POST", "api/auth/login", 200, admin_data)
        if success and 'token' in response:
            self.admin_token = response['token']
            return True, response
        return success, response

    def test_user_login(self):
        """Test user login with registered user"""
        if hasattr(self, 'user_email'):
            login_data = {
                "email": self.user_email,
                "password": "testpass123"
            }
            return self.run_test("User Login", "POST", "api/auth/login", 200, login_data)
        else:
            print("⚠️  Skipping user login - no registered user")
            return True, {}

    def test_get_user_profile(self):
        """Test getting user profile"""
        if self.token:
            return self.run_test("Get User Profile", "GET", "api/auth/me", 200, use_token=self.token)
        else:
            print("⚠️  Skipping profile test - no token")
            return True, {}

    def test_get_wallet(self):
        """Test getting user wallet"""
        if self.token:
            return self.run_test("Get User Wallet", "GET", "api/user/wallet", 200, use_token=self.token)
        else:
            print("⚠️  Skipping wallet test - no token")
            return True, {}

    def test_mitra_dashboard(self):
        """Test mitra dashboard"""
        if self.mitra_token:
            return self.run_test("Mitra Dashboard", "GET", "api/mitra/dashboard", 200, use_token=self.mitra_token)
        else:
            print("⚠️  Skipping mitra dashboard - no mitra token")
            return True, {}

    def test_admin_dashboard(self):
        """Test admin dashboard"""
        if self.admin_token:
            return self.run_test("Admin Dashboard", "GET", "api/admin/dashboard", 200, use_token=self.admin_token)
        else:
            print("⚠️  Skipping admin dashboard - no admin token")
            return True, {}

    def test_get_mitra_list(self):
        """Test getting mitra list"""
        return self.run_test("Get Mitra List", "GET", "api/mitra/list", 200)

def main():
    print("🚀 Starting SuruAhai API Tests")
    print("=" * 50)

    api_base_url = os.environ.get("API_BASE_URL", "http://127.0.0.1:8001")
    tester = SuruAhaiAPITester(base_url=api_base_url)
    
    # Basic API tests
    tester.test_health_check()
    tester.test_seed_data()
    tester.test_get_categories()
    tester.test_get_services()
    
    # Authentication tests
    tester.test_user_registration()
    tester.test_mitra_registration()
    tester.test_admin_login()
    
    # Authenticated endpoint tests
    tester.test_get_user_profile()
    tester.test_get_wallet()
    tester.test_mitra_dashboard()
    tester.test_admin_dashboard()
    tester.test_get_mitra_list()
    
    # Results summary
    print("\n" + "=" * 50)
    print(f"📊 Test Summary:")
    print(f"   Tests run: {tester.tests_run}")
    print(f"   Tests passed: {tester.tests_passed}")
    print(f"   Tests failed: {tester.tests_run - tester.tests_passed}")
    
    if tester.failed_tests:
        print(f"\n❌ Failed tests:")
        for failed in tester.failed_tests:
            print(f"   - {failed}")
    
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"\n✅ Success rate: {success_rate:.1f}%")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())