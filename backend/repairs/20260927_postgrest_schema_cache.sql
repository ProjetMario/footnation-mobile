-- FOOTNATION incident: REST returns 503/PGRST002; schema-cache loading
-- repeatedly fails with SQLSTATE 57014 (statement timeout).
-- Observed authenticator timeout: 8s. Explicit approval required before execution.
-- User request timeouts (anon 3s / authenticated 8s) remain unchanged.
ALTER ROLE authenticator SET statement_timeout = '60s';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';

-- Verify REST health and a real sign-in after execution.
-- If existing pool connections keep the old setting, investigate the pool
-- before considering any separately approved service restart.
-- Rollback:
-- ALTER ROLE authenticator SET statement_timeout = '8s';
-- NOTIFY pgrst, 'reload config';
-- NOTIFY pgrst, 'reload schema';
