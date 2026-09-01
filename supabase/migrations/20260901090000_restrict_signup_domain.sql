-- Only dashelectric.co addresses may create an account. Enforced as a
-- BEFORE INSERT trigger on auth.users so it can't be bypassed by calling
-- the auth API directly (client-side validation is UX only).
CREATE OR REPLACE FUNCTION public.enforce_email_domain()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email NOT ILIKE '%@dashelectric.co' THEN
    RAISE EXCEPTION 'Only @dashelectric.co email addresses can sign up.';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER enforce_email_domain_before_insert
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.enforce_email_domain();
