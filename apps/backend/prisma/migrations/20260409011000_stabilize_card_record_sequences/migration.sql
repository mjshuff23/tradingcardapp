-- Create independent sequences for Prisma-compatible autoincrement behavior.
CREATE SEQUENCE IF NOT EXISTS "UserCard_id_seq";
CREATE SEQUENCE IF NOT EXISTS "UserWishlist_id_seq";

ALTER TABLE "UserCard"
  ALTER COLUMN "id" SET DEFAULT nextval('"UserCard_id_seq"'::regclass);

ALTER TABLE "UserWishlist"
  ALTER COLUMN "id" SET DEFAULT nextval('"UserWishlist_id_seq"'::regclass);

ALTER SEQUENCE "UserCard_id_seq" OWNED BY "UserCard"."id";
ALTER SEQUENCE "UserWishlist_id_seq" OWNED BY "UserWishlist"."id";

SELECT setval('"UserCard_id_seq"', COALESCE((SELECT MAX("id") FROM "UserCard"), 0) + 1, false);
SELECT setval('"UserWishlist_id_seq"', COALESCE((SELECT MAX("id") FROM "UserWishlist"), 0) + 1, false);

DROP SEQUENCE IF EXISTS "CardRecordIdSeq";
