import { ok, fail, parseJson } from "@/lib/api/response";
import { requireWebmailCredentials } from "@/services/webmail/session-store";
import {
  listFolders,
  createFolder,
  renameFolder,
  deleteFolder,
} from "@/services/webmail/mailbox";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET() {
  try {
    const creds = await requireWebmailCredentials();
    const folders = await listFolders(creds);
    return ok({ folders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status =
      typeof error === "object" && error && "status" in error
        ? Number((error as { status: number }).status)
        : 400;
    return fail(message, status || 400);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export async function POST(request: Request) {
  try {
    const creds = await requireWebmailCredentials();
    const body = createSchema.parse(await parseJson(request));
    const data = await createFolder(creds, body.name);
    return ok(data, undefined, "Folder created");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Create failed";
    const status =
      typeof error === "object" && error && "status" in error
        ? Number((error as { status: number }).status)
        : 400;
    return fail(message, status || 400);
  }
}

const renameSchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1).max(100),
});

export async function PATCH(request: Request) {
  try {
    const creds = await requireWebmailCredentials();
    const body = renameSchema.parse(await parseJson(request));
    const data = await renameFolder(creds, body.from, body.to);
    return ok(data, undefined, "Folder renamed");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rename failed";
    const status =
      typeof error === "object" && error && "status" in error
        ? Number((error as { status: number }).status)
        : 400;
    return fail(message, status || 400);
  }
}

const deleteSchema = z.object({
  path: z.string().trim().min(1),
});

export async function DELETE(request: Request) {
  try {
    const creds = await requireWebmailCredentials();
    const body = deleteSchema.parse(await parseJson(request));
    const data = await deleteFolder(creds, body.path);
    return ok(data, undefined, "Folder deleted");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    const status =
      typeof error === "object" && error && "status" in error
        ? Number((error as { status: number }).status)
        : 400;
    return fail(message, status || 400);
  }
}
