-- Least-privilege login for the web app. Run once as the Postgres superuser, after the restore:
--   oc exec -i -n postgres pg-1 -c postgres -- psql -U postgres -d medemap -v ON_ERROR_STOP=1 -f - < openshift/db/app-role.sql
-- The owner role `medemap` keeps all DDL rights (migrations, restores) but cannot log in.
-- The app connects as `medemap_app`: read the data, and nothing else except appending log rows.
-- openshift/create-secrets.sh creates both roles and sets the password for medemap_app.

ALTER ROLE medemap NOLOGIN;

-- nobody but the two roles may even connect to this database
REVOKE ALL ON DATABASE medemap FROM PUBLIC;
GRANT CONNECT ON DATABASE medemap TO medemap, medemap_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- read access to the data schemas the app queries
GRANT USAGE ON SCHEMA medemap_aug, medemap_aug_v2, graphv2, public TO medemap_app;
GRANT SELECT ON ALL TABLES IN SCHEMA medemap_aug, medemap_aug_v2, graphv2 TO medemap_app;
GRANT SELECT ON public.user_profiles, public.globe_data TO medemap_app;

-- the one write the app makes: appending to the log table
-- (INSERT ... RETURNING id needs SELECT on that one column, but the log rows stay unreadable)
REVOKE SELECT ON medemap_aug.application_logs FROM medemap_app;
GRANT INSERT ON medemap_aug.application_logs TO medemap_app;
GRANT SELECT (id) ON medemap_aug.application_logs TO medemap_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA medemap_aug TO medemap_app;

-- tables created later by the owner (migrations) become readable too
ALTER DEFAULT PRIVILEGES FOR ROLE medemap IN SCHEMA medemap_aug, medemap_aug_v2, graphv2
  GRANT SELECT ON TABLES TO medemap_app;
