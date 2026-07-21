/**
 * GLOBAL ORBIT MAIL — Database Seed (Phase 2B)
 * Run: npx tsx prisma/seed.ts
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { buildDnsRecordsForDomain } from "../lib/dns/records";

const prisma = new PrismaClient();

const PERMISSIONS = [
  ["admin:full", "Full admin access"],
  ["domain:read", "Read domains"],
  ["domain:write", "Write domains"],
  ["mailbox:read", "Read mailboxes"],
  ["mailbox:write", "Write mailboxes"],
  ["user:read", "Read users"],
  ["user:write", "Write users"],
  ["dns:read", "Read DNS"],
  ["dns:write", "Write DNS"],
  ["logs:read", "Read logs"],
  ["settings:read", "Read settings"],
  ["settings:write", "Write settings"],
  ["monitoring:read", "Read monitoring"],
] as const;

async function main() {
  for (const [key, name] of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, name, description: name },
      update: { name },
    });
  }

  const roles: { key: "SUPER_ADMIN" | "RESELLER" | "CUSTOMER" | "SUPPORT_STAFF" | "MAILBOX_USER"; name: string }[] = [
    { key: "SUPER_ADMIN", name: "Super Admin" },
    { key: "RESELLER", name: "Reseller" },
    { key: "CUSTOMER", name: "Customer" },
    { key: "SUPPORT_STAFF", name: "Support Staff" },
    { key: "MAILBOX_USER", name: "Mailbox User" },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { key: role.key },
      create: role,
      update: { name: role.name },
    });
  }

  const superRole = await prisma.role.findUniqueOrThrow({ where: { key: "SUPER_ADMIN" } });
  const adminPermission = await prisma.permission.findUniqueOrThrow({
    where: { key: "admin:full" },
  });
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: { roleId: superRole.id, permissionId: adminPermission.id },
    },
    create: { roleId: superRole.id, permissionId: adminPermission.id },
    update: {},
  });

  const org = await prisma.organization.upsert({
    where: { slug: "global-orbit" },
    create: {
      name: "GLOBAL ORBIT PVT. LTD.",
      slug: "global-orbit",
      type: "INTERNAL",
      status: "ACTIVE",
    },
    update: { name: "GLOBAL ORBIT PVT. LTD.", status: "ACTIVE" },
  });

  const passwordHash = await hash("OrbitAdmin!2026", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@theglobalorbit.com" },
    create: {
      email: "admin@theglobalorbit.com",
      name: "Super Admin",
      passwordHash,
      status: "ACTIVE",
      roleId: superRole.id,
      organizationId: org.id,
      twoFactorEnabled: false,
    },
    update: {
      passwordHash,
      status: "ACTIVE",
      roleId: superRole.id,
      organizationId: org.id,
    },
  });

  const settings = [
    {
      key: "company",
      value: {
        name: "GLOBAL ORBIT PVT. LTD.",
        supportEmail: "support@theglobalorbit.com",
        website: "https://theglobalorbit.com",
        timezone: "Asia/Kathmandu",
        language: "en",
      },
    },
    {
      key: "brand",
      value: {
        product: "GLOBAL ORBIT MAIL",
        primaryColor: "#2f6fed",
        accentColor: "#d4af37",
        logoPath: "/brand/logo.png",
      },
    },
    {
      key: "smtp",
      value: { host: "mail.theglobalorbit.com", port: 587, encryption: "STARTTLS" },
    },
    {
      key: "imap",
      value: { host: "mail.theglobalorbit.com", port: 993, encryption: "SSL/TLS" },
    },
    {
      key: "security",
      value: {
        passwordMinLength: 12,
        require2faForAdmins: true,
        sessionTimeoutMinutes: 720,
      },
    },
    {
      key: "appearance",
      value: {
        darkMode: "system",
      },
    },
  ] as const;

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: {
        organizationId_key: { organizationId: org.id, key: setting.key },
      },
      create: {
        organizationId: org.id,
        key: setting.key,
        value: setting.value,
      },
      update: { value: setting.value },
    });
  }

  // Seed one verified primary domain for platform bootstrap (real DB row, not demo array)
  let domain = await prisma.domain.findFirst({
    where: { name: "theglobalorbit.com", organizationId: org.id, deletedAt: null },
  });
  if (!domain) {
    domain = await prisma.domain.create({
      data: {
        name: "theglobalorbit.com",
        organizationId: org.id,
        status: "ACTIVE",
        sslStatus: "ACTIVE",
        dnsStatus: "VERIFIED",
        mailStatus: "ACTIVE",
        verifiedAt: new Date(),
      },
    });
    const records = buildDnsRecordsForDomain(domain.name).map((r) => ({
      ...r,
      domainId: domain!.id,
      status: "VERIFIED" as const,
    }));
    await prisma.dnsRecord.createMany({ data: records });
  }

  const existingMailbox = await prisma.mailbox.findFirst({
    where: {
      localPart: "admin",
      domainId: domain.id,
      deletedAt: null,
    },
  });
  if (!existingMailbox) {
    await prisma.mailbox.create({
      data: {
        localPart: "admin",
        domainId: domain.id,
        organizationId: org.id,
        displayName: "Platform Admin",
        status: "ACTIVE",
        passwordHash,
        quota: { create: { quotaMb: 10240, usedMb: 0 } },
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "system.seed",
      resource: "database",
      resourceId: org.id,
      metadata: { phase: "2B" },
    },
  });

  console.log("Seed complete");
  console.log("Admin login: admin@theglobalorbit.com / OrbitAdmin!2026");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
