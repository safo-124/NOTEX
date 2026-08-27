import { auth } from "@/lib/auth";
import { listCourses, listFiles } from "@/lib/queries";
import { storageConfigured } from "@/lib/storage";
import { PageHead } from "@/components/page-head";
import { FileManager } from "@/components/file-manager";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  const session = await auth();
  const userId = session!.user!.id as string;
  const [rows, courses] = await Promise.all([listFiles(userId), listCourses(userId)]);

  return (
    <>
      <PageHead eyebrow="Course materials" title="Files" />
      <FileManager
        rows={rows}
        courses={courses.map((c) => ({ id: c.id, name: c.name }))}
        storageReady={storageConfigured}
      />
    </>
  );
}
