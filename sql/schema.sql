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

create index if not exists patients_status_idx on patients(status);
create index if not exists patients_created_at_idx on patients(created_at desc);
create index if not exists patients_test_date_idx on patients(test_date);
create index if not exists patients_arrival_date_idx on patients(arrival_date);
create index if not exists patients_adaptation_date_idx on patients(adaptation_date);
create index if not exists patients_name_idx on patients(lower(patient_name));
create index if not exists patients_phone_idx on patients(phone);

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
