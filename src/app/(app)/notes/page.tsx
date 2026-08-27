import { auth } from "@/lib/auth";
import { getUserTimezone, listCourses, searchNotes } from "@/lib/queries";
import { studyClock } from "@/lib/time";
import { PageHead } from "@/components/page-head";
import { NotesBrowser } from "@/components/notes-browser";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const session = await auth();
  const userId = session!.user!.id as string;
  const tz = await getUserTimezone(userId);

  const [notes, courses] = await Promise.all([searchNotes(userId, ""), listCourses(userId)]);
  const clock = studyClock(new Date(), tz);

  return (
    <>
      <PageHead eyebrow={`${notes.length} note${notes.length === 1 ? "" : "s"}`} title="Notes" />
      <NotesBrowser
        notes={notes}
        courses={courses.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
        todayIso={clock.dateIso}
      />
    </>
  );
}
