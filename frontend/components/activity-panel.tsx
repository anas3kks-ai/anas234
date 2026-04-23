"use client";

import { useMemo } from "react";
import {
  Globe,
  Camera,
  Terminal,
  FileText,
  Mail,
  Brain,
  CheckCircle2,
  XCircle,
  Circle,
} from "lucide-react";

export type ActivityEvent =
  | {
      kind: "tool_call";
      id: string;
      name: string;
      args: Record<string, unknown>;
      createdAt: number;
    }
  | {
      kind: "tool_result";
      id: string;
      toolCallId: string;
      name: string;
      result: Record<string, unknown>;
      createdAt: number;
    }
  | {
      kind: "error";
      id: string;
      message: string;
      createdAt: number;
    };

type Paired = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: Record<string, unknown>;
  errored?: boolean;
  errorMessage?: string;
};

function toolIcon(name: string) {
  if (name === "browse_web") return Globe;
  if (name === "screenshot") return Camera;
  if (name === "run_code") return Terminal;
  if (name === "write_file" || name === "read_file" || name === "list_files")
    return FileText;
  if (name === "send_email") return Mail;
  if (name === "remember" || name === "recall") return Brain;
  return Circle;
}

export function ActivityPanel({
  events,
  streaming,
  status,
}: {
  events: ActivityEvent[];
  streaming: boolean;
  status: string;
}) {
  const paired = useMemo<Paired[]>(() => {
    const map = new Map<string, Paired>();
    const order: string[] = [];
    for (const e of events) {
      if (e.kind === "tool_call") {
        map.set(e.id, { id: e.id, name: e.name, args: e.args });
        order.push(e.id);
      } else if (e.kind === "tool_result") {
        const existing = map.get(e.toolCallId);
        if (existing) {
          existing.result = e.result;
          const r = e.result as { error?: unknown };
          if (r && typeof r === "object" && "error" in r && r.error) {
            existing.errored = true;
            existing.errorMessage = String(r.error);
          }
        }
      } else if (e.kind === "error") {
        const id = e.id;
        map.set(id, {
          id,
          name: "error",
          args: {},
          errored: true,
          errorMessage: e.message,
        });
        order.push(id);
      }
    }
    return order.map((id) => map.get(id)!).filter(Boolean);
  }, [events]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-4 border-b border-line">
        <div className="text-xs uppercase tracking-wider text-muted">Activity</div>
        <div className="text-sm mt-0.5">
          {streaming ? status || "working…" : paired.length > 0 ? "Completed" : "Idle"}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {paired.length === 0 && !streaming && (
          <div className="text-xs text-muted px-2 py-8 text-center">
            Tool runs will appear here in real time —<br />
            browser views, terminal output, files.
          </div>
        )}

        {paired.map((p) => (
          <ActivityCard key={p.id} entry={p} />
        ))}
      </div>
    </div>
  );
}

function ActivityCard({ entry }: { entry: Paired }) {
  const Icon = toolIcon(entry.name);
  const StatusIcon = entry.result
    ? entry.errored
      ? XCircle
      : CheckCircle2
    : Circle;

  return (
    <div className="rounded-xl border border-line bg-soft overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-line">
        <Icon className="w-4 h-4 text-accent" />
        <div className="text-sm font-medium flex-1">{entry.name}</div>
        <StatusIcon
          className={
            "w-4 h-4 " +
            (entry.errored
              ? "text-red-400"
              : entry.result
                ? "text-emerald-400"
                : "text-muted animate-pulse")
          }
        />
      </div>
      <div className="p-3 text-xs">
        <ArgPreview name={entry.name} args={entry.args} />
        {entry.result && <ResultPreview name={entry.name} result={entry.result} />}
        {entry.errorMessage && (
          <div className="mt-2 text-red-400 bg-red-500/10 rounded p-2 font-mono text-[11px]">
            {entry.errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}

function ArgPreview({
  name,
  args,
}: {
  name: string;
  args: Record<string, unknown>;
}) {
  if (Object.keys(args).length === 0) return null;
  if (name === "run_code") {
    const code = String(args.code ?? "");
    const lang = String(args.language ?? "");
    return (
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
          {lang}
        </div>
        <pre className="bg-bg border border-line rounded p-2 overflow-x-auto text-[11px] font-mono whitespace-pre-wrap break-all">
          {code}
        </pre>
      </div>
    );
  }
  if (name === "browse_web" || name === "screenshot") {
    return (
      <div className="text-muted break-all">
        → <a className="text-accent2 underline" href={String(args.url)} target="_blank" rel="noreferrer">{String(args.url)}</a>
      </div>
    );
  }
  if (name === "send_email") {
    return (
      <div className="space-y-1">
        <div><span className="text-muted">to:</span> {String(args.to)}</div>
        <div><span className="text-muted">subject:</span> {String(args.subject)}</div>
      </div>
    );
  }
  return (
    <pre className="bg-bg border border-line rounded p-2 overflow-x-auto text-[11px] font-mono whitespace-pre-wrap break-all">
      {JSON.stringify(args, null, 2)}
    </pre>
  );
}

function ResultPreview({
  name,
  result,
}: {
  name: string;
  result: Record<string, unknown>;
}) {
  if (result.error) return null; // errored handled elsewhere

  if (name === "screenshot" && typeof result.image_data_url === "string") {
    return (
      <div className="mt-2 rounded overflow-hidden border border-line">
        <img src={result.image_data_url} alt="screenshot" className="block w-full" />
      </div>
    );
  }

  if (name === "browse_web") {
    return (
      <div className="mt-2">
        <div className="text-[11px] text-muted mb-1">
          {String(result.title || "")}
        </div>
        <pre className="bg-bg border border-line rounded p-2 overflow-x-auto text-[11px] font-mono whitespace-pre-wrap max-h-48">
          {String(result.text || "").slice(0, 2000)}
        </pre>
      </div>
    );
  }

  if (name === "run_code") {
    const stdout = String(result.stdout || "");
    const stderr = String(result.stderr || "");
    const results = Array.isArray(result.results) ? result.results.join("\n") : "";
    return (
      <div className="mt-2 space-y-2">
        {stdout && (
          <pre className="bg-bg border border-line rounded p-2 text-[11px] font-mono whitespace-pre-wrap max-h-40 overflow-auto">
            {stdout}
          </pre>
        )}
        {stderr && (
          <pre className="bg-red-500/10 border border-red-500/30 text-red-300 rounded p-2 text-[11px] font-mono whitespace-pre-wrap max-h-32 overflow-auto">
            {stderr}
          </pre>
        )}
        {results && (
          <pre className="bg-bg border border-line rounded p-2 text-[11px] font-mono whitespace-pre-wrap max-h-32 overflow-auto">
            {results}
          </pre>
        )}
      </div>
    );
  }

  if (name === "list_files" && Array.isArray(result.entries)) {
    return (
      <ul className="mt-2 text-[11px] font-mono">
        {(result.entries as Array<{ name: string; type: string }>).map((e) => (
          <li key={e.name} className="text-muted">
            <span className={e.type === "dir" ? "text-accent2" : ""}>{e.name}</span>
            {e.type === "dir" ? "/" : ""}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <pre className="mt-2 bg-bg border border-line rounded p-2 overflow-x-auto text-[11px] font-mono whitespace-pre-wrap max-h-32">
      {JSON.stringify(result, null, 2).slice(0, 800)}
    </pre>
  );
}
