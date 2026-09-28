-- Technical security state, deliberately outside the business/audit entity model.
-- Never stores raw tokens, passwords, names or email addresses.
CREATE TABLE __auth_revocations (
  jti TEXT PRIMARY KEY NOT NULL CHECK(length(jti) = 36),
  expires_at INTEGER NOT NULL CHECK(typeof(expires_at) = 'integer' AND expires_at > 0)
);
--> statement-breakpoint
CREATE INDEX __auth_revocations_expiry_idx ON __auth_revocations(expires_at);
