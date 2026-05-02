-- Migration: add_leads_and_tokens
-- Apply manually via Supabase SQL Editor or psql if prisma migrate dev fails

CREATE TABLE "CampaignToken" (
  "id"        TEXT NOT NULL,
  "slug"      TEXT NOT NULL,
  "campanha"  TEXT NOT NULL,
  "ativo"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignToken_slug_key" ON "CampaignToken"("slug");

CREATE TABLE "Lead" (
  "id"             TEXT NOT NULL,
  "nome"           TEXT NOT NULL,
  "email"          TEXT NOT NULL,
  "telefone"       TEXT NOT NULL,
  "desejaMelhorar" TEXT NOT NULL,
  "tokenId"        TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadAnalise" (
  "id"           TEXT NOT NULL,
  "leadId"       TEXT NOT NULL,
  "imageUrl"     TEXT NOT NULL,
  "resultado"    JSONB NOT NULL,
  "emailEnviado" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadAnalise_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeadAnalise_leadId_key" ON "LeadAnalise"("leadId");

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tokenId_fkey"
  FOREIGN KEY ("tokenId") REFERENCES "CampaignToken"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeadAnalise" ADD CONSTRAINT "LeadAnalise_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
