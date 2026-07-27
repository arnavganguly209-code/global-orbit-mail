import { OrbitMailApp } from "@/features/webmail/orbit-mail-app";

export default async function MailMessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const uid = Number(id);
  return <OrbitMailApp initialUid={Number.isFinite(uid) ? uid : null} />;
}
