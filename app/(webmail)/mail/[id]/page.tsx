import { OrbitMailApp } from "@/features/webmail/orbit-mail-app";

export default async function MailMessagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const uid = Number(id);
  const folderRaw = sp.folder;
  const folder =
    typeof folderRaw === "string" && folderRaw.trim() ? folderRaw.trim() : null;
  return (
    <OrbitMailApp
      initialUid={Number.isFinite(uid) ? uid : null}
      initialFolder={folder}
    />
  );
}
