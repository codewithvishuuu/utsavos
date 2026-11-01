import { useEffect, useRef, useState } from "react";

import { api } from "../api/client";
import type { PlanTask } from "../api/types";
import { daysBetween, formatDate } from "../lib/format";
import { useIdempotencyMutation } from "../lib/idempotency";
import { ErrorAlert } from "./ErrorAlert";

const STATUSES = ["todo", "in_progress", "done", "cancelled"];

const STATUS_LABELS: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled"
};

export function TasksPanel({
  eventId,
  eventDate,
  tasks,
  dependencies,
  onChanged
}: {
  eventId: string;
  eventDate: string;
  tasks: PlanTask[];
  dependencies: { predecessor_id: string; successor_id: string }[];
  onChanged: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(eventDate);
  const [predecessor, setPredecessor] = useState("");
  const [successor, setSuccessor] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const mutation = useIdempotencyMutation(`event:${eventId}:tasks`);

  const taskNames = new Map(tasks.map((task) => [task.id, task.title]));

  useEffect(() => {
    setDueDate(eventDate);
  }, [eventDate]);

  async function addTask(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setError("");
    setBusy(true);
    try {
      const payload = {
        title,
        due_date: dueDate,
        status: "todo",
        offset_days: daysBetween(eventDate, dueDate)
      };
      await api.tasks.create(eventId, payload, mutation.keyFor(payload));
      mutation.clear();
      setTitle("");
      await onChanged();
    } catch (caught) {
      setError(mutation.errorMessage(caught, "Could not add the task"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function updateStatus(taskId: string, status: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setError("");
    setBusy(true);
    try {
      await api.tasks.update(eventId, taskId, { status });
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the task");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function addDependency(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    setError("");
    if (!predecessor || !successor) {
      setError("Choose both tasks.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      await api.dependencies.create(eventId, predecessor, successor);
      setPredecessor("");
      setSuccessor("");
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add the dependency");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="tasks-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="tasks-heading"
            className="font-serif-editorial text-2xl leading-tight text-[#12100E] sm:text-3xl"
          >
            Timeline, tasks and dependencies
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#4A433E]">
            Work backwards from the event date. Task order cannot form a loop; the server checks
            before saving. Locked tasks are fixed by the plan.
          </p>
        </div>
        <span className="rounded-full bg-[#181512]/5 px-3 py-1 font-mono-code text-[10px] uppercase tracking-[0.12em] text-[#4A433E]">
          {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
        </span>
      </div>

      {tasks.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-[#181512]/15 bg-[#FAF6F0] px-4 py-5 text-sm leading-relaxed text-[#4A433E]">
          No tasks yet. Add the first milestone below and give it a due date.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-[#181512]/10 text-sm" aria-label="Tasks">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="font-medium text-[#12100E]">{task.title}</span>
                {task.is_locked && (
                  <span className="rounded-full bg-[#181512]/5 px-2 py-0.5 font-mono-code text-[9px] uppercase tracking-[0.1em] text-[#6E655F]">
                    Locked
                  </span>
                )}
              </span>
              <span className="flex items-center gap-3 text-[#6E655F]">
                <span className="whitespace-nowrap font-mono-code text-[11px] uppercase tracking-[0.06em]">
                  {formatDate(task.due_date)}
                </span>
                <select
                  className="input min-h-0 w-auto py-1.5 text-xs"
                  aria-label={`Status for ${task.title}`}
                  value={task.status}
                  disabled={busy}
                  onChange={(event) => updateStatus(task.id, event.target.value)}
                >
                  {STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {STATUS_LABELS[value] ?? value}
                    </option>
                  ))}
                </select>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 border-t border-[#181512]/10 pt-5">
        <h3 className="font-mono-code text-[10px] uppercase tracking-[0.16em] text-[#6E655F]">
          Add a task
        </h3>
        <form
          className="mt-2 grid gap-3 sm:grid-cols-4"
          onSubmit={addTask}
          aria-label="Add task"
        >
          <div>
            <label className="label" htmlFor="task-title">
              Task title
            </label>
            <input
              id="task-title"
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="task-due-date">
              Task due date
            </label>
            <input
              id="task-due-date"
              className="input"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              required
            />
          </div>
          <button className="btn self-end sm:col-span-2" disabled={busy}>
            Add task
          </button>
        </form>
      </div>

      <div className="mt-5">
        <h3 className="font-mono-code text-[10px] uppercase tracking-[0.16em] text-[#6E655F]">
          Link task order
        </h3>
        <form
          className="mt-2 grid gap-3 sm:grid-cols-3"
          onSubmit={addDependency}
          aria-label="Add task dependency"
        >
          <div>
            <label className="label" htmlFor="task-predecessor">
              Predecessor
            </label>
            <select
              id="task-predecessor"
              className="input"
              value={predecessor}
              onChange={(event) => setPredecessor(event.target.value)}
            >
              <option value="">Choose predecessor</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="task-successor">
              Successor
            </label>
            <select
              id="task-successor"
              className="input"
              value={successor}
              onChange={(event) => setSuccessor(event.target.value)}
            >
              <option value="">Choose successor</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </div>
          <button className="btn self-end" disabled={busy || tasks.length < 2}>
            Add dependency
          </button>
        </form>
      </div>

      {dependencies.length > 0 && (
        <ul className="mt-4 space-y-1 text-xs text-[#6E655F]" aria-label="Dependencies">
          {dependencies.map((dependency) => (
            <li key={`${dependency.predecessor_id}-${dependency.successor_id}`}>
              {taskNames.get(dependency.predecessor_id) ?? "Task"} must finish before{" "}
              {taskNames.get(dependency.successor_id) ?? "task"}.
            </li>
          ))}
        </ul>
      )}
      <ErrorAlert message={error} />
    </section>
  );
}
