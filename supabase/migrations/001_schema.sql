-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================
-- WAREHOUSES & SITES
-- ========================
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse VARCHAR(20) NOT NULL,
  site VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  address TEXT,
  currency VARCHAR(10) DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse, site)
);

-- ========================
-- ROLES & USERS
-- ========================
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse VARCHAR(20) NOT NULL,
  site VARCHAR(20) NOT NULL,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_super_user BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse, site, code)
);

CREATE TABLE wms_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse VARCHAR(20) NOT NULL,
  site VARCHAR(20) NOT NULL,
  auth_user_id UUID UNIQUE,
  email VARCHAR(200) UNIQUE NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  role_id UUID REFERENCES roles(id),
  is_active BOOLEAN DEFAULT true,
  default_warehouse VARCHAR(20),
  default_site VARCHAR(20),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse VARCHAR(20) NOT NULL,
  site VARCHAR(20) NOT NULL,
  user_id UUID NOT NULL REFERENCES wms_users(id) ON DELETE CASCADE,
  module VARCHAR(50) NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse, site, user_id, module)
);

-- ========================
-- ITEM MASTER
-- ========================
CREATE TABLE item_master (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse VARCHAR(20) NOT NULL,
  site VARCHAR(20) NOT NULL,
  item_code VARCHAR(50) NOT NULL,
  description VARCHAR(200) NOT NULL,
  category VARCHAR(100),
  uom VARCHAR(20) DEFAULT 'EA',
  weight DECIMAL(10,3),
  length DECIMAL(10,3),
  width DECIMAL(10,3),
  height DECIMAL(10,3),
  is_serialized BOOLEAN DEFAULT false,
  is_lot_tracked BOOLEAN DEFAULT false,
  min_stock DECIMAL(10,3) DEFAULT 0,
  max_stock DECIMAL(10,3),
  reorder_point DECIMAL(10,3),
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse, site, item_code)
);

-- ========================
-- LOCATION MASTER
-- ========================
CREATE TABLE location_master (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse VARCHAR(20) NOT NULL,
  site VARCHAR(20) NOT NULL,
  location_code VARCHAR(50) NOT NULL,
  zone VARCHAR(50),
  aisle VARCHAR(20),
  bay VARCHAR(20),
  level VARCHAR(20),
  position VARCHAR(20),
  location_type VARCHAR(50) DEFAULT 'STORAGE',
  max_weight DECIMAL(10,3),
  max_volume DECIMAL(10,3),
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse, site, location_code)
);

-- ========================
-- CUSTOMERS & SUPPLIERS
-- ========================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse VARCHAR(20) NOT NULL,
  site VARCHAR(20) NOT NULL,
  customer_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(200),
  contact_person VARCHAR(200),
  credit_limit DECIMAL(15,2),
  payment_terms VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse, site, customer_code)
);

CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse VARCHAR(20) NOT NULL,
  site VARCHAR(20) NOT NULL,
  supplier_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(200),
  contact_person VARCHAR(200),
  payment_terms VARCHAR(50),
  lead_time_days INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse, site, supplier_code)
);

-- ========================
-- GOODS RECEIPT (INBOUND)
-- ========================
CREATE TABLE goods_receipt_header (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse VARCHAR(20) NOT NULL,
  site VARCHAR(20) NOT NULL,
  gr_number VARCHAR(50) NOT NULL,
  gr_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id UUID REFERENCES suppliers(id),
  supplier_reference VARCHAR(100),
  status VARCHAR(20) DEFAULT 'DRAFT',
  notes TEXT,
  total_lines INTEGER DEFAULT 0,
  received_by UUID,
  received_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse, site, gr_number),
  CHECK (status IN ('DRAFT','CONFIRMED','RECEIVED','CANCELLED'))
);

CREATE TABLE goods_receipt_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse VARCHAR(20) NOT NULL,
  site VARCHAR(20) NOT NULL,
  gr_id UUID NOT NULL REFERENCES goods_receipt_header(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  item_id UUID NOT NULL REFERENCES item_master(id),
  expected_qty DECIMAL(10,3) DEFAULT 0,
  received_qty DECIMAL(10,3) DEFAULT 0,
  location_id UUID REFERENCES location_master(id),
  lot_number VARCHAR(100),
  serial_number VARCHAR(100),
  expiry_date DATE,
  unit_cost DECIMAL(15,4),
  status VARCHAR(20) DEFAULT 'PENDING',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (status IN ('PENDING','RECEIVED','REJECTED'))
);

