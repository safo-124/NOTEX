/**
 * Exam preparation planner.
 *
 * The weekly template stays the source of truth for WHEN you study; this only
 * decides WHAT each dated block is spent on once an exam is close. Pure: no
 * database, no clock, so the same inputs always give the same plan.
 *
 * The rule, per exam:
 *   - it wants `need` minutes: its prep target less what the timer already
 *     logged for that course inside the prep window;
 *   - it may use blocks from `prepDays` before the exam up to a sleep buffer
 *     before it starts, so the night before a 09:00 exam is not a deep block;
 *   - its pace line spreads `need` evenly over the block time in that window.
 *
 * Walking the blocks in time order, a block goes to an exam that is behind its
 * pace line, or whose window is closing; of those, the one that needs the
 * largest share of its remaining block time wins. A block no exam needs keeps
 * its usual course. Missing a night leaves an exam further behind, so the next
 * plan catches up on its own, and a target that cannot fit shows up as a
 * shortfall instead of a silent gap.
 */

export const DEFAULT_PREP_HOURS = 20;
export const DEFAULT_PREP_DAYS = 14;
/** No block may end closer than this to the start of an exam it prepares for. */
export const SLEEP_BUFFER_HOURS = 8;

export type PlanSlot = {
  blockId: string;
  dateIso: string;
  startTime: string;
  endTime: string;
  minutes: number;
  startsAt: Date;
  endsAt: Date;
  /** The course the weekly template gives this block. */
  courseId: string | null;
};

export type PlanExam = {
  id: string;
  courseId: string;
  title: string;
  startsAt: Date;
  prepMinutes: number;
  prepDays: number;
  /** Timer minutes already logged for this course inside the prep window. */
  loggedMinutes: number;
};

export type ExamProgress = {
  examId: string;
  windowStart: Date;
  /** Block minutes the window offers, before other exams compete for them. */
  capacityMinutes: number;
  needMinutes: number;
  plannedMinutes: number;
  shortfallMinutes: number;
};

export type PlannedSlot = PlanSlot & { examId: string | null };

export function planExamPrep(slots: PlanSlot[], exams: PlanExam[]) {
  const ordered = [...slots].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const byStart = [...exams].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  // Exams whose windows overlap compete for the same blocks, so an even pace
  // for each can still leave one short at the end. When that happens, the
  // short exam paces itself faster from the start and the plan is redone.
  // A handful of passes settles it; the best one is kept.
  const boost = new Map<string, number>();
  let best = pass(ordered, byStart, boost);
  for (let i = 0; i < 6 && total(best.progress) > 0; i++) {
    for (const p of best.progress) boost.set(p.examId, (boost.get(p.examId) ?? 0) + p.shortfallMinutes);
    const next = pass(ordered, byStart, boost);
    if (total(next.progress) < total(best.progress)) best = next;
  }
  return best;
}

const total = (progress: ExamProgress[]) => progress.reduce((sum, p) => sum + p.shortfallMinutes, 0);

function pass(ordered: PlanSlot[], exams: PlanExam[], boost: Map<string, number>) {
  const state = exams.map((exam) => {
    const windowStart = new Date(exam.startsAt.getTime() - exam.prepDays * 86400_000);
    const cutoff = new Date(exam.startsAt.getTime() - SLEEP_BUFFER_HOURS * 3600_000);
    const fits = (s: PlanSlot) => s.startsAt >= windowStart && s.endsAt <= cutoff;
    const need = Math.max(0, exam.prepMinutes - exam.loggedMinutes);
    return {
      exam,
      windowStart,
      fits,
      need,
      pace: need + (boost.get(exam.id) ?? 0),
      capacity: ordered.filter(fits).reduce((sum, s) => sum + s.minutes, 0),
      seen: 0,
      planned: 0,
    };
  });

  const plan: PlannedSlot[] = [];
  for (const slot of ordered) {
    let best: (typeof state)[number] | null = null;
    let bestPressure = 0;

    for (const s of state) {
      if (!s.fits(slot)) continue;
      const left = s.capacity - s.seen;
      s.seen += slot.minutes;
      const remaining = s.need - s.planned;
      if (remaining <= 0) continue;

      // Where the pace line says this exam should be by the end of this block.
      const ideal = s.capacity > 0 ? Math.min(s.need, (s.pace * s.seen) / s.capacity) : s.need;
      // Share of the exam's remaining block time it still needs. At or near 1
      // the window is closing and every block counts.
      const pressure = remaining / left;
      // Half a block of lag is the threshold: less than that and the block is
      // better spent on the course it normally belongs to.
      const behind = ideal - s.planned >= slot.minutes / 2;
      if ((behind || pressure >= 0.9) && pressure > bestPressure) {
        best = s;
        bestPressure = pressure;
      }
    }

    if (best) best.planned += slot.minutes;
    plan.push({ ...slot, examId: best ? best.exam.id : null });
  }

  const progress: ExamProgress[] = state.map((s) => ({
    examId: s.exam.id,
    windowStart: s.windowStart,
    capacityMinutes: s.capacity,
    needMinutes: s.need,
    plannedMinutes: s.planned,
    shortfallMinutes: Math.max(0, s.need - s.planned),
  }));

  return { slots: plan, progress };
}
