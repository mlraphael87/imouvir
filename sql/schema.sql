create table if not exists patients (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'documentacao_recebida',

  patient_name text not null,
  cpf text,
  sus_card text,
  birth_date date,
  phone text,
  email text,
  city text,
  state text,

  medical_request_date date,
  audiometry_date date,
  hearing_loss text,
  documentation_notes text,

  test_date timestamptz,
  audiologist_name text,
  test_result text,
  patient_approved boolean default false,

  order_date date,
  factory_order_number text,
  selected_payment_term_id bigint,
  payment_terms text,
  payment_description text,
  payment_code text,
  selected_device_product_id bigint,
  selected_accessory_product_ids bigint[] not null default '{}',
  accessory_items jsonb not null default '[]'::jsonb,
  device_side text default 'bilateral',
  device_brand text,
  device_model text,
  right_device_code text,
  left_device_code text,
  accessory_codes text,
  factory_value_cents integer default 0,
  patient_value_cents integer default 0,

  arrival_date date,
  adaptation_date timestamptz,
  notes text
);

create table if not exists catalog_products (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'modelo-pedido-uberlandia',
  source_sheet text not null,
  source_row integer not null,
  category text not null,
  item_kind text not null default 'accessory',
  description text not null,
  code text,
  unit_value_cents integer not null default 0,
  active boolean not null default true,
  unique(source, source_sheet, source_row)
);

create table if not exists payment_terms (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'modelo-pedido-uberlandia',
  source_sheet text not null,
  source_row integer not null,
  terms text not null,
  description text,
  code text,
  active boolean not null default true,
  unique(source, source_sheet, source_row)
);

alter table patients add column if not exists selected_payment_term_id bigint;
alter table patients add column if not exists payment_terms text;
alter table patients add column if not exists payment_description text;
alter table patients add column if not exists payment_code text;
alter table patients add column if not exists selected_device_product_id bigint;
alter table patients add column if not exists selected_accessory_product_ids bigint[] not null default '{}';
alter table patients add column if not exists accessory_items jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'patients_selected_payment_term_id_fkey'
  ) then
    alter table patients
      add constraint patients_selected_payment_term_id_fkey
      foreign key (selected_payment_term_id) references payment_terms(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'patients_selected_device_product_id_fkey'
  ) then
    alter table patients
      add constraint patients_selected_device_product_id_fkey
      foreign key (selected_device_product_id) references catalog_products(id) on delete set null;
  end if;
end;
$$;

create index if not exists patients_status_idx on patients(status);
create index if not exists patients_created_at_idx on patients(created_at desc);
create index if not exists patients_test_date_idx on patients(test_date);
create index if not exists patients_arrival_date_idx on patients(arrival_date);
create index if not exists patients_adaptation_date_idx on patients(adaptation_date);
create index if not exists patients_name_idx on patients(lower(patient_name));
create index if not exists patients_phone_idx on patients(phone);
create index if not exists patients_selected_device_product_id_idx on patients(selected_device_product_id);
create index if not exists catalog_products_kind_idx on catalog_products(item_kind, active);
create index if not exists catalog_products_category_idx on catalog_products(category);
create index if not exists catalog_products_description_idx on catalog_products(lower(description));
create index if not exists payment_terms_active_idx on payment_terms(active);

create or replace function set_patients_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_patients_updated_at on patients;
create trigger trg_patients_updated_at
before update on patients
for each row execute function set_patients_updated_at();

create or replace function set_catalog_products_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_catalog_products_updated_at on catalog_products;
create trigger trg_catalog_products_updated_at
before update on catalog_products
for each row execute function set_catalog_products_updated_at();

create or replace function set_payment_terms_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_payment_terms_updated_at on payment_terms;
create trigger trg_payment_terms_updated_at
before update on payment_terms
for each row execute function set_payment_terms_updated_at();
