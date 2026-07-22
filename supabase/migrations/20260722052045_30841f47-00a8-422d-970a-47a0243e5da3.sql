
CREATE POLICY event_access_codes_no_public ON public.event_access_codes FOR SELECT USING (false);
CREATE POLICY event_access_attempts_no_public ON public.event_access_attempts FOR SELECT USING (false);
CREATE POLICY customer_sessions_no_public ON public.customer_sessions FOR SELECT USING (false);

REVOKE EXECUTE ON FUNCTION public.create_local_booking(UUID, UUID, TEXT, JSONB, TEXT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_stale_bookings() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.available_stock(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.available_stock(UUID, TEXT) TO anon, authenticated, service_role;
