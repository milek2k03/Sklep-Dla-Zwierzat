-- Random fixed-length product IDs.
-- Run after 018_products_sku_default.sql.

create or replace function public.generate_product_sku()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  sku_length constant integer := 10;
  candidate text;
  random_bytes bytea;
  byte_index integer;
begin
  loop
    candidate := '';
    random_bytes := gen_random_bytes(sku_length);

    for byte_index in 0..(sku_length - 1) loop
      candidate := candidate || substr(
        alphabet,
        (get_byte(random_bytes, byte_index) % length(alphabet)) + 1,
        1
      );
    end loop;

    exit when not exists (
      select 1
      from public.products product
      where product.sku = candidate
    );
  end loop;

  return candidate;
end;
$$;

alter table public.products
  alter column sku set default public.generate_product_sku();
