#!/usr/bin/env python3
"""Isolated production-image/PostgreSQL checks. Uses synthetic data and removes its containers."""
import base64
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
    if not body:
        return None
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return body  # Gin's removed-route 404 is plain text.


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
    # Verify the two new upgrade migrations against legacy-shaped synthetic data.
    role_migration = (ROOT / 'api/db/migrations/0065_single_office_administrator.sql').read_text()
    sql("""CREATE SCHEMA retired_role_check; SET search_path TO retired_role_check;
        CREATE TABLE users (id BIGINT PRIMARY KEY, role TEXT, office_id BIGINT, password TEXT,
          first_name TEXT, last_name TEXT, department TEXT, is_active BOOLEAN, deleted_at TIMESTAMPTZ,
          updated_at TIMESTAMPTZ, token_version BIGINT NOT NULL DEFAULT 0);
        INSERT INTO users (id,role,office_id,password,is_active,token_version) VALUES
          (1,'technical_support',NULL,'support-preserved',true,3),
          (2,'office_manager',10,'manager-a-preserved',true,4),
          (3,'office_manager',20,'manager-b-preserved',false,8),
          (4,'office_manager',NULL,'unassigned-preserved',true,0),
          (5,'admin',10,'admin-preserved',true,2);
        """ + role_migration + role_migration + """
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM users WHERE role='office_manager')
             OR NOT EXISTS (SELECT 1 FROM users WHERE id=2 AND role='admin' AND office_id=10 AND password='manager-a-preserved' AND is_active AND token_version=5)
             OR NOT EXISTS (SELECT 1 FROM users WHERE id=3 AND role='admin' AND office_id=20 AND password='manager-b-preserved' AND NOT is_active AND token_version=9)
             OR NOT EXISTS (SELECT 1 FROM users WHERE id=4 AND role='admin' AND office_id IS NULL AND token_version=1)
             OR NOT EXISTS (SELECT 1 FROM users WHERE id=1 AND role='technical_support' AND token_version=3)
             OR NOT EXISTS (SELECT 1 FROM users WHERE id=5 AND role='admin' AND token_version=2)
          THEN RAISE EXCEPTION 'Role retirement changed scope/credentials/status or replay invalidated sessions twice'; END IF;
          BEGIN
            UPDATE users SET role='office_manager' WHERE id=5;
            RAISE EXCEPTION 'Retired role was allowed';
          EXCEPTION WHEN check_violation THEN NULL; END;
        END $$;
        DROP SCHEMA retired_role_check CASCADE;
        """)
    shared_migration = (ROOT / 'api/db/migrations/0066_shared_maquila_directory.sql').read_text()
    sql("""CREATE SCHEMA shared_factory_check; SET search_path TO shared_factory_check;
        CREATE TABLE organizations (id BIGINT PRIMARY KEY, kind TEXT, name TEXT, office_id BIGINT NOT NULL, deleted_at TIMESTAMPTZ);
        CREATE TABLE organization_clients (id BIGINT PRIMARY KEY, organization_id BIGINT, client_id BIGINT, employee_number TEXT);
        CREATE TABLE cases (id BIGINT PRIMARY KEY, maquila_id BIGINT, office_id BIGINT, employee_number TEXT, shift_name TEXT);
        INSERT INTO organizations VALUES (10,'maquila','Same factory',1,NULL),(11,'maquila','Same factory',2,NULL),(12,'constructora','Company',1,NULL);
        INSERT INTO organization_clients VALUES (1,10,100,'0001'),(2,11,200,'0002');
        INSERT INTO cases VALUES (1,10,1,'0001','Primero'),(2,11,2,'0002','Segundo');
        """ + shared_migration + shared_migration + """
        DO $$ BEGIN
          IF (SELECT COUNT(*) FROM organizations) <> 3
             OR (SELECT COUNT(*) FROM organizations WHERE kind='maquila' AND office_id IS NULL AND deleted_at IS NULL) <> 2
             OR NOT EXISTS (SELECT 1 FROM organizations WHERE id=10 AND legacy_office_id=1)
             OR NOT EXISTS (SELECT 1 FROM organizations WHERE id=11 AND legacy_office_id=2)
             OR NOT EXISTS (SELECT 1 FROM organizations WHERE id=12 AND office_id=1 AND legacy_office_id IS NULL)
             OR NOT EXISTS (SELECT 1 FROM organization_clients WHERE id=1 AND organization_id=10 AND employee_number='0001')
             OR NOT EXISTS (SELECT 1 FROM organization_clients WHERE id=2 AND organization_id=11 AND employee_number='0002')
             OR NOT EXISTS (SELECT 1 FROM cases WHERE id=1 AND maquila_id=10 AND office_id=1 AND employee_number='0001' AND shift_name='Primero')
             OR NOT EXISTS (SELECT 1 FROM cases WHERE id=2 AND maquila_id=11 AND office_id=2 AND employee_number='0002' AND shift_name='Segundo')
          THEN RAISE EXCEPTION 'Shared factory upgrade altered records, relationships or history'; END IF;
        END $$;
        DROP SCHEMA shared_factory_check CASCADE;
        """)
    print('PASS: role retirement preserves office/credentials/status and revokes sessions once; shared factory upgrade/replay preserves duplicate records, links and snapshots')

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
    # Shared self-profile fields are authoritative, private and read-only.
    last_login_before = sql('SELECT last_login FROM users WHERE id=1;')
    profile = request('GET', '/api/v1/profile?userID=2', token=token)
    assert profile['userID'] == '1' and profile['email'] == 'support@example.test'
    assert profile['role'] == 'technical_support' and profile['office'] is None and profile['officeId'] is None
    assert profile['createdAt'] and profile['lastLogin'] and profile['isActive']
    assert profile['department'] == 'IT' and profile['organizationInfo']['department'] == 'Tecnologías de la Información (IT)'
    assert profile['organizationInfo']['specialty'] is None
    assert profile['avatarPolicy']['maxBytes'] == 10 * 1024 * 1024
    assert not {'password', 'tokenVersion', 'personalAddress', 'stripeCustomerId'}.intersection(profile)
    assert sql('SELECT last_login FROM users WHERE id=1;') == last_login_before
    request('PATCH', '/api/v1/profile', {'avatarUrl': 'javascript:alert(1)'}, token, 400)
    request('PATCH', '/api/v1/profile', {'avatarUrl': 'https://example.test/photo.png'}, token)
    assert request('GET', '/api/v1/profile', token=token)['avatarUrl'] == 'https://example.test/photo.png'
    # Verify real multipart upload and protected local-avatar retrieval.
    png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jV+kAAAAASUVORK5CYII=')
    boundary = 'caf-photo-boundary'
    multipart = (f'--{boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="profile.png"\r\nContent-Type: image/png\r\n\r\n'.encode()
                 + png + f'\r\n--{boundary}--\r\n'.encode())
    upload = urllib.request.Request(base + '/api/v1/profile/avatar', method='POST', data=multipart,
             headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'multipart/form-data; boundary=' + boundary})
    with urllib.request.urlopen(upload, timeout=10) as response:
        assert response.status == 200
        avatar_path = json.load(response)['avatarUrl']
    assert avatar_path.startswith('/api/v1/avatar?v=')
    with urllib.request.urlopen(urllib.request.Request(base + avatar_path, headers={'Authorization': 'Bearer ' + token}), timeout=10) as response:
        assert response.read() == png and response.headers['Cache-Control'].startswith('private')
    request('PATCH', '/api/v1/profile', {'avatarUrl': ''}, token)
    assert request('GET', '/api/v1/profile', token=token)['avatarUrl'] == ''
    client = create_user('Client', 'client', offices[1])
    client_token = request('POST', '/api/v1/login', {'email': client['email'], 'password': PASSWORD})['token']
    client_profile = request('GET', '/api/v1/client/profile', token=client_token)
    assert client_profile['email'] == client['email'] and client_profile['phone'] == client['phone']
    assert client_profile['officeId'] == offices[1] and client_profile['avatarPolicy'] == profile['avatarPolicy']
    request('GET', '/api/v1/profile', token=client_token, expected=403)
    print('PASS: shared staff/client profile contract, privacy, read-only login date, photo upload, protected retrieval and removal')
    # Run the organization migration twice against the actual production schema.
    registry_migration = (ROOT / 'api/db/migrations/0063_client_organizations.sql').read_text()
    sql(registry_migration + registry_migration)
    admin_token = request('POST', '/api/v1/login', {'email': admin['email'], 'password': PASSWORD})['token']
    factory_data = {'kind': 'maquila', 'name': 'Maquila Uno'}
    factory = request('POST', '/api/v1/organizations', factory_data, admin_token, 201)
    request('POST', '/api/v1/organizations', factory_data, admin_token, 409)
    second_factory = request('POST', '/api/v1/organizations', {**factory_data, 'name': 'Maquila Dos'}, admin_token, 201)
    foreign_factory = request('POST', '/api/v1/organizations', {**factory_data, 'name': 'Compartida entre oficinas'}, token, 201)
    request('GET', f"/api/v1/organizations/{foreign_factory['id']}", token=admin_token)
    request('POST', '/api/v1/organizations', {**factory_data, 'name': 'Scope escape', 'officeId': offices[1]}, admin_token, 400)
    assert factory['officeId'] is None
    request('GET', '/api/v1/manager/users', token=token, expected=404)
    request('POST', '/api/v1/admin/users', {'firstName':'Retired','lastName':'Role','email':'retired-role@example.test','phone':'6561234567','role':'office_manager','officeId':offices[0],'password':PASSWORD}, token, 400)
    employee = create_user('Employee', 'client', offices[0])
    employment = {'employeeNumber': '000042', 'shiftName': 'Tercer turno', 'shiftStart': '22:00', 'shiftEnd': '06:00'}
    request('POST', f"/api/v1/organizations/{factory['id']}/clients", {'clientId': employee['id'], **employment}, admin_token)
    request('POST', '/api/v1/admin/cases', {'clientId': employee['id'], 'officeId': offices[0], 'title': 'Divorcios', 'category': 'Legal', 'description': 'Synthetic factory case'}, admin_token, 201)
    assert sql(f"SELECT employee_number || ':' || shift_start || ':' || shift_end FROM cases WHERE client_id={employee['id']};") == '000042:22:00:06:00'
    request('POST', f"/api/v1/organizations/{second_factory['id']}/clients", {'clientId': employee['id'], **employment, 'employeeNumber': '000099'}, admin_token)
    history = request('GET', f"/api/v1/organizations/{factory['id']}", token=admin_token)
    assert history['clientTotal'] == 1 and history['clients'][0]['historical']
    assert history['cases'][0]['employeeNumber'] == '000042'
    remote_employee = create_user('RemoteEmployee', 'client', offices[1])
    request('POST', f"/api/v1/organizations/{factory['id']}/clients", {'clientId': remote_employee['id'], **employment, 'employeeNumber':'000077'}, token)
    request('POST', '/api/v1/admin/cases', {'clientId': remote_employee['id'], 'officeId':offices[1], 'title':'Remote factory case', 'category':'Legal', 'description':'Synthetic second-office case'}, token, 201)
    local_detail = request('GET', f"/api/v1/organizations/{factory['id']}", token=admin_token)
    global_detail = request('GET', f"/api/v1/organizations/{factory['id']}", token=token)
    assert local_detail['clientTotal'] == 1 and local_detail['caseTotal'] == 1
    assert global_detail['clientTotal'] == 2 and global_detail['caseTotal'] == 2
    request('POST', f"/api/v1/organizations/{factory['id']}/clients", {'clientId':remote_employee['id'], **employment}, admin_token, 400)
    assert sql("SELECT count(*) FROM migrations WHERE version IN ('0065','0066');") == '2'

    contractor_data = {'kind': 'constructora', 'name': 'Constructora Uno', 'officeId': offices[0], 'legalRepresentative': 'Representante', 'legalAddress': 'Domicilio legal 123', 'boardPresident': 'Presidente', 'neighborhood': 'Centro'}
    contractor = request('POST', '/api/v1/organizations', contractor_data, admin_token, 201)
    second_contractor = request('POST', '/api/v1/organizations', {**contractor_data, 'name': 'Constructora Dos'}, admin_token, 201)
    assert contractor['accountClientId'] != second_contractor['accountClientId']
    before_duplicate = sql('SELECT count(*) FROM users;')
    request('POST', '/api/v1/organizations', {**contractor_data, 'name': 'Duplicate email', 'email': employee['email']}, admin_token, 409)
    assert sql('SELECT count(*) FROM users;') == before_duplicate
    assert sql("SELECT count(*) FROM users WHERE client_type='organization' AND email='';") == '2'
    company_id = contractor['accountClientId']
    request('POST', f"/api/v1/organizations/{contractor['id']}/clients", {'clientId': employee['id']}, admin_token)
    assert len(request('GET', f"/api/v1/client-organizations/{employee['id']}", token=admin_token)['data']) == 2
    before_direct = sql('SELECT count(*) FROM cases;')
    appointment_data = {'withoutCase': True, 'clientId': company_id, 'officeId': offices[0], 'staffId': admin['id'], 'title': 'Direct company appointment', 'startTime': '2030-01-07T10:00:00Z', 'endTime': '2030-01-07T11:00:00Z', 'timeZone': 'UTC', 'status': 'confirmed', 'category': 'General', 'department': 'General'}
    appointment = request('POST', '/api/v1/admin/appointments', appointment_data, admin_token, 201)
    assert sql('SELECT count(*) FROM cases;') == before_direct
    assert sql(f"SELECT case_id IS NULL FROM appointments WHERE id={appointment['id']};") == 't'
    request('POST', '/api/v1/admin/appointments', appointment_data, admin_token, 400)
    appointments = request('GET', f'/api/v1/admin/appointments?clientId={company_id}', token=admin_token)['data']
    assert len(appointments) == 1 and appointments[0]['client']['firstName'] == contractor['name']
    request('POST', '/api/v1/admin/cases', {'clientId': company_id, 'officeId': offices[0], 'title': 'Invalid', 'category': 'Legal'}, admin_token, 400)
    request('DELETE', f'/api/v1/admin/users/{company_id}', token=admin_token, expected=403)
    event = request('POST', '/api/v1/calendar/events', {'title': 'Company meeting', 'startTime': '2030-01-07T12:00:00Z', 'endTime': '2030-01-07T13:00:00Z', 'timeZone': 'UTC', 'relatedClientIds': [company_id, employee['id']], 'attendeeIds': []}, admin_token, 201)
    assert {link['clientId'] for link in event['relatedClients']} == {company_id, employee['id']}
    assert sql(f"SELECT count(*) FROM calendar_event_attendees WHERE user_id={company_id};") == '0'
    request('GET', '/api/v1/organizations?kind=constructora', token=client_token, expected=403)
    assert sql("SELECT count(*) FROM migrations WHERE version='0063';") == '1'
    print('PASS: PostgreSQL organization migration/replay, scoped directories, leading-zero IDs, overnight shifts, case history, shared company accounts, direct appointments and calendar links')
    support_profile_migration = (ROOT / 'api/db/migrations/0064_support_it_department.sql').read_text()
    sql("UPDATE users SET department='legal', specialty='general_practice' WHERE id=1;")
    sql(f"UPDATE users SET department='legal', specialty='family_law' WHERE id={admin['id']};")
    sql(support_profile_migration + support_profile_migration)
    assert sql("SELECT department || ':' || (specialty IS NULL)::text FROM users WHERE id=1;") == 'IT:true'
    assert sql(f"SELECT department || ':' || specialty FROM users WHERE id={admin['id']};") == 'legal:family_law'
    assert sql("SELECT count(*) FROM migrations WHERE version='0064';") == '1'
    print('PASS: IT support bootstrap, localized profile metadata and repeatable legacy profile correction preserve other users')
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
