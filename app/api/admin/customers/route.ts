import { ok, fail, created, parseJson } from "@/lib/api/response";
import { requireAdminActor, requireSuperAdminMutation } from "@/lib/api/actor";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit";
import { paginationSchema } from "@/lib/validations/admin";

const createCustomerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email(),
  company: z.string().trim().min(1).max(160),
  password: z.string().min(12).max(128),
  planKey: z.enum(["starter", "business", "enterprise"]),
  interval: z.enum(["MONTHLY", "YEARLY", "TWO_YEAR"]),
  activate: z.boolean().default(true),
  storageGb: z.coerce.number().int().min(1).max(10240).optional(),
});

function statusFor(message: string) {
  if (message === "Unauthorized") return 401;
  if (message.startsWith("Forbidden") || message === "Invalid CSRF token") return 403;
  if (message.includes("already exists")) return 409;
  return 400;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function GET(request: Request) {
  try {
    await requireAdminActor();
    const { searchParams } = new URL(request.url);
    const parsed = paginationSchema.parse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    });

    const where = {
      deletedAt: null,
      role: { key: "CUSTOMER" as const },
      ...(parsed.search
        ? {
            OR: [
              { email: { contains: parsed.search, mode: "insensitive" as const } },
              { name: { contains: parsed.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        include: {
          organization: {
            include: {
              subscriptions: {
                include: { plan: true },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (parsed.page - 1) * parsed.pageSize,
        take: parsed.pageSize,
      }),
    ]);

    return ok({
      items: rows.map((u) => {
        const sub = u.organization?.subscriptions[0] ?? null;
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          status: u.status,
          organizationId: u.organizationId,
          organizationName: u.organization?.name ?? null,
          organizationStatus: u.organization?.status ?? null,
          planKey: sub?.plan.key ?? null,
          planName: sub?.plan.name ?? null,
          interval: sub?.interval ?? null,
          subscriptionStatus: sub?.status ?? null,
          currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
          createdAt: u.createdAt.toISOString(),
        };
      }),
      total,
      page: parsed.page,
      pageSize: parsed.pageSize,
      hasMore: parsed.page * parsed.pageSize < total,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list customers";
    return fail(message, statusFor(message));
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSuperAdminMutation(request);
    const body = createCustomerSchema.parse(await parseJson(request));
    const email = body.email.toLowerCase().trim();

    const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (existing) throw new Error("An account with this email already exists");

    const role = await prisma.role.findUnique({ where: { key: "CUSTOMER" } });
    if (!role) throw new Error("Customer role is not seeded");

    const plan = await prisma.plan.findUnique({ where: { key: body.planKey } });
    if (!plan) throw new Error("Plan not found");

    const baseSlug = slugify(body.company);
    let slug = baseSlug || "customer";
    let n = 0;
    while (await prisma.organization.findUnique({ where: { slug } })) {
      n += 1;
      slug = `${baseSlug}-${n}`;
    }

    const passwordHash = await hashPassword(body.password);
    const now = new Date();
    const periodEnd = new Date(now);
    if (body.interval === "MONTHLY") periodEnd.setMonth(periodEnd.getMonth() + 1);
    else if (body.interval === "YEARLY") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setFullYear(periodEnd.getFullYear() + 2);

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: body.company,
          slug,
          type: "CUSTOMER",
          status: body.activate ? "ACTIVE" : "TRIAL",
        },
      });

      const user = await tx.user.create({
        data: {
          email,
          name: body.name,
          passwordHash,
          status: body.activate ? "ACTIVE" : "INVITED",
          roleId: role.id,
          organizationId: organization.id,
          emailVerified: now,
        },
      });

      const subscription = await tx.subscription.create({
        data: {
          organizationId: organization.id,
          ownerId: user.id,
          planId: plan.id,
          status: body.activate ? "ACTIVE" : "INCOMPLETE",
          interval: body.interval,
          currentPeriodStart: body.activate ? now : null,
          currentPeriodEnd: body.activate ? periodEnd : null,
        },
      });

      if (body.storageGb) {
        await tx.systemSetting.create({
          data: {
            organizationId: organization.id,
            key: "storage.limitGb",
            value: { storageGb: body.storageGb },
          },
        });
      }

      return { user, organization, subscription };
    });

    await writeAudit({
      actorId: actor.sub,
      action: "customer.create",
      resource: "user",
      resourceId: result.user.id,
      status: "SUCCESS",
      newValue: {
        email,
        planKey: body.planKey,
        interval: body.interval,
        activated: body.activate,
      },
    });

    return created(
      {
        id: result.user.id,
        email: result.user.email,
        organizationId: result.organization.id,
        subscriptionId: result.subscription.id,
        activated: body.activate,
      },
      body.activate ? "Customer created and activated" : "Customer created (pending activation)",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create customer";
    return fail(message, statusFor(message));
  }
}
