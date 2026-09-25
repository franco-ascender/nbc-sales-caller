-- Corrects the original E.164 regex, whose escaped plus sign was persisted as a literal backslash.
alter table public.caller_phone_numbers drop constraint if exists caller_phone_numbers_phone_number_check;
alter table public.caller_phone_numbers add constraint caller_phone_numbers_phone_number_check
  check(phone_number ~ '^\+[1-9][0-9]{7,14}$');
