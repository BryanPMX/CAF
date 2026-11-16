#!/usr/bin/env python3
"""Isolated production-image/PostgreSQL checks. Uses synthetic data and removes its containers."""
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request
import uuid

IMAGE = os.environ.get('CAF_TEST_API_IMAGE', 'caf-api:support-review')
PREFIX = 'caf-support-test-' + uuid.uuid4().hex[:8]
NETWORK, DATABASE, API = PREFIX + '-net', PREFIX + '-db', PREFIX + '-api'
PASSWORD = 'Synthetic-Container-Password123!'
ROOT = Path(__file__).resolve().parent.parent


def docker(*args, input=None):
    return subprocess.check_output(['docker', *args], input=input, text=True, stderr=subprocess.STDOUT).strip()


def wait_for(check, description):
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        try:
            if check():
                return
        except (OSError, subprocess.CalledProcessError):
            pass
        time.sleep(0.5)
    raise AssertionError('Timed out: ' + description)


def sql(statement):
    return docker('exec', '-i', DATABASE, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'caf_test', '-d', 'caf_test', '-At', input=statement)


def request(method, path, data=None, token=None, expected=200):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(base + path, method=method, headers=headers,
                                 data=json.dumps(data).encode() if data is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            status, body = response.status, response.read().decode()
    except urllib.error.HTTPError as response:
        status, body = response.code, response.read().decode()
    assert status == expected, f'{method} {path}: {status}, expected {expected}: {body}'
    return json.loads(body) if body else None


try:
    docker('network', 'create', NETWORK)
    docker('run', '-d', '--name', DATABASE, '--network', NETWORK, '--tmpfs', '/var/lib/postgresql/data',
           '-e', 'POSTGRES_USER=caf_test', '-e', 'POSTGRES_DB=caf_test', '-e', 'POSTGRES_PASSWORD=' + PASSWORD,
           'postgres:15-alpine')
    wait_for(lambda: docker('exec', DATABASE, 'pg_isready', '-U', 'caf_test') and True, 'PostgreSQL ready')
    # Exercise the upgrade twice, including the disabled historical default.
    migration = (ROOT / 'api/db/migrations/0062_protected_technical_support.sql').read_text()
    sql("""CREATE SCHEMA migration_check; SET search_path TO migration_check;
        CREATE TABLE users (id BIGINT PRIMARY KEY, role VARCHAR(50), email TEXT, password TEXT,
                            office_id BIGINT, is_active BOOLEAN, updated_at TIMESTAMPTZ);
        INSERT INTO users VALUES (1, 'admin', 'customized@example.test', 'preserved-hash', 1, false, NOW()),
                                 (18, 'executive_director', 'ceo@example.test', 'ceo-hash', 1, true, NOW()),
                                 (2, 'admin', 'office@example.test', 'office-hash', 1, true, NOW());
        """ + migration + migration + """
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM users WHERE id=1 AND role='technical_support' AND office_id IS NULL
                         AND email='customized@example.test' AND password='preserved-hash' AND is_active=false AND token_version=0)
             OR NOT EXISTS (SELECT 1 FROM users WHERE id=18 AND role='executive_director' AND office_id=1)
             OR NOT EXISTS (SELECT 1 FROM users WHERE id=2 AND role='admin' AND office_id=1)
          THEN RAISE EXCEPTION 'Migration altered credentials, account status, or unrelated roles'; END IF;
          BEGIN
            INSERT INTO users (id,role) VALUES (99,'technical_support');
            RAISE EXCEPTION 'Duplicate support role was allowed';
          EXCEPTION WHEN unique_violation THEN NULL; END;
        END $$;
        DROP SCHEMA migration_check CASCADE;
        """)
    print('PASS: migration preserves credentials/status, leaves other accounts intact, is repeatable, and prevents duplicate support')
    docker('run', '-d', '--name', API, '--network', NETWORK, '-p', '127.0.0.1::8080',
           '-e', 'NODE_ENV=production', '-e', 'DB_HOST=' + DATABASE, '-e', 'DB_PORT=5432',
           '-e', 'DB_USER=caf_test', '-e', 'DB_NAME=caf_test', '-e', 'DB_PASSWORD=' + PASSWORD,
           '-e', 'DB_SSLMODE=disable', '-e', 'JWT_SECRET=Synthetic-Container-JWT-Secret-At-Least-32-Characters',
           '-e', 'CONTACT_API_SHARED_SECRET=Synthetic-Container-Contact-Secret-At-Least-32-Characters',
           '-e', 'BOOTSTRAP_ADMIN_EMAIL=support@example.test', '-e', 'BOOTSTRAP_ADMIN_PASSWORD=' + PASSWORD,
           '-e', 'RATE_LIMIT_REQUESTS=1000', '-e', 'AWS_EC2_METADATA_DISABLED=true', IMAGE)
    address = docker('port', API, '8080/tcp').splitlines()[0]
    base = 'http://' + address
    wait_for(lambda: urllib.request.urlopen(base + '/health', timeout=2).status == 200, 'API healthy')
    support = request('POST', '/api/v1/login', {'email': 'support@example.test', 'password': PASSWORD})
    assert support['user']['role'] == 'technical_support' and support['user']['id'] == 1
    token = support['token']
    offices = []
    for name in ['Office A', 'Office B']:
        result = request('POST', '/api/v1/admin/offices', {'name': name}, token, 201)
        offices.append(result.get('data', result)['id'])
    def create_user(name, role, office=None):
        payload = {'firstName': name, 'lastName': 'Synthetic', 'email': name.lower() + '@example.test',
                   'role': role, 'phone': '6561234567', 'password': PASSWORD}
        if office:
            payload['officeId'] = office
        return request('POST', '/api/v1/admin/users', payload, token, 201)
    ceo = create_user('CEO', 'executive_director')
    admin = create_user('Admin', 'admin', offices[0])
    ceo_login = request('POST', '/api/v1/login', {'email': ceo['email'], 'password': PASSWORD})
    body = {key: ceo[key] for key in ['firstName', 'lastName', 'email', 'role', 'phone']}
    body['password'] = 'Synthetic-Updated-Container-Password456!'
    request('PATCH', f"/api/v1/admin/users/{ceo['id']}", body, ceo_login['token'], 403)
    request('PATCH', f"/api/v1/admin/users/{ceo['id']}", body, token)
    request('GET', '/api/v1/profile', token=ceo_login['token'], expected=401)
    request('GET', '/api/v1/admin/users', token=ceo_login['token'], expected=401)
    request('POST', '/api/v1/login', {'email': ceo['email'], 'password': PASSWORD}, expected=401)
    request('POST', '/api/v1/login', {'email': ceo['email'], 'password': body['password']})
    for suffix in ['', '/permanent']:
        request('DELETE', '/api/v1/admin/users/1' + suffix, token=token, expected=403)
    request('PATCH', '/api/v1/admin/users/1', {**body, 'role': 'admin', 'officeId': offices[0]}, token, 403)
    assert {office['id'] for office in request('GET', '/api/v1/admin/offices', token=token)}.issuperset(offices)
    assert len(request('GET', '/api/v1/admin/users', token=token)['data']) == 3
    credential_before = sql('SELECT password FROM users WHERE id=1;')
    docker('restart', API)
    base = 'http://' + docker('port', API, '8080/tcp').splitlines()[0]
    wait_for(lambda: urllib.request.urlopen(base + '/health', timeout=2).status == 200, 'restarted API healthy')
    assert sql('SELECT password FROM users WHERE id=1;') == credential_before
    assert sql("SELECT COUNT(*) FROM users WHERE role='technical_support';") == '1'
    request('POST', '/api/v1/login', {'email': 'support@example.test', 'password': PASSWORD})
    assert sql("SELECT COUNT(*) FROM migrations WHERE version='0062';") == '1'
    print('PASS: production Docker startup/migrations, support bootstrap, all-office access, password reset, JWT invalidation, delete/demotion protection and restart persistence')
except Exception:
    try:
        print(docker('logs', '--tail', '40', API))
    except subprocess.CalledProcessError:
        pass
    raise
finally:
    for name in [API, DATABASE]:
        subprocess.run(['docker', 'rm', '-f', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(['docker', 'network', 'rm', NETWORK], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
