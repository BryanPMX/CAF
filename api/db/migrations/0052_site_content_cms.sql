-- 0052_site_content_cms.sql
-- CMS tables for managing marketing website content from the admin portal.
-- Four tables: site_content (key-value text), site_services, site_events, site_images.

-- Editable text content (hero titles, about text, footer text, etc.)
CREATE TABLE IF NOT EXISTS site_content (
    id SERIAL PRIMARY KEY,
    section VARCHAR(100) NOT NULL,
    content_key VARCHAR(100) NOT NULL,
    content_value TEXT NOT NULL DEFAULT '',
    content_type VARCHAR(50) DEFAULT 'text',
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    updated_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(section, content_key)
);

CREATE INDEX IF NOT EXISTS idx_site_content_section ON site_content(section);
CREATE INDEX IF NOT EXISTS idx_site_content_active ON site_content(is_active) WHERE is_active = true;

-- Services offered by the organization
CREATE TABLE IF NOT EXISTS site_services (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    details TEXT[],
    icon VARCHAR(100),
    image_url VARCHAR(512),
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    updated_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_services_active ON site_services(is_active, sort_order) WHERE is_active = true;

-- Public events for the marketing site
CREATE TABLE IF NOT EXISTS site_events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    location VARCHAR(255),
    image_url VARCHAR(512),
    is_active BOOLEAN DEFAULT true,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    updated_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_events_date ON site_events(event_date) WHERE is_active = true;

-- Gallery / carousel images
CREATE TABLE IF NOT EXISTS site_images (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    alt_text VARCHAR(255),
    image_url VARCHAR(512) NOT NULL,
    section VARCHAR(100) DEFAULT 'gallery',
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    updated_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_images_section ON site_images(section, sort_order) WHERE is_active = true;

-- Seed default content for key website sections
INSERT INTO site_content (section, content_key, content_value, content_type, sort_order) VALUES
    ('hero', 'title', 'Fortaleciendo Familias, Construyendo Comunidad', 'text', 1),
    ('hero', 'subtitle', 'Centro de Apoyo para la Familia A.C. brinda servicios legales, psicológicos y de asistencia social a familias que lo necesitan.', 'text', 2),
    ('hero', 'cta_primary', 'Contáctenos', 'text', 3),
    ('hero', 'cta_secondary', 'Nuestros Servicios', 'text', 4),
    ('about', 'title', 'Sobre Nosotros', 'text', 1),
    ('about', 'description', 'Somos una organización sin fines de lucro dedicada a fortalecer el núcleo familiar a través de servicios integrales de apoyo legal, psicológico y social. Desde nuestra fundación, hemos trabajado incansablemente para brindar esperanza y soluciones a las familias más vulnerables de nuestra comunidad.', 'html', 2),
    ('about', 'mission', 'Nuestra misión es brindar apoyo integral a familias en situación de vulnerabilidad, promoviendo su bienestar y desarrollo a través de servicios profesionales de calidad.', 'text', 3),
    ('about', 'vision', 'Ser la organización líder en el apoyo y fortalecimiento familiar en nuestra región, reconocida por la calidad de nuestros servicios y el impacto positivo en la comunidad.', 'text', 4),
    ('footer', 'copyright', '© 2025 Centro de Apoyo para la Familia A.C. Todos los derechos reservados.', 'text', 1),
    ('footer', 'privacy_text', 'Aviso de Privacidad', 'text', 2),
    ('contact', 'hours', 'Lunes a Viernes: 8:00 AM - 6:00 PM | Sábado: 9:00 AM - 2:00 PM', 'text', 1),
    ('contact', 'emergency', 'Línea de emergencia disponible 24/7 para casos urgentes.', 'text', 2)
ON CONFLICT (section, content_key) DO NOTHING;

-- Seed default services
INSERT INTO site_services (title, description, icon, sort_order) VALUES
    ('Asesoría Legal', 'Navegar el sistema legal puede ser abrumador. Nuestro equipo de abogados experimentados le brinda orientación clara y representación en una variedad de asuntos legales para proteger sus derechos y los de su familia.', 'balance-scale', 1),
    ('Apoyo Psicológico', 'La salud mental es fundamental para el bienestar familiar. Ofrecemos servicios de terapia y consejería para individuos, parejas y familias, en un ambiente seguro y confidencial.', 'brain', 2),
    ('Asistencia Social', 'Entendemos que los desafíos de la vida pueden ser complejos. Nuestros trabajadores sociales le ayudan a acceder a recursos comunitarios, programas de asistencia y redes de apoyo.', 'hands-helping', 3)
ON CONFLICT DO NOTHING;
