-- Phase 1 branding + mailbox profile fields
ALTER TABLE `domains`
  ADD COLUMN `companyName` VARCHAR(191) NULL,
  ADD COLUMN `brandColor` VARCHAR(32) NULL,
  ADD COLUMN `logoDataUrl` LONGTEXT NULL;

ALTER TABLE `mailboxes`
  ADD COLUMN `jobTitle` VARCHAR(191) NULL,
  ADD COLUMN `department` VARCHAR(191) NULL,
  ADD COLUMN `phone` VARCHAR(191) NULL,
  ADD COLUMN `website` VARCHAR(191) NULL,
  ADD COLUMN `company` VARCHAR(191) NULL,
  ADD COLUMN `replyTo` VARCHAR(191) NULL,
  ADD COLUMN `timezone` VARCHAR(191) NULL,
  ADD COLUMN `language` VARCHAR(191) NULL,
  ADD COLUMN `signatureHtml` LONGTEXT NULL,
  ADD COLUMN `signatureText` LONGTEXT NULL,
  ADD COLUMN `avatarUrl` LONGTEXT NULL;