-- ========================
-- SALES ORDERS (OUTBOUND)
-- ========================
CREATE TABLE sales_order_header (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse VARCHAR(20) NOT NULL,
  site VARCHAR(20) NOT NULL,
  so_number VARCHAR(50) NOT NULL,
  so_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID REFERENCES customers(id),
  customer_reference VARCHAR(100),
  status VARCHAR(20) DEFAULT 'DRAFT',
  priority VARCHAR(10) DEFAULT 'NORMAL',
  ship_to_address TEXT,
  requested_date DATE,
  notes TEXT,
  total_lines INTEGER DEFAULT 0,
  picked_by UUID,
  picked_at TIMESTAMPTZ,
  shipped_by UUID,
  shipped_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse, site, so_number),
  CHECK (status IN ('DRAFT','CONFIRMED','PICKING','PICKED','SHIPPED','CANCELLED')),
  CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT'))
);

CREATE TABLE sales_order_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse VARCHAR(20) NOT NULL,
  site VARCHAR(20) NOT NULL,
  so_id UUID NOT NULL REFERENCES sales_order_header(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  item_id UUID NOT NULL REFERENCES item_master(id),
  ordered_qty DECIMAL(10,3) NOT NULL,
  picked_qty DECIMAL(10,3) DEFAULT 0,
  shipped_qty DECIMAL(10,3) DEFAULT 0,
  location_id UUID REFERENCES location_master(id),
  lot_number VARCHAR(100),
  serial_number VARCHAR(100),
  unit_price DECIMAL(15,4),
  status VARCHAR(20) DEFAULT 'PENDING',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (status IN ('PENDING','PICKED','SHIPPED','CANCELLED'))
);

-- ========================
-- STOCK
-- ========================
CREATE TABLE stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse VARCHAR(20) NOT NULL,
  site VARCHAR(20) NOT NULL,
  item_id UUID NOT NULL REFERENCES item_master(id),
  location_id UUID NOT NULL REFERENCES location_master(id),
  lot_number VARCHAR(100),
  serial_number VARCHAR(100),
  quantity DECIMAL(10,3) DEFAULT 0,
  reserved_qty DECIMAL(10,3) DEFAULT 0,
  last_movement_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse, site, item_id, location_id, lot_number, serial_number)
);

CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse VARCHAR(20) NOT NULL,
  site VARCHAR(20) NOT NULL,
  movement_type VARCHAR(30) NOT NULL,
  reference_type VARCHAR(30),
  reference_id UUID,
  reference_number VARCHAR(50),
  item_id UUID NOT NULL REFERENCES item_master(id),
  from_location_id UUID REFERENCES location_master(id),
  to_location_id UUID REFERENCES location_master(id),
  quantity DECIMAL(10,3) NOT NULL,
  lot_number VARCHAR(100),
  serial_number VARCHAR(100),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (movement_type IN ('RECEIPT','SHIPMENT','TRANSFER','ADJUSTMENT','STOCKTAKE'))
);

-- ========================
-- STOCK TAKING
-- ========================
CREATE TABLE stock_taking_header (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse VARCHAR(20) NOT NULL,
  site VARCHAR(20) NOT NULL,
  st_number VARCHAR(50) NOT NULL,
  st_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description VARCHAR(200),
  status VARCHAR(20) DEFAULT 'OPEN',
  zone_filter VARCHAR(50),
  confirmed_by UUID,
  confirmed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse, site, st_number),
  CHECK (status IN ('OPEN','IN_PROGRESS','CONFIRMED','CANCELLED'))
);

CREATE TABLE stock_taking_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse VARCHAR(20) NOT NULL,
  site VARCHAR(20) NOT NULL,
  st_id UUID NOT NULL REFERENCES stock_taking_header(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  item_id UUID NOT NULL REFERENCES item_master(id),
  location_id UUID NOT NULL REFERENCES location_master(id),
  system_qty DECIMAL(10,3) DEFAULT 0,
  counted_qty DECIMAL(10,3),
  variance DECIMAL(10,3),
  lot_number VARCHAR(100),
  serial_number VARCHAR(100),
  status VARCHAR(20) DEFAULT 'PENDING',
  notes TEXT,
  counted_by UUID,
  counted_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (status IN ('PENDING','COUNTED','CONFIRMED'))
);

-- ========================
-- TRANSPORT ORDERS (for future RF)
-- ========================
CREATE TABLE transport_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse VARCHAR(20) NOT NULL,
  site VARCHAR(20) NOT NULL,
  to_number VARCHAR(50) NOT NULL,
  to_type VARCHAR(30) NOT NULL,
  reference_type VARCHAR(30),
  reference_id UUID,
  reference_number VARCHAR(50),
  status VARCHAR(20) DEFAULT 'OPEN',
  assigned_to UUID REFERENCES wms_users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse, site, to_number),
  CHECK (status IN ('OPEN','IN_PROGRESS','COMPLETED','CANCELLED'))
);

