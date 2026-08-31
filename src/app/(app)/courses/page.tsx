import { currentUserId } from "@/lib/auth";
import { getUserTimezone, loggedMinutes, weekSnapshot } from "@/lib/queries";
import { prettyDate, shiftIsoDate } from "@/lib/time";
import { PageHead } from "@/components/page-head";
import { CourseManager } from "@/components/course-manager";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const userId = await currentUserId();
  const tz = await getUserTimezone(userId);
  const snap = await weekSnapshot(userId, new Date(), tz);
  const logged = await loggedMinutes(userId, snap.mondayIso, shiftIsoDate(snap.mondayIso, 6));

  const rows = snap.courses.map((c) => {
    const t = snap.perCourse.get(c.id) ?? { planned: 0, done: 0 };
    return {
      id: c.id,
      name: c.name,
      code: c.code,
      color: c.color,
      focus: c.focus,
      groupFilter: c.groupFilter,
      planned: t.planned,
      done: t.done,
      logged: logged.get(c.id) ?? 0,
    };
  });

  return (
    <>
      <PageHead eyebrow={`Week of ${prettyDate(snap.mondayIso)}`} title="Hours logged this week" />
      <CourseManager rows={rows} />
    </>
  );
}