-- ========================
-- SEQUENCES FOR DOCUMENT NUMBERS
-- ========================
CREATE TABLE document_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse VARCHAR(20) NOT NULL,
  site VARCHAR(20) NOT NULL,
  doc_type VARCHAR(30) NOT NULL,
  prefix VARCHAR(10),
  last_number INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse, site, doc_type)
);

-- Function to get next document number
CREATE OR REPLACE FUNCTION get_next_doc_number(p_warehouse VARCHAR, p_site VARCHAR, p_doc_type VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_prefix VARCHAR;
  v_next INTEGER;
BEGIN
  INSERT INTO document_sequences (warehouse, site, doc_type, prefix, last_number)
  VALUES (p_warehouse, p_site, p_doc_type, p_doc_type, 0)
  ON CONFLICT (warehouse, site, doc_type) DO NOTHING;

  UPDATE document_sequences
  SET last_number = last_number + 1, updated_at = NOW()
  WHERE warehouse = p_warehouse AND site = p_site AND doc_type = p_doc_type
  RETURNING prefix, last_number INTO v_prefix, v_next;

  RETURN v_prefix || '-' || LPAD(v_next::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function for SQL query tool
CREATE OR REPLACE FUNCTION execute_select(query TEXT)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query || ') t' INTO result;
  RETURN COALESCE(result, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================
-- INDEXES
-- ========================
CREATE INDEX idx_item_master_ws ON item_master(warehouse, site);
CREATE INDEX idx_location_master_ws ON location_master(warehouse, site);
CREATE INDEX idx_customers_ws ON customers(warehouse, site);
CREATE INDEX idx_suppliers_ws ON suppliers(warehouse, site);
CREATE INDEX idx_gr_header_ws ON goods_receipt_header(warehouse, site);
CREATE INDEX idx_so_header_ws ON sales_order_header(warehouse, site);
CREATE INDEX idx_stock_ws ON stock(warehouse, site);
CREATE INDEX idx_stock_item ON stock(item_id);
CREATE INDEX idx_stock_movements_ws ON stock_movements(warehouse, site);
CREATE INDEX idx_stock_movements_ref ON stock_movements(reference_type, reference_id);

-- ========================
-- SEED DATA
-- ========================
INSERT INTO warehouses (code, name, address) VALUES ('WH001', 'Main Warehouse', '123 Warehouse St, City');
INSERT INTO sites (warehouse, site, name, currency) VALUES ('WH001', 'SITE01', 'Main Company', 'USD');
INSERT INTO roles (warehouse, site, code, name, is_super_user) VALUES ('WH001', 'SITE01', 'SUPER', 'Super User', true);
INSERT INTO roles (warehouse, site, code, name, is_super_user) VALUES ('WH001', 'SITE01', 'MANAGER', 'Warehouse Manager', false);
INSERT INTO roles (warehouse, site, code, name, is_super_user) VALUES ('WH001', 'SITE01', 'OPERATOR', 'Warehouse Operator', false);
INSERT INTO roles (warehouse, site, code, name, is_super_user) VALUES ('WH001', 'SITE01', 'IT', 'IT Team', false);

INSERT INTO document_sequences (warehouse, site, doc_type, prefix) VALUES
  ('WH001', 'SITE01', 'GR', 'GR'),
  ('WH001', 'SITE01', 'SO', 'SO'),
  ('WH001', 'SITE01', 'ST', 'ST'),
  ('WH001', 'SITE01', 'TO', 'TO');

INSERT INTO location_master (warehouse, site, location_code, zone, aisle, bay, level, position, location_type) VALUES
  ('WH001', 'SITE01', 'REC-01', 'RECEIVING', 'REC', '01', '01', '01', 'RECEIVING'),
  ('WH001', 'SITE01', 'A-01-01-01', 'A', 'A', '01', '01', '01', 'STORAGE'),
  ('WH001', 'SITE01', 'A-01-01-02', 'A', 'A', '01', '01', '02', 'STORAGE'),
  ('WH001', 'SITE01', 'A-01-02-01', 'A', 'A', '01', '02', '01', 'STORAGE'),
  ('WH001', 'SITE01', 'B-01-01-01', 'B', 'B', '01', '01', '01', 'STORAGE'),
  ('WH001', 'SITE01', 'SHIP-01', 'SHIPPING', 'SHIP', '01', '01', '01', 'SHIPPING');
